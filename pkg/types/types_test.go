package types

import (
	"math"
	"strings"
	"testing"
)

func TestJSONBDecoder(t *testing.T) {
	// Standard JSON text test
	jsonText := `{"name": "Alice", "age": 30, "active": true}`
	decoded, err := DecodeJSONB([]byte(jsonText))
	if err != nil {
		t.Fatalf("decode standard json failed: %v", err)
	}

	m, ok := decoded.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any, got %T", decoded)
	}
	if m["name"] != "Alice" {
		t.Errorf("expected Alice, got %v", m["name"])
	}

	pretty, err := FormatJSONBPretty([]byte(jsonText))
	if err != nil {
		t.Fatalf("pretty print failed: %v", err)
	}
	if !strings.Contains(pretty, "\"Alice\"") {
		t.Errorf("expected pretty printed json to contain Alice")
	}
}

func TestVectors(t *testing.T) {
	vecA := []float32{1.0, 0.0, 0.0}
	vecB := []float32{0.0, 1.0, 0.0}
	vecC := []float32{2.0, 0.0, 0.0}

	// Bytes conversion
	bytesA := VectorToBytes(vecA)
	if len(bytesA) != 12 {
		t.Fatalf("expected 12 bytes for 3-dim float32 vector, got %d", len(bytesA))
	}

	parsedA, err := BytesToVector(bytesA)
	if err != nil {
		t.Fatalf("bytes to vector failed: %v", err)
	}
	if len(parsedA) != 3 || parsedA[0] != 1.0 {
		t.Errorf("parsed vector mismatch: %+v", parsedA)
	}

	// Orthogonal vectors: Cosine distance should be 1.0
	cosAB, err := CosineDistance(vecA, vecB)
	if err != nil {
		t.Fatalf("cosine distance failed: %v", err)
	}
	if math.Abs(cosAB-1.0) > 1e-5 {
		t.Errorf("expected cosine distance 1.0 for orthogonal vectors, got %f", cosAB)
	}

	// Collinear vectors: Cosine distance should be 0.0
	cosAC, err := CosineDistance(vecA, vecC)
	if err != nil {
		t.Fatalf("cosine distance failed: %v", err)
	}
	if math.Abs(cosAC-0.0) > 1e-5 {
		t.Errorf("expected cosine distance 0.0 for collinear vectors, got %f", cosAC)
	}

	// L2 distance between [1, 0, 0] and [0, 1, 0] is sqrt(2) ~ 1.4142
	l2AB, err := L2Distance(vecA, vecB)
	if err != nil {
		t.Fatalf("L2 distance failed: %v", err)
	}
	if math.Abs(l2AB-math.Sqrt(2)) > 1e-4 {
		t.Errorf("expected L2 distance %f, got %f", math.Sqrt(2), l2AB)
	}

	// Dot product between [1, 0, 0] and [2, 0, 0] is 2.0
	dotAC, err := DotProduct(vecA, vecC)
	if err != nil {
		t.Fatalf("dot product failed: %v", err)
	}
	if math.Abs(dotAC-2.0) > 1e-5 {
		t.Errorf("expected dot product 2.0, got %f", dotAC)
	}

	// Normalize
	normC := Normalize(vecC)
	if math.Abs(float64(normC[0])-1.0) > 1e-5 {
		t.Errorf("expected normalized value 1.0, got %f", normC[0])
	}

	// Vector blob check
	if !IsVectorBlob(bytesA) {
		t.Error("expected IsVectorBlob to be true for bytesA")
	}
}

func TestBlobInspector(t *testing.T) {
	// Text blob
	textBlob := []byte("Hello SQLite 3.45 from LiteLens!")
	textInsp := InspectBlob(textBlob)
	if !textInsp.IsText {
		t.Error("expected text blob to be detected as text")
	}
	if textInsp.TextContent != string(textBlob) {
		t.Errorf("mismatched text content: %s", textInsp.TextContent)
	}

	// Fake PNG header
	pngData := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	imgInsp := InspectBlob(pngData)
	if !imgInsp.IsImage {
		t.Error("expected PNG header to be detected as image")
	}
	if !strings.HasPrefix(imgInsp.DataURL, "data:image/png;base64,") {
		t.Errorf("unexpected data URL: %s", imgInsp.DataURL)
	}

	// Hex dump formatting
	dump := FormatHexDump([]byte("0123456789abcdefABCDEF"), 32)
	if !strings.Contains(dump, "00000000") || !strings.Contains(dump, "30 31 32") {
		t.Errorf("unexpected hex dump output:\n%s", dump)
	}
}
