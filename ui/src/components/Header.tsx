import React from 'react'
import { Database, Activity, GitCompare, Code2, Cpu, Eye, Radio } from 'lucide-react'
import { SchemaMetadata, WalDiagnostics } from '../api/client'

interface HeaderProps {
  schema: SchemaMetadata | null
  wal: WalDiagnostics | null
  activeTab: 'data' | 'query' | 'wal' | 'vectors' | 'diff'
  setActiveTab: (tab: 'data' | 'query' | 'wal' | 'vectors' | 'diff') => void
  isLiveEvent: boolean
}

export const Header: React.FC<HeaderProps> = ({
  schema,
  wal,
  activeTab,
  setActiveTab,
  isLiveEvent,
}) => {
  const dbName = schema?.databasePath ? schema.databasePath.split(/[/\\]/).pop() : 'SQLite Database'
  const isWal = schema?.journalMode?.toLowerCase() === 'wal'

  return (
    <header className="app-header">
      {/* Brand & Database Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            }}
          >
            <Eye size={18} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                LiteLens
              </span>
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 600 }}>
                v1.0
              </span>
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />

        {/* Database Meta Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            <Database size={14} color="#94a3b8" />
            {dbName}
          </span>

          {schema && (
            <>
              <span className={`badge ${isWal ? 'badge-green' : 'badge-amber'}`}>
                {schema.journalMode.toUpperCase()}
              </span>

              <span className="badge badge-cyan" title={`SQLite Engine ${schema.sqliteVersion}`}>
                SQLite {schema.sqliteVersion}
              </span>

              {schema.sizeBytes > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {(schema.sizeBytes / (1024 * 1024)).toFixed(2)} MB
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
              padding: '2px 8px',
              borderRadius: 12,
              background: isLiveEvent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isLiveEvent ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              fontSize: 11,
              color: isLiveEvent ? '#34d399' : 'var(--text-muted)',
              transition: 'all 0.3s ease',
            }}
          >
            <Radio size={12} className={isLiveEvent ? 'animate-pulse' : ''} />
            <span>{isLiveEvent ? 'WAL Activity' : 'Live Sync'}</span>
          </div>
        </div>
      </div>

      {/* Main Studio Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setActiveTab('data')}
          className={`btn-secondary ${activeTab === 'data' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'data' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'data' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'data' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <Database size={15} />
          <span>Data Grid</span>
        </button>

        <button
          onClick={() => setActiveTab('query')}
          className={`btn-secondary ${activeTab === 'query' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'query' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'query' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'query' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <Code2 size={15} />
          <span>Query & Visual Plan</span>
        </button>

        <button
          onClick={() => setActiveTab('wal')}
          className={`btn-secondary ${activeTab === 'wal' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'wal' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'wal' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'wal' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <Activity size={15} />
          <span>WAL Diagnostics</span>
          {wal?.totalFrames ? (
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 10, background: '#0284c7', color: '#fff' }}>
              {wal.totalFrames}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('vectors')}
          className={`btn-secondary ${activeTab === 'vectors' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'vectors' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'vectors' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'vectors' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <Cpu size={15} />
          <span>Vectors & Types</span>
        </button>

        <button
          onClick={() => setActiveTab('diff')}
          className={`btn-secondary ${activeTab === 'diff' ? 'active-nav' : ''}`}
          style={{
            background: activeTab === 'diff' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'diff' ? '#38bdf8' : 'var(--text-secondary)',
            borderColor: activeTab === 'diff' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
          }}
        >
          <GitCompare size={15} />
          <span>Schema Diff</span>
        </button>
      </nav>
    </header>
  )
}
