import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Zap,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { ExplainResponse, IndexRecommendation, api } from '../api/client'

interface VisualPlanGraphProps {
  plan: ExplainResponse | null
  onRefreshSchema?: () => void
}

export const VisualPlanGraph: React.FC<VisualPlanGraphProps> = ({ plan, onRefreshSchema }) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showVdbe, setShowVdbe] = useState(false)
  const [runningIndex, setRunningIndex] = useState<string | null>(null)

  if (!plan || !plan.graph) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-muted)',
          gap: 12,
        }}
      >
        <Zap size={36} color="var(--border-subtle)" />
        <p>Execute or explain a SQL query to visualize its execution plan DAG and index advice.</p>
      </div>
    )
  }

  const { graph, recommendations, vdbe } = plan

  const copySQL = (sql: string, idx: number) => {
    navigator.clipboard.writeText(sql)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const runIndexDDL = async (ddl: string) => {
    setRunningIndex(ddl)
    try {
      await api.executeQuery(ddl)
      alert('Index created successfully!')
      if (onRefreshSchema) onRefreshSchema()
    } catch (err: any) {
      alert(`Failed creating index: ${err.message}`)
    } finally {
      setRunningIndex(null)
    }
  }

  // Score color
  let scoreColor = '#10b981'
  if (graph.optimizationScore < 50) {
    scoreColor = '#f43f5e'
  } else if (graph.optimizationScore < 80) {
    scoreColor = '#f59e0b'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 20, gap: 20 }}>
      {/* Overview Metric Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {/* Score Card */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              border: `4px solid ${scoreColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: scoreColor,
              boxShadow: `0 0 16px ${scoreColor}33`,
            }}
          >
            {graph.optimizationScore}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Optimization Score
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>
              {graph.optimizationScore >= 80 ? 'Optimal Query' : graph.optimizationScore >= 50 ? 'Needs Tuning' : 'High Scan Cost'}
            </div>
          </div>
        </div>

        {/* Full Table Scans */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${graph.fullTableScans > 0 ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: graph.fullTableScans > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: graph.fullTableScans > 0 ? '#f43f5e' : 'var(--text-muted)',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Full Table Scans
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: graph.fullTableScans > 0 ? '#f43f5e' : '#f8fafc' }}>
              {graph.fullTableScans}
            </div>
          </div>
        </div>

        {/* Index Lookups */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <CheckCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Index Searches
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{graph.indexLookups}</div>
          </div>
        </div>

        {/* Temporary B-Trees */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: graph.tempBTrees > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: graph.tempBTrees > 0 ? '#f59e0b' : 'var(--text-muted)',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Temp B-Trees
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: graph.tempBTrees > 0 ? '#f59e0b' : '#f8fafc' }}>
              {graph.tempBTrees}
            </div>
          </div>
        </div>
      </div>

      {/* Index Advisor Card */}
      {recommendations && recommendations.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(37, 99, 235, 0.08))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8' }}>
            <Zap size={18} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>LiteLens Index Advisor Recommendations</h3>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            The query optimizer identified execution bottlenecks. Creating the following index will convert high-cost
            scans into instantaneous B-Tree searches:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{rec.table}</span>
                    <span className="badge badge-amber">{rec.impact}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{rec.reason}</div>
                  <code
                    style={{
                      display: 'block',
                      marginTop: 6,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: '#38bdf8',
                    }}
                  >
                    {rec.ddl}
                  </code>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => copySQL(rec.ddl, i)}
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '5px 10px' }}
                  >
                    {copiedIdx === i ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copiedIdx === i ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => runIndexDDL(rec.ddl)}
                    disabled={runningIndex === rec.ddl}
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                  >
                    <Zap size={13} />
                    <span>{runningIndex === rec.ddl ? 'Creating...' : 'Run Index'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Execution Plan DAG */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>Query Execution Plan Graph (DAG)</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{graph.totalNodes} execution steps</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 10,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {graph.nodes.map((node, idx) => {
            let borderColor = 'rgba(255, 255, 255, 0.1)'
            let bgNode = 'rgba(255, 255, 255, 0.03)'
            let badgeClass = 'badge-cyan'

            if (node.costRating === 'danger') {
              borderColor = 'rgba(244, 63, 94, 0.4)'
              bgNode = 'rgba(244, 63, 94, 0.08)'
              badgeClass = 'badge-rose'
            } else if (node.costRating === 'warning') {
              borderColor = 'rgba(245, 158, 11, 0.4)'
              bgNode = 'rgba(245, 158, 11, 0.08)'
              badgeClass = 'badge-amber'
            } else if (node.costRating === 'good') {
              borderColor = 'rgba(16, 185, 129, 0.4)'
              bgNode = 'rgba(16, 185, 129, 0.08)'
              badgeClass = 'badge-green'
            }

            return (
              <div key={node.id}>
                <div
                  style={{
                    background: bgNode,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`badge ${badgeClass}`}>{node.type}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>{node.label}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                        }}
                      >
                        {node.detail}
                      </div>
                    </div>
                  </div>

                  {node.table && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Table: {node.table}
                    </span>
                  )}
                </div>

                {idx < graph.nodes.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                    <div style={{ width: 2, height: 14, background: 'var(--border-subtle)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* VDBE Bytecode Inspector Drawer */}
      {vdbe && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setShowVdbe(!showVdbe)}
            style={{
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Cpu size={16} color="var(--accent-cyan)" />
              <span style={{ fontWeight: 600, fontSize: 14, color: '#f8fafc' }}>
                VDBE Virtual Machine Bytecode ({vdbe.totalOpcodes} opcodes • Complexity: {vdbe.estimatedComplexity.toUpperCase()})
              </span>
            </div>
            {showVdbe ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {showVdbe && (
            <div style={{ maxHeight: 350, overflowY: 'auto', padding: 12 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '6px 8px', width: 50 }}>Addr</th>
                    <th style={{ padding: '6px 8px', width: 120 }}>Opcode</th>
                    <th style={{ padding: '6px 8px', width: 50 }}>P1</th>
                    <th style={{ padding: '6px 8px', width: 50 }}>P2</th>
                    <th style={{ padding: '6px 8px', width: 50 }}>P3</th>
                    <th style={{ padding: '6px 8px', width: 100 }}>P4</th>
                    <th style={{ padding: '6px 8px' }}>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {vdbe.instructions.map((inst) => {
                    let catColor = 'var(--text-primary)'
                    if (inst.category === 'cursor') catColor = '#38bdf8'
                    if (inst.category === 'storage') catColor = '#10b981'
                    if (inst.category === 'branch') catColor = '#f59e0b'

                    return (
                      <tr
                        key={inst.addr}
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}
                      >
                        <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>{inst.addr}</td>
                        <td style={{ padding: '4px 8px', color: catColor, fontWeight: 600 }}>{inst.opcode}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{inst.p1}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{inst.p2}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>{inst.p3}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{inst.p4 || '-'}</td>
                        <td style={{ padding: '4px 8px', color: 'var(--text-dim)' }}>{inst.comment}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
