export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notNull: boolean
  defaultValue: string | null
  primaryKey: number
  hidden: number
}

export interface IndexColumn {
  seqNo: number
  cid: number
  name: string
}

export interface IndexInfo {
  seq: number
  name: string
  unique: boolean
  origin: string
  partial: boolean
  columns: IndexColumn[]
  sql: string
}

export interface ForeignKeyInfo {
  id: number
  seq: number
  table: string
  from: string
  to: string
  onUpdate: string
  onDelete: string
  match: string
}

export interface TriggerInfo {
  name: string
  tableName: string
  sql: string
}

export interface TableInfo {
  name: string
  type: 'table' | 'view'
  sql: string
  rowCount: number
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
  triggers: TriggerInfo[]
}

export interface SchemaMetadata {
  databasePath: string
  sizeBytes: number
  sqliteVersion: string
  pageSize: number
  pageCount: number
  journalMode: string
  tables: TableInfo[]
  views: TableInfo[]
}

export interface PaginatedDataResponse {
  tableName: string
  page: number
  limit: number
  totalRows: number
  columns: string[]
  columnTypes: string[]
  rows: Record<string, any>[]
  durationMs: number
}

export interface QueryResult {
  columns: string[]
  columnTypes: string[]
  rows: Record<string, any>[]
  rowsAffected: number
  durationMs: number
}

export interface PlanGraphNode {
  id: string
  label: string
  detail: string
  type: 'SCAN' | 'SEARCH' | 'TEMP_BTREE' | 'SUBQUERY' | 'COMPOUND' | 'GENERAL'
  costRating: 'good' | 'warning' | 'danger'
  table?: string
  index?: string
}

export interface PlanGraphEdge {
  id: string
  source: string
  target: string
}

export interface PlanGraph {
  nodes: PlanGraphNode[]
  edges: PlanGraphEdge[]
  totalNodes: number
  fullTableScans: number
  tempBTrees: number
  indexLookups: number
  optimizationScore: number
}

export interface IndexRecommendation {
  table: string
  columns: string[]
  indexName: string
  ddl: string
  reason: string
  impact: string
  isExisting: boolean
}

export interface VdbeInstruction {
  addr: number
  opcode: string
  p1: number
  p2: number
  p3: number
  p4: string
  p5: string
  comment: string
  category: string
}

export interface VdbeAnalysis {
  query: string
  instructions: VdbeInstruction[]
  totalOpcodes: number
  cursorOpsCount: number
  storageOpsCount: number
  branchOpsCount: number
  estimatedComplexity: string
}

export interface ExplainResponse {
  query: string
  graph: PlanGraph
  recommendations: IndexRecommendation[]
  vdbe?: VdbeAnalysis
}

export interface ShmHeader {
  version: number
  changeCounter: number
  isInitialized: boolean
  isBigEndian: boolean
  pageSize: number
  maxFrame: number
  databasePages: number
  backfilledFrames: number
  readMarks: number[]
  activeReadersCount: number
  minActiveReadMark: number
  blockingFramesCount: number
  hasStaleReader: boolean
}

export interface WalDiagnostics {
  walPath: string
  shmPath: string
  walExists: boolean
  shmExists: boolean
  walSizeBytes: number
  shmSizeBytes: number
  header?: {
    magic: number
    version: number
    pageSize: number
    checkpointSeq: number
    salt1: number
    salt2: number
  }
  shm?: ShmHeader
  totalFrames: number
  lastCommitPages: number
  lastModified?: string
}

export interface CheckpointResult {
  mode: string
  busy: number
  log: number
  checkpointed: number
  durationMs: number
}

export interface ForeignKeyViolation {
  tableName: string
  rowId: number
  parentTable: string
  fkid: number
}

export interface StorageHealth {
  pageSize: number
  pageCount: number
  freelistCount: number
  totalSizeBytes: number
  unusedSizeBytes: number
  unusedPercentage: number
  fragmentation: 'optimal' | 'moderate' | 'high'
}

export interface HealthReport {
  healthScore: number
  integrityOk: boolean
  integrityErrors: string[]
  quickCheckOk: boolean
  quickCheckErrors: string[]
  foreignKeyViolations: ForeignKeyViolation[]
  storage: StorageHealth
  summary: string
}

export interface FtsTableInfo {
  name: string
  columns: string[]
  tokenizer: string
  contentTable?: string
  rowCount: number
  sql: string
}

export interface CreateFtsRequest {
  ftsTableName: string
  sourceTable?: string
  columns: string[]
  tokenizer?: string
  withTriggers: boolean
  populateData: boolean
}

export interface FtsDdlResult {
  createSql: string
  triggersSql: string[]
  populateSql?: string
}

