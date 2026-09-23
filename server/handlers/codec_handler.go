package handlers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/types"
)

// CodecHandler handles BLOB inspection, JSONB formatting, and Vector distance calculations.
type CodecHandler struct{}

// NewCodecHandler creates a new CodecHandler.
func NewCodecHandler() *CodecHandler {
	return &CodecHandler{}
}

// BlobInspectRequest holds the raw base64 or text payload.
type BlobInspectRequest struct {
	Base64Data string `json:"base64Data,omitempty"`
	RawText    string `json:"rawText,omitempty"`
}

// InspectBlob decodes and analyzes binary data.
func (h *CodecHandler) InspectBlob(w http.ResponseWriter, r *http.Request) {
	var req BlobInspectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	var data []byte
	var err error

	if req.Base64Data != "" {
		data, err = base64.StdEncoding.DecodeString(req.Base64Data)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid base64: " + err.Error()})
			return
		}
	} else if req.RawText != "" {
		data = []byte(req.RawText)
	}

	insp := types.InspectBlob(data)
	writeJSON(w, http.StatusOK, insp)
}

// VectorCalcRequest holds two vectors for distance comparison.
type VectorCalcRequest struct {
	VectorA []float32 `json:"vectorA"`
	VectorB []float32 `json:"vectorB"`
}

// VectorCalcResponse holds distance metrics.
type VectorCalcResponse struct {
	CosineDistance float64 `json:"cosineDistance"`
	L2Distance     float64 `json:"l2Distance"`
	DotProduct     float64 `json:"dotProduct"`
}

// CalcVectorDistances computes metrics between two vectors.
func (h *CodecHandler) CalcVectorDistances(w http.ResponseWriter, r *http.Request) {
	var req VectorCalcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	cosDist, err := types.CosineDistance(req.VectorA, req.VectorB)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	l2Dist, _ := types.L2Distance(req.VectorA, req.VectorB)
	dot, _ := types.DotProduct(req.VectorA, req.VectorB)

	resp := VectorCalcResponse{
		CosineDistance: cosDist,
		L2Distance:     l2Dist,
		DotProduct:     dot,
	}

	writeJSON(w, http.StatusOK, resp)
}
