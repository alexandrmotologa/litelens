package analyzer

import (
	"fmt"
	"strings"

	"github.com/alexandrmotologa/litelens/pkg/db"
)

// DiffChangeType represents the nature of a schema difference.
type DiffChangeType string

const (
	ChangeAdd    DiffChangeType = "ADD"
	ChangeDrop   DiffChangeType = "DROP"
	ChangeModify DiffChangeType = "MODIFY"
)

// SchemaChange represents a single granular change detected between two databases.
type SchemaChange struct {
	Type        DiffChangeType `json:"type"`
	EntityType  string         `json:"entityType"` // "table", "column", "index", "view", "trigger"
	EntityName  string         `json:"entityName"`
	TableName   string         `json:"tableName,omitempty"`
	Description string         `json:"description"`
	UpSQL       string         `json:"upSql"`
	DownSQL     string         `json:"downSql"`
}

// DiffReport holds complete structural differences and reversible SQL migrations.
type DiffReport struct {
	SourcePath       string         `json:"sourcePath"`
	TargetPath       string         `json:"targetPath"`
	Changes          []SchemaChange `json:"changes"`
	UpMigrationSQL   string         `json:"upMigrationSql"`
	DownMigrationSQL string         `json:"downMigrationSql"`
	TotalChanges     int            `json:"totalChanges"`
}

// CompareSchemas compares two database schema snapshots and generates reversible DDL migrations.
func CompareSchemas(oldSchema, newSchema *db.SchemaMetadata) *DiffReport {
	report := &DiffReport{
		SourcePath: oldSchema.DatabasePath,
		TargetPath: newSchema.DatabasePath,
		Changes:    make([]SchemaChange, 0),
	}

	oldTables := make(map[string]db.TableInfo)
	for _, t := range oldSchema.Tables {
		oldTables[t.Name] = t
	}

	newTables := make(map[string]db.TableInfo)
	for _, t := range newSchema.Tables {
		newTables[t.Name] = t
	}

	// 1. Detect Added Tables
	for name, newTbl := range newTables {
		if _, exists := oldTables[name]; !exists {
			ch := SchemaChange{
				Type:        ChangeAdd,
				EntityType:  "table",
				EntityName:  name,
				Description: fmt.Sprintf("Table %s was created", name),
				UpSQL:       newTbl.SQL + ";",
				DownSQL:     fmt.Sprintf("DROP TABLE IF EXISTS %s;", name),
			}
			report.Changes = append(report.Changes, ch)
		}
	}

	// 2. Detect Dropped Tables
	for name, oldTbl := range oldTables {
		if _, exists := newTables[name]; !exists {
			ch := SchemaChange{
				Type:        ChangeDrop,
				EntityType:  "table",
				EntityName:  name,
				Description: fmt.Sprintf("Table %s was dropped", name),
				UpSQL:       fmt.Sprintf("DROP TABLE IF EXISTS %s;", name),
				DownSQL:     oldTbl.SQL + ";",
			}
			report.Changes = append(report.Changes, ch)
		}
	}

	// 3. Detect Column & Table-level changes for common tables
	for name, oldTbl := range oldTables {
		newTbl, exists := newTables[name]
		if !exists {
			continue
		}

		oldCols := make(map[string]db.ColumnInfo)
		for _, c := range oldTbl.Columns {
			oldCols[strings.ToLower(c.Name)] = c
		}

		newCols := make(map[string]db.ColumnInfo)
		for _, c := range newTbl.Columns {
			newCols[strings.ToLower(c.Name)] = c
		}

		// Added Columns
		for colNameLower, newCol := range newCols {
			if _, colExists := oldCols[colNameLower]; !colExists {
				colDef := formatColumnDef(newCol)
				ch := SchemaChange{
					Type:        ChangeAdd,
					EntityType:  "column",
					EntityName:  newCol.Name,
					TableName:   name,
					Description: fmt.Sprintf("Column %s.%s was added (%s)", name, newCol.Name, newCol.Type),
					UpSQL:       fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s;", name, colDef),
					DownSQL:     fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s;", name, newCol.Name),
				}
				report.Changes = append(report.Changes, ch)
			}
		}

		// Dropped Columns
		for colNameLower, oldCol := range oldCols {
			if _, colExists := newCols[colNameLower]; !colExists {
				ch := SchemaChange{
					Type:        ChangeDrop,
					EntityType:  "column",
					EntityName:  oldCol.Name,
					TableName:   name,
					Description: fmt.Sprintf("Column %s.%s was dropped", name, oldCol.Name),
					UpSQL:       fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s;", name, oldCol.Name),
					DownSQL:     fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s;", name, formatColumnDef(oldCol)),
				}
				report.Changes = append(report.Changes, ch)
			}
		}

		// Indexes
		oldIdxMap := make(map[string]db.IndexInfo)
		for _, idx := range oldTbl.Indexes {
			if !strings.HasPrefix(idx.Name, "sqlite_autoindex") {
				oldIdxMap[idx.Name] = idx
			}
		}

		newIdxMap := make(map[string]db.IndexInfo)
		for _, idx := range newTbl.Indexes {
			if !strings.HasPrefix(idx.Name, "sqlite_autoindex") {
				newIdxMap[idx.Name] = idx
			}
		}

		for idxName, newIdx := range newIdxMap {
			if _, idxExists := oldIdxMap[idxName]; !idxExists && newIdx.SQL != "" {
				report.Changes = append(report.Changes, SchemaChange{
					Type:        ChangeAdd,
					EntityType:  "index",
					EntityName:  idxName,
					TableName:   name,
					Description: fmt.Sprintf("Index %s was added to %s", idxName, name),
					UpSQL:       newIdx.SQL + ";",
					DownSQL:     fmt.Sprintf("DROP INDEX IF EXISTS %s;", idxName),
				})
			}
		}

		for idxName := range oldIdxMap {
			if _, idxExists := newIdxMap[idxName]; !idxExists {
				oldIdx := oldIdxMap[idxName]
				report.Changes = append(report.Changes, SchemaChange{
					Type:        ChangeDrop,
					EntityType:  "index",
					EntityName:  idxName,
					TableName:   name,
					Description: fmt.Sprintf("Index %s was dropped from %s", idxName, name),
					UpSQL:       fmt.Sprintf("DROP INDEX IF EXISTS %s;", idxName),
					DownSQL:     oldIdx.SQL + ";",
				})
			}
		}
	}

	report.TotalChanges = len(report.Changes)
	report.UpMigrationSQL = synthesizeMigrationScript(report.Changes, true)
	report.DownMigrationSQL = synthesizeMigrationScript(report.Changes, false)

	return report
}

