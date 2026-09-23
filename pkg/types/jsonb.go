package types

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
)

// JSONB types in SQLite 3.45 format
const (
	JSONBNull   = 0
	JSONBTrue   = 1
	JSONBFalse  = 2
	JSONBInt    = 3
	JSONBFloat  = 4
	JSONBText   = 5
	JSONBArray  = 6
	JSONBObject = 7
)

// DecodeJSONB attempts to decode a raw byte slice as either SQLite 3.45 JSONB or standard JSON.
func DecodeJSONB(b []byte) (any, error) {
	if len(b) == 0 {
		return nil, errors.New("empty payload")
	}

	// First try standard JSON decoding if it starts with { or [ or quote
	trimmed := strings.TrimSpace(string(b))
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") || strings.HasPrefix(trimmed, "\"") {
		var res any
		if err := json.Unmarshal([]byte(trimmed), &res); err == nil {
			return res, nil
		}
	}

	// Try SQLite JSONB binary decoding
	val, _, err := parseJSONBElement(b, 0)
	if err == nil {
		return val, nil
	}

	// Fallback to plain string or raw bytes
	return string(b), nil
}

// IsJSONB checks if a byte slice matches the SQLite JSONB header heuristic.
func IsJSONB(b []byte) bool {
	if len(b) < 1 {
		return false
	}
	elemType := b[0] & 0x0F
	if elemType > JSONBObject {
		return false
	}
	_, _, err := parseJSONBElement(b, 0)
	return err == nil
}

// FormatJSONBPretty decodes and pretty-prints JSON or JSONB content.
func FormatJSONBPretty(b []byte) (string, error) {
	decoded, err := DecodeJSONB(b)
	if err != nil {
		return "", err
	}

	pretty, err := json.MarshalIndent(decoded, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", decoded), nil
	}
	return string(pretty), nil
}

func parseJSONBElement(b []byte, offset int) (any, int, error) {
	if offset >= len(b) {
		return nil, offset, errors.New("unexpected end of jsonb stream")
	}

	header := b[offset]
	elemType := header & 0x0F
	length := int(header >> 4)
	offset++

	// Extended length
	if length == 12 && offset < len(b) {
		length = int(b[offset])
		offset++
	} else if length == 13 && offset+1 < len(b) {
		length = int(binary.BigEndian.Uint16(b[offset : offset+2]))
		offset += 2
	} else if length == 14 && offset+3 < len(b) {
		length = int(binary.BigEndian.Uint32(b[offset : offset+4]))
		offset += 4
	}

	switch elemType {
	case JSONBNull:
		return nil, offset, nil
	case JSONBTrue:
		return true, offset, nil
	case JSONBFalse:
		return false, offset, nil
	case JSONBInt:
		if offset+length > len(b) {
			return nil, offset, errors.New("truncated integer in jsonb")
		}
		rawStr := string(b[offset : offset+length])
		offset += length
		var n int64
		if _, err := fmt.Sscanf(rawStr, "%d", &n); err == nil {
			return n, offset, nil
		}
		return rawStr, offset, nil
	case JSONBFloat:
		if offset+length > len(b) {
			return nil, offset, errors.New("truncated float in jsonb")
		}
		rawStr := string(b[offset : offset+length])
		offset += length
		var f float64
		if _, err := fmt.Sscanf(rawStr, "%f", &f); err == nil {
			return f, offset, nil
		}
		return rawStr, offset, nil
	case JSONBText:
		if offset+length > len(b) {
			return nil, offset, errors.New("truncated text in jsonb")
		}
		txt := string(b[offset : offset+length])
		offset += length
		return txt, offset, nil
	case JSONBArray:
		items := make([]any, 0)
		end := offset + length
		if end > len(b) {
			end = len(b)
		}
		for offset < end {
			item, newOff, err := parseJSONBElement(b, offset)
			if err != nil {
				break
			}
			items = append(items, item)
			offset = newOff
		}
		return items, offset, nil
	case JSONBObject:
		obj := make(map[string]any)
		end := offset + length
		if end > len(b) {
			end = len(b)
		}
		for offset < end {
			key, newOff, err := parseJSONBElement(b, offset)
			if err != nil {
				break
			}
			offset = newOff

			keyStr := fmt.Sprintf("%v", key)
			if offset >= end {
				obj[keyStr] = nil
				break
			}

			val, valOff, err := parseJSONBElement(b, offset)
			if err != nil {
				break
			}
			obj[keyStr] = val
			offset = valOff
		}
		return obj, offset, nil
	default:
		// Fallback for standard float64 or unknown
		if offset+8 <= len(b) {
			bits := binary.LittleEndian.Uint64(b[offset : offset+8])
			return math.Float64frombits(bits), offset + 8, nil
		}
		return nil, offset, fmt.Errorf("unknown jsonb element type: %d", elemType)
	}
}
