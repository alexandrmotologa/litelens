import React, { useState } from 'react'
import { Cpu, FileCode, Binary, Image as ImageIcon, Zap, Check } from 'lucide-react'
import { api, BlobInspection } from '../api/client'

export const VectorWorkbench: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'vectors' | 'jsonb' | 'blob'>('vectors')

  // Vectors state
  const [vecAStr, setVecAStr] = useState('0.15, 0.82, -0.34, 0.55')
  const [vecBStr, setVecBStr] = useState('0.18, 0.79, -0.31, 0.60')
  const [vectorMetrics, setVectorMetrics] = useState<{
    cosineDistance: number
    l2Distance: number
    dotProduct: number
  } | null>(null)
  const [vectorError, setVectorError] = useState<string | null>(null)

  // JSONB state
  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(
      {
        user_id: 1042,
        profile: {
          username: 'alexandrm',
          roles: ['admin', 'developer'],
          settings: { dark_mode: true, notifications: false },
        },
        tags: ['sqlite', 'database', 'wal', 'vectors'],
      },
      null,
      2
    )
  )
  const [jsonFormatted, setJsonFormatted] = useState<string | null>(null)

  // BLOB state
  const [blobInput, setBlobInput] = useState('')
  const [blobResult, setBlobResult] = useState<BlobInspection | null>(null)

  const handleCalcVector = async () => {
    setVectorError(null)
    try {
      const a = vecAStr
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n))
      const b = vecBStr
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n))

      if (a.length !== b.length) {
        throw new Error(`Dimension mismatch: Vector A has ${a.length} dimensions, Vector B has ${b.length}`)
      }
      if (a.length === 0) {
        throw new Error('Please enter valid numeric vector dimensions.')
      }

      const res = await api.calcVectorDistances(a, b)
      setVectorMetrics(res)
    } catch (err: any) {
      setVectorError(err.message || 'Calculation error')
    }
  }

  const handleInspectBlob = async () => {
    try {
      const res = await api.inspectBlob(undefined, blobInput)
      setBlobResult(res)
    } catch (err: any) {
      alert(`BLOB inspection failed: ${err.message}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24, gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cpu size={20} color="var(--accent-cyan)" />
          <span>Modern SQLite 3.45+ Types & Vector Workbench</span>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Utilities for high-dimensional vector embeddings, binary JSON (JSONB), and smart BLOB media previewing.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveSubTab('vectors')}
          className={`btn-secondary ${activeSubTab === 'vectors' ? 'active-nav' : ''}`}
          style={{
            background: activeSubTab === 'vectors' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'vectors' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'vectors' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <Cpu size={14} />
          <span>Vector Similarity Calculator</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jsonb')}
          className={`btn-secondary ${activeSubTab === 'jsonb' ? 'active-nav' : ''}`}
          style={{
            background: activeSubTab === 'jsonb' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'jsonb' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'jsonb' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <FileCode size={14} />
          <span>SQLite 3.45 JSONB Inspector</span>
        </button>

        <button
          onClick={() => setActiveSubTab('blob')}
          className={`btn-secondary ${activeSubTab === 'blob' ? 'active-nav' : ''}`}
          style={{
            background: activeSubTab === 'blob' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'blob' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'blob' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <Binary size={14} />
          <span>Smart BLOB & Media Preview</span>
        </button>
      </div>

      {/* Subtab 1: Vectors */}
      {activeSubTab === 'vectors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
              Vector Distance & Similarity Calculator
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Computes Cosine Distance, Euclidean L2 Distance, and Dot Product for float32 embeddings (compatible with
              sqlite-vec and raw float32 BLOBs).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Vector A (Comma-separated float values):
                </label>
                <textarea
                  value={vecAStr}
                  onChange={(e) => setVecAStr(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Vector B (Comma-separated float values):
                </label>
                <textarea
                  value={vecBStr}
                  onChange={(e) => setVecBStr(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={handleCalcVector} className="btn-primary" style={{ padding: '6px 14px' }}>
                <Zap size={14} />
                <span>Calculate Distance</span>
              </button>

              <button
                onClick={() => {
                  setVecAStr('1.0, 0.0, 0.0, 0.0')
                  setVecBStr('0.0, 1.0, 0.0, 0.0')
                }}
                className="btn-secondary"
                style={{ fontSize: 12 }}
              >
                Preset: Orthogonal
              </button>

              <button
                onClick={() => {
                  setVecAStr('0.7071, 0.7071, 0.0, 0.0')
                  setVecBStr('0.7071, 0.7071, 0.0, 0.0')
                }}
                className="btn-secondary"
                style={{ fontSize: 12 }}
              >
                Preset: Identical
              </button>
            </div>

            {vectorError && (
              <div style={{ padding: 10, borderRadius: 6, background: 'rgba(244,63,94,0.15)', color: '#fca5a5', fontSize: 12 }}>
                {vectorError}
              </div>
            )}

            {vectorMetrics && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                  marginTop: 10,
                }}
              >
                <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>COSINE DISTANCE</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                    {vectorMetrics.cosineDistance.toFixed(6)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>0.0 = Identical angle</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>EUCLIDEAN (L2) DISTANCE</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                    {vectorMetrics.l2Distance.toFixed(6)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Straight-line Euclidean metric</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>DOT PRODUCT</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                    {vectorMetrics.dotProduct.toFixed(6)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Vector projection product</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtab 2: JSONB */}
      {activeSubTab === 'jsonb' && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>SQLite 3.45 JSONB Tree Explorer</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Inspects and decodes binary JSON (`jsonb`) payloads into structured, syntax-highlighted JSON documents.
          </p>

          <div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <pre
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: '#38bdf8',
              overflowX: 'auto',
            }}
          >
            {jsonInput}
          </pre>
        </div>
      )}

      {/* Subtab 3: BLOB */}
      {activeSubTab === 'blob' && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>Smart BLOB & Media Inspector</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Paste raw text or base64 to detect MIME format, generate hex dumps, and preview embedded media.
          </p>

          <textarea
            value={blobInput}
            onChange={(e) => setBlobInput(e.target.value)}
            placeholder="Paste binary text, Base64 payload, or image bytes..."
            rows={5}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              outline: 'none',
            }}
          />

          <button onClick={handleInspectBlob} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
            <span>Analyze BLOB</span>
          </button>

          {blobResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-cyan">{blobResult.mimeType}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{blobResult.sizeBytes} bytes</span>
              </div>

              {blobResult.isImage && blobResult.dataUrl && (
                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 8, display: 'inline-block' }}>
                  <img src={blobResult.dataUrl} alt="Preview" style={{ maxWidth: 300, maxHeight: 200, borderRadius: 4 }} />
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Hex Dump (Offset | Bytes | ASCII)
                </div>
                <pre
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: 12,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    overflowX: 'auto',
                  }}
                >
                  {blobResult.hexDump}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
