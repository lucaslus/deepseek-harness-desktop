/**
 * ProviderBrandIcon: one shared mark for every model/provider route in the
 * product. The stable route id is the only input so settings, the composer,
 * and the slash-command picker cannot drift into separate brand mappings.
 */
import type { CSSProperties, ReactNode } from 'react'
import antGroupIcon from '@lobehub/icons-static-svg/icons/antgroup-color.svg'
import anthropicIcon from '@lobehub/icons-static-svg/icons/anthropic.svg'
import azureIcon from '@lobehub/icons-static-svg/icons/azure-color.svg'
import bedrockIcon from '@lobehub/icons-static-svg/icons/bedrock-color.svg'
import cerebrasIcon from '@lobehub/icons-static-svg/icons/cerebras-color.svg'
import cloudflareIcon from '@lobehub/icons-static-svg/icons/cloudflare-color.svg'
import deepseekIcon from '@lobehub/icons-static-svg/icons/deepseek-color.svg'
import fireworksIcon from '@lobehub/icons-static-svg/icons/fireworks-color.svg'
import githubCopilotIcon from '@lobehub/icons-static-svg/icons/githubcopilot.svg'
import googleIcon from '@lobehub/icons-static-svg/icons/google-color.svg'
import groqIcon from '@lobehub/icons-static-svg/icons/groq.svg'
import huggingFaceIcon from '@lobehub/icons-static-svg/icons/huggingface-color.svg'
import kimiIcon from '@lobehub/icons-static-svg/icons/kimi-color.svg'
import minimaxIcon from '@lobehub/icons-static-svg/icons/minimax-color.svg'
import mistralIcon from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import moonshotIcon from '@lobehub/icons-static-svg/icons/moonshot.svg'
import nvidiaIcon from '@lobehub/icons-static-svg/icons/nvidia-color.svg'
import openaiIcon from '@lobehub/icons-static-svg/icons/openai.svg'
import opencodeIcon from '@lobehub/icons-static-svg/icons/opencode.svg'
import openrouterIcon from '@lobehub/icons-static-svg/icons/openrouter-color.svg'
import qwenIcon from '@lobehub/icons-static-svg/icons/qwen-color.svg'
import togetherIcon from '@lobehub/icons-static-svg/icons/together-color.svg'
import vercelIcon from '@lobehub/icons-static-svg/icons/vercel.svg'
import vertexIcon from '@lobehub/icons-static-svg/icons/vertexai-color.svg'
import workersAiIcon from '@lobehub/icons-static-svg/icons/workersai-color.svg'
import xaiIcon from '@lobehub/icons-static-svg/icons/xai.svg'
import xiaomiIcon from '@lobehub/icons-static-svg/icons/xiaomimimo.svg'
import zaiIcon from '@lobehub/icons-static-svg/icons/zai.svg'

/** Current pi-ai catalog route → LobeHub static SVG. */
const BRAND_ICONS: Readonly<Record<string, string>> = {
  'amazon-bedrock': bedrockIcon,
  'ant-ling': antGroupIcon,
  anthropic: anthropicIcon,
  'azure-openai-responses': azureIcon,
  cerebras: cerebrasIcon,
  'cloudflare-ai-gateway': cloudflareIcon,
  'cloudflare-workers-ai': workersAiIcon,
  deepseek: deepseekIcon,
  'deepseek-official': deepseekIcon,
  fireworks: fireworksIcon,
  'github-copilot': githubCopilotIcon,
  google: googleIcon,
  'google-vertex': vertexIcon,
  groq: groqIcon,
  huggingface: huggingFaceIcon,
  kimi: kimiIcon,
  'kimi-coding': kimiIcon,
  minimax: minimaxIcon,
  'minimax-cn': minimaxIcon,
  mistral: mistralIcon,
  moonshotai: moonshotIcon,
  'moonshotai-cn': moonshotIcon,
  nvidia: nvidiaIcon,
  openai: openaiIcon,
  'openai-codex': openaiIcon,
  opencode: opencodeIcon,
  'opencode-go': opencodeIcon,
  openrouter: openrouterIcon,
  'qwen-token-plan': qwenIcon,
  'qwen-token-plan-cn': qwenIcon,
  together: togetherIcon,
  'vercel-ai-gateway': vercelIcon,
  xai: xaiIcon,
  xiaomi: xiaomiIcon,
  'xiaomi-token-plan-ams': xiaomiIcon,
  'xiaomi-token-plan-cn': xiaomiIcon,
  'xiaomi-token-plan-sgp': xiaomiIcon,
  zai: zaiIcon,
  'zai-coding-cn': zaiIcon,
}

