import React, { useState } from 'react'
import { Play, Zap, History, Clock, FileCode, Check, AlertCircle } from 'lucide-react'
import { api, QueryResult, ExplainResponse } from '../api/client'
import { VisualPlanGraph } from './VisualPlanGraph'

interface QueryWorkbenchProps {
  initialQuery?: string
  onRefreshSchema?: () => void
}

interface SavedQuery {
  id: string
  title: string
  sql: string
  createdAt: string
}

const DIAGNOSTIC_RECIPES = [
  {
    name: 'Unindexed Foreign Keys',
    desc: 'Find FK columns missing index coverage (high scan penalty)',
    sql: `-- Unindexed Foreign Keys in Child Tables
SELECT m.name AS child_table, fk."from" AS fk_column, fk."table" AS parent_table, fk."to" AS parent_pk
FROM sqlite_schema m
JOIN pragma_foreign_key_list(m.name) fk
WHERE m.type = 'table'
  AND NOT EXISTS (
    SELECT 1 FROM pragma_index_list(m.name) il
    JOIN pragma_index_info(il.name) ii ON ii.name = fk."from"
  );`,
  },
  {
    name: 'Storage Footprint & Geometry',
    desc: 'Database page size, total pages, and freelist space',
    sql: `-- Database Storage Geometry
SELECT
  (SELECT * FROM pragma_page_count()) * (SELECT * FROM pragma_page_size()) AS total_bytes,
  (SELECT * FROM pragma_freelist_count()) * (SELECT * FROM pragma_page_size()) AS freelist_bytes,
  (SELECT * FROM pragma_freelist_count()) AS freelist_pages,
  (SELECT * FROM pragma_page_size()) AS page_size;`,
  },
  {
    name: 'Active Triggers Catalog',
    desc: 'Discover all active triggers and target tables',
    sql: `SELECT name, tbl_name, sql FROM sqlite_schema WHERE type = 'trigger' ORDER BY tbl_name;`,
  },
  {
    name: 'Index Catalog & Uniqueness',
    desc: 'List all indexes with uniqueness and parent tables',
    sql: `SELECT tbl_name, name, "unique", sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL ORDER BY tbl_name;`,
  },
]

