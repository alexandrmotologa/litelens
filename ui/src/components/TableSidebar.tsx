import React, { useState } from 'react'
import { Table, Eye, Search, Layers, Key, ShieldAlert, X } from 'lucide-react'
import { SchemaMetadata, TableInfo } from '../api/client'

interface TableSidebarProps {
  schema: SchemaMetadata | null
  selectedTable: string | null
  onSelectTable: (name: string) => void
  onInspectTableSchema: (table: TableInfo) => void
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

export const TableSidebar: React.FC<TableSidebarProps> = ({
  schema,
  selectedTable,
  onSelectTable,
  onInspectTableSchema,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const tables = (schema?.tables || []).filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const views = (schema?.views || []).filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <aside className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Layers size={15} color="var(--accent-cyan)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>Database Schema</span>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            style={{
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close sidebar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search schema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Tables & Views List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {/* Tables Section */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Tables</span>
            <span>{tables.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {tables.map((t) => {
              const isSelected = selectedTable === t.name
              return (
                <div
                  key={t.name}
                  onClick={() => onSelectTable(t.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.3)' : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Table size={14} color={isSelected ? '#38bdf8' : 'var(--text-muted)'} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? '#f8fafc' : 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.rowCount.toLocaleString()}
                    </span>

                    <button
                      title="Inspect Schema & DDL"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInspectTableSchema(t)
                      }}
                      style={{
                        padding: '2px 4px',
                        borderRadius: 4,
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Layers size={13} />
                    </button>
                  </div>
                </div>
              )
            })}

            {tables.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                No tables found
              </div>
            )}
          </div>
        </div>

        {/* Views Section */}
        {views.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Views</span>
              <span>{views.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {views.map((v) => {
                const isSelected = selectedTable === v.name
                return (
                  <div
                    key={v.name}
                    onClick={() => onSelectTable(v.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                      border: `1px solid ${isSelected ? 'rgba(168, 85, 247, 0.3)' : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Eye size={14} color={isSelected ? '#c084fc' : 'var(--text-muted)'} />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? '#f8fafc' : 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {v.name}
                      </span>
                    </div>

                    <button
                      title="Inspect View DDL"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInspectTableSchema(v)
                      }}
                      style={{
                        padding: '2px 4px',
                        borderRadius: 4,
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#c084fc')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Layers size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {schema && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 11,
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Page Size: {schema.pageSize} B</span>
          <span>{schema.pageCount} Pages</span>
        </div>
      )}
    </aside>
  )
}
