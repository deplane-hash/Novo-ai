import type { InternalMsg, InternalToolCall, StreamHandlers, ToolDef, Usage } from './types.js'
import { estimateTokens } from './types.js'
import { parseSSE } from './sse.js'

export interface ProviderRuntime {
  id: string
  streamChat(params: {
    baseUrl: string
    apiKey: string
    model: string
    providerLabel?: string
    messages: InternalMsg[]
    tools: ToolDef[]
    temperature: number
    maxTokens: number
    signal: AbortSignal
  }, handlers: StreamHandlers): Promise<{ text: string; toolCalls: InternalToolCall[]; usage?: Usage }>
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible (OpenAI, OpenRouter, Ollama, LM Studio)            */
/* ------------------------------------------------------------------ */

export const openAiRuntime: ProviderRuntime = {
  id: 'openai',
  async streamChat({ baseUrl, apiKey, model, providerLabel, messages, tools, temperature, maxTokens, signal }, handlers) {
    const label = providerLabel ?? 'OpenAI'
    const body: Record<string, unknown> = {
      model,
      messages: messages.map(openAiMsg),
      temperature,
      max_tokens: maxTokens,
      stream: true
    }
    if (tools.length) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      }))
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) throw new Error(await readError(res, label, baseUrl))

    let text = ''
    const toolCalls: InternalToolCall[] = []
    let usage: Usage | undefined
    let finalUsage: Usage | undefined

    await parseSSE(res.body, (data) => {
      const json = JSON.parse(data)
      const choice = json.choices?.[0]
      if (choice?.delta?.content) {
        text += choice.delta.content
        handlers.onDelta(choice.delta.content)
      }
      for (const tc of choice?.delta?.tool_calls ?? []) {
        const idx = tc.index ?? 0
        while (toolCalls.length <= idx) {
          toolCalls.push({ id: '', name: '', args: {} })
        }
        if (tc.id) toolCalls[idx].id = tc.id
        if (tc.function?.name) toolCalls[idx].name += tc.function.name
        if (tc.function?.arguments) {
          const partial = toolCalls[idx].args as unknown as { __raw?: string }
          const raw = (partial.__raw ?? '') + tc.function.arguments
          try {
            toolCalls[idx].args = JSON.parse(raw)
          } catch {
            ;(toolCalls[idx].args as { __raw?: string }).__raw = raw
          }
        }
      }
      if (json.usage) {
        finalUsage = {
          inputTokens: json.usage.prompt_tokens ?? 0,
          outputTokens: json.usage.completion_tokens ?? 0,
          totalTokens: json.usage.total_tokens ?? 0
        }
      }
    })

    // any leftover partial args with __raw (JSON never fully parsed) -> repair
    for (const tc of toolCalls) {
      const raw = (tc.args as { __raw?: string }).__raw
      if (raw) {
        try {
          tc.args = JSON.parse(raw)
        } catch {
          tc.args = { _malformed: raw }
        }
      }
    }
    if (finalUsage) {
      usage = finalUsage
      handlers.onUsage(usage)
    } else if (messages.length) {
      usage = {
        inputTokens: estimateTokens(messages.map((m) => m.content).join('\n')),
        outputTokens: estimateTokens(text),
        totalTokens: 0,
        estimated: true
      }
      handlers.onUsage(usage)
    }
    return { text, toolCalls, usage }
  }
}

function openAiMsg(m: InternalMsg): Record<string, unknown> {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content }
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args) }
      }))
    }
  }
  return { role: m.role, content: m.content }
}

/* ------------------------------------------------------------------ */
/* Anthropic                                                           */
/* ------------------------------------------------------------------ */

export const anthropicRuntime: ProviderRuntime = {
  id: 'anthropic',
  async streamChat({ baseUrl, apiKey, model, providerLabel, messages, tools, temperature, maxTokens, signal }, handlers) {
    const label = providerLabel ?? 'Anthropic'
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages: messages.filter((m) => m.role !== 'system').map(anthropicMsg)
    }
    if (system) body.system = system
    if (tools.length) {
      body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) throw new Error(await readError(res, label, baseUrl))

    let text = ''
    const toolCalls: InternalToolCall[] = []
    let inputTokens = 0
    let outputTokens = 0

    await parseSSE(res.body, (data) => {
      const json = JSON.parse(data)
      if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
        const idx = json.index ?? 0
        toolCalls[idx] = { id: json.content_block.id, name: json.content_block.name, args: {} }
      } else if (json.type === 'content_block_delta' && json.delta?.type === 'input_json_delta') {
        const idx = json.index ?? 0
        if (toolCalls[idx]) {
          const partial = toolCalls[idx].args as { __raw?: string }
          const raw = (partial.__raw ?? '') + json.delta.partial_json
          try {
            toolCalls[idx].args = JSON.parse(raw)
          } catch {
            ;(toolCalls[idx].args as { __raw?: string }).__raw = raw
          }
        }
      } else if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
        text += json.delta.text
        handlers.onDelta(json.delta.text)
      } else if (json.type === 'message_start' && json.message?.usage) {
        inputTokens = json.message.usage.input_tokens ?? 0
      } else if (json.type === 'message_delta' && json.usage) {
        outputTokens = json.usage.output_tokens ?? 0
      }
    })

    for (const tc of toolCalls) {
      const raw = (tc.args as { __raw?: string }).__raw
      if (raw) {
        try {
          tc.args = JSON.parse(raw)
        } catch {
          tc.args = { _malformed: raw }
        }
      }
    }

    const usage: Usage = {
      inputTokens: inputTokens || estimateTokens(messages.map((m) => m.content).join('\n')),
      outputTokens: outputTokens || estimateTokens(text),
      totalTokens: inputTokens + outputTokens,
      estimated: !inputTokens
    }
    handlers.onUsage(usage)
    return { text, toolCalls, usage }
  }
}

