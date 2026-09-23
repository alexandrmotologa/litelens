package db

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// Manager manages a thread-safe connection pool to a target SQLite database.
type Manager struct {
	mu       sync.RWMutex
	db       *sql.DB
	path     string
	readOnly bool
}

// QueryResult holds execution output and performance metadata.
type QueryResult struct {
	Columns      []string         `json:"columns"`
	ColumnTypes  []string         `json:"columnTypes"`
	Rows         []map[string]any `json:"rows"`
	RowsAffected int64            `json:"rowsAffected"`
	DurationMs   float64          `json:"durationMs"`
}

// Open opens a connection to the SQLite database file at dbPath.
func Open(dbPath string, readOnly bool) (*Manager, error) {
	params := url.Values{}
	params.Set("_pragma", "busy_timeout(5000)")

	if readOnly {
		params.Add("_pragma", "query_only(1)")
	} else {
		params.Add("_pragma", "journal_mode(WAL)")
		params.Add("_pragma", "foreign_keys(1)")
		params.Add("_pragma", "synchronous(NORMAL)")
	}

	dsn := fmt.Sprintf("file:%s?%s", dbPath, params.Encode())
	if readOnly && !strings.Contains(dsn, "mode=ro") {
		dsn = fmt.Sprintf("file:%s?mode=ro&%s", dbPath, params.Encode())
	}

	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database at %s: %w", dbPath, err)
	}

	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(1 * time.Hour)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("failed to ping database at %s: %w", dbPath, err)
	}

	return &Manager{
		db:       conn,
		path:     dbPath,
		readOnly: readOnly,
	}, nil
}

// Close closes the underlying SQLite database connection pool.
func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.db != nil {
		return m.db.Close()
	}
	return nil
}

// DB returns the underlying sql.DB connection pool.
func (m *Manager) DB() *sql.DB {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.db
}

// Path returns the filesystem path of the database.
func (m *Manager) Path() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.path
}

// IsReadOnly reports whether the manager is operating in read-only mode.
func (m *Manager) IsReadOnly() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.readOnly
}

// ExecuteQuery runs an arbitrary SQL query and returns results formatted as generic rows.
func (m *Manager) ExecuteQuery(ctx context.Context, sqlQuery string, args ...any) (*QueryResult, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	start := time.Now()
	trimmed := strings.TrimSpace(sqlQuery)
	isSelectOrExplain := strings.HasPrefix(strings.ToUpper(trimmed), "SELECT") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "EXPLAIN") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "PRAGMA") ||
		strings.HasPrefix(strings.ToUpper(trimmed), "WITH")

	if !isSelectOrExplain {
		if m.readOnly {
			return nil, fmt.Errorf("database opened in read-only mode; write operation rejected")
		}

		res, err := m.db.ExecContext(ctx, sqlQuery, args...)
		if err != nil {
			return nil, err
		}

		affected, _ := res.RowsAffected()
		return &QueryResult{
			Columns:      []string{"rows_affected"},
			ColumnTypes:  []string{"INTEGER"},
			Rows:         []map[string]any{{"rows_affected": affected}},
			RowsAffected: affected,
			DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
		}, nil
	}

	rows, err := m.db.QueryContext(ctx, sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	colNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve columns: %w", err)
	}

	colTypes, err := rows.ColumnTypes()
	typesList := make([]string, len(colNames))
	if err == nil {
		for i, ct := range colTypes {
			dbType := ct.DatabaseTypeName()
			if dbType == "" {
				dbType = "ANY"
			}
			typesList[i] = dbType
		}
	} else {
		for i := range typesList {
			typesList[i] = "ANY"
		}
	}

	results := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(colNames))
		scanArgs := make([]any, len(colNames))
		for i := range values {
			scanArgs[i] = &values[i]
		}

		if err := rows.Scan(scanArgs...); err != nil {
			return nil, fmt.Errorf("row scan error: %w", err)
		}

		rowMap := make(map[string]any, len(colNames))
		for i, colName := range colNames {
			val := values[i]
			if b, ok := val.([]byte); ok {
				rowMap[colName] = string(b)
			} else {
				rowMap[colName] = val
			}
		}
		results = append(results, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &QueryResult{
		Columns:      colNames,
		ColumnTypes:  typesList,
		Rows:         results,
		RowsAffected: int64(len(results)),
		DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

// ExecuteStatement runs a non-query SQL statement (INSERT, UPDATE, DELETE, DDL).
func (m *Manager) ExecuteStatement(ctx context.Context, sqlStmt string, args ...any) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.readOnly {
		return 0, fmt.Errorf("database opened in read-only mode; statement rejected")
	}

	res, err := m.db.ExecContext(ctx, sqlStmt, args...)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}