/** One safe, bundled brand choice for a custom provider. */
export interface ProviderBrandOption {
  /** Stable static asset id stored in the provider profile. */
  readonly id: string
  /** Human-readable label used by the settings picker. */
  readonly label: string
}

/**
 * Bundled, offline-safe choices for custom providers. We persist the id, not
 * an external image URL, so a profile remains portable and every client
 * renders the same mark without fetching untrusted content.
 */
export const PROVIDER_BRAND_OPTIONS: readonly ProviderBrandOption[] = [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google AI' },
  { id: 'google-vertex', label: 'Google Vertex AI' },
  { id: 'azure-openai-responses', label: 'Azure OpenAI' },
  { id: 'amazon-bedrock', label: 'Amazon Bedrock' },
  { id: 'cloudflare-ai-gateway', label: 'Cloudflare AI Gateway' },
  { id: 'cloudflare-workers-ai', label: 'Cloudflare Workers AI' },
  { id: 'mistral', label: 'Mistral AI' },
  { id: 'groq', label: 'Groq' },
  { id: 'cerebras', label: 'Cerebras' },
  { id: 'fireworks', label: 'Fireworks AI' },
  { id: 'huggingface', label: 'Hugging Face' },
  { id: 'moonshotai', label: 'Kimi / Moonshot AI' },
  { id: 'kimi', label: 'Kimi' },
  { id: 'kimi-coding', label: 'Kimi Coding' },
  { id: 'qwen-token-plan', label: 'Qwen' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'zai', label: 'Z.ai' },
  { id: 'xiaomi', label: 'Xiaomi MiMo' },
  { id: 'nvidia', label: 'NVIDIA' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'together', label: 'Together AI' },
  { id: 'xai', label: 'xAI' },
  { id: 'vercel-ai-gateway', label: 'Vercel AI Gateway' },
  { id: 'github-copilot', label: 'GitHub Copilot' },
  { id: 'ant-ling', label: 'Ant Group Ling' },
  { id: 'opencode', label: 'OpenCode' },
]

/** Logos defined through currentColor are rendered as CSS masks, so they keep contrast in either app theme. */
const MONOCHROME_PROVIDERS: ReadonlySet<string> = new Set([
  'anthropic', 'github-copilot', 'groq', 'moonshotai', 'moonshotai-cn',
  'openai', 'openai-codex', 'opencode', 'opencode-go', 'vercel-ai-gateway',
  'xai', 'xiaomi', 'xiaomi-token-plan-ams', 'xiaomi-token-plan-cn',
  'xiaomi-token-plan-sgp', 'zai', 'zai-coding-cn',
])

/** Props for one compact, decorative provider mark. */
export interface ProviderBrandIconProps {
  /** Provider route id, for example `deepseek-official` or `openai`. */
  readonly provider: string
  /** Optional configured brand override for a custom provider route. */
  readonly brandIcon?: string | undefined
  /** Square icon size in CSS pixels. */
  readonly size?: number
  /** Accessible name. Omit when adjacent visible text already names the provider. */
  readonly label?: string
  /** Extra wrapper class for layout only. */
  readonly className?: string | undefined
}

/**
 * Render a recognizable provider mark or a neutral API-route fallback for a
 * custom/new provider. The monochrome SVGs use masking rather than an image,
 * letting them inherit the surrounding text color in both light and dark UI.
 */
export function ProviderBrandIcon({ provider, brandIcon, size = 18, label, className }: ProviderBrandIconProps): ReactNode {
  const brand = brandIcon ?? provider
  const icon = BRAND_ICONS[brand]
  const accessibility = label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }
  const baseStyle: CSSProperties = {
    display: 'inline-flex', flex: '0 0 auto', width: size, height: size,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: Math.max(3, size / 4),
  }
  if (icon !== undefined && MONOCHROME_PROVIDERS.has(brand)) {
    const mask = `url(${JSON.stringify(icon)}) center / contain no-repeat`
    return <span
      className={className}
      style={{ ...baseStyle, backgroundColor: 'currentColor', mask, WebkitMask: mask }}
      {...accessibility}
    />
  }
  if (icon !== undefined) {
    return <span className={className} style={baseStyle} {...accessibility}>
      <img src={icon} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  }
  return (
    <span
      className={className}
      style={{ ...baseStyle, boxSizing: 'border-box', border: '1px solid currentColor', color: 'currentColor', opacity: 0.72 }}
      {...accessibility}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width={size} height={size}>
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.25 6.25h5.5M5.25 9.75h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}
