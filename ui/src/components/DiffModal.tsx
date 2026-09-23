import React, { useState } from 'react'
import { GitCompare, Copy, Check, Download, AlertCircle, Plus, Trash2, Edit } from 'lucide-react'
import { api, DiffReport } from '../api/client'

interface DiffModalProps {
  currentDbPath: string
}

export const DiffModal: React.FC<DiffModalProps> = ({ currentDbPath }) => {
  const [targetPath, setTargetPath] = useState('')
  const [report, setReport] = useState<DiffReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedUp, setCopiedUp] = useState(false)
  const [copiedDown, setCopiedDown] = useState(false)
  const [sqlView, setSqlView] = useState<'up' | 'down'>('up')

  const handleCompare = async () => {
    if (!targetPath.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.compareDatabase(targetPath.trim())
      setReport(res)
    } catch (err: any) {
      setError(err.message || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const copySQL = (text: string, isUp: boolean) => {
    navigator.clipboard.writeText(text)
    if (isUp) {
      setCopiedUp(true)
      setTimeout(() => setCopiedUp(false), 2000)
    } else {
      setCopiedDown(true)
      setTimeout(() => setCopiedDown(false), 2000)
    }
  }

  const downloadSQL = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/sql;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24, gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitCompare size={20} color="var(--accent-cyan)" />
          <span>Database Schema Diff & Migration Generator</span>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Compares the active database schema against an external target database and produces reversible SQL DDL
          migrations.
        </p>
      </div>

      {/* Target input */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Target SQLite Database Path:
            </label>
            <input
              type="text"
              placeholder="e.g. C:\data\production_v2.db or ./migrations/target.sqlite"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={handleCompare}
            disabled={loading || !targetPath.trim()}
            className="btn-primary"
            style={{ alignSelf: 'flex-end', height: 38, padding: '0 18px' }}
          >
            <GitCompare size={15} />
            <span>{loading ? 'Comparing...' : 'Compare Schemas'}</span>
          </button>
        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 6, background: 'rgba(244,63,94,0.15)', color: '#fca5a5', fontSize: 12 }}>
            <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
                Detected Changes ({report.totalChanges})
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {currentDbPath} → {report.targetPath}
              </span>
            </div>

            {report.changes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.changes.map((ch, idx) => {
                  let badge = <span className="badge badge-green">ADD</span>
                  if (ch.type === 'DROP') badge = <span className="badge badge-rose">DROP</span>
                  if (ch.type === 'MODIFY') badge = <span className="badge badge-amber">MOD</span>

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {badge}
                        <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500 }}>
                          {ch.description}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        {ch.entityType}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                Both databases have identical schema definitions. No changes detected.
              </p>
            )}
          </div>

          {/* Generated Migration DDL */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setSqlView('up')}
                  className={`btn-secondary ${sqlView === 'up' ? 'active-nav' : ''}`}
                  style={{
                    background: sqlView === 'up' ? 'rgba(56,189,248,0.15)' : 'transparent',
                    color: sqlView === 'up' ? '#38bdf8' : 'var(--text-secondary)',
                  }}
                >
                  UP Migration SQL (Upgrade)
                </button>
                <button
                  onClick={() => setSqlView('down')}
                  className={`btn-secondary ${sqlView === 'down' ? 'active-nav' : ''}`}
                  style={{
                    background: sqlView === 'down' ? 'rgba(244,63,94,0.15)' : 'transparent',
                    color: sqlView === 'down' ? '#f43f5e' : 'var(--text-secondary)',
                  }}
                >
                  DOWN Migration SQL (Rollback)
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() =>
                    copySQL(sqlView === 'up' ? report.upMigrationSql : report.downMigrationSql, sqlView === 'up')
                  }
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  {(sqlView === 'up' ? copiedUp : copiedDown) ? (
                    <Check size={13} color="#10b981" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>{(sqlView === 'up' ? copiedUp : copiedDown) ? 'Copied' : 'Copy SQL'}</span>
                </button>

                <button
                  onClick={() =>
                    downloadSQL(
                      sqlView === 'up' ? report.upMigrationSql : report.downMigrationSql,
                      sqlView === 'up' ? 'migration_up.sql' : 'migration_down.sql'
                    )
                  }
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  <Download size={13} />
                  <span>Download .sql</span>
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
                color: sqlView === 'up' ? '#38bdf8' : '#fca5a5',
                overflowX: 'auto',
                lineHeight: 1.5,
              }}
            >
              {sqlView === 'up' ? report.upMigrationSql : report.downMigrationSql}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
