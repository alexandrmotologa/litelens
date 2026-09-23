package db

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

const (
	WalHeaderSize = 32
	WalFrameHeaderSize = 24
	WalMagicLE = 0x377f0682
	WalMagicBE = 0x377f0683
)

// WalHeader represents the 32-byte header at the beginning of a SQLite WAL file.
type WalHeader struct {
	Magic         uint32 `json:"magic"`
	Version       uint32 `json:"version"`
	PageSize      uint32 `json:"pageSize"`
	CheckpointSeq uint32 `json:"checkpointSeq"`
	Salt1         uint32 `json:"salt1"`
	Salt2         uint32 `json:"salt2"`
	Checksum1     uint32 `json:"checksum1"`
	Checksum2     uint32 `json:"checksum2"`
	IsBigEndian   bool   `json:"isBigEndian"`
}

// WalFrameHeader holds the 24-byte metadata preceding each database page in the WAL.
type WalFrameHeader struct {
	PageNumber       uint32 `json:"pageNumber"`
	SizeAfterCommit  uint32 `json:"sizeAfterCommit"`
	Salt1            uint32 `json:"salt1"`
	Salt2            uint32 `json:"salt2"`
	Checksum1        uint32 `json:"checksum1"`
	Checksum2        uint32 `json:"checksum2"`
}

// WalDiagnostics contains diagnostic metrics extracted from WAL and SHM files.
type WalDiagnostics struct {
	WalPath          string     `json:"walPath"`
	ShmPath          string     `json:"shmPath"`
	WalExists        bool       `json:"walExists"`
	ShmExists        bool       `json:"shmExists"`
	WalSizeBytes     int64      `json:"walSizeBytes"`
	ShmSizeBytes     int64      `json:"shmSizeBytes"`
	Header           *WalHeader `json:"header,omitempty"`
	Shm              *ShmHeader `json:"shm,omitempty"`
	TotalFrames      int        `json:"totalFrames"`
	LastCommitPages  uint32     `json:"lastCommitPages"`
	LastModified     *time.Time `json:"lastModified,omitempty"`
}

// CheckpointResult holds the output from a PRAGMA wal_checkpoint call.
type CheckpointResult struct {
	Mode         string `json:"mode"`
	Busy         int    `json:"busy"`
	Log          int    `json:"log"`
	Checkpointed int    `json:"checkpointed"`
	DurationMs   float64 `json:"durationMs"`
}

// InspectWal reads the WAL and SHM files associated with the database to gather diagnostics.
func (m *Manager) InspectWal() (*WalDiagnostics, error) {
	walPath := m.path + "-wal"
	shmPath := m.path + "-shm"

	diag := &WalDiagnostics{
		WalPath: walPath,
		ShmPath: shmPath,
	}

	if fi, err := os.Stat(shmPath); err == nil {
		diag.ShmExists = true
		diag.ShmSizeBytes = fi.Size()
		if shmHdr, parseErr := ParseShm(shmPath); parseErr == nil {
			diag.Shm = shmHdr
		}
	}

	fi, err := os.Stat(walPath)
	if err != nil {
		if os.IsNotExist(err) {
			diag.WalExists = false
			return diag, nil
		}
		return nil, err
	}

	diag.WalExists = true
	diag.WalSizeBytes = fi.Size()
	modTime := fi.ModTime()
	diag.LastModified = &modTime

	if diag.WalSizeBytes < WalHeaderSize {
		return diag, nil
	}

	file, err := os.Open(walPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open WAL file: %w", err)
	}
	defer file.Close()

	headerBytes := make([]byte, WalHeaderSize)
	if _, err := io.ReadFull(file, headerBytes); err != nil {
		return nil, fmt.Errorf("failed to read WAL header: %w", err)
	}

	header, err := parseWalHeader(headerBytes)
	if err != nil {
		return nil, err
	}
	diag.Header = header

	if header.PageSize > 0 {
		frameLen := int64(WalFrameHeaderSize + header.PageSize)
		framesDataSize := diag.WalSizeBytes - WalHeaderSize
		if framesDataSize > 0 {
			diag.TotalFrames = int(framesDataSize / frameLen)
		}

		if diag.TotalFrames > 0 {
			// Read the last frame header
			lastFrameOffset := WalHeaderSize + int64(diag.TotalFrames-1)*frameLen
			if _, err := file.Seek(lastFrameOffset, io.SeekStart); err == nil {
				frameBuf := make([]byte, WalFrameHeaderSize)
				if _, err := io.ReadFull(file, frameBuf); err == nil {
					var lastFrame WalFrameHeader
					if header.IsBigEndian {
						lastFrame.PageNumber = binary.BigEndian.Uint32(frameBuf[0:4])
						lastFrame.SizeAfterCommit = binary.BigEndian.Uint32(frameBuf[4:8])
					} else {
						lastFrame.PageNumber = binary.LittleEndian.Uint32(frameBuf[0:4])
						lastFrame.SizeAfterCommit = binary.LittleEndian.Uint32(frameBuf[4:8])
					}
					diag.LastCommitPages = lastFrame.SizeAfterCommit
				}
			}
		}
	}

	return diag, nil
}

