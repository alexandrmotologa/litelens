import React, { useState } from 'react'
import { X, Check, Save } from 'lucide-react'
import { api, TableInfo } from '../api/client'

interface RowEditModalProps {
  tableName: string
  tableInfo: TableInfo | null
  initialRow?: Record<string, any> | null
  onClose: () => void
  onSaved: () => void
}

export const RowEditModal: React.FC<RowEditModalProps> = ({
  tableName,
  tableInfo,
  initialRow,
  onClose,
  onSaved,
}) => {
  const isEditing = !!initialRow
  const columns = tableInfo?.columns || []

  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {}
    for (const col of columns) {
      if (initialRow && initialRow[col.name] !== undefined && initialRow[col.name] !== null) {
        vals[col.name] = typeof initialRow[col.name] === 'object'
          ? JSON.stringify(initialRow[col.name])
          : String(initialRow[col.name])
      } else {
        vals[col.name] = ''
      }
    }
    return vals
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, any> = {}
      for (const col of columns) {
        const raw = formValues[col.name]
        if (col.primaryKey > 0 && !isEditing && raw === '') {
          // Skip autoincrement primary key when adding new row
          continue
        }
        if (raw === '' && !col.notNull) {
          payload[col.name] = null
        } else {
          // Cast numbers if column is INTEGER or REAL
          const upperType = col.type.toUpperCase()
          if (upperType.includes('INT') && raw !== '') {
            payload[col.name] = parseInt(raw, 10)
          } else if ((upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE')) && raw !== '') {
            payload[col.name] = parseFloat(raw)
          } else {
            payload[col.name] = raw
          }
        }
      }

      if (isEditing) {
        const pkCols = columns.filter((c) => c.primaryKey > 0)
        const where: Record<string, any> = {}
        if (pkCols.length > 0) {
          for (const pk of pkCols) {
            where[pk.name] = initialRow[pk.name]
          }
        } else if ('id' in initialRow) {
          where['id'] = initialRow['id']
        } else {
          throw new Error('Table has no primary key defined')
        }

        await api.updateRow(tableName, where, payload)
      } else {
        await api.insertRow(tableName, payload)
      }

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
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
          maxWidth: 580,
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
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
            {isEditing ? `Edit Row in ${tableName}` : `Add New Row to ${tableName}`}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <div style={{ padding: 10, borderRadius: 6, background: 'rgba(244,63,94,0.15)', color: '#fca5a5', fontSize: 12 }}>
                {error}
              </div>
            )}

            {columns.map((col) => {
              const isPK = col.primaryKey > 0
              return (
                <div key={col.name}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {col.name} {isPK && <span style={{ color: '#fbbf24' }}>(Primary Key)</span>}
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {col.type || 'TEXT'} {col.notNull ? '• NOT NULL' : ''}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formValues[col.name] ?? ''}
                    onChange={(e) => setFormValues({ ...formValues, [col.name]: e.target.value })}
                    disabled={isPK && isEditing}
                    placeholder={isPK && !isEditing ? '(Auto-generated if empty)' : 'NULL'}
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary" style={{ fontSize: 12 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 12 }}>
              <Save size={13} />
              <span>{saving ? 'Saving...' : isEditing ? 'Update Row' : 'Insert Row'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