function anthropicMsg(m: InternalMsg): Record<string, unknown> {
  const blocks: Record<string, unknown>[] = []
  if (m.content) blocks.push({ type: 'text', text: m.content })
  if (m.role === 'assistant' && m.toolCalls?.length) {
    for (const tc of m.toolCalls) {
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
    }
  }
  if (m.role === 'tool') {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId ?? '', content: m.content }] }
  }
  return { role: m.role === 'assistant' ? 'assistant' : 'user', content: blocks }
}

/* ------------------------------------------------------------------ */
/* Google Gemini                                                       */
/* ------------------------------------------------------------------ */

export const geminiRuntime: ProviderRuntime = {
  id: 'google',
  async streamChat({ baseUrl, apiKey, model, providerLabel, messages, tools, temperature, maxTokens, signal }, handlers) {
    const label = providerLabel ?? 'Gemini'
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const contents = buildGeminiContents(messages)
    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    }
    if (system) body.systemInstruction = { parts: [{ text: system }] }
    if (tools.length) {
      body.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }
      ]
    }
    const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) throw new Error(await readError(res, label, baseUrl))

    let text = ''
    const toolCalls: InternalToolCall[] = []

    await parseSSE(res.body, (data) => {
      const json = JSON.parse(data)
      const parts = json.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (part.text) {
          text += part.text
          handlers.onDelta(part.text)
        } else if (part.functionCall?.name) {
          toolCalls.push({ id: `gem_${toolCalls.length}`, name: part.functionCall.name, args: part.functionCall.args ?? {} })
        }
      }
    })

    const usage: Usage = {
      inputTokens: estimateTokens(messages.map((m) => m.content).join('\n')),
      outputTokens: estimateTokens(text),
      totalTokens: estimateTokens(messages.map((m) => m.content).join('\n')),
      estimated: true
    }
    handlers.onUsage(usage)
    return { text, toolCalls, usage }
  }
}

function buildGeminiContents(messages: InternalMsg[]): Record<string, unknown>[] {
  const contents: { role: string; parts: Record<string, unknown>[] }[] = []
  for (const m of messages) {
    if (m.role === 'system' || m.role === 'tool') continue
    const role = m.role === 'assistant' ? 'model' : 'user'
    const parts: Record<string, unknown>[] = []
    if (m.content) parts.push({ text: m.content })
    if (m.role === 'assistant' && m.toolCalls?.length) {
      for (const tc of m.toolCalls) parts.push({ functionCall: { name: tc.name, args: tc.args } })
    }
    const last = contents[contents.length - 1]
    if (last && last.role === role) {
      last.parts.push(...parts)
    } else {
      contents.push({ role, parts })
    }
  }
  for (const m of messages) {
    if (m.role !== 'tool') continue
    const part = { functionResponse: { name: m.toolName ?? '', response: { result: m.content } } }
    const last = contents[contents.length - 1]
    if (last && last.role === 'function') {
      last.parts.push(part)
    } else {
      contents.push({ role: 'function', parts: [part] })
    }
  }
  return contents
}

async function readError(res: Response, provider: string, baseUrl = ''): Promise<string> {
  let detail = ''
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      const e = json?.error
      if (typeof e === 'string') detail = e
      else if (e?.message) detail = `${e.message}${e.code ? ` (${e.code})` : ''}`
      else detail = json?.message ?? (typeof json?.success === 'boolean' && !json.success && json.error ? json.error : text)
    } catch {
      detail = text.slice(0, 400)
    }
  } catch {
    detail = 'no body'
  }
  let host = ''
  try {
    host = new URL(baseUrl).host
  } catch {
    /* noop */
  }
  return `${provider} API ${res.status}${host ? ` @ ${host}` : ''}: ${detail}`
}