export const QueryWorkbench: React.FC<QueryWorkbenchProps> = ({ initialQuery = '', onRefreshSchema }) => {
  const [sql, setSql] = useState(
    initialQuery || 'SELECT * FROM sqlite_master WHERE type IN (\'table\', \'view\');'
  )
  const [running, setRunning] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [plan, setPlan] = useState<ExplainResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'results' | 'plan'>('results')
  const [history, setHistory] = useState<string[]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => {
    try {
      const stored = localStorage.getItem('litelens_saved_queries')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [saveTitle, setSaveTitle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)

  const handleSaveQuery = () => {
    if (!saveTitle.trim() || !sql.trim()) return
    const newSaved: SavedQuery = {
      id: Date.now().toString(),
      title: saveTitle.trim(),
      sql: sql.trim(),
      createdAt: new Date().toISOString(),
    }
    const updated = [newSaved, ...savedQueries]
    setSavedQueries(updated)
    try {
      localStorage.setItem('litelens_saved_queries', JSON.stringify(updated))
    } catch {}
    setSaveTitle('')
    setShowSaveModal(false)
  }

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedQueries.filter((q) => q.id !== id)
    setSavedQueries(updated)
    try {
      localStorage.setItem('litelens_saved_queries', JSON.stringify(updated))
    } catch {}
  }

  const handleExecute = async () => {
    if (!sql.trim()) return
    setRunning(true)
    setError(null)
    try {
      const res = await api.executeQuery(sql)
      setResult(res)
      setViewMode('results')

      // Auto-trigger explain in background so Visual Plan is instantly ready!
      api.explainQuery(sql).then((p) => setPlan(p)).catch(() => {})

      // Update history
      setHistory((prev) => [sql, ...prev.filter((q) => q !== sql).slice(0, 9)])
    } catch (err: any) {
      setError(err.message || 'Execution error')
    } finally {
      setRunning(false)
    }
  }

  const handleExplain = async () => {
    if (!sql.trim()) return
    setExplaining(true)
    setError(null)
    try {
      const p = await api.explainQuery(sql)
      setPlan(p)
      setViewMode('plan')
    } catch (err: any) {
      setError(err.message || 'Explain error')
    } finally {
      setExplaining(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Editor & Controls */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your SQLite query here (Ctrl+Enter to execute)..."
            rows={5}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.4)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleExecute}
              disabled={running}
              className="btn-primary"
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              <Play size={14} fill="#fff" />
              <span>{running ? 'Running...' : 'Run Query'}</span>
            </button>

            <button
              onClick={handleExplain}
              disabled={explaining}
              className="btn-secondary"
              style={{ fontSize: 13, padding: '6px 12px' }}
            >
              <Zap size={14} color="var(--accent-amber)" />
              <span>{explaining ? 'Analyzing...' : 'Explain Plan'}</span>
            </button>

            <button
              onClick={() => setShowSaveModal(true)}
              className="btn-secondary"
              style={{ fontSize: 13, padding: '6px 12px' }}
              title="Save current query"
            >
              <FileCode size={14} />
              <span>Save</span>
            </button>

            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>
              Press Ctrl+Enter
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Diagnostic Recipes Dropdown */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  setSql(e.target.value)
                  e.target.value = ''
                }
              }}
              style={{
                background: 'var(--bg-card)',
                color: '#6366f1',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <option value="">⚡ Diagnostic Recipes</option>
              {DIAGNOSTIC_RECIPES.map((rec, i) => (
                <option key={i} value={rec.sql}>
                  {rec.name}
                </option>
              ))}
            </select>

            {/* Saved Queries Dropdown */}
            {savedQueries.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setSql(e.target.value)
                    e.target.value = ''
                  }
                }}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  maxWidth: 160,
                }}
              >
                <option value="">Saved Queries ({savedQueries.length})</option>
                {savedQueries.map((q) => (
                  <option key={q.id} value={q.sql}>
                    {q.title}
                  </option>
                ))}
              </select>
            )}

            {/* History Dropdown */}
            {history.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) setSql(e.target.value)
                }}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  maxWidth: 150,
                }}
              >
                <option value="">History ({history.length})</option>
                {history.map((q, idx) => (
                  <option key={idx} value={q}>
                    {q.slice(0, 35)}...
                  </option>
                ))}
              </select>
            )}

            {result && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {result.rows.length.toLocaleString()} rows • {result.durationMs.toFixed(1)} ms
              </span>
            )}
          </div>
        </div>

        {/* Save Modal */}
        {showSaveModal && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>Query Title:</span>
            <input
              type="text"
              className="input"
              placeholder="e.g. Monthly revenue aggregation"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              style={{ flex: 1, height: 28, fontSize: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveQuery()
              }}
            />
            <button className="btn btn-primary" style={{ height: 28, padding: '0 12px', fontSize: 12 }} onClick={handleSaveQuery}>
              Save
            </button>
            <button className="btn btn-secondary" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setShowSaveModal(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
        }}
      >
        <button
          onClick={() => setViewMode('results')}
          style={{
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            borderBottom: `2px solid ${viewMode === 'results' ? 'var(--accent-cyan)' : 'transparent'}`,
            color: viewMode === 'results' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          }}
        >
          Query Results
        </button>

        <button
          onClick={() => setViewMode('plan')}
          style={{
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 500,
            borderBottom: `2px solid ${viewMode === 'plan' ? 'var(--accent-cyan)' : 'transparent'}`,
            color: viewMode === 'plan' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Zap size={14} color={viewMode === 'plan' ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
          <span>Visual Execution Plan & Advisor</span>
          {plan?.graph && (
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: plan.graph.optimizationScore >= 80 ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
                color: plan.graph.optimizationScore >= 80 ? '#6ee7b7' : '#fca5a5',
              }}
            >
              {plan.graph.optimizationScore}%
            </span>
          )}
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            margin: 12,
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {viewMode === 'results' ? (
          result ? (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                textAlign: 'left',
              }}
            >
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-surface)',
                  zIndex: 5,
                  boxShadow: '0 1px 0 var(--border-subtle)',
                }}
              >
                <tr>
                  <th style={{ padding: '8px 12px', width: 60, color: 'var(--text-muted)', textAlign: 'center' }}>
                    #
                  </th>
                  {result.columns.map((col, idx) => (
                    <th
                      key={col}
                      style={{
                        padding: '8px 12px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        borderRight: '1px solid var(--border-subtle)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                      <span
                        style={{
                          fontSize: 10,
                          marginLeft: 6,
                          color: 'var(--text-muted)',
                          fontWeight: 400,
                        }}
                      >
                        ({result.columnTypes[idx] || 'ANY'})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      {rIdx + 1}
                    </td>
                    {result.columns.map((col) => {
                      const val = row[col]
                      const isNull = val === null || val === undefined
                      return (
                        <td
                          key={col}
                          style={{
                            padding: '6px 12px',
                            color: isNull ? 'var(--text-dim)' : 'var(--text-primary)',
                            fontStyle: isNull ? 'italic' : 'normal',
                            borderRight: '1px solid var(--border-subtle)',
                            maxWidth: 320,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isNull ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {result.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={result.columns.length + 1}
                      style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      Query executed successfully with 0 rows returned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
              }}
            >
              Run a query to view results
            </div>
          )
        ) : (
          <VisualPlanGraph plan={plan} onRefreshSchema={onRefreshSchema} />
        )}
      </div>
    </div>
  )
}
