package fts

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
)

// FtsTableInfo represents an SQLite FTS5 virtual table.
type FtsTableInfo struct {
	Name         string   `json:"name"`
	Columns      []string `json:"columns"`
	Tokenizer    string   `json:"tokenizer"`
	ContentTable string   `json:"contentTable,omitempty"`
	RowCount     int64    `json:"rowCount"`
	Sql          string   `json:"sql"`
}

// CreateFtsRequest contains parameters to generate an FTS5 table and optional sync triggers.
type CreateFtsRequest struct {
	FtsTableName string   `json:"ftsTableName"`
	SourceTable  string   `json:"sourceTable,omitempty"`
	Columns      []string `json:"columns"`
	Tokenizer    string   `json:"tokenizer,omitempty"` // e.g. "porter unicode61", "unicode61"
	WithTriggers bool     `json:"withTriggers"`
	PopulateData bool     `json:"populateData"`
}

// FtsDdlResult contains the generated DDL statements.
type FtsDdlResult struct {
	CreateSql   string   `json:"createSql"`
	TriggersSql []string `json:"triggersSql"`
	PopulateSql string   `json:"populateSql,omitempty"`
}

// DetectFtsTables discovers all FTS5 virtual tables in the database.
func DetectFtsTables(ctx context.Context, db *sql.DB) ([]FtsTableInfo, error) {
	query := `SELECT name, sql FROM sqlite_schema WHERE type='table' AND sql LIKE '%USING fts5%' ORDER BY name;`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed querying sqlite_schema for FTS5 tables: %w", err)
	}
	defer rows.Close()

	type rawTable struct {
		name   string
		sqlStr string
	}
	var rawTables []rawTable
	for rows.Next() {
		var rt rawTable
		if err := rows.Scan(&rt.name, &rt.sqlStr); err == nil {
			rawTables = append(rawTables, rt)
		}
	}
	rows.Close()

	var result []FtsTableInfo
	for _, rt := range rawTables {
		info := parseFts5Sql(rt.name, rt.sqlStr)

		// Get row count
		var count int64
		_ = db.QueryRowContext(ctx, fmt.Sprintf("SELECT count(*) FROM %s;", quoteIdentifier(rt.name))).Scan(&count)
		info.RowCount = count

		result = append(result, info)
	}

	return result, nil
}

// GenerateFtsDdl generates SQL to create an FTS5 table, populate it, and attach synchronization triggers.
func GenerateFtsDdl(req CreateFtsRequest) (*FtsDdlResult, error) {
	if req.FtsTableName == "" {
		return nil, fmt.Errorf("FTS table name is required")
	}
	if len(req.Columns) == 0 {
		return nil, fmt.Errorf("at least one column is required")
	}

	tokenizer := "unicode61"
	if req.Tokenizer != "" {
		tokenizer = req.Tokenizer
	}

	// 1. CREATE VIRTUAL TABLE
	colDefs := make([]string, len(req.Columns))
	for i, c := range req.Columns {
		colDefs[i] = quoteIdentifier(c)
	}
	createSql := fmt.Sprintf("CREATE VIRTUAL TABLE %s USING fts5(%s, tokenize = '%s');",
		quoteIdentifier(req.FtsTableName),
		strings.Join(colDefs, ", "),
		tokenizer,
	)

	res := &FtsDdlResult{
		CreateSql:   createSql,
		TriggersSql: make([]string, 0),
	}

	quotedCols := strings.Join(colDefs, ", ")
	newCols := make([]string, len(req.Columns))
	oldCols := make([]string, len(req.Columns))
	for i, c := range req.Columns {
		newCols[i] = "new." + quoteIdentifier(c)
		oldCols[i] = "old." + quoteIdentifier(c)
	}

	// 2. Data population if source table exists
	if req.SourceTable != "" && req.PopulateData {
		res.PopulateSql = fmt.Sprintf("INSERT INTO %s(rowid, %s) SELECT rowid, %s FROM %s;",
			quoteIdentifier(req.FtsTableName),
			quotedCols,
			quotedCols,
			quoteIdentifier(req.SourceTable),
		)
	}

	// 3. Sync Triggers
	if req.SourceTable != "" && req.WithTriggers {
		src := req.SourceTable
		fts := req.FtsTableName

		aiTrigger := fmt.Sprintf(`CREATE TRIGGER trg_%s_ai AFTER INSERT ON %s BEGIN
  INSERT INTO %s(rowid, %s) VALUES (new.rowid, %s);
END;`, fts, quoteIdentifier(src), quoteIdentifier(fts), quotedCols, strings.Join(newCols, ", "))

		adTrigger := fmt.Sprintf(`CREATE TRIGGER trg_%s_ad AFTER DELETE ON %s BEGIN
  INSERT INTO %s(%s, rowid, %s) VALUES('delete', old.rowid, %s);
END;`, fts, quoteIdentifier(src), quoteIdentifier(fts), quoteIdentifier(fts), quotedCols, strings.Join(oldCols, ", "))

		auTrigger := fmt.Sprintf(`CREATE TRIGGER trg_%s_au AFTER UPDATE ON %s BEGIN
  INSERT INTO %s(%s, rowid, %s) VALUES('delete', old.rowid, %s);
  INSERT INTO %s(rowid, %s) VALUES (new.rowid, %s);
END;`, fts, quoteIdentifier(src), quoteIdentifier(fts), quoteIdentifier(fts), quotedCols, strings.Join(oldCols, ", "), quoteIdentifier(fts), quotedCols, strings.Join(newCols, ", "))

		res.TriggersSql = append(res.TriggersSql, aiTrigger, adTrigger, auTrigger)
	}

	return res, nil
}

func parseFts5Sql(name, sqlStr string) FtsTableInfo {
	info := FtsTableInfo{
		Name:      name,
		Sql:       sqlStr,
		Tokenizer: "unicode61",
		Columns:   make([]string, 0),
	}

	// Find args inside USING fts5(...)
	re := regexp.MustCompile(`(?i)USING\s+fts5\s*\((.*)\)`)
	matches := re.FindStringSubmatch(sqlStr)
	if len(matches) > 1 {
		rawArgs := matches[1]
		parts := strings.Split(rawArgs, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			lower := strings.ToLower(trimmed)
			if strings.HasPrefix(lower, "tokenize") && strings.Contains(lower, "=") {
				tokRe := regexp.MustCompile(`(?i)tokenize\s*=\s*['"]?([^'"]+)['"]?`)
				if tm := tokRe.FindStringSubmatch(trimmed); len(tm) > 1 {
					info.Tokenizer = strings.TrimSpace(tm[1])
				}
			} else if strings.HasPrefix(lower, "content") && strings.Contains(lower, "=") {
				contRe := regexp.MustCompile(`(?i)content\s*=\s*['"]?([^'"]+)['"]?`)
				if cm := contRe.FindStringSubmatch(trimmed); len(cm) > 1 {
					info.ContentTable = strings.TrimSpace(cm[1])
				}
			} else if trimmed != "" && !strings.Contains(trimmed, "=") {
				cleanCol := strings.Trim(trimmed, `"'` + "`")
				info.Columns = append(info.Columns, cleanCol)
			}
		}
	}

	return info
}

func quoteIdentifier(id string) string {
	return `"` + strings.ReplaceAll(id, `"`, `""`) + `"`
}
