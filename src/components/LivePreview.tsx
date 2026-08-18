import { useEffect, useRef, useState } from 'react'

interface Props {
  path: string
  variant?: 'card' | 'panel'
  onClose?: () => void
}

function previewUrl(path: string): string {
  return `/preview/${path.replace(/^\/+/, '').split('?')[0]}`
}

interface FileMeta {
  mtime: number
  size: number
}

export default function LivePreview({ path, variant = 'card', onClose }: Props) {
  const [ts, setTs] = useState(Date.now())
  const [live, setLive] = useState(true)
  const known = useRef<FileMeta | null>(null)

  useEffect(() => {
    known.current = null
    setTs(Date.now())
  }, [path])

  useEffect(() => {
    if (!live) return

    const check = async () => {
      try {
        const r = await fetch(`/api/preview/meta?path=${encodeURIComponent(path)}`)
        if (!r.ok) return
        const j = await r.json()
        const m = j.meta as FileMeta | null
        if (!m) {
          if (known.current) {
            known.current = null
            setTs(Date.now())
          }
          return
        }
        if (!known.current) {
          known.current = m
          setTs(Date.now())
        } else if (known.current.mtime !== m.mtime || known.current.size !== m.size) {
          known.current = m
          setTs(Date.now())
        }
      } catch {
        /* ignore polling errors */
      }
    }

    check()
    const t = setInterval(check, 1200)
    return () => clearInterval(t)
  }, [path, live])

  const src = `${previewUrl(path)}?t=${ts}`
  const openNew = () => window.open(previewUrl(path), '_blank')

  return (
    <div className={`live-preview ${variant}`}>
      <div className="live-preview-head">
        <div className="live-preview-title">
          <span className="preview-dot" />
          <code>{path}</code>
          <span className="live-badge">LIVE</span>
        </div>
        <div className="live-preview-actions">
          <label className="live-toggle" title="Auto-refresh on changes">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            LIVE
          </label>
          <button className="btn-ghost tiny" title="Refresh now" onClick={() => setTs(Date.now())}>↻</button>
          <button className="btn-ghost tiny" title="Open in new tab" onClick={openNew}>↗</button>
          {onClose && (
            <button className="btn-ghost tiny" title="Close preview" onClick={onClose}>✕</button>
          )}
        </div>
      </div>
      <div className="live-preview-body">
        <iframe
          className="preview-frame"
          src={src}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={`Live preview: ${path}`}
        />
      </div>
    </div>
  )
}