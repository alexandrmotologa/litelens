import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  GitFork,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Table as TableIcon,
  Key,
  Link2,
  Eye,
  Filter,
} from 'lucide-react'
import { api, TableInfo } from '../api/client'

interface NodeLayout {
  table: TableInfo
  x: number
  y: number
  width: number
  height: number
}

export const ErDiagram: React.FC = () => {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const loadSchema = async () => {
      try {
        const meta = await api.fetchSchema()
        setTables(meta.tables)
      } catch (err) {
        console.error('Failed loading schema for ER diagram', err)
      } finally {
        setLoading(false)
      }
    }
    loadSchema()
  }, [])

  // Calculate layout nodes in a 3-column grid
  const nodeWidth = 280
  const rowHeight = 26
  const headerHeight = 44
  const paddingX = 80
  const paddingY = 60

  const layout = useMemo<Record<string, NodeLayout>>(() => {
    const map: Record<string, NodeLayout> = {}
    const cols = 3

    tables.forEach((tbl, idx) => {
      const colIdx = idx % cols
      const rowIdx = Math.floor(idx / cols)

      const visibleColsCount = Math.min(tbl.columns.length, 12)
      const height = headerHeight + visibleColsCount * rowHeight + 20

      // Approximate staggered Y positioning
      const x = colIdx * (nodeWidth + paddingX)
      const y = rowIdx * 380

      map[tbl.name] = {
        table: tbl,
        x,
        y,
        width: nodeWidth,
        height,
      }
    })

    return map
  }, [tables])

  // Extract all foreign key relationships
  const relationships = useMemo(() => {
    const list: Array<{
      id: string
      fromTable: string
      fromCol: string
      toTable: string
      toCol: string
      isRelated: boolean
    }> = []

    tables.forEach((tbl) => {
      tbl.foreignKeys.forEach((fk, fkIdx) => {
        const isRelated =
          !selectedTable ||
          selectedTable === tbl.name ||
          selectedTable === fk.table

        list.push({
          id: `${tbl.name}-${fk.table}-${fkIdx}`,
          fromTable: tbl.name,
          fromCol: fk.from,
          toTable: fk.table,
          toCol: fk.to,
          isRelated,
        })
      })
    })

    return list
  }, [tables, selectedTable])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.4, Math.min(2.5, prev + delta)))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 40, y: 40 })
    setSelectedTable(null)
  }

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitFork size={18} color="#6366f1" />
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Entity-Relationship Graph</span>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter tables..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', height: '32px', fontSize: '13px', width: '200px' }}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {tables.length} tables · {relationships.length} foreign key relations
          </div>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="btn btn-secondary" onClick={() => handleZoom(0.15)} title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button className="btn btn-secondary" onClick={() => handleZoom(-0.15)} title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button className="btn btn-secondary" onClick={resetView} title="Reset view">
            <Maximize2 size={14} />
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '45px', textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          backgroundColor: 'var(--bg-canvas, #090d16)',
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <defs>
            <marker
              id="er-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
            </marker>
            <marker
              id="er-arrow-active"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ec4899" />
            </marker>
          </defs>

          {/* Draw FK Curves */}
          {relationships.map((rel) => {
            const fromNode = layout[rel.fromTable]
            const toNode = layout[rel.toTable]
            if (!fromNode || !toNode) return null

            const isHighlighted = selectedTable && (selectedTable === rel.fromTable || selectedTable === rel.toTable)
            const isDimmed = selectedTable && !isHighlighted

            // Calculate anchor points
            const startX = fromNode.x + fromNode.width
            const startY = fromNode.y + 40
            const endX = toNode.x
            const endY = toNode.y + 40

            const dx = Math.abs(endX - startX) * 0.5
            const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`
            const midX = (startX + endX) / 2
            const midY = (startY + endY) / 2

            return (
              <g key={rel.id} opacity={isDimmed ? 0.15 : 1}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={isHighlighted ? '#ec4899' : '#6366f1'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isHighlighted ? undefined : '4 2'}
                  markerEnd={isHighlighted ? 'url(#er-arrow-active)' : 'url(#er-arrow)'}
                />
                {/* Cardinality pill on mid point */}
                <rect
                  x={midX - 18}
                  y={midY - 9}
                  width="36"
                  height="18"
                  rx="4"
                  fill="var(--bg-surface)"
                  stroke={isHighlighted ? '#ec4899' : 'var(--border-subtle)'}
                />
                <text
                  x={midX}
                  y={midY + 3.5}
                  textAnchor="middle"
                  fill={isHighlighted ? '#ec4899' : 'var(--text-muted)'}
                  fontSize="9px"
                  fontWeight="600"
                >
                  N : 1
                </text>
              </g>
            )
          })}

          {/* Draw Table Nodes */}
          {tables.map((tbl) => {
            const node = layout[tbl.name]
            if (!node) return null

            const matchesSearch = !searchTerm || tbl.name.toLowerCase().includes(searchTerm.toLowerCase())
            const isSelected = selectedTable === tbl.name
            const isRelated = relationships.some(
              (r) =>
                (selectedTable === r.fromTable && r.toTable === tbl.name) ||
                (selectedTable === r.toTable && r.fromTable === tbl.name)
            )
            const isDimmed = selectedTable && !isSelected && !isRelated

            return (
              <g
                key={tbl.name}
                transform={`translate(${node.x}, ${node.y})`}
                opacity={!matchesSearch || isDimmed ? 0.25 : 1}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedTable(selectedTable === tbl.name ? null : tbl.name)
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Card Background */}
                <rect
                  width={node.width}
                  height={node.height}
                  rx="8"
                  fill="var(--bg-surface)"
                  stroke={isSelected ? '#6366f1' : isRelated ? '#ec4899' : 'var(--border-subtle)'}
                  strokeWidth={isSelected || isRelated ? 2 : 1}
                  filter="drop-shadow(0 4px 12px rgba(0,0,0,0.4))"
                />

                {/* Card Header */}
                <rect width={node.width} height={headerHeight} rx="8" fill="var(--bg-elevated)" />
                <rect y={headerHeight - 2} width={node.width} height="2" fill="var(--border-subtle)" />

                {/* Header Title */}
                <text x="14" y="27" fill="var(--text-primary)" fontSize="13px" fontWeight="600">
                  {tbl.name}
                </text>

                {/* Row Count Badge */}
                <rect x={node.width - 70} y="14" width="56" height="18" rx="4" fill="rgba(255,255,255,0.06)" />
                <text
                  x={node.width - 42}
                  y="26"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="10px"
                  fontWeight="500"
                >
                  {tbl.rowCount.toLocaleString()} r
                </text>

                {/* Columns */}
                {tbl.columns.slice(0, 12).map((col, cIdx) => {
                  const yPos = headerHeight + 18 + cIdx * rowHeight
                  const isPk = col.primaryKey > 0
                  const isFk = tbl.foreignKeys.some((k) => k.from === col.name)

                  return (
                    <g key={col.name} transform={`translate(0, ${yPos})`}>
                      {/* Icon */}
                      <text x="14" y="0" fontSize="11px" fill={isPk ? '#f59e0b' : isFk ? '#6366f1' : 'transparent'}>
                        {isPk ? '🔑' : isFk ? '🔗' : ''}
                      </text>

                      {/* Column Name */}
                      <text
                        x="34"
                        y="0"
                        fill={isPk ? '#f59e0b' : 'var(--text-secondary)'}
                        fontSize="12px"
                        fontWeight={isPk ? '600' : 'normal'}
                      >
                        {col.name}
                      </text>

                      {/* Column Type */}
                      <text
                        x={node.width - 14}
                        y="0"
                        textAnchor="end"
                        fill="var(--text-muted)"
                        fontSize="11px"
                        fontFamily="monospace"
                      >
                        {col.type || 'BLOB'}
                      </text>
                    </g>
                  )
                })}

                {tbl.columns.length > 12 && (
                  <text
                    x={node.width / 2}
                    y={headerHeight + 18 + 12 * rowHeight}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="10px"
                    fontStyle="italic"
                  >
                    + {tbl.columns.length - 12} more columns
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
