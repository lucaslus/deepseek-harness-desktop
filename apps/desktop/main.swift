// DSH desktop shell (MVP): a native macOS window around `dsh web`.
//
// Responsibilities are deliberately tiny — the Node harness owns everything:
//   1. Locate a usable Node runtime (never bundled; prompt to install when absent).
//   2. Spawn the host (`node apps/cli/lib/bin.js web --port 0`, or `pnpm dsh web`).
//   3. Parse the `dsh web: http://127.0.0.1:<port>` readiness line.
//   4. Show the GUI in a WKWebView; tear the host down on quit.
import AppKit
import WebKit

let appDisplayName = "DeepSeek Harness"

// MARK: - Runtime detection

struct NodeRuntime {
    let executablePath: String
    let version: String
}

/// GUI apps inherit a minimal PATH; ask the user's login shell for the real one.
func loginShellPATH() -> String? {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/bin/zsh")
    process.arguments = ["-lc", "printf %s \"$PATH\""]
    let stdout = Pipe()
    process.standardOutput = stdout
    process.standardError = Pipe()
    do { try process.run() } catch { return nil }
    let deadline = Date().addingTimeInterval(8)
    while process.isRunning && Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.1))
    }
    if process.isRunning {
        process.terminate()
        return nil
    }
    let text = String(data: stdout.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines)
    return text?.isEmpty == true ? nil : text
}

func searchDirectories() -> [String] {
    var dirs: [String] = []
    var seen = Set<String>()
    func add(_ entries: [String]) {
        for entry in entries where !entry.isEmpty && seen.insert(entry).inserted {
            dirs.append(entry)
        }
    }
    add((ProcessInfo.processInfo.environment["PATH"] ?? "").split(separator: ":").map(String.init))
    add((loginShellPATH() ?? "").split(separator: ":").map(String.init))
    add(["/opt/homebrew/bin", "/usr/local/bin"])
    return dirs
}

func findExecutable(_ name: String) -> String? {
    let fm = FileManager.default
    for dir in searchDirectories() {
        let candidate = (dir as NSString).appendingPathComponent(name)
        if fm.isExecutableFile(atPath: candidate) { return candidate }
    }
    return nil
}

