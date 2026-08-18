import type { ModelMeta, ProviderDefinition } from './types.js'
import { setActiveProviders, setRuntimePrices } from './types.js'

/* ------------------------------------------------------------------ */
/* models.dev integration — live model catalog, free tags, pricing      */
/* ------------------------------------------------------------------ */

interface MdCost {
  input?: number
  output?: number
  cache_read?: number
}

interface MdModel {
  id: string
  name?: string
  description?: string
  family?: string
  tool_call?: boolean
  reasoning?: boolean
  attachment?: boolean
  cost?: MdCost
  limit?: { context?: number; output?: number }
  modalities?: { input?: string[]; output?: string[] }
}

interface MdProvider {
  id: string
  name: string
  env?: string[]
  npm?: string
  api?: string
  models: Record<string, MdModel>
}

const MODELDEV_URL = 'https://models.dev/api.json'
const CACHE_MS = 6 * 3600_000
let cache: Record<string, MdProvider> | null = null
let cacheAt = 0

export async function fetchModelsDev(): Promise<Record<string, MdProvider>> {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache
  const res = await fetch(MODELDEV_URL, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`models.dev ${res.status}`)
  cache = (await res.json()) as Record<string, MdProvider>
  cacheAt = Date.now()
  return cache
}

export function isChatModel(m: MdModel): boolean {
  const input = m.modalities?.input ?? ['text']
  const output = m.modalities?.output ?? ['text']
  if (!input.includes('text') || !output.includes('text')) return false
  if (!m.tool_call && !m.reasoning) return false
  if ((m.limit?.context ?? 0) <= 0) return false
  return true
}

export function isFreeModel(m: MdModel): boolean {
  if (!m.cost) return true
  return (m.cost.input ?? 0) === 0 && (m.cost.output ?? 0) === 0
}

export function modelPrice(m: MdModel): ModelMeta | null {
  if (!m.cost || isFreeModel(m)) return null
  return { inputPerM: m.cost.input ?? 0, outputPerM: m.cost.output ?? 0 }
}

export function detectFormat(p: MdProvider): 'openai' | 'anthropic' | 'gemini' {
  if (p.npm === '@ai-sdk/anthropic') return 'anthropic'
  if (p.npm === '@ai-sdk/google' || p.npm === '@ai-sdk/google-generative-ai') return 'gemini'
  return 'openai'
}

function normalizeBaseUrl(api: string | undefined, format: 'openai' | 'anthropic' | 'gemini'): string | undefined {
  if (!api) return undefined
  const url = api.replace(/\/+$/, '')
  if (format === 'anthropic' && url.endsWith('/v1')) return url.slice(0, -3)
  return url
}

const ID_MAP: Record<string, string> = { 'fireworks-ai': 'fireworks' }

const META: Record<string, Omit<ProviderDefinition, 'models'>> = {
  zhipuai: { id: 'zhipuai', name: 'Zhipu AI', tagline: 'GLM models', icon: '✦', color: '#eab308', needsKey: true, keyPlaceholder: 'sk-…', baseUrlEditable: true },
  zai: { id: 'zai', name: 'Z.AI', tagline: 'Z.ai coding models', icon: 'Z', color: '#a855f7', needsKey: true, keyPlaceholder: 'sk-…', baseUrlEditable: true },
  siliconflow: { id: 'siliconflow', name: 'SiliconFlow', tagline: 'Open model cloud', icon: '◇', color: '#38bdf8', needsKey: true, keyPlaceholder: 'sk-…', baseUrlEditable: true },
  stepfun: { id: 'stepfun', name: 'StepFun', tagline: 'Step models', icon: '⌘', color: '#60a5fa', needsKey: true, keyPlaceholder: 'sk-…', baseUrlEditable: true },
  sakana: { id: 'sakana', name: 'Sakana AI', tagline: 'TinySwallow · Darwin', icon: '🐟', color: '#f97316', needsKey: true, keyPlaceholder: 'sk-…', baseUrlEditable: true },
  nebius: { id: 'nebius', name: 'Nebius', tagline: 'Token Factory', icon: '◆', color: '#7c3aed', needsKey: true, keyPlaceholder: '…', baseUrlEditable: true },
  scaleway: { id: 'scaleway', name: 'Scaleway', tagline: 'Inference servers', icon: '◈', color: '#2563eb', needsKey: true, keyPlaceholder: '…', baseUrlEditable: true },
  requesty: { id: 'requesty', name: 'Requesty', tagline: 'AI router', icon: '◐', color: '#14b8a6', needsKey: true, keyPlaceholder: '…', baseUrlEditable: true },
  baseten: { id: 'baseten', name: 'Baseten', tagline: 'Model serving', icon: '▲', color: '#f59e0b', needsKey: true, keyPlaceholder: '…', baseUrlEditable: true },
  zenmux: { id: 'zenmux', name: 'ZenMux', tagline: 'Router — many models', icon: '✦', color: '#22c55e', needsKey: true, keyPlaceholder: '…', baseUrlEditable: true },
  meta: { id: 'meta', name: 'Meta', tagline: 'Llama via Meta API', icon: '◉', color: '#2563eb', needsKey: true, keyPlaceholder: '…', baseUrlEditable: true },
  minimax: { id: 'minimax', name: 'MiniMax', tagline: 'Anthropic-compatible', icon: '▣', color: '#f43f5e', needsKey: true, keyPlaceholder: 'sk-…', baseUrlEditable: true }
}

