package analyzer

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
)

// NodeType categorizes an execution step in the query plan.
type NodeType string

const (
	NodeScan      NodeType = "SCAN"       // Full table scan (Red / Danger)
	NodeSearch    NodeType = "SEARCH"     // Index search (Green / Good)
	NodeTempBTree NodeType = "TEMP_BTREE" // Temporary B-Tree sort/group (Yellow / Warning)
	NodeSubquery  NodeType = "SUBQUERY"   // Subquery step
	NodeCompound  NodeType = "COMPOUND"   // Compound union/intersect
	NodeGeneral   NodeType = "GENERAL"    // Root or informational node
)

// CostRating represents visual severity for the UI.
type CostRating string

const (
	CostGood    CostRating = "good"
	CostWarning CostRating = "warning"
	CostDanger  CostRating = "danger"
)

// PlanNode represents a single step in a parsed query execution plan.
type PlanNode struct {
	ID                 int         `json:"id"`
	ParentID           int         `json:"parentId"`
	Detail             string      `json:"detail"`
	Type               NodeType    `json:"type"`
	CostRating         CostRating  `json:"costRating"`
	Table              string      `json:"table,omitempty"`
	Index              string      `json:"index,omitempty"`
	UsingIndex         bool        `json:"usingIndex"`
	UsingCoveringIndex bool        `json:"usingCoveringIndex"`
	UsingTempBTree     bool        `json:"usingTempBTree"`
	Description        string      `json:"description"`
	Children           []*PlanNode `json:"children,omitempty"`
}

// PlanGraph contains nodes and edges formatted for visual DAG rendering.
type PlanGraph struct {
	Nodes              []PlanGraphNode `json:"nodes"`
	Edges              []PlanGraphEdge `json:"edges"`
	TotalNodes         int             `json:"totalNodes"`
	FullTableScans     int             `json:"fullTableScans"`
	TempBTrees         int             `json:"tempBTrees"`
	IndexLookups       int             `json:"indexLookups"`
	OptimizationScore  int             `json:"optimizationScore"` // 0 to 100
	RawRows            []RawPlanRow    `json:"rawRows"`
}

// PlanGraphNode represents a node in the DAG graph.
type PlanGraphNode struct {
	ID         string     `json:"id"`
	Label      string     `json:"label"`
	Detail     string     `json:"detail"`
	Type       NodeType   `json:"type"`
	CostRating CostRating `json:"costRating"`
	Table      string     `json:"table,omitempty"`
	Index      string     `json:"index,omitempty"`
}

// PlanGraphEdge represents a directed edge between plan nodes.
type PlanGraphEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

// RawPlanRow maps directly to SQLite EXPLAIN QUERY PLAN columns.
type RawPlanRow struct {
	ID       int    `json:"id"`
	Parent   int    `json:"parent"`
	NotUsed  int    `json:"notUsed"`
	Detail   string `json:"detail"`
}

var (
	tableScanRegex     = regexp.MustCompile(`(?i)SCAN\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)`)
	tableSearchRegex   = regexp.MustCompile(`(?i)SEARCH\s+(?:TABLE\s+)?([a-zA-Z0-9_]+)`)
	indexRegex         = regexp.MustCompile(`(?i)USING\s+(?:COVERING\s+)?INDEX\s+([a-zA-Z0-9_]+)`)
	coveringIndexRegex = regexp.MustCompile(`(?i)USING\s+COVERING\s+INDEX`)
	tempBTreeRegex     = regexp.MustCompile(`(?i)USE\s+TEMP\s+B-TREE`)
)

// ExplainQueryPlan executes EXPLAIN QUERY PLAN for a given SQL query and synthesizes a PlanGraph.
func ExplainQueryPlan(ctx context.Context, db *sql.DB, query string) (*PlanGraph, error) {
	explainSQL := fmt.Sprintf("EXPLAIN QUERY PLAN %s", query)
	rows, err := db.QueryContext(ctx, explainSQL)
	if err != nil {
		return nil, fmt.Errorf("failed to explain query: %w", err)
	}
	defer rows.Close()

	var rawList []RawPlanRow
	for rows.Next() {
		var r RawPlanRow
		if err := rows.Scan(&r.ID, &r.Parent, &r.NotUsed, &r.Detail); err != nil {
			return nil, fmt.Errorf("failed scanning plan row: %w", err)
		}
		rawList = append(rawList, r)
	}

	return BuildPlanGraph(rawList), nil
}

