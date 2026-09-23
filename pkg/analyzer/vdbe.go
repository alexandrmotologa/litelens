package analyzer

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// VdbeInstruction represents a single SQLite virtual machine bytecode opcode.
type VdbeInstruction struct {
	Addr     int    `json:"addr"`
	Opcode   string `json:"opcode"`
	P1       int    `json:"p1"`
	P2       int    `json:"p2"`
	P3       int    `json:"p3"`
	P4       string `json:"p4"`
	P5       string `json:"p5"`
	Comment  string `json:"comment"`
	Category string `json:"category"` // "cursor", "storage", "branch", "compute", "flow"
}

// VdbeAnalysis summarizes a low-level VDBE bytecode program.
type VdbeAnalysis struct {
	Query               string            `json:"query"`
	Instructions        []VdbeInstruction `json:"instructions"`
	TotalOpcodes        int               `json:"totalOpcodes"`
	CursorOpsCount      int               `json:"cursorOpsCount"`
	StorageOpsCount     int               `json:"storageOpsCount"`
	BranchOpsCount      int               `json:"branchOpsCount"`
	EstimatedComplexity string            `json:"estimatedComplexity"` // "low", "medium", "high"
}

// ExplainVDBE runs raw EXPLAIN on a SQL statement and parses the SQLite bytecode.
func ExplainVDBE(ctx context.Context, db *sql.DB, query string) (*VdbeAnalysis, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("EXPLAIN %s", query))
	if err != nil {
		return nil, fmt.Errorf("failed to run EXPLAIN: %w", err)
	}
	defer rows.Close()

	analysis := &VdbeAnalysis{
		Query:        query,
		Instructions: make([]VdbeInstruction, 0),
	}

	for rows.Next() {
		var inst VdbeInstruction
		var p4, p5, comment sql.NullString

		if err := rows.Scan(&inst.Addr, &inst.Opcode, &inst.P1, &inst.P2, &inst.P3, &p4, &p5, &comment); err != nil {
			return nil, fmt.Errorf("failed to scan VDBE instruction: %w", err)
		}

		if p4.Valid {
			inst.P4 = p4.String
		}
		if p5.Valid {
			inst.P5 = p5.String
		}
		if comment.Valid {
			inst.Comment = comment.String
		}

		inst.Category = categorizeOpcode(inst.Opcode)
		switch inst.Category {
		case "cursor":
			analysis.CursorOpsCount++
		case "storage":
			analysis.StorageOpsCount++
		case "branch":
			analysis.BranchOpsCount++
		}

		analysis.Instructions = append(analysis.Instructions, inst)
	}

	analysis.TotalOpcodes = len(analysis.Instructions)
	if analysis.TotalOpcodes < 25 {
		analysis.EstimatedComplexity = "low"
	} else if analysis.TotalOpcodes < 80 {
		analysis.EstimatedComplexity = "medium"
	} else {
		analysis.EstimatedComplexity = "high"
	}

	return analysis, nil
}

func categorizeOpcode(opcode string) string {
	upper := strings.ToUpper(opcode)
	switch {
	case strings.HasPrefix(upper, "OPEN") || strings.HasPrefix(upper, "SEEK") || upper == "NEXT" || upper == "PREV" || upper == "CLOSE":
		return "cursor"
	case strings.HasPrefix(upper, "INSERT") || strings.HasPrefix(upper, "DELETE") || upper == "COLUMN" || upper == "ROWID" || upper == "MAKERECORD":
		return "storage"
	case strings.HasPrefix(upper, "IF") || upper == "GOTO" || upper == "RETURN" || upper == "HALT" || upper == "INIT":
		return "branch"
	case strings.HasPrefix(upper, "ADD") || strings.HasPrefix(upper, "SUB") || strings.HasPrefix(upper, "MUL") || strings.HasPrefix(upper, "DIV") || strings.HasPrefix(upper, "EQ") || strings.HasPrefix(upper, "NE"):
		return "compute"
	default:
		return "flow"
	}
}
