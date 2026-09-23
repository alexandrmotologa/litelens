import React, { useState } from 'react'
import { Cpu, FileCode, Binary, Image as ImageIcon, Zap, Check, Sparkles } from 'lucide-react'
import { api, BlobInspection } from '../api/client'

export const VectorWorkbench: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'vectors' | 'scatter' | 'jsonb' | 'blob'>('vectors')

  // Sample vector dataset for PCA projection
  const SAMPLE_VECTORS = [
    { id: 1, label: 'Pro Laptop 16"', vector: [0.85, 0.72, -0.40, 0.65, 0.12, 0.05, 0.33, 0.88] },
    { id: 2, label: 'Wireless Ergonomic Mouse', vector: [0.82, 0.68, -0.38, 0.61, 0.15, 0.02, 0.31, 0.84] },
    { id: 3, label: 'Mechanical RGB Keyboard', vector: [0.79, 0.65, -0.35, 0.58, 0.10, 0.08, 0.28, 0.80] },
    { id: 4, label: 'USB-C Docking Station', vector: [0.75, 0.60, -0.30, 0.50, 0.20, 0.15, 0.40, 0.72] },
    { id: 5, label: '4K UltraSharp Monitor', vector: [0.65, 0.55, -0.25, 0.45, 0.25, 0.20, 0.45, 0.65] },
    { id: 6, label: 'Noise Cancelling Headphones', vector: [-0.45, -0.60, 0.75, -0.50, 0.80, 0.35, -0.20, -0.30] },
    { id: 7, label: 'Studio Condenser Mic', vector: [-0.40, -0.55, 0.70, -0.45, 0.75, 0.40, -0.15, -0.25] },
    { id: 8, label: 'Heavy Duty Standing Desk', vector: [0.10, 0.20, 0.05, -0.10, -0.60, -0.75, 0.85, 0.15] },
  ]

  const [vectorDataset, setVectorDataset] = useState(SAMPLE_VECTORS)
  const [selectedPointId, setSelectedPointId] = useState<number | null>(1)
  const [hoveredPoint, setHoveredPoint] = useState<typeof SAMPLE_VECTORS[0] | null>(null)

  // 2D PCA Projection calculation
  const projectedPoints = React.useMemo(() => {
    if (vectorDataset.length === 0) return []
    const dims = vectorDataset[0].vector.length

    // 1. Compute mean
    const mean = new Array(dims).fill(0)
    for (const item of vectorDataset) {
      for (let d = 0; d < dims; d++) {
        mean[d] += item.vector[d]
      }
    }
    for (let d = 0; d < dims; d++) {
      mean[d] /= vectorDataset.length
    }

    // 2. Center data
    const centered = vectorDataset.map((item) => ({
      ...item,
      cVec: item.vector.map((v, d) => v - mean[d]),
    }))

    // 3. Simple 2D projection vectors (pseudo-PCA axes via orthogonalized projection)
    // First principal axis: direction of max variance
    let pc1 = new Array(dims).fill(0.3)
    let pc2 = new Array(dims).fill(-0.2)
    // Normalize
    const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    const n1 = norm(pc1)
    pc1 = pc1.map((x) => x / n1)

    // Orthogonalize pc2 to pc1
    const dot = pc1.reduce((s, x, i) => s + x * pc2[i], 0)
    pc2 = pc2.map((x, i) => x - dot * pc1[i])
    const n2 = norm(pc2)
    pc2 = pc2.map((x) => x / n2)

    // Power iterations to align with data covariance
    for (let iter = 0; iter < 10; iter++) {
      const next1 = new Array(dims).fill(0)
      for (const item of centered) {
        const proj = item.cVec.reduce((s, x, i) => s + x * pc1[i], 0)
        for (let d = 0; d < dims; d++) next1[d] += item.cVec[d] * proj
      }
      const len1 = norm(next1)
      if (len1 > 0) pc1 = next1.map((x) => x / len1)
    }

    for (let iter = 0; iter < 10; iter++) {
      const next2 = new Array(dims).fill(0)
      for (const item of centered) {
        // Orthogonal projection
        const proj = item.cVec.reduce((s, x, i) => s + x * pc2[i], 0)
        for (let d = 0; d < dims; d++) next2[d] += item.cVec[d] * proj
      }
      const dot12 = pc1.reduce((s, x, i) => s + x * next2[i], 0)
      for (let d = 0; d < dims; d++) next2[d] -= dot12 * pc1[d]
      const len2 = norm(next2)
      if (len2 > 0) pc2 = next2.map((x) => x / len2)
    }

    // 4. Project onto 2D plane
    const rawCoords = centered.map((item) => {
      const x = item.cVec.reduce((s, v, i) => s + v * pc1[i], 0)
      const y = item.cVec.reduce((s, v, i) => s + v * pc2[i], 0)
      return { ...item, x, y }
    })

    // Find min/max for normalization to canvas space (50 to 550 for X, 50 to 350 for Y)
    const minX = Math.min(...rawCoords.map((c) => c.x))
    const maxX = Math.max(...rawCoords.map((c) => c.x))
    const minY = Math.min(...rawCoords.map((c) => c.y))
    const maxY = Math.max(...rawCoords.map((c) => c.y))

    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1

    return rawCoords.map((c) => ({
      ...c,
      svgX: 60 + ((c.x - minX) / rangeX) * 480,
      svgY: 340 - ((c.y - minY) / rangeY) * 280,
    }))
  }, [vectorDataset])

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 10,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <button
          onClick={() => setActiveSubTab('vectors')}
          className={`btn-secondary ${activeSubTab === 'vectors' ? 'active-nav' : ''}`}
          style={{
            background: activeSubTab === 'vectors' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'vectors' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'vectors' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Cpu size={14} />
          <span>Vector Similarity Calculator</span>
        </button>

        <button
          onClick={() => setActiveSubTab('scatter')}
          className={`btn-secondary ${activeSubTab === 'scatter' ? 'active-nav' : ''}`}
          style={{
            background: activeSubTab === 'scatter' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'scatter' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'scatter' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Sparkles size={14} />
          <span>Vector 2D PCA Scatter Plot</span>
        </button>

        <button
          onClick={() => setActiveSubTab('jsonb')}
          className={`btn-secondary ${activeSubTab === 'jsonb' ? 'active-nav' : ''}`}
          style={{
            background: activeSubTab === 'jsonb' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeSubTab === 'jsonb' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'jsonb' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
            whiteSpace: 'nowrap',
            flexShrink: 0,
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
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Binary size={14} />
          <span>Smart BLOB & Media Preview</span>
        </button>
      </div>

      {/* Subtab: Scatter Plot (PCA 2D Projection) */}
      {activeSubTab === 'scatter' && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                  2D Embedding Dimensionality Reduction (PCA Scatter Plot)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Projects high-dimensional float32 vector embeddings onto a 2D plane to visualize semantic clustering and similarity distance.
                </p>
              </div>

              <button
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => setVectorDataset(SAMPLE_VECTORS)}
              >
                Reset Sample Vectors
              </button>
            </div>

            {/* SVG 2D Canvas */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: 16,
                position: 'relative',
              }}
            >
              <svg
                viewBox="0 0 600 380"
                style={{ width: '100%', height: '380px', overflow: 'visible' }}
              >
                {/* Axes */}
                <line x1="60" y1="340" x2="540" y2="340" stroke="var(--border-subtle)" strokeWidth="1" />
                <line x1="60" y1="60" x2="60" y2="340" stroke="var(--border-subtle)" strokeWidth="1" />
                <text x="530" y="360" fill="var(--text-muted)" fontSize="11px">PC1 (Variance)</text>
                <text x="30" y="55" fill="var(--text-muted)" fontSize="11px">PC2</text>

                {/* Grid guidelines */}
                <line x1="60" y1="200" x2="540" y2="200" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <line x1="300" y1="60" x2="300" y2="340" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

                {/* Lines connecting selected point to all other points */}
                {selectedPointId &&
                  projectedPoints.map((pt) => {
                    const sel = projectedPoints.find((p) => p.id === selectedPointId)
                    if (!sel || pt.id === selectedPointId) return null
                    return (
                      <line
                        key={`line-${pt.id}`}
                        x1={sel.svgX}
                        y1={sel.svgY}
                        x2={pt.svgX}
                        y2={pt.svgY}
                        stroke="rgba(99, 102, 241, 0.2)"
                        strokeDasharray="2 2"
                      />
                    )
                  })}

                {/* Points */}
                {projectedPoints.map((pt) => {
                  const isSelected = selectedPointId === pt.id
                  const isHovered = hoveredPoint?.id === pt.id

                  return (
                    <g
                      key={pt.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedPointId(pt.id)}
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <circle
                        cx={pt.svgX}
                        cy={pt.svgY}
                        r={isSelected ? 9 : isHovered ? 7 : 6}
                        fill={isSelected ? '#6366f1' : isHovered ? '#38bdf8' : '#10b981'}
                        stroke="#fff"
                        strokeWidth={isSelected ? 2 : 1}
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                      />
                      <text
                        x={pt.svgX}
                        y={pt.svgY - 12}
                        textAnchor="middle"
                        fill={isSelected ? '#818cf8' : 'var(--text-secondary)'}
                        fontSize="10px"
                        fontWeight={isSelected ? '600' : 'normal'}
                      >
                        {pt.label}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Point Inspector Card */}
              {hoveredPoint && (
                <div
                  style={{
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: '11px',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 2 }}>{hoveredPoint.label}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Vector [{hoveredPoint.vector.slice(0, 4).join(', ')}...]</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
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
