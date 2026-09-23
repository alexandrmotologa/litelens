import React, { useState, useEffect } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Edit2,
  ExternalLink,
  Download,
  AlertCircle,
  FileCode,
  Key,
  Layers,
} from 'lucide-react'
import { api, PaginatedDataResponse, TableInfo, ForeignKeyInfo } from '../api/client'

interface VirtualGridProps {
  tableName: string
  tableInfo: TableInfo | null
  onNavigateToTable: (targetTable: string, filter?: string) => void
  onInspectCell: (colName: string, value: any, colType: string) => void
  onOpenAddRow: () => void
  onOpenEditRow: (row: Record<string, any>) => void
  onOpenMobileTables?: () => void
}

export const VirtualGrid: React.FC<VirtualGridProps> = ({
  tableName,
  tableInfo,
  onNavigateToTable,
  onInspectCell,
  onOpenAddRow,
  onOpenEditRow,
  onOpenMobileTables,
}) => {
  const [data, setData] = useState<PaginatedDataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [sortCol, setSortCol] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC')
  const [filterQuery, setFilterQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.fetchTableData(tableName, page, limit, sortCol, sortOrder, activeFilter)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Failed loading table data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    setSortCol('')
    setSortOrder('ASC')
    setFilterQuery('')
    setActiveFilter('')
  }, [tableName])

  useEffect(() => {
    loadData()
  }, [tableName, page, limit, sortCol, sortOrder, activeFilter])

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortOrder === 'ASC') {
        setSortOrder('DESC')
      } else {
        setSortCol('')
        setSortOrder('ASC')
      }
    } else {
      setSortCol(col)
      setSortOrder('ASC')
    }
  }

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setActiveFilter(filterQuery.trim())
  }

  const handleDeleteRow = async (row: Record<string, any>) => {
    // Find primary key column(s)
    const pkCols = tableInfo?.columns.filter((c) => c.primaryKey > 0) || []
    const where: Record<string, any> = {}

    if (pkCols.length > 0) {
      for (const pk of pkCols) {
        where[pk.name] = row[pk.name]
      }
    } else if ('id' in row) {
      where['id'] = row['id']
    } else if ('rowid' in row) {
      where['rowid'] = row['rowid']
    } else {
      alert('Cannot delete row: Table has no primary key defined.')
      return
    }

    if (!confirm(`Are you sure you want to delete this row?`)) {
      return
    }

    try {
      await api.deleteRow(tableName, where)
      loadData()
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  const exportCSV = () => {
    if (!data || data.rows.length === 0) return
    const cols = data.columns
    const csvRows = [cols.join(',')]

    for (const r of data.rows) {
      const values = cols.map((col) => {
        const val = r[col]
        if (val === null || val === undefined) return ''
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      })
      csvRows.push(values.join(','))
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tableName}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.totalRows / limit)) : 1

  // FK lookup map
  const fkMap = new Map<string, ForeignKeyInfo>()
  if (tableInfo?.foreignKeys) {
    for (const fk of tableInfo.foreignKeys) {
      fkMap.set(fk.from.toLowerCase(), fk)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Grid Toolbar */}
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, flex: '1 1 auto' }}>
          {onOpenMobileTables && (
            <button
              onClick={onOpenMobileTables}
              className="btn-secondary"
              style={{ fontSize: 12, padding: '5px 10px', gap: 5, borderRadius: 6 }}
              title="Browse Schema Tables"
            >
              <Layers size={13} color="var(--accent-cyan)" />
              <span>Tables</span>
            </button>
          )}

          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <span>{tableName}</span>
            {data && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                ({data.totalRows.toLocaleString()} rows • {data.durationMs.toFixed(1)} ms)
              </span>
            )}
          </h2>

          <form onSubmit={handleApplyFilter} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px', maxWidth: 420 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                flex: 1,
                minWidth: 140,
              }}
            >
              <Filter size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="WHERE status = 'active'..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  width: '100%',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <button type="submit" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
              Filter
            </button>
            {activeFilter && (
              <button
                type="button"
                onClick={() => {
                  setFilterQuery('')
                  setActiveFilter('')
                }}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: 12, color: 'var(--accent-rose)' }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onOpenAddRow}
            className="btn-primary"
            style={{ fontSize: 12, padding: '5px 10px' }}
          >
            <Plus size={14} />
            <span>Add Row</span>
          </button>

          <button
            onClick={exportCSV}
            className="btn-secondary"
            style={{ fontSize: 12, padding: '5px 10px' }}
            title="Export current view to CSV"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary"
            style={{ fontSize: 12, padding: '5px 10px' }}
            title="Refresh Table Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error Message */}
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

      {/* Grid Table Container */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {data && (
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
                zIndex: 10,
                boxShadow: '0 1px 0 var(--border-subtle)',
              }}
            >
              <tr>
                <th
                  style={{
                    padding: '8px 12px',
                    width: 70,
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-subtle)',
                    textAlign: 'center',
                  }}
                >
                  #
                </th>
                {data.columns.map((col, idx) => {
                  const isSorted = sortCol === col
                  const type = data.columnTypes[idx] || 'ANY'
                  const colMeta = tableInfo?.columns.find((c) => c.name.toLowerCase() === col.toLowerCase())
                  const isPK = colMeta && colMeta.primaryKey > 0
                  const isFK = fkMap.has(col.toLowerCase())

                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{
                        padding: '8px 12px',
                        color: isSorted ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--border-subtle)',
                        borderRight: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isPK && (
                          <span title="Primary Key">
                            <Key size={12} color="#fbbf24" />
                          </span>
                        )}
                        <span>{col}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                          }}
                        >
                          {type}
                        </span>
                        {isFK && (
                          <span
                            title={`Foreign Key -> ${fkMap.get(col.toLowerCase())?.table}`}
                            style={{
                              fontSize: 10,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: 'rgba(168, 85, 247, 0.2)',
                              color: '#d8b4fe',
                            }}
                          >
                            FK
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                          {isSorted ? (
                            sortOrder === 'ASC' ? (
                              <ArrowUp size={12} color="var(--accent-cyan)" />
                            ) : (
                              <ArrowDown size={12} color="var(--accent-cyan)" />
                            )
                          ) : (
                            <ArrowUpDown size={11} color="var(--text-dim)" />
                          )}
                        </span>
                      </div>
                    </th>
                  )
                })}
                <th
                  style={{
                    padding: '8px 12px',
                    width: 80,
                    textAlign: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIdx) => {
                const rowNumber = (page - 1) * limit + rowIdx + 1
                return (
                  <tr
                    key={rowIdx}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td
                      style={{
                        padding: '6px 12px',
                        textAlign: 'center',
                        color: 'var(--text-dim)',
                        borderRight: '1px solid var(--border-subtle)',
                      }}
                    >
                      {rowNumber}
                    </td>

                    {data.columns.map((col, cIdx) => {
                      const val = row[col]
                      const colType = data.columnTypes[cIdx] || 'ANY'
                      const fk = fkMap.get(col.toLowerCase())

                      const isNull = val === null || val === undefined
                      const strVal = isNull ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)
                      const isLong = strVal.length > 40

                      return (
                        <td
                          key={col}
                          onDoubleClick={() => onInspectCell(col, val, colType)}
                          style={{
                            padding: '6px 12px',
                            color: isNull ? 'var(--text-dim)' : 'var(--text-primary)',
                            fontStyle: isNull ? 'italic' : 'normal',
                            borderRight: '1px solid var(--border-subtle)',
                            maxWidth: 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{strVal}</span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {fk && !isNull && (
                                <button
                                  title={`Jump to ${fk.table}.${fk.to} = ${val}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onNavigateToTable(fk.table, `${fk.to} = '${val}'`)
                                  }}
                                  style={{ color: '#a855f7', padding: '1px 3px' }}
                                >
                                  <ExternalLink size={11} />
                                </button>
                              )}

                              {isLong && (
                                <button
                                  title="Expand & Inspect Cell"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onInspectCell(col, val, colType)
                                  }}
                                  style={{ color: 'var(--text-muted)', padding: '1px 3px' }}
                                >
                                  <FileCode size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      )
                    })}

                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button
                          title="Edit Row"
                          onClick={() => onOpenEditRow(row)}
                          style={{ color: 'var(--text-muted)', padding: 3 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          title="Delete Row"
                          onClick={() => handleDeleteRow(row)}
                          style={{ color: 'var(--text-muted)', padding: 3 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-rose)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={data.columns.length + 2}
                    style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No records found in this table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          minHeight: 46,
          height: 'auto',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          padding: '8px 16px',
          gap: 10,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value))
              setPage(1)
            }}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            Page {page} of {totalPages}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11 }}
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11 }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11 }}
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11 }}
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