func parseWalHeader(b []byte) (*WalHeader, error) {
	if len(b) < WalHeaderSize {
		return nil, fmt.Errorf("invalid header length: %d", len(b))
	}

	// SQLite WAL header magic is 0x377f0682 (little-endian checksums) or 0x377f0683 (big-endian checksums).
	// In the file, the 4 magic bytes are stored as big-endian 0x377f0682 or 0x377f0683.
	magicRaw := binary.BigEndian.Uint32(b[0:4])

	var isBE bool
	var byteOrder binary.ByteOrder

	if magicRaw == WalMagicLE {
		isBE = false
		byteOrder = binary.LittleEndian
	} else if magicRaw == WalMagicBE {
		isBE = true
		byteOrder = binary.BigEndian
	} else if binary.LittleEndian.Uint32(b[0:4]) == WalMagicLE {
		isBE = false
		magicRaw = WalMagicLE
		byteOrder = binary.LittleEndian
	} else {
		return nil, fmt.Errorf("unrecognized WAL magic: 0x%x", magicRaw)
	}

	h := &WalHeader{
		Magic:         magicRaw,
		Version:       byteOrder.Uint32(b[4:8]),
		PageSize:      byteOrder.Uint32(b[8:12]),
		CheckpointSeq: byteOrder.Uint32(b[12:16]),
		Salt1:         byteOrder.Uint32(b[16:20]),
		Salt2:         byteOrder.Uint32(b[20:24]),
		Checksum1:     byteOrder.Uint32(b[24:28]),
		Checksum2:     byteOrder.Uint32(b[28:32]),
		IsBigEndian:   isBE,
	}

	return h, nil
}

// ExecuteCheckpoint runs a manual WAL checkpoint with the specified mode.
// Supported modes: PASSIVE, FULL, RESTART, TRUNCATE.
func (m *Manager) ExecuteCheckpoint(ctx context.Context, mode string) (*CheckpointResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.readOnly {
		return nil, fmt.Errorf("database opened in read-only mode; checkpoint rejected")
	}

	normalized := strings.ToUpper(strings.TrimSpace(mode))
	switch normalized {
	case "PASSIVE", "FULL", "RESTART", "TRUNCATE":
	default:
		return nil, fmt.Errorf("invalid checkpoint mode %q; allowed: PASSIVE, FULL, RESTART, TRUNCATE", mode)
	}

	start := time.Now()
	query := fmt.Sprintf("PRAGMA wal_checkpoint(%s);", normalized)

	var busy, log, checkpointed int
	err := m.db.QueryRowContext(ctx, query).Scan(&busy, &log, &checkpointed)
	if err != nil {
		return nil, fmt.Errorf("checkpoint failed: %w", err)
	}

	return &CheckpointResult{
		Mode:         normalized,
		Busy:         busy,
		Log:          log,
		Checkpointed: checkpointed,
		DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}