func runCaptured(_ executable: String, arguments: [String], cwd: String? = nil) -> (status: Int32, text: String)? {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    if let cwd { process.currentDirectoryURL = URL(fileURLWithPath: cwd) }
    let stdout = Pipe()
    process.standardOutput = stdout
    process.standardError = Pipe()
    do { try process.run() } catch { return nil }
    let deadline = Date().addingTimeInterval(8)
    while process.isRunning && Date() < deadline {
        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    if process.isRunning {
        process.terminate()
        return nil
    }
    let text = String(data: stdout.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    return (process.terminationStatus, text.trimmingCharacters(in: .whitespacesAndNewlines))
}

/// Repository engines contract: `node ^22.19.0 || >=24.0.0`.
func nodeVersionSatisfies(_ raw: String) -> Bool {
    var version = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if version.hasPrefix("v") { version.removeFirst() }
    let parts = version.split(separator: ".").compactMap { Int($0) }
    guard let major = parts.first, parts.count >= 2 else { return false }
    if major == 22 { return parts[1] >= 19 }
    return major >= 24
}

func detectNode() -> NodeRuntime? {
    let executable = findExecutable("node")
    guard let executable else { return nil }
    guard let result = runCaptured(executable, arguments: ["-v"]), result.status == 0 else { return nil }
    return NodeRuntime(executablePath: executable, version: result.text)
}

// MARK: - Repository location

func resolveRepositoryRoot() -> String? {
    let fm = FileManager.default
    func valid(_ root: String) -> Bool {
        fm.fileExists(atPath: (root as NSString).appendingPathComponent("apps/cli/package.json"))
    }
    if let override = ProcessInfo.processInfo.environment["DSH_REPO"], valid(override) {
        return override
    }
    // The bundle lives at <repo>/apps/desktop/build/DSH.app when built in-tree.
    if let bundlePath = Bundle.main.bundlePath as NSString? {
        var candidate = bundlePath.deletingLastPathComponent
        for _ in 0..<6 {
            if valid(candidate) { return candidate }
            let parent = (candidate as NSString).deletingLastPathComponent
            if parent == candidate { break }
            candidate = parent
        }
    }
    return nil
}

// MARK: - Title bar theme bridge

/// Mirrors the Web GUI's active theme into the native chrome: the transparent
/// title bar takes the sidebar fill so the left edge reads as one surface, and
/// the window appearance follows the resolved light/dark theme.
final class ThemeBridge: NSObject, WKScriptMessageHandler {
    weak var window: NSWindow?
    weak var webView: WKWebView?

    /// Injected at document start; reports the resolved design tokens whenever
    /// the theme presenter rewrites them (`body[data-ds-dark-theme]`, inline
    /// alias tokens) or the OS scheme flips under the `system` preference.
    static let observerScript = """
    (function () {
      var send = function () {
        var body = document.body;
        if (!body || !window.webkit) return;
        var cs = getComputedStyle(body);
        var sidebar = cs.getPropertyValue('--dsw-specific-sidebar-fill').trim();
        var base = cs.getPropertyValue('--dsw-alias-bg-base').trim();
        if (!sidebar || !base) return;
        window.webkit.messageHandlers.dshTheme.postMessage({
          sidebar: sidebar,
          base: base,
          dark: body.hasAttribute('data-ds-dark-theme'),
        });
      };
      var scheduled = false;
      var schedule = function () {
        if (scheduled) return;
        scheduled = true;
        setTimeout(function () { scheduled = false; send(); }, 50);
      };
      if (document.readyState === 'complete') { send(); } else { window.addEventListener('load', send); }
      new MutationObserver(schedule).observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'data-ds-dark-theme', 'class'],
      });
    })();
    """

    /// Desktop-only sidebar rhythm. Center the wordmark visually between the
    /// traffic lights and the New Session control without changing the Web UI.
    static let desktopLayoutScript = """
    document.documentElement.style.setProperty('--dsh-sidebar-logo-row-content-offset', '12px');
    """

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "dshTheme",
              let body = message.body as? [String: Any],
              let sidebar = body["sidebar"] as? String,
              let base = body["base"] as? String,
              let dark = body["dark"] as? Bool else { return }
        DispatchQueue.main.async {
            guard let window = self.window else { return }
            if let color = Self.parseColor(sidebar) { window.backgroundColor = color }
            if let color = Self.parseColor(base) { self.webView?.underPageBackgroundColor = color }
            window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
        }
    }

    /// Accepts the token serializations the theme system emits: `rgb(...)`,
    /// `rgba(...)`, and `#rrggbb`.
    static func parseColor(_ raw: String) -> NSColor? {
        let text = raw.trimmingCharacters(in: .whitespaces)
        if text.hasPrefix("#") {
            var hex = UInt64()
            let digits = String(text.dropFirst())
            guard digits.count == 6, Scanner(string: digits).scanHexInt64(&hex) else { return nil }
            return NSColor(
                srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1,
            )
        }
        guard text.hasPrefix("rgb"),
              let open = text.firstIndex(of: "("),
              let close = text.lastIndex(of: ")") else { return nil }
        let inner = text[text.index(after: open)..<close]
        let parts = inner.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
        guard parts.count >= 3 else { return nil }
        return NSColor(srgbRed: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255, alpha: 1)
    }
}

// MARK: - App delegate

/// Window that restores the double-click action over a full-size transparent title bar.
final class DesktopWindow: NSWindow {
    override func sendEvent(_ event: NSEvent) {
        guard event.type == .leftMouseDown,
              isTitleBarInteractionPoint(event.locationInWindow) else {
            super.sendEvent(event)
            return
        }
        if event.clickCount == 2 {
            performTitleBarDoubleClickAction()
            return
        }
        if event.clickCount == 1 {
            dragWindow(from: event)
            return
        }
        super.sendEvent(event)
    }

    private func isTitleBarInteractionPoint(_ point: NSPoint) -> Bool {
        guard point.y >= contentLayoutRect.maxY else { return false }
        let buttons: [NSButton?] = [
            standardWindowButton(.closeButton),
            standardWindowButton(.miniaturizeButton),
            standardWindowButton(.zoomButton),
        ]
        return !buttons.compactMap { $0 }.contains { button in
            button.convert(button.bounds, to: nil).contains(point)
        }
    }

    /// Move the full-size WebView window while the pointer is in native chrome.
    /// WebKit otherwise receives this mouse sequence before AppKit can start a
    /// normal window drag.
    private func dragWindow(from initialEvent: NSEvent) {
        let initialFrame = frame
        let initialScreenLocation = NSEvent.mouseLocation
        while let event = nextEvent(matching: [.leftMouseDragged, .leftMouseUp]) {
            let screenLocation = NSEvent.mouseLocation
            let deltaX = screenLocation.x - initialScreenLocation.x
            let deltaY = screenLocation.y - initialScreenLocation.y
            setFrameOrigin(NSPoint(x: initialFrame.origin.x + deltaX, y: initialFrame.origin.y + deltaY))
            if event.type == .leftMouseUp { return }
        }
    }

    /// Mirror the title bar's double-click action, honoring the system
    /// preference (NSGlobalDomain AppleActionOnDoubleClick: Minimize /
    /// Maximize / None; absent or unknown → the platform default, zoom).
    func performTitleBarDoubleClickAction() {
        let action = UserDefaults(suiteName: "NSGlobalDomain")?
            .string(forKey: "AppleActionOnDoubleClick") ?? "Maximize"
        switch action {
        case "Minimize": performMiniaturize(nil)
        case "None": break
        default: zoom(nil)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private static let mainWindowAutosaveName = "dsh-desktop-main-v2"

    private var window: NSWindow!
    private var webView: WKWebView!
    private var themeBridge = ThemeBridge()
    private var overlay: NSView!
    private var overlayLabel: NSTextField!
    private var overlaySpinner: NSProgressIndicator!
    private var retryButton: NSButton!

    private var repoRoot: String?
    private var node: NodeRuntime?
    private var host: Process?
    private var lineBuffer = Data()
    private var stderrTail = Data()
    private var hostReady = false
    private var hostURL: URL?
    private var updateProcess: Process?
    private var updateOutput = Data()

    private let urlPattern = try! NSRegularExpression(pattern: #"dsh web: (http://127\.0\.0\.1:\d+)"#)

    // MARK: Startup

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        boot()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        teardownHost()
        updateProcess?.terminate()
        return .terminateNow
    }

    private func boot() {
        repoRoot = resolveRepositoryRoot()
        node = detectNode()
        guard let node else {
            promptInstallNode(message: "No Node.js runtime found on this machine.")
            return
        }
        guard nodeVersionSatisfies(node.version) else {
            promptInstallNode(
                message: "Node.js \(node.version) does not satisfy the required range (^22.19.0 || >=24.0.0).",
            )
            return
        }
        startHost(repoRoot: repoRoot, node: node)
    }

    private func promptInstallNode(message: String) {
        let alert = NSAlert()
        alert.messageText = "Node.js is required"
        alert.informativeText = """
        \(message)

        The desktop shell does not bundle a Node runtime. Install Node.js 22.19+ or 24+ \
        (https://nodejs.org, or `brew install node`), then retry.
        """
        alert.addButton(withTitle: "Retry Detection")
        alert.addButton(withTitle: "Open nodejs.org")
        alert.addButton(withTitle: "Quit")
        switch alert.runModal() {
        case .alertFirstButtonReturn:
            boot()
        case .alertSecondButtonReturn:
            NSWorkspace.shared.open(URL(string: "https://nodejs.org/")!)
            promptInstallNode(message: message)
        default:
            NSApp.terminate(nil)
        }
    }

    // MARK: Host lifecycle

    private func startHost(repoRoot: String?, node: NodeRuntime) {
        hostReady = false
        lineBuffer = Data()
        stderrTail = Data()
        showOverlay("Starting \(appDisplayName)…", spinning: true, showRetry: false)

        let builtBin = repoRoot.map {
            ($0 as NSString).appendingPathComponent("apps/cli/lib/bin.js")
        }
        let process = Process()
        if let repoRoot, let builtBin,
           FileManager.default.fileExists(atPath: builtBin) {
            process.currentDirectoryURL = URL(fileURLWithPath: repoRoot)
            process.executableURL = URL(fileURLWithPath: node.executablePath)
            process.arguments = [builtBin, "web", "--port", "0"]
        } else if let dsh = findExecutable("dsh") {
            process.currentDirectoryURL = FileManager.default.homeDirectoryForCurrentUser
            process.executableURL = URL(fileURLWithPath: dsh)
            process.arguments = ["web", "--port", "0"]
        } else {
            showFatal(
                "DeepSeek Harness is not installed.",
                detail: "Install the dsh CLI, or set DSH_REPO to a built deepseek-harness checkout, then relaunch.",
            )
            return
        }

        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr
        process.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async { self?.hostExited(finished) }
        }
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            DispatchQueue.main.async { self?.consumeStdout(chunk) }
        }
        stderr.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            DispatchQueue.main.async { self?.consumeStderr(chunk) }
        }

        do {
            try process.run()
            host = process
        } catch {
            showFatal("Failed to launch the host process.", detail: error.localizedDescription)
        }

        // Cold boots should not take a minute; surface a retry instead of hanging.
        DispatchQueue.main.asyncAfter(deadline: .now() + 90) { [weak self] in
            guard let self, !self.hostReady, self.host?.isRunning == true else { return }
            self.teardownHost()
            self.showOverlay("The host did not become ready in time.", spinning: false, showRetry: true)
        }
    }

    private func consumeStdout(_ chunk: Data) {
        lineBuffer.append(chunk)
        while let newlineIndex = lineBuffer.firstIndex(of: 0x0A) {
            let lineData = lineBuffer.subdata(in: lineBuffer.startIndex..<newlineIndex)
            lineBuffer.removeSubrange(lineBuffer.startIndex...newlineIndex)
            guard let line = String(data: lineData, encoding: .utf8) else { continue }
            let range = NSRange(line.startIndex..., in: line)
            if let match = urlPattern.firstMatch(in: line, range: range),
               let urlRange = Range(match.range(at: 1), in: line),
               let url = URL(string: String(line[urlRange])) {
                hostDidBecomeReady(url)
                return
            }
        }
        if lineBuffer.count > 1_048_576 { lineBuffer = Data() }
    }

    private func consumeStderr(_ chunk: Data) {
        stderrTail.append(chunk)
        let cap = 8_192
        if stderrTail.count > cap {
            stderrTail = stderrTail.subdata(in: (stderrTail.count - cap)..<stderrTail.count)
        }
    }

    private func hostDidBecomeReady(_ url: URL) {
        guard !hostReady else { return }
        hostReady = true
        hostURL = url
        hideOverlay()
        webView.load(URLRequest(url: url))
    }

    private func hostExited(_ process: Process) {
        stdoutCleanup()
        guard process === host else { return }
        host = nil
        if !hostReady {
            let detail = String(data: stderrTail, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            showOverlay(
                "The host exited before becoming ready (code \(process.terminationStatus)).",
                spinning: false,
                showRetry: true,
                detail: detail,
            )
        } else {
            showOverlay("The host process exited unexpectedly.", spinning: false, showRetry: true)
        }
    }

    private func stdoutCleanup() {
        // Pipes close with the process; drop stale references only.
        lineBuffer = Data()
    }

    private func teardownHost() {
        guard let process = host, process.isRunning else { return }
        kill(process.processIdentifier, SIGTERM)
        let deadline = Date().addingTimeInterval(5)
        while process.isRunning && Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        if process.isRunning { kill(process.processIdentifier, SIGKILL) }
        host = nil
    }

    @objc private func updateAndRestart() {
        guard let repoRoot else {
            showFatal(
                "Updates require a local Git checkout.",
                detail: "Clone deepseek-harness-desktop and launch its in-tree app, then try again.",
            )
            return
        }
        let alert = NSAlert()
        alert.messageText = "Update DeepSeek Harness?"
        alert.informativeText = "The app will pull the latest code, install dependencies, rebuild, and restart."
        alert.addButton(withTitle: "Update and Restart")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        teardownHost()
        updateOutput = Data()
        showOverlay("Updating DeepSeek Harness…", spinning: true, showRetry: false)
        let process = Process()
        process.currentDirectoryURL = URL(fileURLWithPath: repoRoot)
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = ["apps/desktop/update.sh", repoRoot]
        let output = Pipe()
        process.standardOutput = output
        process.standardError = output
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            DispatchQueue.main.async { self?.appendUpdateOutput(chunk) }
        }
        process.terminationHandler = { [weak self] finished in
            DispatchQueue.main.async { self?.finishUpdate(finished) }
        }
        do {
            updateProcess = process
            try process.run()
        } catch {
            updateProcess = nil
            showFatal("Failed to start the updater.", detail: error.localizedDescription)
        }
    }

    private func appendUpdateOutput(_ chunk: Data) {
        updateOutput.append(chunk)
        if updateOutput.count > 8_192 {
            updateOutput = updateOutput.suffix(8_192)
        }
    }

    private func finishUpdate(_ process: Process) {
        guard process === updateProcess else { return }
        updateProcess = nil
        if process.terminationStatus == 0 {
            NSApp.terminate(nil)
            return
        }
        let detail = String(data: updateOutput, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        showOverlay("The update failed (code \(process.terminationStatus)).", spinning: false, showRetry: true, detail: detail)
    }

    @objc private func restartHost() {
        teardownHost()
        boot()
    }

    // MARK: Window construction

    private func buildWindow() {
        let style: NSWindow.StyleMask = [
            .titled,
            .closable,
            .miniaturizable,
            .resizable,
            .fullSizeContentView,
        ]
        window = DesktopWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1_240, height: 820),
            styleMask: style,
            backing: .buffered,
            defer: false,
        )
        window.title = appDisplayName
        window.minSize = NSSize(width: 900, height: 600)
        window.setFrameAutosaveName(Self.mainWindowAutosaveName)
        window.center()
        // Native-unified chrome: the title bar loses its default material and
        // hairline; ThemeBridge paints it with the Web sidebar fill so the
        // left edge reads as one continuous surface.
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        // Content extends under the transparent title bar so the Web surface
        // fills the window behind the title and traffic lights.
        window.backgroundColor = NSColor(srgbRed: 27.0 / 255.0, green: 27.0 / 255.0, blue: 28.0 / 255.0, alpha: 1)
        window.appearance = NSAppearance(named: .darkAqua)
        window.isMovableByWindowBackground = true

        let configuration = WKWebViewConfiguration()
        let userContent = WKUserContentController()
        userContent.add(themeBridge, name: "dshTheme")
        userContent.addUserScript(WKUserScript(
            source: ThemeBridge.observerScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true,
        ))
        userContent.addUserScript(WKUserScript(
            source: ThemeBridge.desktopLayoutScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true,
        ))
        configuration.userContentController = userContent

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]
        themeBridge.window = window
        themeBridge.webView = webView

        let content = NSView(frame: NSRect(x: 0, y: 0, width: 1_240, height: 820))
        webView.frame = content.bounds
        webView.autoresizingMask = [.width, .height]
        content.addSubview(webView)

        buildOverlay(in: content)
        window.contentView = content
    }

    private func buildOverlay(in content: NSView) {
        overlay = NSView(frame: content.bounds)
        overlay.autoresizingMask = [.width, .height]
        overlay.wantsLayer = true
        overlay.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

        overlaySpinner = NSProgressIndicator(frame: NSRect(x: 0, y: 0, width: 32, height: 32))
        overlaySpinner.style = .spinning
        overlaySpinner.controlSize = .large

        overlayLabel = NSTextField(labelWithString: "Starting…")
        overlayLabel.font = .systemFont(ofSize: 15, weight: .medium)
        overlayLabel.alignment = .center
        overlayLabel.maximumNumberOfLines = 0
        overlayLabel.preferredMaxLayoutWidth = 460

        retryButton = NSButton(title: "Retry", target: self, action: #selector(restartHost))
        retryButton.bezelStyle = .rounded
        retryButton.keyEquivalent = "\r"

        for view: NSView in [overlaySpinner, overlayLabel, retryButton] {
            view.translatesAutoresizingMaskIntoConstraints = false
            overlay.addSubview(view)
        }
        NSLayoutConstraint.activate([
            overlaySpinner.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            overlaySpinner.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -44),
            overlayLabel.topAnchor.constraint(equalTo: overlaySpinner.bottomAnchor, constant: 18),
            overlayLabel.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            retryButton.topAnchor.constraint(equalTo: overlayLabel.bottomAnchor, constant: 18),
            retryButton.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
        ])
        content.addSubview(overlay)
    }

    private func showOverlay(_ message: String, spinning: Bool, showRetry: Bool, detail: String? = nil) {
        var text = message
        if let detail, !detail.isEmpty {
            let trimmed = detail.count > 1_200 ? "…" + detail.suffix(1_200) : detail
            text += "\n\n\(trimmed)"
        }
        overlayLabel.stringValue = text
        if spinning { overlaySpinner.startAnimation(nil) } else { overlaySpinner.stopAnimation(nil) }
        overlaySpinner.isHidden = !spinning
        retryButton.isHidden = !showRetry
        overlay.isHidden = false
    }

    private func hideOverlay() {
        overlay.isHidden = true
        overlaySpinner.stopAnimation(nil)
    }

    private func showFatal(_ message: String, detail: String) {
        teardownHost()
        showOverlay(message, spinning: false, showRetry: true, detail: detail)
    }

    // MARK: Navigation

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showOverlay("The page failed to load.", spinning: false, showRetry: true, detail: error.localizedDescription)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error,
    ) {
        showOverlay("The page failed to load.", spinning: false, showRetry: true, detail: error.localizedDescription)
    }

    // MARK: Menu

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About \(appDisplayName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Reload", action: #selector(reloadPage), keyEquivalent: "r")
        appMenu.addItem(withTitle: "Update and Restart…", action: #selector(updateAndRestart), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(redo)
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
    }

    @objc private func reloadPage() {
        if let hostURL, hostReady {
            webView.load(URLRequest(url: hostURL))
        } else {
            restartHost()
        }
    }
}

// MARK: - Entry point

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