export interface ImportResult {
  tableName: string
  rowsImported: number
  durationMs: number
  columns: string[]
  tableCreated: boolean
}

export interface SchemaChange {
  type: 'ADD' | 'DROP' | 'MODIFY'
  entityType: string
  entityName: string
  tableName?: string
  description: string
  upSql: string
  downSql: string
}

export interface DiffReport {
  sourcePath: string
  targetPath: string
  changes: SchemaChange[]
  upMigrationSql: string
  downMigrationSql: string
  totalChanges: number
}

export interface BlobInspection {
  sizeBytes: number
  mimeType: string
  isImage: boolean
  isText: boolean
  isVector: boolean
  vectorDims?: number
  dataUrl?: string
  textContent?: string
  hexDump: string
}

const API_BASE = '/api'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(errorData.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  fetchSchema: () => request<SchemaMetadata>('/schema'),
  fetchTableDetails: (table: string) => request<TableInfo>(`/tables/${encodeURIComponent(table)}`),
  
  fetchTableData: (table: string, page = 1, limit = 50, sort = '', order = 'ASC', filter = '') => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      order,
    })
    if (sort) params.set('sort', sort)
    if (filter) params.set('filter', filter)
    return request<PaginatedDataResponse>(`/tables/${encodeURIComponent(table)}/data?${params.toString()}`)
  },

  insertRow: (table: string, values: Record<string, any>) =>
    request<{ rowsAffected: number }>(`/tables/${encodeURIComponent(table)}/rows`, {
      method: 'POST',
      body: JSON.stringify({ values }),
    }),

  updateRow: (table: string, where: Record<string, any>, values: Record<string, any>) =>
    request<{ rowsAffected: number }>(`/tables/${encodeURIComponent(table)}/rows`, {
      method: 'PUT',
      body: JSON.stringify({ where, values }),
    }),

  deleteRow: (table: string, where: Record<string, any>) =>
    request<{ rowsAffected: number }>(`/tables/${encodeURIComponent(table)}/rows`, {
      method: 'DELETE',
      body: JSON.stringify({ where }),
    }),

  executeQuery: (sql: string) =>
    request<QueryResult>('/query/execute', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),

  explainQuery: (sql: string) =>
    request<ExplainResponse>('/query/explain', {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }),

  fetchWalStatus: () => request<WalDiagnostics>('/wal/status'),

  executeCheckpoint: (mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE') =>
    request<CheckpointResult>('/wal/checkpoint', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  compareDatabase: (targetPath: string) =>
    request<DiffReport>('/diff', {
      method: 'POST',
      body: JSON.stringify({ targetPath }),
    }),

  inspectBlob: (base64Data?: string, rawText?: string) =>
    request<BlobInspection>('/codec/blob', {
      method: 'POST',
      body: JSON.stringify({ base64Data, rawText }),
    }),

  calcVectorDistances: (vectorA: number[], vectorB: number[]) =>
    request<{ cosineDistance: number; l2Distance: number; dotProduct: number }>('/codec/vector', {
      method: 'POST',
      body: JSON.stringify({ vectorA, vectorB }),
    }),

  // Database Doctor & Health Audit
  fetchHealth: () => request<HealthReport>('/doctor/health'),
  executeVacuum: (intoPath?: string) =>
    request<{ success: boolean; message: string }>('/doctor/vacuum', {
      method: 'POST',
      body: JSON.stringify({ intoPath }),
    }),

  // FTS5 Full-Text Search Studio
  fetchFtsTables: () => request<FtsTableInfo[]>('/fts/tables'),
  generateFtsDdl: (req: CreateFtsRequest) =>
    request<FtsDdlResult>('/fts/ddl', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  createFtsTable: (req: CreateFtsRequest) =>
    request<{ success: boolean; result: FtsDdlResult }>('/fts/create', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  // Import & Export Hub
  getExportUrl: (table?: string, format: 'sql' | 'csv' | 'jsonl' = 'sql') => {
    const params = new URLSearchParams({ format })
    if (table) params.set('table', table)
    return `${API_BASE}/transfer/export?${params.toString()}`
  },

  importData: (table: string, format: 'csv' | 'json', createTable: boolean, data: string | FormData) => {
    const params = new URLSearchParams({
      table,
      format,
      createTable: createTable ? 'true' : 'false',
    })

    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return request<ImportResult>(`/transfer/import?${params.toString()}`, {
        method: 'POST',
        body: data,
      })
    }

    return request<ImportResult>(`/transfer/import?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
      },
      body: typeof data === 'string' ? data : JSON.stringify(data),
    })
  },
}
