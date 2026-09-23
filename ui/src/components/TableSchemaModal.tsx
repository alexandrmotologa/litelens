import React, { useState } from 'react'
import { X, Copy, Check, Table, Key, Link2, Shield, Layers } from 'lucide-react'
import { TableInfo } from '../api/client'

interface TableSchemaModalProps {
  table: TableInfo
  onClose: () => void
}

export const TableSchemaModal: React.FC<TableSchemaModalProps> = ({ table, onClose }) => {
  const [copied, setCopied] = useState(false)

  const handleCopyDDL = () => {
    navigator.clipboard.writeText(table.sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          maxWidth: 780,
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
            <Table size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
              Schema Definition: <span style={{ color: 'var(--accent-cyan)' }}>{table.name}</span>
            </h3>
            <span className="badge badge-cyan">{table.type.toUpperCase()}</span>
          </div>

          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Columns */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 8 }}>
              Columns ({table.columns.length})
            </h4>
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Name</th>
                    <th style={{ padding: '6px 10px' }}>Type</th>
                    <th style={{ padding: '6px 10px' }}>Nullability</th>
                    <th style={{ padding: '6px 10px' }}>Default</th>
                    <th style={{ padding: '6px 10px' }}>Key</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((c) => (
                    <tr key={c.name} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '6px 10px', color: '#f8fafc', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--accent-cyan)' }}>{c.type || 'ANY'}</td>
                      <td style={{ padding: '6px 10px', color: c.notNull ? '#f43f5e' : 'var(--text-muted)' }}>
                        {c.notNull ? 'NOT NULL' : 'NULL'}
                      </td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-dim)' }}>
                        {c.defaultValue !== null ? c.defaultValue : '-'}
                      </td>
                      <td style={{ padding: '6px 10px', color: '#fbbf24' }}>
                        {c.primaryKey > 0 ? `PK (#${c.primaryKey})` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Indexes */}
          {table.indexes.length > 0 && (
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 8 }}>
                Indexes ({table.indexes.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {table.indexes.map((idx) => (
                  <div
                    key={idx.name}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{idx.name}</span>
                      {idx.unique && <span className="badge badge-green">UNIQUE</span>}
                    </div>
                    {idx.sql && (
                      <code style={{ display: 'block', marginTop: 4, color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        {idx.sql}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Foreign Keys */}
          {table.foreignKeys.length > 0 && (
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 8 }}>
                Foreign Keys ({table.foreignKeys.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {table.foreignKeys.map((fk, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Link2 size={14} color="#a855f7" />
                    <span>
                      {fk.from} → <strong>{fk.table}</strong>({fk.to})
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      ON UPDATE {fk.onUpdate || 'NO ACTION'} • ON DELETE {fk.onDelete || 'NO ACTION'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DDL SQL */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>Table DDL</h4>
              <button onClick={handleCopyDDL} className="btn-secondary" style={{ fontSize: 11, padding: '3px 8px' }}>
                {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy DDL'}</span>
              </button>
            </div>
            <pre
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: '#38bdf8',
                overflowX: 'auto',
                lineHeight: 1.5,
              }}
            >
              {table.sql}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
