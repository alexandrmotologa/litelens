import React, { useState, useEffect } from 'react'
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  Database,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { api, TableInfo, ImportResult } from '../api/client'

export const TransferHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [tables, setTables] = useState<TableInfo[]>([])

  // Export State
  const [exportScope, setExportScope] = useState<'all' | 'table'>('table')
  const [exportTable, setExportTable] = useState('')
  const [exportFormat, setExportFormat] = useState<'sql' | 'csv' | 'jsonl'>('sql')

  // Import State
  const [importTable, setImportTable] = useState('')
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv')
  const [importCreateTable, setImportCreateTable] = useState(true)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    const loadTables = async () => {
      try {
        const meta = await api.fetchSchema()
        setTables(meta.tables)
        if (meta.tables.length > 0 && !exportTable) {
          setExportTable(meta.tables[0].name)
          setImportTable(`imported_${meta.tables[0].name}`)
        }
      } catch (err) {
        console.error('Failed loading tables for TransferHub', err)
      }
    }
    loadTables()
  }, [])

  const handleDownload = () => {
    const target = exportScope === 'table' ? exportTable : undefined
    const url = api.getExportUrl(target, exportFormat)
    const link = document.createElement('a')
    link.href = url
    link.download = ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setImportFile(f)
      const name = f.name.replace(/\.[^/.]+$/, '')
      setImportTable(name)
      if (f.name.endsWith('.csv')) {
        setImportFormat('csv')
      } else if (f.name.endsWith('.json') || f.name.endsWith('.jsonl')) {
        setImportFormat('json')
      }
    }
  }

  const handleExecuteImport = async () => {
    if (!importTable.trim()) return
    setImporting(true)
    setImportError(null)
    setImportResult(null)

    try {
      let res: ImportResult
      if (importFile) {
        const fd = new FormData()
        fd.append('file', importFile)
        res = await api.importData(importTable.trim(), importFormat, importCreateTable, fd)
      } else if (rawText.trim()) {
        res = await api.importData(importTable.trim(), importFormat, importCreateTable, rawText.trim())
      } else {
        throw new Error('Please select a file or paste data to import')
      }
      setImportResult(res)
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24, gap: 20 }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={20} color="#6366f1" />
          <span>Import & Export Data Hub</span>
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Zero-overhead data pipeline for SQL dumps, CSV streaming, newline-delimited JSONL, and automatic schema inference.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab('export')}
          className={`btn-secondary ${activeTab === 'export' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'export' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeTab === 'export' ? '#818cf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'export' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
          }}
        >
          <Download size={14} />
          <span>Export Data & Dumps</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`btn-secondary ${activeTab === 'import' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'import' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeTab === 'import' ? '#818cf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'import' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
          }}
        >
          <Upload size={14} />
          <span>Import CSV & JSON</span>
        </button>
      </div>

      {/* Tab 1: Export */}
      {activeTab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', margin: 0 }}>Configure Export Target</h3>

            {/* Scope */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Export Scope:
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={exportScope === 'table'}
                    onChange={() => setExportScope('table')}
                  />
                  <span>Single Table</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={exportScope === 'all'}
                    onChange={() => {
                      setExportScope('all')
                      setExportFormat('sql')
                    }}
                  />
                  <span>Entire Database (Full SQL Dump)</span>
                </label>
              </div>
            </div>

            {/* Table Selector */}
            {exportScope === 'table' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Select Table:
                </label>
                <select
                  className="input"
                  value={exportTable}
                  onChange={(e) => setExportTable(e.target.value)}
                  style={{ width: '320px', height: 34, fontSize: 13 }}
                >
                  {tables.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.rowCount} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Format Selection */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Output Format:
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setExportFormat('sql')}
                  style={{
                    border: `1px solid ${exportFormat === 'sql' ? '#6366f1' : 'var(--border-subtle)'}`,
                    background: exportFormat === 'sql' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                    color: exportFormat === 'sql' ? '#818cf8' : 'var(--text-secondary)',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <FileCode size={16} />
                  <span>SQL Dump (.sql)</span>
                </button>

                {exportScope === 'table' && (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setExportFormat('csv')}
                      style={{
                        border: `1px solid ${exportFormat === 'csv' ? '#6366f1' : 'var(--border-subtle)'}`,
                        background: exportFormat === 'csv' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                        color: exportFormat === 'csv' ? '#818cf8' : 'var(--text-secondary)',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <FileSpreadsheet size={16} />
                      <span>CSV (.csv)</span>
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => setExportFormat('jsonl')}
                      style={{
                        border: `1px solid ${exportFormat === 'jsonl' ? '#6366f1' : 'var(--border-subtle)'}`,
                        background: exportFormat === 'jsonl' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                        color: exportFormat === 'jsonl' ? '#818cf8' : 'var(--text-secondary)',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Database size={16} />
                      <span>JSONL (.jsonl)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Action */}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px' }}>
                <Download size={16} />
                <span>Download {exportFormat.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Import */}
      {activeTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', margin: 0 }}>Import Dataset</h3>

            {/* File Upload / Drag Drop */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Upload File (.csv, .json, .jsonl):
              </label>
              <input
                type="file"
                accept=".csv,.json,.jsonl"
                onChange={handleFileChange}
                style={{ fontSize: 13 }}
              />
            </div>

            {/* Or Paste Raw Content */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Or Paste Raw CSV / JSON Data:
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste CSV headers & rows, or a JSON array of objects here..."
                rows={5}
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Target Table & Options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Target Table Name:
                </label>
                <input
                  type="text"
                  className="input"
                  value={importTable}
                  onChange={(e) => setImportTable(e.target.value)}
                  style={{ width: '100%', height: 34, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Format:
                </label>
                <select
                  className="input"
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value as any)}
                  style={{ width: '100%', height: 34, fontSize: 13 }}
                >
                  <option value="csv">CSV (Comma-Separated)</option>
                  <option value="json">JSON / JSONL (Array of objects)</option>
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={importCreateTable}
                onChange={(e) => setImportCreateTable(e.target.checked)}
              />
              <span>Auto-create table if it doesn't exist (with automatic column type inference)</span>
            </label>

            {/* Success Result */}
            {importResult && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#34d399',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <CheckCircle size={18} />
                <div>
                  <strong>Import Succeeded!</strong> Inserted {importResult.rowsImported.toLocaleString()} rows into{' '}
                  <code>{importResult.tableName}</code> in {importResult.durationMs.toFixed(1)} ms.
                  {importResult.tableCreated && ' (New table schema created)'}
                </div>
              </div>
            )}

            {/* Error Result */}
            {importError && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid #f43f5e',
                  color: '#fb7185',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertTriangle size={18} />
                <span>{importError}</span>
              </div>
            )}

            <div>
              <button
                className="btn btn-primary"
                onClick={handleExecuteImport}
                disabled={importing || (!importFile && !rawText.trim()) || !importTable.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px' }}
              >
                <Upload size={16} />
                <span>{importing ? 'Importing Dataset...' : 'Execute Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
