import { getApiKey, loadConfig } from '../config.js'
import { getDefaultBaseUrl, getProvider, estimateTokens } from './types.js'
import type { InternalMsg, InternalToolCall, ProviderDefinition, ToolDef, Usage } from './types.js'
import type { ProviderRuntime } from './http.js'
import { openAiRuntime, anthropicRuntime, geminiRuntime } from './http.js'

function runtimeFor(p: ProviderDefinition | undefined): ProviderRuntime {
  switch (p?.format) {
    case 'anthropic':
      return anthropicRuntime
    case 'gemini':
      return geminiRuntime
    default:
      return openAiRuntime
  }
}

export interface StreamRequest {
  providerId: string
  model: string
  messages: InternalMsg[]
  tools: ToolDef[]
  temperature?: number
  maxTokens?: number
  signal: AbortSignal
}

export interface StreamResult {
  providerId: string
  model: string
  text: string
  toolCalls: InternalToolCall[]
  usage?: Usage
  durationMs: number
}

export async function streamChat(req: StreamRequest, handlers: {
  onDelta: (text: string) => void
  onUsage: (usage: Usage) => void
  onError: (message: string) => void
}): Promise<StreamResult> {
  const started = Date.now()
  const config = loadConfig()
  const provider = config.providers[req.providerId]
  const baseUrl = provider?.baseUrl || getDefaultBaseUrl(req.providerId)
  const apiKey = getApiKey(req.providerId)

  const runtime = runtimeFor(getProvider(req.providerId))
  if (!runtime) throw new Error(`Unknown provider: ${req.providerId}`)

  const providerDef = getProvider(req.providerId)
  let final: { text: string; toolCalls: InternalToolCall[]; usage?: Usage }
  try {
    final = await runtime.streamChat(
      {
        baseUrl,
        apiKey,
        model: req.model,
        providerLabel: providerDef?.name ?? req.providerId,
        messages: req.messages,
        tools: req.tools,
        temperature: req.temperature ?? config.temperature,
        maxTokens: req.maxTokens ?? config.maxTokens,
        signal: req.signal
      },
      handlers
    )
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      handlers.onError('Stream aborted')
    } else {
      handlers.onError(err instanceof Error ? err.message : String(err))
    }
    throw err
  }

  return {
    providerId: req.providerId,
    model: req.model,
    text: final.text,
    toolCalls: final.toolCalls ?? [],
    usage: final.usage,
    durationMs: Date.now() - started
  }
}

export function summaryTokens(messages: InternalMsg[]): number {
  return estimateTokens(messages.map((m) => m.content).join('\n'))
}
