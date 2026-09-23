package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
)

// ColumnInfo holds details about a table or view column.
type ColumnInfo struct {
	CID          int     `json:"cid"`
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	NotNull      bool    `json:"notNull"`
	DefaultValue *string `json:"defaultValue"`
	PrimaryKey   int     `json:"primaryKey"`
	Hidden       int     `json:"hidden"`
}

// IndexColumn describes an indexed column.
type IndexColumn struct {
	SeqNo int    `json:"seqNo"`
	CID   int    `json:"cid"`
	Name  string `json:"name"`
}

// IndexInfo holds details about an index on a table.
type IndexInfo struct {
	Seq     int           `json:"seq"`
	Name    string        `json:"name"`
	Unique  bool          `json:"unique"`
	Origin  string        `json:"origin"`
	Partial bool          `json:"partial"`
	Columns []IndexColumn `json:"columns"`
	SQL     string        `json:"sql"`
}

// ForeignKeyInfo describes a foreign key constraint.
type ForeignKeyInfo struct {
	ID       int    `json:"id"`
	Seq      int    `json:"seq"`
	Table    string `json:"table"`
	From     string `json:"from"`
	To       string `json:"to"`
	OnUpdate string `json:"onUpdate"`
	OnDelete string `json:"onDelete"`
	Match    string `json:"match"`
}

// TriggerInfo represents a database trigger.
type TriggerInfo struct {
	Name      string `json:"name"`
	TableName string `json:"tableName"`
	SQL       string `json:"sql"`
}

// TableInfo represents a table or view with full schema information.
type TableInfo struct {
	Name        string           `json:"name"`
	Type        string           `json:"type"` // "table" or "view"
	SQL         string           `json:"sql"`
	RowCount    int64            `json:"rowCount"`
	Columns     []ColumnInfo     `json:"columns"`
	Indexes     []IndexInfo      `json:"indexes"`
	ForeignKeys []ForeignKeyInfo `json:"foreignKeys"`
	Triggers    []TriggerInfo    `json:"triggers"`
}

// SchemaMetadata summarizes the entire database.
type SchemaMetadata struct {
	DatabasePath  string      `json:"databasePath"`
	SizeBytes     int64       `json:"sizeBytes"`
	SQLiteVersion string      `json:"sqliteVersion"`
	PageSize      int64       `json:"pageSize"`
	PageCount     int64       `json:"pageCount"`
	JournalMode   string      `json:"journalMode"`
	Tables        []TableInfo `json:"tables"`
	Views         []TableInfo `json:"views"`
}

