package doctor

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// ForeignKeyViolation represents an orphaned or invalid foreign key reference.
type ForeignKeyViolation struct {
	TableName   string `json:"tableName"`
	RowID       int64  `json:"rowId"`
	ParentTable string `json:"parentTable"`
	FKID        int    `json:"fkid"`
}

// StorageHealth holds fragmentation and freelist metrics.
type StorageHealth struct {
	PageSize         int64   `json:"pageSize"`
	PageCount        int64   `json:"pageCount"`
	FreelistCount    int64   `json:"freelistCount"`
	TotalSizeBytes   int64   `json:"totalSizeBytes"`
	UnusedSizeBytes  int64   `json:"unusedSizeBytes"`
	UnusedPercentage float64 `json:"unusedPercentage"`
	Fragmentation    string  `json:"fragmentation"` // "optimal", "moderate", "high"
}

// HealthReport encapsulates full database diagnostic status.
type HealthReport struct {
	HealthScore          int                   `json:"healthScore"` // 0 to 100
	IntegrityOk          bool                  `json:"integrityOk"`
	IntegrityErrors      []string              `json:"integrityErrors"`
	QuickCheckOk         bool                  `json:"quickCheckOk"`
	QuickCheckErrors     []string              `json:"quickCheckErrors"`
	ForeignKeyViolations []ForeignKeyViolation `json:"foreignKeyViolations"`
	Storage              StorageHealth         `json:"storage"`
	Summary              string                `json:"summary"`
}

// RunHealthAudit executes PRAGMA integrity_check, quick_check, foreign_key_check, and analyzes storage.
func RunHealthAudit(ctx context.Context, db *sql.DB) (*HealthReport, error) {
	rep := &HealthReport{
		IntegrityErrors:      make([]string, 0),
		QuickCheckErrors:     make([]string, 0),
		ForeignKeyViolations: make([]ForeignKeyViolation, 0),
	}

	// 1. PRAGMA quick_check
	qRows, err := db.QueryContext(ctx, "PRAGMA quick_check(10);")
	if err == nil {
		for qRows.Next() {
			var msg string
			if err := qRows.Scan(&msg); err == nil {
				if strings.EqualFold(msg, "ok") {
					rep.QuickCheckOk = true
				} else {
					rep.QuickCheckErrors = append(rep.QuickCheckErrors, msg)
				}
			}
		}
		qRows.Close()
	}

	// 2. PRAGMA integrity_check
	iRows, err := db.QueryContext(ctx, "PRAGMA integrity_check(10);")
	if err == nil {
		for iRows.Next() {
			var msg string
			if err := iRows.Scan(&msg); err == nil {
				if strings.EqualFold(msg, "ok") {
					rep.IntegrityOk = true
				} else {
					rep.IntegrityErrors = append(rep.IntegrityErrors, msg)
				}
			}
		}
		iRows.Close()
	}

	// 3. PRAGMA foreign_key_check
	fkRows, err := db.QueryContext(ctx, "PRAGMA foreign_key_check;")
	if err == nil {
		for fkRows.Next() {
			var v ForeignKeyViolation
			if err := fkRows.Scan(&v.TableName, &v.RowID, &v.ParentTable, &v.FKID); err == nil {
				rep.ForeignKeyViolations = append(rep.ForeignKeyViolations, v)
			}
		}
		fkRows.Close()
	}

	// 4. Storage & Freelist Metrics
	var pageSize, pageCount, freelistCount int64
	_ = db.QueryRowContext(ctx, "PRAGMA page_size;").Scan(&pageSize)
	_ = db.QueryRowContext(ctx, "PRAGMA page_count;").Scan(&pageCount)
	_ = db.QueryRowContext(ctx, "PRAGMA freelist_count;").Scan(&freelistCount)

	totalBytes := pageSize * pageCount
	unusedBytes := pageSize * freelistCount
	var unusedPercent float64
	if totalBytes > 0 {
		unusedPercent = (float64(unusedBytes) / float64(totalBytes)) * 100.0
	}

	frag := "optimal"
	if unusedPercent > 25.0 {
		frag = "high"
	} else if unusedPercent > 10.0 {
		frag = "moderate"
	}

	rep.Storage = StorageHealth{
		PageSize:         pageSize,
		PageCount:        pageCount,
		FreelistCount:    freelistCount,
		TotalSizeBytes:   totalBytes,
		UnusedSizeBytes:  unusedBytes,
		UnusedPercentage: unusedPercent,
		Fragmentation:    frag,
	}

	// Calculate Score (0-100)
	score := 100
	if !rep.IntegrityOk || len(rep.IntegrityErrors) > 0 {
		score -= 50
	}
	if !rep.QuickCheckOk || len(rep.QuickCheckErrors) > 0 {
		score -= 20
	}
	if len(rep.ForeignKeyViolations) > 0 {
		penalty := len(rep.ForeignKeyViolations) * 5
		if penalty > 25 {
			penalty = 25
		}
		score -= penalty
	}
	if frag == "high" {
		score -= 15
	} else if frag == "moderate" {
		score -= 5
	}

	if score < 0 {
		score = 0
	}
	rep.HealthScore = score

	if score >= 90 {
		rep.Summary = "Database is healthy. B-tree pages are intact and no foreign key violations found."
	} else if score >= 70 {
		rep.Summary = "Database is operational with minor fragmentation or orphan foreign keys."
	} else {
		rep.Summary = "Database requires maintenance: integrity issues or foreign key constraints violated."
	}

	return rep, nil
}

// ExecuteVacuum runs VACUUM or VACUUM INTO to defragment and reclaim disk space.
func ExecuteVacuum(ctx context.Context, db *sql.DB, intoPath string) error {
	var query string
	if intoPath != "" {
		cleaned := strings.ReplaceAll(intoPath, `'`, `''`)
		query = fmt.Sprintf("VACUUM INTO '%s';", cleaned)
	} else {
		query = "VACUUM;"
	}

	_, err := db.ExecContext(ctx, query)
	return err
}
