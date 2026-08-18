import { useState } from 'react'
import type { FileNode, Session } from '../types'
import { listWorkspace } from '../api'

interface Props {
  sessions: Session[]
  activeId: string | null
  tree: FileNode[]
  booting: boolean
  workspaceName: string
  status: 'idle' | 'thinking' | 'executing' | 'error'
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onSettings: () => void
  onOpenFile: (path: string) => void
  onWorkOn: (path: string, isDir: boolean) => void
}

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

const FILE_ICON = '📄'
const DIR_ICON = '📁'
const DIR_OPEN_ICON = '📂'

const STATUS_TEXT: Record<string, string> = {
  idle: 'Ready',
  thinking: 'Thinking…',
  executing: 'Executing…',
  error: 'Error'
}

function FileTreeNode({
  node,
  depth,
  onOpenFile,
  onWorkOn
}: {
  node: FileNode
  depth: number
  onOpenFile: (path: string) => void
  onWorkOn: (path: string, isDir: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[] | null>(null)
  const [loading, setLoading] = useState(false)

  const isDir = node.type === 'directory'

  const toggle = async () => {
    if (!isDir) return onOpenFile(node.path)
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (children === null) {
      setLoading(true)
      try {
        const r = await listWorkspace(node.path)
        setChildren(r.nodes)
      } catch {
        setChildren([])
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <>
      <div
        className={`tree-node ${!isDir ? 'file' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={toggle}
        title={node.path}
      >
        <span className="tree-icon">
          {isDir ? (expanded ? DIR_OPEN_ICON : DIR_ICON) : FILE_ICON}
        </span>
        <span className="tree-name">{node.name}</span>
        {isDir && loading && <span className="tree-spin" />}
        <button
          className="tree-workon"
          title="Work on this"
          onClick={(e) => {
            e.stopPropagation()
            onWorkOn(node.path, isDir)
          }}
        >
          work on this
        </button>
      </div>
      {isDir && expanded && children?.map((c) => (
        <FileTreeNode key={c.path} node={c} depth={depth + 1} onOpenFile={onOpenFile} onWorkOn={onWorkOn} />
      ))}
    </>
  )
}

export default function Sidebar({
  sessions, activeId, tree, booting, workspaceName, status,
  onNew, onOpen, onDelete, onSettings, onOpenFile, onWorkOn
}: Props) {
  const [tab, setTab] = useState<'files' | 'sessions'>('files')

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <span className="logo-core" />
        </div>
        <div>
          <h1>NOVA</h1>
          <p>AI workspace</p>
        </div>
      </div>

      <button className="btn-primary btn-new" onClick={onNew}>
        <span>+</span> New conversation
      </button>

      <div className="tabs">
        <button className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>
          Files
        </button>
        <button className={`tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>
          Chats
        </button>
      </div>

      {tab === 'files' ? (
        <div className="file-tree">
          <div className="workspace-label" title={workspaceName}>
            {workspaceName.split('/').pop() || 'workspace'}
          </div>
          <div className="tree-scroll">
            {booting ? (
              <div className="muted small">loading…</div>
            ) : tree.length === 0 ? (
              <div className="muted small">Empty workspace</div>
            ) : (
              tree.map((n) => (
                <FileTreeNode key={n.path} node={n} depth={0} onOpenFile={onOpenFile} onWorkOn={onWorkOn} />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="session-list">
          {booting ? (
            <div className="muted small">loading…</div>
          ) : sessions.length === 0 ? (
            <div className="muted small">No conversations yet</div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === activeId ? 'active' : ''}`}
                onClick={() => onOpen(s.id)}
              >
                <div className="session-body">
                  <div className="session-title">{s.title}</div>
                  <div className="session-meta">
                    <span>{s.model || '—'}</span>
                    <span>{timeAgo(s.updatedAt)}</span>
                  </div>
                </div>
                <button
                  className="session-del"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(s.id)
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="sidebar-footer">
        <button className="btn-ghost sidebar-link" onClick={onSettings}>
          ⚙ Settings
        </button>
        <div className="sidebar-status">
          <span className={`status-ind ${status}`}>
            <span className="status-dot" />
            {STATUS_TEXT[status]}
          </span>
        </div>
      </div>
    </aside>
  )
}
