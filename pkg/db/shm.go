package db

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

const (
	ShmHeaderSize = 136
	ShmNumReaders = 5
	ReadMarkUnused = 0xFFFFFFFF
)

// ShmHeader holds the parsed WAL index header and reader marks from the -shm file.
type ShmHeader struct {
	Version             uint32   `json:"version"`
	ChangeCounter       uint32   `json:"changeCounter"`
	IsInitialized       bool     `json:"isInitialized"`
	IsBigEndian         bool     `json:"isBigEndian"`
	PageSize            uint16   `json:"pageSize"`
	MaxFrame            uint32   `json:"maxFrame"`
	DatabasePages       uint32   `json:"databasePages"`
	BackfilledFrames    uint32   `json:"backfilledFrames"`
	ReadMarks           []uint32 `json:"readMarks"`
	ActiveReadersCount  int      `json:"activeReadersCount"`
	MinActiveReadMark   uint32   `json:"minActiveReadMark"`
	BlockingFramesCount uint32   `json:"blockingFramesCount"`
	HasStaleReader      bool     `json:"hasStaleReader"`
}

// ParseShm parses the SQLite -shm shared-memory file header.
func ParseShm(filePath string) (*ShmHeader, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	buf := make([]byte, ShmHeaderSize)
	n, err := io.ReadFull(file, buf)
	if err != nil && n < 96 {
		return nil, fmt.Errorf("failed reading shm header: %w", err)
	}

	return parseShmBytes(buf)
}

func parseShmBytes(buf []byte) (*ShmHeader, error) {
	if len(buf) < 96 {
		return nil, fmt.Errorf("shm buffer too short: %d bytes (minimum 96 required)", len(buf))
	}

	// Determine byte order from isBigEndian flag at byte 13
	isBigEndian := buf[13] != 0
	var order binary.ByteOrder
	if isBigEndian {
		order = binary.BigEndian
	} else {
		order = binary.LittleEndian
	}

	hdr := &ShmHeader{
		Version:       order.Uint32(buf[0:4]),
		ChangeCounter: order.Uint32(buf[8:12]),
		IsInitialized: buf[12] != 0,
		IsBigEndian:   isBigEndian,
		PageSize:      order.Uint16(buf[14:16]),
		MaxFrame:      order.Uint32(buf[16:20]),
		DatabasePages: order.Uint32(buf[20:24]),
		ReadMarks:     make([]uint32, 0, ShmNumReaders),
	}

	// WalCkptInfo starts at offset 96
	if len(buf) >= 100 {
		hdr.BackfilledFrames = order.Uint32(buf[96:100])
	}

	minMark := uint32(0xFFFFFFFF)
	activeCount := 0

	// Reader marks are at offsets 100 to 100 + 5*4 = 120
	if len(buf) >= 120 {
		for i := 0; i < ShmNumReaders; i++ {
			offset := 100 + (i * 4)
			mark := order.Uint32(buf[offset : offset+4])
			hdr.ReadMarks = append(hdr.ReadMarks, mark)

			if mark != ReadMarkUnused && mark > 0 {
				activeCount++
				if mark < minMark {
					minMark = mark
				}
			}
		}
	}

	hdr.ActiveReadersCount = activeCount
	if activeCount > 0 && minMark != ReadMarkUnused {
		hdr.MinActiveReadMark = minMark
		if hdr.MaxFrame > minMark {
			hdr.BlockingFramesCount = hdr.MaxFrame - minMark
		}
		// If a reader is more than 500 frames behind MaxFrame, flag as stale
		if hdr.BlockingFramesCount > 500 {
			hdr.HasStaleReader = true
		}
	}

	return hdr, nil
}
