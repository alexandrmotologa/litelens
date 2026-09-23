import React, { useState, useEffect } from 'react'
import { Header, StudioTab } from './components/Header'
import { TableSidebar } from './components/TableSidebar'
import { VirtualGrid } from './components/VirtualGrid'
import { ErDiagram } from './components/ErDiagram'
import { QueryWorkbench } from './components/QueryWorkbench'
import { WalDashboard } from './components/WalDashboard'
import { DatabaseDoctor } from './components/DatabaseDoctor'
import { FtsStudio } from './components/FtsStudio'
import { VectorWorkbench } from './components/VectorWorkbench'
import { TransferHub } from './components/TransferHub'
import { DiffModal } from './components/DiffModal'
import { CellInspectorModal } from './components/CellInspectorModal'
import { RowEditModal } from './components/RowEditModal'
import { TableSchemaModal } from './components/TableSchemaModal'
import { api, SchemaMetadata, WalDiagnostics, TableInfo } from './api/client'

export const App: React.FC = () => {
  const [schema, setSchema] = useState<SchemaMetadata | null>(null)
  const [wal, setWal] = useState<WalDiagnostics | null>(null)
  const [activeTab, setActiveTab] = useState<StudioTab>('data')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Live SSE activity log & indicator
  const [isLiveEvent, setIsLiveEvent] = useState(false)
  const [liveLog, setLiveLog] = useState<Array<{ timestamp: string; event: string; details: string }>>([])

  // Modals
  const [inspectCell, setInspectCell] = useState<{ colName: string; colType: string; value: any } | null>(null)
  const [inspectSchemaTable, setInspectSchemaTable] = useState<TableInfo | null>(null)
  const [rowModal, setRowModal] = useState<{ isOpen: boolean; row?: Record<string, any> | null }>({ isOpen: false })

  const loadInitialData = async () => {
    try {
      const [s, w] = await Promise.all([api.fetchSchema(), api.fetchWalStatus()])
      setSchema(s)
      setWal(w)
      if (s.tables.length > 0 && !selectedTable) {
        setSelectedTable(s.tables[0].name)
      }
    } catch (err) {
      console.error('Failed to load initial metadata:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // Setup Server-Sent Events (SSE) for live WAL activity
  useEffect(() => {
    const sse = new EventSource('/api/wal/events')

    sse.addEventListener('wal-update', (event) => {
      try {
        const diag: WalDiagnostics = JSON.parse(event.data)
        setWal(diag)

        // Trigger visual beacon pulse
        setIsLiveEvent(true)
        setTimeout(() => setIsLiveEvent(false), 1200)

        // Add to live activity stream
        const timeStr = new Date().toLocaleTimeString()
        setLiveLog((prev) => [
          {
            timestamp: timeStr,
            event: 'WAL_FRAME_WRITE',
            details: `Frames: ${diag.totalFrames} • WAL Size: ${(diag.walSizeBytes / 1024).toFixed(1)} KB`,
          },
          ...prev.slice(0, 49),
        ])
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    })

    sse.onerror = () => {
      // Reconnects automatically
    }

    return () => {
      sse.close()
    }
  }, [])

  const currentTableInfo =
    schema?.tables.find((t) => t.name === selectedTable) ||
    schema?.views.find((v) => v.name === selectedTable) ||
    null

  const handleNavigateToTable = (targetTable: string) => {
    setSelectedTable(targetTable)
    setActiveTab('data')
  }

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        schema={schema}
        wal={wal}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLiveEvent={isLiveEvent}
      />

      {/* Main Workspace */}
      <div className="app-main">
        {/* Sidebar visible in data explorer */}
        {activeTab === 'data' && (
          <TableSidebar
            schema={schema}
            selectedTable={selectedTable}
            onSelectTable={setSelectedTable}
            onInspectTableSchema={(t) => setInspectSchemaTable(t)}
          />
        )}

        {/* Content Views */}
        <main className="app-content">
          {activeTab === 'data' && selectedTable && (
            <VirtualGrid
              tableName={selectedTable}
              tableInfo={currentTableInfo}
              onNavigateToTable={handleNavigateToTable}
              onInspectCell={(colName, value, colType) => setInspectCell({ colName, value, colType })}
              onOpenAddRow={() => setRowModal({ isOpen: true, row: null })}
              onOpenEditRow={(row) => setRowModal({ isOpen: true, row })}
            />
          )}

          {activeTab === 'data' && !selectedTable && !loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
              }}
            >
              Select a table from the sidebar to inspect records
            </div>
          )}

          {activeTab === 'er' && <ErDiagram />}

          {activeTab === 'query' && (
            <QueryWorkbench onRefreshSchema={loadInitialData} />
          )}

          {activeTab === 'wal' && (
            <WalDashboard wal={wal} onRefreshWal={loadInitialData} liveLog={liveLog} />
          )}

          {activeTab === 'doctor' && <DatabaseDoctor />}

          {activeTab === 'fts' && <FtsStudio />}

          {activeTab === 'vectors' && <VectorWorkbench />}

          {activeTab === 'transfer' && <TransferHub />}

          {activeTab === 'diff' && (
            <DiffModal currentDbPath={schema?.databasePath || 'Current Database'} />
          )}
        </main>
      </div>

      {/* Cell Inspector Modal */}
      {inspectCell && (
        <CellInspectorModal
          colName={inspectCell.colName}
          colType={inspectCell.colType}
          value={inspectCell.value}
          onClose={() => setInspectCell(null)}
        />
      )}

      {/* Table Schema Definition Modal */}
      {inspectSchemaTable && (
        <TableSchemaModal
          table={inspectSchemaTable}
          onClose={() => setInspectSchemaTable(null)}
        />
      )}

      {/* Row Insert/Edit Modal */}
      {rowModal.isOpen && selectedTable && (
        <RowEditModal
          tableName={selectedTable}
          tableInfo={currentTableInfo}
          initialRow={rowModal.row}
          onClose={() => setRowModal({ isOpen: false })}
          onSaved={() => {
            // refresh data
            loadInitialData()
          }}
        />
      )}
    </div>
  )
}
