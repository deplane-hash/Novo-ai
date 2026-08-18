import { executeTool, describeTool, resolveSafe, TOOL_MAP, type ToolContext } from './tools/registry.js'
import { streamChat } from './providers/index.js'
import path from 'node:path'
import type { InternalMsg, InternalToolCall, Usage } from './providers/types.js'
import { requestApproval, isAllowed, rememberAllowed } from './approvals.js'
import { TOOLS } from './tools/registry.js'

export interface AgentEvents {
  onDelta: (text: string) => void
  onToolCall: (call: { id: string; name: string; summary: string; needApproval: boolean }) => void
  onToolApproved: (id: string) => void
  onToolResult: (id: string, ok: boolean, output: string, error?: string) => void
  onPreview: (path: string) => void
  onUsage: (usage: Usage) => void
  onError: (message: string) => void
}

export interface AgentOptions {
  providerId: string
  model: string
  messages: InternalMsg[]
  workspace: string
  chatId: string
  sessionId: string
  planMode: boolean
  autoApprove: boolean
  signal: AbortSignal
}

const MAX_ITERATIONS = 12

const SYSTEM_TEMPLATE = `You are Nova, an AI coding assistant working inside the user's project workspace at:
{{WORKSPACE}}

You have tools you can call to read, write and edit files, list/search the workspace, run shell commands (git, npm, python, node, tests), and fetch web pages.

Guidelines:
- The user is a beginner. Explain clearly and simply, step by step.
- Use tools when the task involves real files or commands. Explore before assuming.
- When writing code, follow existing conventions in the project. Prefer surgical edits over rewriting whole files.
- After making changes, summarize what you changed and how to test it.
- If a command fails, read the error, fix it, and retry.
- Never invent file contents or claim actions you did not actually perform via tools.
- Keep responses focused and skimmable. Use markdown and code blocks.

{{EXTRA}}`

export async function runAgent(opts: AgentOptions, events: AgentEvents): Promise<{ fullText: string; totalUsage?: Usage }> {
  const extra = opts.planMode
    ? 'PLAN MODE IS ON: Do NOT call any tools. Produce a clear step-by-step plan of what you would do, with specific files and commands. Then ask the user to approve the plan before any changes are made.'
    : 'When you want to change files or run commands, call the appropriate tool. The user will be asked to approve actions that modify their machine.'
  const system = SYSTEM_TEMPLATE.replace('{{WORKSPACE}}', opts.workspace).replace('{{EXTRA}}', extra)

  const messages: InternalMsg[] = [
    { role: 'system', content: system },
    ...opts.messages.filter((m) => m.role !== 'system')
  ]
  const ctx: ToolContext = { workspace: opts.workspace }

  let fullText = ''
  let totalUsage: Usage | undefined

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (opts.signal.aborted) break

    const res = await streamChat(
      {
        providerId: opts.providerId,
        model: opts.model,
        messages,
        tools: TOOLS,
        signal: opts.signal
      },
      {
        onDelta: (t) => {
          fullText += t
          events.onDelta(t)
        },
        onUsage: (u) => {
          totalUsage = totalUsage
            ? {
                inputTokens: (totalUsage.inputTokens ?? 0) + (u.inputTokens ?? 0),
                outputTokens: (totalUsage.outputTokens ?? 0) + (u.outputTokens ?? 0),
                totalTokens: (totalUsage.totalTokens ?? 0) + (u.totalTokens ?? 0),
                estimated: Boolean(totalUsage.estimated && u.estimated)
              }
            : u
          events.onUsage(u)
        },
        onError: events.onError
      }
    )

    if (!res.toolCalls.length) break

    messages.push({ role: 'assistant', content: res.text, toolCalls: res.toolCalls })

    for (const call of res.toolCalls) {
      if (opts.signal.aborted) break
      const def = TOOL_MAP.get(call.name)
      const summary = describeTool(call.name, call.args)

      let needApproval = false
      let decision: 'allow' | 'deny' | 'allow_always' = 'deny'
      let stepId: string

      if (!def) {
        stepId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        events.onToolCall({ id: stepId, name: call.name, summary, needApproval: false })
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: `Unknown tool: ${call.name}. Do not call it again.`
        })
        events.onToolResult(stepId, false, `Unknown tool: ${call.name}`)
        continue
      }

      if (opts.planMode || (def.perm === 'approve' && !opts.autoApprove && !isAllowed(opts.sessionId, call.name))) {
        needApproval = true
        const req = requestApproval(opts.chatId)
        stepId = req.id
        events.onToolCall({ id: stepId, name: call.name, summary, needApproval: true })
        decision = await req.decision.catch(() => 'deny' as const)
      } else {
        decision = 'allow'
        stepId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        events.onToolCall({ id: stepId, name: call.name, summary, needApproval: false })
      }

      if (decision === 'deny') {
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: `The user denied permission to run the tool ${call.name}. Do not retry it unless asked.`
        })
        events.onToolResult(stepId, false, 'Denied by user')
        continue
      }

      if (decision === 'allow_always') rememberAllowed(opts.sessionId, call.name)
      events.onToolApproved(stepId)

      const result = await executeTool(call.name, call.args, ctx)

      if (call.name === 'preview' || ((call.name === 'write' || call.name === 'edit') && /\.html?$/i.test(String(call.args?.path ?? '')))) {
        try {
          const target = resolveSafe(ctx, String(call.args?.path ?? ''))
          const rel = path.relative(opts.workspace, target)
          events.onPreview(rel && !rel.startsWith('..') ? rel : path.basename(target))
        } catch {
          /* ignore preview emit errors */
        }
      }

      const payload = JSON.stringify(result).slice(0, 8000)
      messages.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: payload })
      events.onToolResult(stepId, result.ok, result.output, result.error)
    }
  }

  return { fullText, totalUsage }
}
