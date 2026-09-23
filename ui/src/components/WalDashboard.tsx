import React, { useState } from 'react'
import {
  Activity,
  Layers,
  Zap,
  Play,
  CheckCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
  Clock,
  Radio,
  FileText,
} from 'lucide-react'
import { api, WalDiagnostics, CheckpointResult } from '../api/client'

interface WalDashboardProps {
  wal: WalDiagnostics | null
  onRefreshWal: () => void
  liveLog: Array<{ timestamp: string; event: string; details: string }>
}

export const WalDashboard: React.FC<WalDashboardProps> = ({ wal, onRefreshWal, liveLog }) => {
  const [runningMode, setRunningMode] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<CheckpointResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunCheckpoint = async (mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE') => {
    setRunningMode(mode)
    setError(null)
    try {
      const res = await api.executeCheckpoint(mode)
      setLastResult(res)
      onRefreshWal()
    } catch (err: any) {
      setError(err.message || 'Checkpoint failed')
    } finally {
      setRunningMode(null)
    }
  }

  const walKb = wal ? (wal.walSizeBytes / 1024).toFixed(1) : '0'
  const shmKb = wal ? (wal.shmSizeBytes / 1024).toFixed(1) : '0'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: 24, gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={20} color="var(--accent-cyan)" />
            <span>SQLite WAL Concurrency Diagnostics & Checkpoint Engine</span>
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Direct binary inspection of Write-Ahead Log headers, frame allocations, and lock contention.
          </p>
        </div>

        <button onClick={onRefreshWal} className="btn-secondary" style={{ padding: '6px 12px' }}>
          <RefreshCw size={14} />
          <span>Refresh State</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* WAL Size */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            WAL File Size
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>{walKb} KB</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {wal?.walExists ? 'Active write log on disk' : 'No active WAL file'}
          </div>
        </div>

        {/* Total Frames */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Uncheckpointed Frames
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
            {wal?.totalFrames ?? 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Page size: {wal?.header?.pageSize ? `${wal.header.pageSize} bytes` : '4096 bytes'}
          </div>
        </div>

        {/* Checkpoint Sequence */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Checkpoint Sequence
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', marginTop: 4 }}>
            #{wal?.header?.checkpointSeq ?? 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Sequential generation counter</div>
        </div>

        {/* Shared Memory (SHM) */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Shared Memory (-shm)
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>{shmKb} KB</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {wal?.shmExists ? 'Reader index mapping active' : 'Not allocated'}
          </div>
        </div>
      </div>

      {/* Checkpoint Control Panel */}
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
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>Execute Manual WAL Checkpoint</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Flushes modified database pages from the Write-Ahead Log back into the main database file.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {/* PASSIVE */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#f8fafc' }}>PASSIVE</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Checkpoints as many frames as possible without waiting for readers or writers. Never blocks.
              </p>
            </div>
            <button
              onClick={() => handleRunCheckpoint('PASSIVE')}
              disabled={runningMode !== null}
              className="btn-secondary"
              style={{ fontSize: 12, width: '100%' }}
            >
              <Play size={13} />
              <span>{runningMode === 'PASSIVE' ? 'Executing...' : 'Run Passive'}</span>
            </button>
          </div>

          {/* FULL */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#38bdf8' }}>FULL</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Waits for active writers to finish, checkpoints all committed frames, and blocks new writes.
              </p>
            </div>
            <button
              onClick={() => handleRunCheckpoint('FULL')}
              disabled={runningMode !== null}
              className="btn-primary"
              style={{ fontSize: 12, width: '100%' }}
            >
              <Play size={13} />
              <span>{runningMode === 'FULL' ? 'Executing...' : 'Run Full'}</span>
            </button>
          </div>

          {/* RESTART */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#f59e0b' }}>RESTART</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Waits for all readers to exit so that subsequent writes restart from the beginning of the log.
              </p>
            </div>
            <button
              onClick={() => handleRunCheckpoint('RESTART')}
              disabled={runningMode !== null}
              className="btn-secondary"
              style={{ fontSize: 12, width: '100%', borderColor: 'rgba(245, 158, 11, 0.4)' }}
            >
              <Play size={13} color="#f59e0b" />
              <span>{runningMode === 'RESTART' ? 'Executing...' : 'Run Restart'}</span>
            </button>
          </div>

          {/* TRUNCATE */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#10b981' }}>TRUNCATE</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Synchronizes all frames and resets the WAL file size to 0 bytes on disk.
              </p>
            </div>
            <button
              onClick={() => handleRunCheckpoint('TRUNCATE')}
              disabled={runningMode !== null}
              className="btn-secondary"
              style={{ fontSize: 12, width: '100%', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              <Zap size={13} color="#10b981" />
              <span>{runningMode === 'TRUNCATE' ? 'Executing...' : 'Run Truncate'}</span>
            </button>
          </div>
        </div>

        {/* Last Checkpoint Result */}
        {lastResult && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#a7f3d0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={15} color="#10b981" />
              <span>
                <strong>{lastResult.mode} Checkpoint Successful:</strong> Checkpointed {lastResult.checkpointed} frames
                (Total: {lastResult.log}, Busy lock holders: {lastResult.busy})
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lastResult.durationMs.toFixed(2)} ms</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fca5a5',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Real-time SSE Activity Stream */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={16} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>
              Real-Time SSE File Watcher Stream
            </h3>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Connected to /api/wal/events</span>
        </div>

        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          {liveLog.length > 0 ? (
            liveLog.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 6px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                }}
              >
                <span style={{ color: 'var(--text-dim)' }}>[{item.timestamp}]</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{item.event}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{item.details}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
              Awaiting write activity or checkpoint events...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
