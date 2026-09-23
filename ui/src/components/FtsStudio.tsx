import React, { useState, useEffect } from 'react'
import {
  Search,
  Sparkles,
  Plus,
  BookOpen,
  Sliders,
  Check,
  Code,
  Layers,
  RefreshCw,
  AlertCircle,
  Hash,
} from 'lucide-react'
import { api, FtsTableInfo, CreateFtsRequest, TableInfo } from '../api/client'

export const FtsStudio: React.FC = () => {
  const [ftsTables, setFtsTables] = useState<FtsTableInfo[]>([])
  const [selectedFtsTable, setSelectedFtsTable] = useState<string>('')
  const [matchQuery, setMatchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    columns: string[]
    rows: Record<string, any>[]
    durationMs: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Creation Wizard Modal State
  const [showWizard, setShowWizard] = useState(false)
  const [schemaTables, setSchemaTables] = useState<TableInfo[]>([])
  const [wizardSourceTable, setWizardSourceTable] = useState('')
  const [wizardFtsName, setWizardFtsName] = useState('')
  const [wizardCols, setWizardCols] = useState<string[]>([])
  const [wizardTokenizer, setWizardTokenizer] = useState('porter unicode61')
  const [wizardWithTriggers, setWizardWithTriggers] = useState(true)
  const [wizardPopulate, setWizardPopulate] = useState(true)
  const [wizardCreating, setWizardCreating] = useState(false)

  const loadFtsTables = async () => {
    setLoading(true)
    setError(null)
    try {
      const tables = await api.fetchFtsTables()
      setFtsTables(tables)
      if (tables.length > 0 && !selectedFtsTable) {
        setSelectedFtsTable(tables[0].name)
      }
    } catch (err: any) {
      setError(err.message || 'Failed fetching FTS5 tables')
    } finally {
      setLoading(false)
    }
  }

  const loadSchema = async () => {
    try {
      const meta = await api.fetchSchema()
      setSchemaTables(meta.tables)
      if (meta.tables.length > 0 && !wizardSourceTable) {
        setWizardSourceTable(meta.tables[0].name)
        setWizardFtsName(`${meta.tables[0].name}_fts`)
        setWizardCols(meta.tables[0].columns.map((c) => c.name))
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadFtsTables()
    loadSchema()
  }, [])

  const currentFts = ftsTables.find((t) => t.name === selectedFtsTable)

  const handleSearch = async () => {
    if (!selectedFtsTable) return
    setSearching(true)
    setError(null)
    try {
      let querySql: string
      if (!matchQuery.trim()) {
        querySql = `SELECT rowid, * FROM "${selectedFtsTable}" LIMIT 50;`
      } else {
        // Safe escaping for MATCH literal
        const escaped = matchQuery.replace(/'/g, "''")
        const highlightCols = (currentFts?.columns || [])
          .slice(0, 3)
          .map((c, i) => `highlight("${selectedFtsTable}", ${i}, '<mark>', '</mark>') as "${c}_snippet"`)
          .join(', ')

        const selectParts = highlightCols ? `rowid, bm25("${selectedFtsTable}") as bm25_rank, ${highlightCols}, *` : `rowid, bm25("${selectedFtsTable}") as bm25_rank, *`
        querySql = `SELECT ${selectParts} FROM "${selectedFtsTable}" WHERE "${selectedFtsTable}" MATCH '${escaped}' ORDER BY bm25_rank LIMIT 50;`
      }

      const res = await api.executeQuery(querySql)
      setSearchResults({
        columns: res.columns,
        rows: res.rows,
        durationMs: res.durationMs,
      })
    } catch (err: any) {
      setError(err.message || 'Search execution failed')
    } finally {
      setSearching(false)
    }
  }

  const appendOperator = (op: string) => {
    setMatchQuery((prev) => {
      const trimmed = prev.trim()
      if (!trimmed) return op
      return `${trimmed} ${op}`
    })
  }

  const handleCreateFts = async () => {
    if (!wizardFtsName.trim() || wizardCols.length === 0) return
    setWizardCreating(true)
    try {
      const req: CreateFtsRequest = {
        ftsTableName: wizardFtsName.trim(),
        sourceTable: wizardSourceTable,
        columns: wizardCols,
        tokenizer: wizardTokenizer,
        withTriggers: wizardWithTriggers,
        populateData: wizardPopulate,
      }
      await api.createFtsTable(req)
      setShowWizard(false)
      await loadFtsTables()
      setSelectedFtsTable(wizardFtsName.trim())
    } catch (err: any) {
      alert('Failed creating FTS table: ' + err.message)
    } finally {
      setWizardCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header Toolbar */}
      <div
        style={{
          padding: '14px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={18} color="#6366f1" />
            <span style={{ fontWeight: 600, fontSize: '15px' }}>FTS5 Full-Text Search Studio</span>
          </div>

          {ftsTables.length > 0 && (
            <select
              value={selectedFtsTable}
              onChange={(e) => {
                setSelectedFtsTable(e.target.value)
                setSearchResults(null)
              }}
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {ftsTables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.rowCount} rows)
                </option>
              ))}
            </select>
          )}

          {currentFts && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                Tokenizer: <code>{currentFts.tokenizer}</code>
              </span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                Indexed Columns: {currentFts.columns.join(', ')}
              </span>
            </div>
          )}
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setShowWizard(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}
        >
          <Plus size={14} />
          Create FTS5 Virtual Table
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {ftsTables.length === 0 && !loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <BookOpen size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>No FTS5 Tables Found</h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '14px', maxWidth: '440px', textAlign: 'center' }}>
              Full-Text Search tables enable BM25 ranked queries, phrase searching, and keyword highlighting across your text columns.
            </p>
            <button className="btn btn-primary" onClick={() => setShowWizard(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} />
              Create FTS5 Table from Existing Schema
            </button>
          </div>
        ) : (
          <>
            {/* Visual Query Builder Bar */}
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter MATCH query (e.g. database OR sqlite, or &quot;exact phrase&quot;, or test*)..."
                    value={matchQuery}
                    onChange={(e) => setMatchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch()
                    }}
                    style={{ width: '100%', height: '36px', fontSize: '13px' }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleSearch}
                  disabled={searching}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px' }}
                >
                  <Search size={14} />
                  <span>{searching ? 'Searching...' : 'Search'}</span>
                </button>
              </div>

              {/* Operator Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Insert Syntax:</span>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => appendOperator('AND')}>
                  AND
                </button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => appendOperator('OR')}>
                  OR
                </button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => appendOperator('NOT')}>
                  NOT
                </button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => appendOperator('"phrase"')}>
                  "phrase"
                </button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => appendOperator('term*')}>
                  prefix*
                </button>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setMatchQuery('')}>
                  Clear
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div style={{ margin: 16, padding: '12px 16px', borderRadius: 8, backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid #f43f5e', color: '#fb7185', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Results Grid */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {searchResults ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      Search Results ({searchResults.rows.length} hits)
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Execution time: {searchResults.durationMs.toFixed(2)} ms
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <table className="table" style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          {searchResults.columns.map((col) => (
                            <th key={col} style={{ padding: '8px 12px' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {searchResults.columns.map((col) => {
                              const val = row[col]
                              const isSnippet = col.endsWith('_snippet')
                              const isRank = col === 'bm25_rank'

                              if (isRank) {
                                const rankNum = typeof val === 'number' ? val : parseFloat(val)
                                return (
                                  <td key={col} style={{ padding: '8px 12px', color: '#6366f1', fontWeight: 600 }}>
                                    {isNaN(rankNum) ? String(val) : rankNum.toFixed(4)}
                                  </td>
                                )
                              }

                              if (isSnippet && typeof val === 'string') {
                                return (
                                  <td
                                    key={col}
                                    style={{ padding: '8px 12px' }}
                                    dangerouslySetInnerHTML={{ __html: val }}
                                  />
                                )
                              }

                              return (
                                <td key={col} style={{ padding: '8px 12px' }}>
                                  {val === null ? <span style={{ color: 'var(--text-muted)' }}>NULL</span> : String(val)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40, fontSize: '14px' }}>
                  Execute a query above to see ranked search results and snippet highlights.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Creation Wizard Modal */}
      {showWizard && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 24,
              width: '540px',
              maxWidth: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Create FTS5 Virtual Table</h3>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowWizard(false)} style={{ padding: '4px 8px' }}>
                ✕
              </button>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Source Table
              </label>
              <select
                className="input"
                value={wizardSourceTable}
                onChange={(e) => {
                  const tbl = e.target.value
                  setWizardSourceTable(tbl)
                  setWizardFtsName(`${tbl}_fts`)
                  const found = schemaTables.find((t) => t.name === tbl)
                  if (found) {
                    setWizardCols(found.columns.map((c) => c.name))
                  }
                }}
                style={{ width: '100%', height: 34, fontSize: 13 }}
              >
                {schemaTables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                FTS5 Virtual Table Name
              </label>
              <input
                type="text"
                className="input"
                value={wizardFtsName}
                onChange={(e) => setWizardFtsName(e.target.value)}
                style={{ width: '100%', height: 34, fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Columns to Index
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 120, overflowY: 'auto' }}>
                {schemaTables
                  .find((t) => t.name === wizardSourceTable)
                  ?.columns.map((col) => {
                    const checked = wizardCols.includes(col.name)
                    return (
                      <button
                        key={col.name}
                        onClick={() => {
                          if (checked) {
                            setWizardCols(wizardCols.filter((c) => c !== col.name))
                          } else {
                            setWizardCols([...wizardCols, col.name])
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: checked ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-elevated)',
                          border: `1px solid ${checked ? '#6366f1' : 'var(--border-subtle)'}`,
                          color: checked ? '#818cf8' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {checked && <Check size={12} />}
                        <span>{col.name}</span>
                      </button>
                    )
                  })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Tokenizer
              </label>
              <select
                className="input"
                value={wizardTokenizer}
                onChange={(e) => setWizardTokenizer(e.target.value)}
                style={{ width: '100%', height: 34, fontSize: 13 }}
              >
                <option value="porter unicode61">porter unicode61 (English stemming + Unicode)</option>
                <option value="unicode61">unicode61 (Universal Unicode)</option>
                <option value="ascii">ascii (Standard 7-bit ASCII)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={wizardWithTriggers}
                  onChange={(e) => setWizardWithTriggers(e.target.checked)}
                />
                <span>Attach synchronization triggers (AFTER INSERT/UPDATE/DELETE)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={wizardPopulate}
                  onChange={(e) => setWizardPopulate(e.target.checked)}
                />
                <span>Populate with existing rows from source table</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowWizard(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateFts}
                disabled={wizardCreating || !wizardFtsName.trim() || wizardCols.length === 0}
              >
                {wizardCreating ? 'Creating Table...' : 'Build FTS5 Index'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
