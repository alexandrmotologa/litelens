package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/alexandrmotologa/litelens/pkg/doctor"
)

// DoctorHandler handles database health checks and vacuum requests.
type DoctorHandler struct {
	mgr *db.Manager
}

// NewDoctorHandler creates a new DoctorHandler.
func NewDoctorHandler(mgr *db.Manager) *DoctorHandler {
	return &DoctorHandler{mgr: mgr}
}

// GetHealth runs a comprehensive diagnostic health check on the database.
func (h *DoctorHandler) GetHealth(w http.ResponseWriter, r *http.Request) {
	report, err := doctor.RunHealthAudit(r.Context(), h.mgr.DB())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// VacuumRequest holds parameters for running VACUUM.
type VacuumRequest struct {
	IntoPath string `json:"intoPath,omitempty"`
}

// ExecuteVacuum executes VACUUM or VACUUM INTO.
func (h *DoctorHandler) ExecuteVacuum(w http.ResponseWriter, r *http.Request) {
	if h.mgr.IsReadOnly() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "database is opened in read-only mode"})
		return
	}

	var req VacuumRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	if err := doctor.ExecuteVacuum(r.Context(), h.mgr.DB(), req.IntoPath); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Vacuum completed successfully"})
}
