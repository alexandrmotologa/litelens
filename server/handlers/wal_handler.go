package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/fsnotify/fsnotify"
)

// WalHandler handles WAL telemetry, manual checkpoints, and live SSE event streams.
type WalHandler struct {
	mgr *db.Manager
}

// NewWalHandler creates a new WalHandler.
func NewWalHandler(mgr *db.Manager) *WalHandler {
	return &WalHandler{mgr: mgr}
}

// GetStatus returns current WAL diagnostic metrics.
func (h *WalHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	diag, err := h.mgr.InspectWal()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, diag)
}

// CheckpointRequest defines payload for executing a checkpoint.
type CheckpointRequest struct {
	Mode string `json:"mode"`
}

// ExecuteCheckpoint runs a manual WAL checkpoint.
func (h *WalHandler) ExecuteCheckpoint(w http.ResponseWriter, r *http.Request) {
	var req CheckpointRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	mode := req.Mode
	if mode == "" {
		mode = "PASSIVE"
	}

	res, err := h.mgr.ExecuteCheckpoint(r.Context(), mode)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, res)
}

// StreamEvents streams real-time WAL updates via Server-Sent Events (SSE).
func (h *WalHandler) StreamEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		http.Error(w, "Failed to initialize watcher", http.StatusInternalServerError)
		return
	}
	defer watcher.Close()

	dbDir := filepath.Dir(h.mgr.Path())
	_ = watcher.Add(dbDir)

	// Send initial status immediately
	diag, _ := h.mgr.InspectWal()
	if diagBytes, err := json.Marshal(diag); err == nil {
		fmt.Fprintf(w, "event: wal-update\ndata: %s\n\n", diagBytes)
		flusher.Flush()
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			// If event touches this database or its wal/shm
			baseName := filepath.Base(h.mgr.Path())
			if filepath.Base(event.Name) == baseName ||
				filepath.Base(event.Name) == baseName+"-wal" ||
				filepath.Base(event.Name) == baseName+"-shm" {
				diag, err := h.mgr.InspectWal()
				if err == nil {
					if data, err := json.Marshal(diag); err == nil {
						fmt.Fprintf(w, "event: wal-update\ndata: %s\n\n", data)
						flusher.Flush()
					}
				}
			}
		case <-ticker.C:
			// Heartbeat & periodic status refresh
			diag, err := h.mgr.InspectWal()
			if err == nil {
				if data, err := json.Marshal(diag); err == nil {
					fmt.Fprintf(w, "event: wal-update\ndata: %s\n\n", data)
					flusher.Flush()
				}
			}
		case <-watcher.Errors:
			// Continue on error
		}
	}
}