// BuildPlanGraph converts raw EXPLAIN QUERY PLAN rows into an interactive visual DAG.
func BuildPlanGraph(rows []RawPlanRow) *PlanGraph {
	graph := &PlanGraph{
		Nodes:   make([]PlanGraphNode, 0, len(rows)),
		Edges:   make([]PlanGraphEdge, 0),
		RawRows: rows,
	}

	if len(rows) == 0 {
		return graph
	}

	nodesMap := make(map[int]*PlanNode)
	nodeExists := make(map[int]bool)

	for _, r := range rows {
		nodeExists[r.ID] = true
		pn := classifyPlanRow(r)
		nodesMap[r.ID] = pn

		if pn.Type == NodeScan {
			graph.FullTableScans++
		} else if pn.Type == NodeSearch {
			graph.IndexLookups++
		}
		if pn.UsingTempBTree {
			graph.TempBTrees++
		}

		graph.Nodes = append(graph.Nodes, PlanGraphNode{
			ID:         fmt.Sprintf("node-%d", r.ID),
			Label:      summarizeLabel(pn),
			Detail:     r.Detail,
			Type:       pn.Type,
			CostRating: pn.CostRating,
			Table:      pn.Table,
			Index:      pn.Index,
		})
	}

	// Create edges
	for _, r := range rows {
		if r.Parent != 0 && nodeExists[r.Parent] {
			graph.Edges = append(graph.Edges, PlanGraphEdge{
				ID:     fmt.Sprintf("edge-%d-%d", r.Parent, r.ID),
				Source: fmt.Sprintf("node-%d", r.Parent),
				Target: fmt.Sprintf("node-%d", r.ID),
			})
		}
	}

	graph.TotalNodes = len(rows)

	// Compute Optimization Score (0-100)
	score := 100
	score -= graph.FullTableScans * 35
	score -= graph.TempBTrees * 15
	if score < 0 {
		score = 0
	}
	if graph.TotalNodes == 0 {
		score = 100
	}
	graph.OptimizationScore = score

	return graph
}

func classifyPlanRow(r RawPlanRow) *PlanNode {
	pn := &PlanNode{
		ID:       r.ID,
		ParentID: r.Parent,
		Detail:   r.Detail,
	}

	upper := strings.ToUpper(r.Detail)

	if match := tableScanRegex.FindStringSubmatch(r.Detail); len(match) > 1 {
		pn.Type = NodeScan
		pn.CostRating = CostDanger
		pn.Table = match[1]
		pn.Description = fmt.Sprintf("Full table scan on %s (reads every row in table)", pn.Table)
	} else if match := tableSearchRegex.FindStringSubmatch(r.Detail); len(match) > 1 {
		pn.Type = NodeSearch
		pn.CostRating = CostGood
		pn.Table = match[1]
		pn.Description = fmt.Sprintf("Index search on %s", pn.Table)
	} else if strings.Contains(upper, "SUBQUERY") {
		pn.Type = NodeSubquery
		pn.CostRating = CostWarning
		pn.Description = "Subquery execution step"
	} else if strings.Contains(upper, "COMPOUND") {
		pn.Type = NodeCompound
		pn.CostRating = CostWarning
		pn.Description = "Compound set operation (UNION / INTERSECT)"
	} else {
		pn.Type = NodeGeneral
		pn.CostRating = CostGood
		pn.Description = "Execution step"
	}

	if match := indexRegex.FindStringSubmatch(r.Detail); len(match) > 1 {
		pn.Index = match[1]
		pn.UsingIndex = true
	}
	if coveringIndexRegex.MatchString(r.Detail) {
		pn.UsingCoveringIndex = true
		pn.Description += " (Covering Index)"
	}
	if tempBTreeRegex.MatchString(r.Detail) {
		pn.UsingTempBTree = true
		if pn.CostRating != CostDanger {
			pn.CostRating = CostWarning
		}
		pn.Description += " [Temporary B-Tree Sorting]"
	}

	return pn
}

func summarizeLabel(pn *PlanNode) string {
	switch pn.Type {
	case NodeScan:
		return fmt.Sprintf("SCAN TABLE %s", pn.Table)
	case NodeSearch:
		if pn.Index != "" {
			return fmt.Sprintf("INDEX %s", pn.Index)
		}
		return fmt.Sprintf("SEARCH %s", pn.Table)
	case NodeTempBTree:
		return "TEMP B-TREE SORT"
	case NodeSubquery:
		return "SUBQUERY"
	case NodeCompound:
		return "COMPOUND"
	default:
		if len(pn.Detail) > 32 {
			return pn.Detail[:29] + "..."
		}
		return pn.Detail
	}
}