// IntrospectDatabase scans the database and returns full schema metadata.
func (m *Manager) IntrospectDatabase(ctx context.Context) (*SchemaMetadata, error) {
	meta := &SchemaMetadata{
		DatabasePath: m.path,
		Tables:       make([]TableInfo, 0),
		Views:        make([]TableInfo, 0),
	}

	if fi, err := os.Stat(m.path); err == nil {
		meta.SizeBytes = fi.Size()
	}

	// SQLite Version
	var version string
	if err := m.db.QueryRowContext(ctx, "SELECT sqlite_version()").Scan(&version); err == nil {
		meta.SQLiteVersion = version
	}

	// PRAGMA page_size
	var pageSize int64
	if err := m.db.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize); err == nil {
		meta.PageSize = pageSize
	}

	// PRAGMA page_count
	var pageCount int64
	if err := m.db.QueryRowContext(ctx, "PRAGMA page_count").Scan(&pageCount); err == nil {
		meta.PageCount = pageCount
	}

	// PRAGMA journal_mode
	var journalMode string
	if err := m.db.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&journalMode); err == nil {
		meta.JournalMode = journalMode
	}

	// Query sqlite_master for tables and views
	rows, err := m.db.QueryContext(ctx, `
		SELECT type, name, coalesce(sql, '') 
		FROM sqlite_master 
		WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
		ORDER BY type, name
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query sqlite_master: %w", err)
	}
	defer rows.Close()

	type rawItem struct {
		itemType string
		name     string
		ddl      string
	}
	var items []rawItem

	for rows.Next() {
		var it rawItem
		if err := rows.Scan(&it.itemType, &it.name, &it.ddl); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	rows.Close()

	for _, it := range items {
		tbl, err := m.IntrospectTable(ctx, it.name, it.itemType, it.ddl)
		if err != nil {
			return nil, fmt.Errorf("failed introspecting %s: %w", it.name, err)
		}

		if it.itemType == "view" {
			meta.Views = append(meta.Views, *tbl)
		} else {
			meta.Tables = append(meta.Tables, *tbl)
		}
	}

	return meta, nil
}

// IntrospectTable retrieves columns, indexes, foreign keys, triggers, and row count for a table.
func (m *Manager) IntrospectTable(ctx context.Context, tableName, tableType, ddl string) (*TableInfo, error) {
	tbl := &TableInfo{
		Name:        tableName,
		Type:        tableType,
		SQL:         ddl,
		Columns:     make([]ColumnInfo, 0),
		Indexes:     make([]IndexInfo, 0),
		ForeignKeys: make([]ForeignKeyInfo, 0),
		Triggers:    make([]TriggerInfo, 0),
	}

	// Fetch columns via PRAGMA table_xinfo or table_info
	cols, err := m.fetchColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}
	tbl.Columns = cols

	if tableType == "table" {
		// Row count (safe fast count)
		var count int64
		escaped := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
		_ = m.db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", escaped)).Scan(&count)
		tbl.RowCount = count

		// Indexes
		indexes, err := m.fetchIndexes(ctx, tableName)
		if err == nil {
			tbl.Indexes = indexes
		}

		// Foreign Keys
		fks, err := m.fetchForeignKeys(ctx, tableName)
		if err == nil {
			tbl.ForeignKeys = fks
		}
	}

	// Triggers
	triggers, err := m.fetchTriggers(ctx, tableName)
	if err == nil {
		tbl.Triggers = triggers
	}

	return tbl, nil
}

func (m *Manager) fetchColumns(ctx context.Context, tableName string) ([]ColumnInfo, error) {
	escaped := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
	rows, err := m.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_xinfo(%s)", escaped))
	if err != nil {
		rows, err = m.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", escaped))
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()

	cols := make([]ColumnInfo, 0)
	for rows.Next() {
		var c ColumnInfo
		var notNull int
		var pk int
		var hidden int = 0
		var dfltVal sql.NullString

		colsCount := 6
		colTypes, _ := rows.ColumnTypes()
		if len(colTypes) == 7 {
			colsCount = 7
		}

		if colsCount == 7 {
			if err := rows.Scan(&c.CID, &c.Name, &c.Type, &notNull, &dfltVal, &pk, &hidden); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&c.CID, &c.Name, &c.Type, &notNull, &dfltVal, &pk); err != nil {
				return nil, err
			}
		}

		c.NotNull = notNull != 0
		c.PrimaryKey = pk
		c.Hidden = hidden
		if dfltVal.Valid {
			c.DefaultValue = &dfltVal.String
		}
		cols = append(cols, c)
	}

	return cols, nil
}

func (m *Manager) fetchIndexes(ctx context.Context, tableName string) ([]IndexInfo, error) {
	escaped := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
	rows, err := m.db.QueryContext(ctx, fmt.Sprintf("PRAGMA index_list(%s)", escaped))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make([]IndexInfo, 0)
	for rows.Next() {
		var idx IndexInfo
		var unique, partial int
		if err := rows.Scan(&idx.Seq, &idx.Name, &unique, &idx.Origin, &partial); err != nil {
			return nil, err
		}
		idx.Unique = unique != 0
		idx.Partial = partial != 0

		// Fetch index columns
		idxEscaped := fmt.Sprintf(`"%s"`, strings.ReplaceAll(idx.Name, `"`, `""`))
		iRows, err := m.db.QueryContext(ctx, fmt.Sprintf("PRAGMA index_info(%s)", idxEscaped))
		if err == nil {
			idxCols := make([]IndexColumn, 0)
			for iRows.Next() {
				var ic IndexColumn
				if err := iRows.Scan(&ic.SeqNo, &ic.CID, &ic.Name); err == nil {
					idxCols = append(idxCols, ic)
				}
			}
			iRows.Close()
			idx.Columns = idxCols
		}

		// Fetch SQL from sqlite_master
		var sqlStr sql.NullString
		_ = m.db.QueryRowContext(ctx, "SELECT sql FROM sqlite_master WHERE type='index' AND name=?", idx.Name).Scan(&sqlStr)
		if sqlStr.Valid {
			idx.SQL = sqlStr.String
		}

		indexes = append(indexes, idx)
	}

	return indexes, nil
}

func (m *Manager) fetchForeignKeys(ctx context.Context, tableName string) ([]ForeignKeyInfo, error) {
	escaped := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
	rows, err := m.db.QueryContext(ctx, fmt.Sprintf("PRAGMA foreign_key_list(%s)", escaped))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fks := make([]ForeignKeyInfo, 0)
	for rows.Next() {
		var fk ForeignKeyInfo
		if err := rows.Scan(&fk.ID, &fk.Seq, &fk.Table, &fk.From, &fk.To, &fk.OnUpdate, &fk.OnDelete, &fk.Match); err != nil {
			return nil, err
		}
		fks = append(fks, fk)
	}

	return fks, nil
}

func (m *Manager) fetchTriggers(ctx context.Context, tableName string) ([]TriggerInfo, error) {
	rows, err := m.db.QueryContext(ctx, "SELECT name, tbl_name, coalesce(sql, '') FROM sqlite_master WHERE type='trigger' AND tbl_name=?", tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	triggers := make([]TriggerInfo, 0)
	for rows.Next() {
		var tr TriggerInfo
		if err := rows.Scan(&tr.Name, &tr.TableName, &tr.SQL); err != nil {
			return nil, err
		}
		triggers = append(triggers, tr)
	}

	return triggers, nil
}