func formatColumnDef(c db.ColumnInfo) string {
	parts := []string{c.Name}
	if c.Type != "" {
		parts = append(parts, c.Type)
	}
	if c.NotNull {
		parts = append(parts, "NOT NULL")
	}
	if c.DefaultValue != nil {
		parts = append(parts, fmt.Sprintf("DEFAULT %s", *c.DefaultValue))
	}
	return strings.Join(parts, " ")
}

func synthesizeMigrationScript(changes []SchemaChange, isUp bool) string {
	if len(changes) == 0 {
		return "-- No schema differences detected.\n"
	}

	var sb strings.Builder
	sb.WriteString("-- Auto-generated by LiteLens Migration Diff Engine\n")
	sb.WriteString("BEGIN TRANSACTION;\n\n")

	if isUp {
		for _, ch := range changes {
			if ch.UpSQL != "" {
				sb.WriteString(fmt.Sprintf("-- %s\n%s\n\n", ch.Description, ch.UpSQL))
			}
		}
	} else {
		// Reverse order for rollback
		for i := len(changes) - 1; i >= 0; i-- {
			ch := changes[i]
			if ch.DownSQL != "" {
				sb.WriteString(fmt.Sprintf("-- Rollback: %s\n%s\n\n", ch.Description, ch.DownSQL))
			}
		}
	}

	sb.WriteString("COMMIT;\n")
	return sb.String()
}
