package types

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
)

// BytesToVector converts a byte slice of IEEE-754 32-bit floats into a []float32 slice.
func BytesToVector(b []byte) ([]float32, error) {
	if len(b)%4 != 0 {
		return nil, fmt.Errorf("byte slice length (%d) is not a multiple of 4", len(b))
	}
	if len(b) == 0 {
		return nil, errors.New("empty byte slice")
	}

	dims := len(b) / 4
	vec := make([]float32, dims)
	for i := 0; i < dims; i++ {
		bits := binary.LittleEndian.Uint32(b[i*4 : (i+1)*4])
		vec[i] = math.Float32frombits(bits)
	}
	return vec, nil
}

// VectorToBytes serializes a []float32 slice into little-endian bytes.
func VectorToBytes(vec []float32) []byte {
	buf := make([]byte, len(vec)*4)
	for i, f := range vec {
		binary.LittleEndian.PutUint32(buf[i*4:(i+1)*4], math.Float32bits(f))
	}
	return buf
}

// CosineDistance calculates cosine distance between two float32 vectors: 1.0 - (a · b) / (||a|| * ||b||).
func CosineDistance(a, b []float32) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("dimension mismatch: %d vs %d", len(a), len(b))
	}
	if len(a) == 0 {
		return 0, errors.New("empty vector")
	}

	var dot, normA, normB float64
	for i := range a {
		ai := float64(a[i])
		bi := float64(b[i])
		dot += ai * bi
		normA += ai * ai
		normB += bi * bi
	}

	if normA == 0 || normB == 0 {
		return 1.0, nil
	}

	cosSim := dot / (math.Sqrt(normA) * math.Sqrt(normB))
	// Clamp cosine similarity to [-1, 1] to avoid precision errors
	if cosSim > 1.0 {
		cosSim = 1.0
	} else if cosSim < -1.0 {
		cosSim = -1.0
	}

	return 1.0 - cosSim, nil
}

// L2Distance calculates the Euclidean (L2) distance between two vectors: sqrt(sum((a_i - b_i)^2)).
func L2Distance(a, b []float32) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("dimension mismatch: %d vs %d", len(a), len(b))
	}

	var sumSq float64
	for i := range a {
		diff := float64(a[i]) - float64(b[i])
		sumSq += diff * diff
	}
	return math.Sqrt(sumSq), nil
}

// DotProduct calculates the dot product between two vectors.
func DotProduct(a, b []float32) (float64, error) {
	if len(a) != len(b) {
		return 0, fmt.Errorf("dimension mismatch: %d vs %d", len(a), len(b))
	}

	var dot float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
	}
	return dot, nil
}

// Normalize returns a unit-length copy of the vector.
func Normalize(v []float32) []float32 {
	var norm float64
	for _, x := range v {
		norm += float64(x) * float64(x)
	}
	if norm == 0 {
		out := make([]float32, len(v))
		copy(out, v)
		return out
	}

	mag := float32(math.Sqrt(norm))
	res := make([]float32, len(v))
	for i, x := range v {
		res[i] = x / mag
	}
	return res
}

// IsVectorBlob checks whether a byte slice looks like a serialized float32 embedding vector.
func IsVectorBlob(b []byte) bool {
	if len(b) < 8 || len(b)%4 != 0 {
		return false
	}
	// Common embedding dimensions: 2, 3, 4, 8, 16, 32, 64, 128, 256, 384, 512, 768, 1024, 1536, 3072
	dims := len(b) / 4
	if dims < 2 || dims > 4096 {
		return false
	}

	// Verify the values are valid finite non-NaN numbers
	validCount := 0
	for i := 0; i < dims && i < 10; i++ {
		bits := binary.LittleEndian.Uint32(b[i*4 : (i+1)*4])
		val := math.Float32frombits(bits)
		if !math.IsNaN(float64(val)) && !math.IsInf(float64(val), 0) {
			validCount++
		}
	}
	return validCount > 0
}
