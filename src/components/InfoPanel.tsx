import type { SessionMessage, ToolStep } from '../types'

interface Props {
  providerId: string
  model: string
  title: string
  messages: SessionMessage[]
  streaming: boolean
  status: 'idle' | 'thinking' | 'executing' | 'error'
}

const TOOL_ICON: Record<string, string> = {
  read: '📖',
  write: '✍️',
  edit: '🛠️',
  delete: '🗑️',
  list: '📂',
  glob: '🔍',
  grep: '🔍',
  bash: '⚡',
  webfetch: '🌐'
}

const STEP_LABEL: Record<string, string> = {
  awaiting: 'waiting',
  running: 'running…',
  done: 'done',
  error: 'error',
  denied: 'denied'
}

const STEP_PILL: Record<string, string> = {
  awaiting: 'warn',
  running: 'run',
  done: 'ok',
  error: 'err',
  denied: 'deny'
}

function fmtDuration(ms?: number): string {
  if (ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s % 60)}s`
}

function fmtTokens(n?: number): string {
  if (!n) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export default function InfoPanel({ providerId, model, title, messages, streaming, status }: Props) {
  const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.id !== 'welcome')
  const steps: ToolStep[] = last?.steps ?? []

  const usage = messages.reduce(
    (acc, m) => {
      if (m.usage) {
        acc.input += m.usage.inputTokens ?? 0
        acc.output += m.usage.outputTokens ?? 0
        acc.total += m.usage.totalTokens ?? 0
        acc.estimated = acc.estimated || Boolean(m.usage.estimated)
      }
      if (typeof m.cost === 'number') acc.cost += m.cost
      if (typeof m.durationMs === 'number') acc.duration += m.durationMs
      return acc
    },
    { input: 0, output: 0, total: 0, cost: 0, duration: 0, estimated: false }
  )

  const statusText =
    status === 'error' ? 'Error'
    : status === 'executing' ? 'Executing…'
    : status === 'thinking' ? 'Thinking…'
    : 'Idle'

  return (
    <aside className="info-panel">
      <div className="info-head">
        <h3>AI Tasks</h3>
        <span className={`status-ind ${status}`}>
          <span className="status-dot" />
          {statusText}
        </span>
      </div>

      <div className="info-scroll">
        <div className="info-section">
          {steps.length === 0 ? (
            <div className="muted small">
              {streaming ? 'Thinking…' : 'No active tasks. Ask the AI to do something.'}
            </div>
          ) : (
            <ul className="task-list">
              {steps.map((s) => (
                <li key={s.id} className={`task-item ${s.status}`}>
                  <span className="task-icon">{TOOL_ICON[s.name] ?? '🛠'}</span>
                  <span className="task-body">
                    <code>{s.name}</code>
                    {s.summary && <span className="task-summary">{s.summary}</span>}
                  </span>
                  <span className={`pill task-pill ${STEP_PILL[s.status] ?? ''}`}>{STEP_LABEL[s.status] ?? s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="info-section">
          <div className="info-title">Context used</div>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-num">{fmtTokens(usage.input)}</div>
              <div className="stat-label">context in{usage.estimated ? ' ~' : ''}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmtTokens(usage.output)}</div>
              <div className="stat-label">output{usage.estimated ? ' ~' : ''}</div>
            </div>
            <div className="stat">
              <div className="stat-num">{fmtTokens(usage.total)}</div>
              <div className="stat-label">total{usage.estimated ? ' ~' : ''}</div>
            </div>
            <div className="stat">
              <div className="stat-num">${usage.cost > 0 ? usage.cost.toFixed(4) : '0.0000'}</div>
              <div className="stat-label">cost</div>
            </div>
          </div>
        </div>

        <div className="info-section">
          <div className="info-title">Session</div>
          <dl className="info-rows">
            <div>
              <dt>Provider</dt>
              <dd>{providerId || '—'}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{model || '—'}</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>{messages.length}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{fmtDuration(usage.duration)}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd className="row-title">{title || 'New conversation'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </aside>
  )
}
