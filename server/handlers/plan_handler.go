package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/analyzer"
	"github.com/alexandrmotologa/litelens/pkg/db"
)

// PlanHandler handles query execution, query plans, and index advice.
type PlanHandler struct {
	mgr     *db.Manager
	advisor *analyzer.Advisor
}

// NewPlanHandler creates a new PlanHandler.
func NewPlanHandler(mgr *db.Manager) *PlanHandler {
	return &PlanHandler{
		mgr:     mgr,
		advisor: analyzer.NewAdvisor(),
	}
}

// QueryRequest defines the input SQL payload.
type QueryRequest struct {
	SQL string `json:"sql"`
}

// ExecuteQuery runs a SQL query and returns results.
func (h *PlanHandler) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	if req.SQL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "SQL statement required"})
		return
	}

	res, err := h.mgr.ExecuteQuery(r.Context(), req.SQL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, res)
}

// ExplainResponse holds the complete diagnostic package for an explained query.
type ExplainResponse struct {
	Query           string                         `json:"query"`
	Graph           *analyzer.PlanGraph            `json:"graph"`
	Recommendations []analyzer.IndexRecommendation `json:"recommendations"`
	Vdbe            *analyzer.VdbeAnalysis         `json:"vdbe,omitempty"`
}

// ExplainQuery analyzes a SQL query and returns its visual plan DAG and recommendations.
func (h *PlanHandler) ExplainQuery(w http.ResponseWriter, r *http.Request) {
	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	if req.SQL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "SQL statement required"})
		return
	}

	graph, err := analyzer.ExplainQueryPlan(r.Context(), h.mgr.DB(), req.SQL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	schema, _ := h.mgr.IntrospectDatabase(r.Context())
	var tables []db.TableInfo
	if schema != nil {
		tables = schema.Tables
	}

	recs := h.advisor.AnalyzeQuery(req.SQL, graph, tables)
	vdbe, _ := analyzer.ExplainVDBE(r.Context(), h.mgr.DB(), req.SQL)

	resp := ExplainResponse{
		Query:           req.SQL,
		Graph:           graph,
		Recommendations: recs,
		Vdbe:            vdbe,
	}

	writeJSON(w, http.StatusOK, resp)
}
