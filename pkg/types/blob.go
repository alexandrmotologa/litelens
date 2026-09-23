package types

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"
)

// BlobInspection summarizes the detected format and representations of a binary value.
type BlobInspection struct {
	SizeBytes   int     `json:"sizeBytes"`
	MimeType    string  `json:"mimeType"`
	IsImage     bool    `json:"isImage"`
	IsText      bool    `json:"isText"`
	IsVector    bool    `json:"isVector"`
	VectorDims  int     `json:"vectorDims,omitempty"`
	DataURL     string  `json:"dataUrl,omitempty"`
	TextContent string  `json:"textContent,omitempty"`
	HexDump     string  `json:"hexDump"`
}

// InspectBlob inspects a binary byte slice, detects its format, and prepares UI previews.
func InspectBlob(data []byte) *BlobInspection {
	insp := &BlobInspection{
		SizeBytes: len(data),
		HexDump:   FormatHexDump(data, 256),
	}

	if len(data) == 0 {
		insp.MimeType = "application/octet-stream"
		return insp
	}

	// Detect MIME type
	mime := detectMimeType(data)
	insp.MimeType = mime

	if strings.HasPrefix(mime, "image/") {
		insp.IsImage = true
		b64 := base64.StdEncoding.EncodeToString(data)
		insp.DataURL = fmt.Sprintf("data:%s;base64,%s", mime, b64)
	}

	if utf8.Valid(data) && !bytes.Contains(data, []byte{0}) {
		insp.IsText = true
		if len(data) <= 4096 {
			insp.TextContent = string(data)
		} else {
			insp.TextContent = string(data[:4096]) + "\n... (truncated)"
		}
	}

	if IsVectorBlob(data) {
		insp.IsVector = true
		insp.VectorDims = len(data) / 4
	}

	return insp
}

func detectMimeType(b []byte) string {
	if len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF {
		return "image/jpeg"
	}
	if len(b) >= 8 && string(b[:8]) == "\x89PNG\r\n\x1a\n" {
		return "image/png"
	}
	if len(b) >= 6 && (string(b[:6]) == "GIF87a" || string(b[:6]) == "GIF89a") {
		return "image/gif"
	}
	if len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP" {
		return "image/webp"
	}
	if len(b) >= 4 && string(b[:4]) == "%PDF" {
		return "application/pdf"
	}
	if len(b) >= 16 && string(b[:15]) == "SQLite format 3" {
		return "application/x-sqlite3"
	}

	return http.DetectContentType(b)
}

// FormatHexDump formats a byte slice into a standard hex + ASCII dump representation.
func FormatHexDump(data []byte, maxBytes int) string {
	if len(data) == 0 {
		return ""
	}

	limit := len(data)
	if maxBytes > 0 && limit > maxBytes {
		limit = maxBytes
	}

	var sb strings.Builder
	for offset := 0; offset < limit; offset += 16 {
		chunkEnd := offset + 16
		if chunkEnd > limit {
			chunkEnd = limit
		}
		chunk := data[offset:chunkEnd]

		sb.WriteString(fmt.Sprintf("%08X  ", offset))

		// Hex bytes
		for i := 0; i < 16; i++ {
			if i == 8 {
				sb.WriteString(" ")
			}
			if i < len(chunk) {
				sb.WriteString(fmt.Sprintf("%02X ", chunk[i]))
			} else {
				sb.WriteString("   ")
			}
		}

		sb.WriteString(" |")
		// ASCII characters
		for _, b := range chunk {
			if b >= 32 && b <= 126 {
				sb.WriteByte(b)
			} else {
				sb.WriteByte('.')
			}
		}
		sb.WriteString("|\n")
	}

	if limit < len(data) {
		sb.WriteString(fmt.Sprintf("... (%d more bytes)\n", len(data)-limit))
	}

	return sb.String()
}
