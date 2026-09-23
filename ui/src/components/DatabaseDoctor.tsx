import React, { useState, useEffect } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  RefreshCw,
  Zap,
  ArrowRight,
  Database,
  ShieldCheck,
  Layers,
} from 'lucide-react'
import { api, HealthReport } from '../api/client'

export const DatabaseDoctor: React.FC = () => {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vacuuming, setVacuuming] = useState(false)
  const [vacuumIntoPath, setVacuumIntoPath] = useState('')
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadHealth = async () => {
    setLoading(true)
    setError(null)
    setActionMessage(null)
    try {
      const data = await api.fetchHealth()
      setReport(data)
    } catch (err: any) {
      setError(err.message || 'Failed running health audit')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  const handleVacuum = async (into = false) => {
    setVacuuming(true)
    setActionMessage(null)
    try {
      const path = into ? vacuumIntoPath.trim() : undefined
      const res = await api.executeVacuum(path)
      setActionMessage({ type: 'success', text: res.message || 'Vacuum completed successfully.' })
      await loadHealth()
      if (into) setVacuumIntoPath('')
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Vacuum execution failed' })
    } finally {
      setVacuuming(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--accent-emerald, #10b981)'
    if (score >= 70) return 'var(--accent-amber, #f59e0b)'
    return 'var(--accent-rose, #f43f5e)'
  }

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', overflowY: 'auto' }}>
      {/* Title & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={24} color="#6366f1" />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Database Doctor & Health Audit</h2>
          </div>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Comprehensive integrity verification, orphan foreign key analysis, and storage defragmentation.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={loadHealth}
          disabled={loading || vacuuming}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Run Health Audit
        </button>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${actionMessage.type === 'success' ? '#10b981' : '#f43f5e'}`,
            color: actionMessage.type === 'success' ? '#34d399' : '#fb7185',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid #f43f5e', borderRadius: '8px', color: '#fb7185' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && (
        <>
          {/* Top Row: Score & Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '20px' }}>
            {/* Score Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: `8px solid ${getScoreColor(report.healthScore)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <span style={{ fontSize: '36px', fontWeight: 700, color: getScoreColor(report.healthScore) }}>
                  {report.healthScore}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  / 100
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                {report.healthScore >= 90 ? 'Optimal Health' : report.healthScore >= 70 ? 'Fair Condition' : 'Needs Attention'}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overall Integrity Score</span>
            </div>

            {/* Diagnostic Summary & Pragma Status */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Diagnostic Assessment</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {report.summary}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '14px' }}>
                  {/* Integrity Check */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <ShieldCheck size={16} color="#6366f1" />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Integrity Check</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}>
                      {report.integrityOk ? (
                        <>
                          <CheckCircle2 size={16} color="#10b981" />
                          <span style={{ color: '#10b981' }}>Passed (OK)</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} color="#f43f5e" />
                          <span style={{ color: '#f43f5e' }}>{report.integrityErrors.length} Errors</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Check */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Zap size={16} color="#f59e0b" />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quick Check</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}>
                      {report.quickCheckOk ? (
                        <>
                          <CheckCircle2 size={16} color="#10b981" />
                          <span style={{ color: '#10b981' }}>Passed (OK)</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={16} color="#f43f5e" />
                          <span style={{ color: '#f43f5e' }}>{report.quickCheckErrors.length} Errors</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Foreign Key Violations */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Database size={16} color="#ec4899" />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>FK Constraints</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}>
                      {report.foreignKeyViolations.length === 0 ? (
                        <>
                          <CheckCircle2 size={16} color="#10b981" />
                          <span style={{ color: '#10b981' }}>No Violations</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} color="#f59e0b" />
                          <span style={{ color: '#f59e0b' }}>{report.foreignKeyViolations.length} Orphan Rows</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Fragmentation & Freelist Analysis */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <HardDrive size={18} color="#6366f1" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Storage & Freelist Fragmentation</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Allocated Size</span>
                <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>
                  {formatBytes(report.storage.totalSizeBytes)}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{report.storage.pageCount.toLocaleString()} pages</span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Freelist (Unused Space)</span>
                <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px', color: report.storage.unusedSizeBytes > 0 ? '#f59e0b' : 'inherit' }}>
                  {formatBytes(report.storage.unusedSizeBytes)}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{report.storage.freelistCount.toLocaleString()} freelist pages</span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unused Ratio</span>
                <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>
                  {report.storage.unusedPercentage.toFixed(1)}%
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reclaimable via VACUUM</span>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Page Size</span>
                <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>
                  {report.storage.pageSize.toLocaleString()} B
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SQLite default page</span>
              </div>
            </div>

            {/* Unused Progress Bar */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', flexWrap: 'wrap', gap: 6 }}>
                <span>Storage Utilization</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Active: {(100 - report.storage.unusedPercentage).toFixed(1)}% | Fragmented: {report.storage.unusedPercentage.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${100 - report.storage.unusedPercentage}%`, backgroundColor: '#6366f1' }} />
                <div style={{ width: `${report.storage.unusedPercentage}%`, backgroundColor: '#f59e0b' }} />
              </div>
            </div>
          </div>

          {/* Foreign Key Violations Table if any */}
          {report.foreignKeyViolations.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <AlertTriangle size={18} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Orphan Foreign Key References</h3>
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Child Table</th>
                      <th>Row ID</th>
                      <th>Referenced Parent</th>
                      <th>FK Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.foreignKeyViolations.map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{v.tableName}</td>
                        <td><code>{v.rowId}</code></td>
                        <td style={{ color: '#ec4899' }}>{v.parentTable}</td>
                        <td><code>FK #{v.fkid}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Maintenance & Defragmentation Actions */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Layers size={18} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Database Maintenance Actions</h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Reorganize B-tree database pages, rebuild indices, and reclaim unused disk space from the freelist.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
              {/* In-place VACUUM */}
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>In-Place Defragmentation</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                    Runs <code>VACUUM</code> on the active database to defragment pages and truncate unused disk allocations.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleVacuum(false)}
                  disabled={vacuuming}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <RefreshCw size={14} className={vacuuming ? 'animate-spin' : ''} />
                  Run In-Place VACUUM
                </button>
              </div>

              {/* VACUUM INTO Backup */}
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Safe Clean Backup (VACUUM INTO)</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    Creates a pristine, defragmented backup copy of the database without interrupting readers or writers.
                  </p>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. backup_clean.db"
                    value={vacuumIntoPath}
                    onChange={(e) => setVacuumIntoPath(e.target.value)}
                    style={{ width: '100%', marginBottom: '12px', fontSize: '12px' }}
                  />
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleVacuum(true)}
                  disabled={vacuuming || !vacuumIntoPath.trim()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <ArrowRight size={14} />
                  Execute VACUUM INTO
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
