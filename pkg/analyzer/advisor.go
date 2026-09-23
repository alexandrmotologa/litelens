package analyzer

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/alexandrmotologa/litelens/pkg/db"
)

// IndexRecommendation represents an automated indexing suggestion.
type IndexRecommendation struct {
	Table       string   `json:"table"`
	Columns     []string `json:"columns"`
	IndexName   string   `json:"indexName"`
	DDL         string   `json:"ddl"`
	Reason      string   `json:"reason"`
	Impact      string   `json:"impact"`
	IsExisting  bool     `json:"isExisting"`
}

// Advisor analyzes query plans and table schemas to recommend optimal indexes.
type Advisor struct{}

// NewAdvisor creates a new instance of the Index Advisor.
func NewAdvisor() *Advisor {
	return &Advisor{}
}

var (
	whereClauseRegex = regexp.MustCompile(`(?i)\bWHERE\s+([a-zA-Z0-9_\s.='"><!ANDORIN]+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|;|\z)`)
	orderByRegex     = regexp.MustCompile(`(?i)\bORDER\s+BY\s+([a-zA-Z0-9_,\s.ASCascDESCdesc]+?)(?:\s+LIMIT|;|\z)`)
	colEqualityRegex = regexp.MustCompile(`(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)\s*(=|IS|IN|LIKE)`)
)

// AnalyzeQuery inspects a SQL query and its execution plan graph to generate index suggestions.
func (a *Advisor) AnalyzeQuery(sqlQuery string, graph *PlanGraph, tables []db.TableInfo) []IndexRecommendation {
	if graph == nil || graph.FullTableScans == 0 && graph.TempBTrees == 0 {
		return nil
	}

	tableMap := make(map[string]db.TableInfo)
	for _, t := range tables {
		tableMap[strings.ToLower(t.Name)] = t
	}

	var recommendations []IndexRecommendation
	seenIndexes := make(map[string]bool)

	// Identify tables with full scans
	scannedTables := make(map[string]bool)
	for _, node := range graph.Nodes {
		if node.Type == NodeScan && node.Table != "" {
			scannedTables[strings.ToLower(node.Table)] = true
		}
	}

	whereCols := a.extractWhereColumns(sqlQuery)
	orderCols := a.extractOrderColumns(sqlQuery)

	for tblName := range scannedTables {
		targetCols := make([]string, 0)
		for _, col := range whereCols[tblName] {
			if !contains(targetCols, col) {
				targetCols = append(targetCols, col)
			}
		}
		for _, col := range orderCols[tblName] {
			if !contains(targetCols, col) {
				targetCols = append(targetCols, col)
			}
		}

		if len(targetCols) == 0 {
			// Check if any where cols were unqualified
			for _, col := range whereCols[""] {
				if tbl, exists := tableMap[tblName]; exists {
					if hasColumn(tbl, col) && !contains(targetCols, col) {
						targetCols = append(targetCols, col)
					}
				}
			}
			for _, col := range orderCols[""] {
				if tbl, exists := tableMap[tblName]; exists {
					if hasColumn(tbl, col) && !contains(targetCols, col) {
						targetCols = append(targetCols, col)
					}
				}
			}
		}

		if len(targetCols) == 0 {
			continue
		}

		idxName := fmt.Sprintf("idx_%s_%s", tblName, strings.Join(targetCols, "_"))
		if len(idxName) > 60 {
			idxName = idxName[:60]
		}

		if seenIndexes[idxName] {
			continue
		}
		seenIndexes[idxName] = true

		// Check if an index already covers these columns
		tblMeta, hasMeta := tableMap[tblName]
		isAlreadyIndexed := false
		if hasMeta {
			for _, existingIdx := range tblMeta.Indexes {
				if indexCovers(existingIdx, targetCols) {
					isAlreadyIndexed = true
					break
				}
			}
		}

		ddl := fmt.Sprintf("CREATE INDEX %s ON %s (%s);", idxName, tblName, strings.Join(targetCols, ", "))
		reason := fmt.Sprintf("Query performs a full table scan on %s with filter/order on (%s)", tblName, strings.Join(targetCols, ", "))
		impact := "High (Converts table scan into indexed B-Tree search)"

		if isAlreadyIndexed {
			continue
		}

		recommendations = append(recommendations, IndexRecommendation{
			Table:      tblName,
			Columns:    targetCols,
			IndexName:  idxName,
			DDL:        ddl,
			Reason:     reason,
			Impact:     impact,
			IsExisting: false,
		})
	}

	return recommendations
}

func (a *Advisor) extractWhereColumns(sqlQuery string) map[string][]string {
	res := make(map[string][]string)
	whereMatch := whereClauseRegex.FindStringSubmatch(sqlQuery)
	if len(whereMatch) < 2 {
		return res
	}

	clause := whereMatch[1]
	matches := colEqualityRegex.FindAllStringSubmatch(clause, -1)
	for _, m := range matches {
		tbl := strings.ToLower(m[1])
		col := strings.ToLower(m[2])
		res[tbl] = append(res[tbl], col)
	}
	return res
}

func (a *Advisor) extractOrderColumns(sqlQuery string) map[string][]string {
	res := make(map[string][]string)
	orderMatch := orderByRegex.FindStringSubmatch(sqlQuery)
	if len(orderMatch) < 2 {
		return res
	}

	parts := strings.Split(orderMatch[1], ",")
	for _, p := range parts {
		clean := strings.TrimSpace(p)
		tokens := strings.Fields(clean)
		if len(tokens) == 0 {
			continue
		}
		rawCol := tokens[0]
		if strings.Contains(rawCol, ".") {
			subParts := strings.Split(rawCol, ".")
			tbl := strings.ToLower(subParts[0])
			col := strings.ToLower(subParts[1])
			res[tbl] = append(res[tbl], col)
		} else {
			res[""] = append(res[""], strings.ToLower(rawCol))
		}
	}
	return res
}

func hasColumn(tbl db.TableInfo, colName string) bool {
	for _, c := range tbl.Columns {
		if strings.EqualFold(c.Name, colName) {
			return true
		}
	}
	return false
}

func indexCovers(idx db.IndexInfo, cols []string) bool {
	if len(idx.Columns) < len(cols) {
		return false
	}
	for i, c := range cols {
		if !strings.EqualFold(idx.Columns[i].Name, c) {
			return false
		}
	}
	return true
}

func contains(slice []string, val string) bool {
	for _, item := range slice {
		if strings.EqualFold(item, val) {
			return true
		}
	}
	return false
}
