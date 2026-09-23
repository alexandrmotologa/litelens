import React, { useState } from 'react'
import { X, Copy, Check, FileCode, Binary } from 'lucide-react'
import { api, BlobInspection } from '../api/client'

interface CellInspectorModalProps {
  colName: string
  colType: string
  value: any
  onClose: () => void
}

export const CellInspectorModal: React.FC<CellInspectorModalProps> = ({
  colName,
  colType,
  value,
  onClose,
}) => {
  const [copied, setCopied] = useState(false)
  const [blobInsp, setBlobInsp] = useState<BlobInspection | null>(null)
  const [loadingBlob, setLoadingBlob] = useState(false)

  const isNull = value === null || value === undefined
  let rawStr = isNull ? 'NULL' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)

  // Try JSON parse for pretty viewing if it looks like JSON
  let isJson = false
  let prettyJson = rawStr
  if (!isNull && typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      const parsed = JSON.parse(value)
      prettyJson = JSON.stringify(parsed, null, 2)
      isJson = true
    } catch {}
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(isJson ? prettyJson : rawStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInspectAsBlob = async () => {
    setLoadingBlob(true)
    try {
      const res = await api.inspectBlob(undefined, rawStr)
      setBlobInsp(res)
    } catch (err: any) {
      alert(`BLOB analysis failed: ${err.message}`)
    } finally {
      setLoadingBlob(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 680,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCode size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
              Inspect Column: <span style={{ color: 'var(--accent-cyan)' }}>{colName}</span>
            </h3>
            <span className="badge badge-cyan">{colType}</span>
          </div>

          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Length: {rawStr.length} characters
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={handleCopy} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleInspectAsBlob}
                disabled={loadingBlob}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                <Binary size={13} />
                <span>{loadingBlob ? 'Analyzing...' : 'Hex / Media View'}</span>
              </button>
            </div>
          </div>

          <pre
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-primary)',
              overflowX: 'auto',
              maxHeight: 320,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {isJson ? prettyJson : rawStr}
          </pre>

          {blobInsp && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-amber">{blobInsp.mimeType}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{blobInsp.sizeBytes} bytes</span>
              </div>

              {blobInsp.isImage && blobInsp.dataUrl && (
                <div style={{ textAlign: 'center', padding: 8 }}>
                  <img src={blobInsp.dataUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6 }} />
                </div>
              )}

              <pre
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  overflowX: 'auto',
                  maxHeight: 180,
                }}
              >
                {blobInsp.hexDump}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