/** models.dev provider ids we want in the catalog. */
const MODELDEV_IDS = [
  'openrouter', 'openai', 'anthropic', 'google', 'groq', 'deepseek', 'xai', 'mistral',
  'cerebras', 'nvidia', 'huggingface', 'fireworks-ai', 'zhipuai', 'zai', 'siliconflow',
  'stepfun', 'sakana', 'nebius', 'scaleway', 'requesty', 'baseten', 'zenmux', 'meta', 'minimax'
]

/** static providers kept as-is (not on models.dev, or local-only). */
const STATIC_ONLY = ['together', 'moonshot', 'ollama', 'lmstudio']

export async function buildCatalog(staticProviders: ProviderDefinition[]): Promise<ProviderDefinition[]> {
  let md: Record<string, MdProvider>
  try {
    md = await fetchModelsDev()
  } catch {
    return staticProviders
  }

  const staticById = new Map(staticProviders.map((p) => [p.id, p]))
  const out: ProviderDefinition[] = []

  for (const pid of MODELDEV_IDS) {
    const p = md[pid]
    if (!p) continue
    const appId = ID_MAP[pid] ?? pid
    const existing = staticById.get(appId)
    const meta = existing ?? META[appId]
    if (!meta) continue

    const chat = Object.values(p.models).filter(isChatModel)
    if (!chat.length) continue

    const format = detectFormat(p)
    const defaultBaseUrl = existing?.defaultBaseUrl ?? normalizeBaseUrl(p.api, format)
    const models = chat.map((m) => m.id)
    const free = chat.filter(isFreeModel).map((m) => m.id)
    const freeSet = new Set(free)
    models.sort((a, b) => {
      const fa = freeSet.has(a) ? 0 : 1
      const fb = freeSet.has(b) ? 0 : 1
      return fa - fb || a.localeCompare(b)
    })

    out.push({
      ...meta,
      id: appId,
      name: existing?.name ?? p.name ?? meta.name,
      tagline: existing?.tagline ?? meta.tagline,
      defaultBaseUrl,
      format,
      models,
      freeAll: free.length === models.length,
      freeModels: free
    })
  }

  for (const s of staticProviders) {
    if (STATIC_ONLY.includes(s.id) && !out.some((p) => p.id === s.id)) out.push(s)
  }

  return out
}

export async function buildPrices(): Promise<Record<string, ModelMeta>> {
  let md: Record<string, MdProvider>
  try {
    md = await fetchModelsDev()
  } catch {
    return {}
  }
  const out: Record<string, ModelMeta> = {}
  for (const pid of MODELDEV_IDS) {
    const p = md[pid]
    if (!p) continue
    for (const m of Object.values(p.models)) {
      const price = modelPrice(m)
      if (price) out[m.id] = price
    }
  }
  return out
}

/** Fetch models.dev once, install the live catalog + pricing. Never throws. */
export async function initModelsDev(staticProviders: ProviderDefinition[]): Promise<void> {
  try {
    const [providers, prices] = await Promise.all([buildCatalog(staticProviders), buildPrices()])
    setActiveProviders(providers)
    setRuntimePrices(prices)
  } catch (err) {
    console.error('[models.dev] using static catalog:', err instanceof Error ? err.message : err)
  }
}
