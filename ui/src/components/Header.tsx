import React from 'react'
import {
  Database,
  Activity,
  GitCompare,
  Code2,
  Cpu,
  Eye,
  Radio,
  GitFork,
  ShieldCheck,
  Search,
  ArrowDownUp,
  Menu,
  X,
  Layers,
} from 'lucide-react'
import { SchemaMetadata, WalDiagnostics } from '../api/client'

export type StudioTab =
  | 'data'
  | 'er'
  | 'query'
  | 'wal'
  | 'doctor'
  | 'fts'
  | 'vectors'
  | 'transfer'
  | 'diff'

interface HeaderProps {
  schema: SchemaMetadata | null
  wal: WalDiagnostics | null
  activeTab: StudioTab
  setActiveTab: (tab: StudioTab) => void
  isLiveEvent: boolean
  onToggleMobileSidebar?: () => void
  isMobileSidebarOpen?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  schema,
  wal,
  activeTab,
  setActiveTab,
  isLiveEvent,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}) => {
  const dbName = schema?.databasePath ? schema.databasePath.split(/[/\\]/).pop() : 'SQLite Database'
  const isWal = schema?.journalMode?.toLowerCase() === 'wal'
  const tableCount = (schema?.tables?.length || 0) + (schema?.views?.length || 0)

  const navItems: Array<{
    id: StudioTab
    label: string
    shortLabel?: string
    icon: React.ReactNode
    badge?: React.ReactNode
  }> = [
    { id: 'data', label: 'Tables', shortLabel: 'Tables', icon: <Database size={14} /> },
    { id: 'er', label: 'ER Diagram', shortLabel: 'ER Graph', icon: <GitFork size={14} /> },
    { id: 'query', label: 'Query & Plan', shortLabel: 'SQL', icon: <Code2 size={14} /> },
    {
      id: 'wal',
      label: 'WAL & Concurrency',
      shortLabel: 'WAL',
      icon: <Activity size={14} />,
      badge: wal?.totalFrames ? (
        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 10, background: '#0284c7', color: '#fff' }}>
          {wal.totalFrames}
        </span>
      ) : null,
    },
    { id: 'doctor', label: 'Doctor', shortLabel: 'Doctor', icon: <ShieldCheck size={14} /> },
    { id: 'fts', label: 'FTS5 Search', shortLabel: 'FTS5', icon: <Search size={14} /> },
    { id: 'vectors', label: 'Vectors & PCA', shortLabel: 'Vectors', icon: <Cpu size={14} /> },
    { id: 'transfer', label: 'Import / Export', shortLabel: 'Transfer', icon: <ArrowDownUp size={14} /> },
    { id: 'diff', label: 'Schema Diff', shortLabel: 'Diff', icon: <GitCompare size={14} /> },
  ]

  return (
    <header className="app-header">
      {/* Brand & Database Info Bar */}
      <div className="header-brand-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
              flexShrink: 0,
            }}
          >
            <Eye size={18} color="#ffffff" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              LiteLens
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(56,189,248,0.15)',
                color: '#38bdf8',
                fontWeight: 600,
              }}
            >
              v1.1
            </span>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Database Meta Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={schema?.databasePath || dbName}
            >
              <Database size={13} color="#94a3b8" />
              {dbName}
            </span>

            {schema && (
              <>
                <span className={`badge ${isWal ? 'badge-green' : 'badge-amber'}`} style={{ display: 'none', minWidth: 'unset' }}>
                  {schema.journalMode.toUpperCase()}
                </span>

                <span
                  className={`badge ${isWal ? 'badge-green' : 'badge-amber'}`}
                  title={`Journal Mode: ${schema.journalMode}`}
                >
                  {schema.journalMode.toUpperCase()}
                </span>

                <span className="badge badge-cyan" title={`SQLite Engine ${schema.sqliteVersion}`}>
                  v{schema.sqliteVersion}
                </span>

                {schema.sizeBytes > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(schema.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </>
            )}

            {/* SSE Live activity beacon */}
            <div
              title={isLiveEvent ? 'Write activity detected in real time' : 'Monitoring WAL file changes'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 7px',
                borderRadius: 12,
                background: isLiveEvent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isLiveEvent ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                fontSize: 11,
                color: isLiveEvent ? '#34d399' : 'var(--text-muted)',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Radio size={11} className={isLiveEvent ? 'animate-pulse' : ''} />
              <span>{isLiveEvent ? 'Active' : 'Live'}</span>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Toggle Button for Tables */}
        {activeTab === 'data' && onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="btn-secondary"
            style={{
              padding: '5px 10px',
              fontSize: 12,
              gap: 5,
              borderRadius: 6,
              background: isMobileSidebarOpen ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-card)',
              color: isMobileSidebarOpen ? '#38bdf8' : 'var(--text-primary)',
            }}
            title="Toggle Tables Sidebar"
          >
            {isMobileSidebarOpen ? <X size={14} /> : <Layers size={14} />}
            <span>Tables ({tableCount})</span>
          </button>
        )}
      </div>

      {/* Main Studio Responsive Navigation Strip */}
      <nav className="header-nav-strip">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="header-nav-item"
              style={{
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.35)' : 'transparent'}`,
                boxShadow: isActive ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none',
              }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
