package db

import (
	"encoding/binary"
	"testing"
)

func TestParseShmBytes(t *testing.T) {
	buf := make([]byte, ShmHeaderSize)

	// Little-endian
	buf[13] = 0 // isBigEndian = false
	binary.LittleEndian.PutUint32(buf[0:4], 3007000) // version
	binary.LittleEndian.PutUint32(buf[8:12], 42)     // changeCounter
	buf[12] = 1                                      // isInit
	binary.LittleEndian.PutUint16(buf[14:16], 4096)  // pageSize
	binary.LittleEndian.PutUint32(buf[16:20], 120)   // maxFrame
	binary.LittleEndian.PutUint32(buf[20:24], 50)    // databasePages

	// WalCkptInfo
	binary.LittleEndian.PutUint32(buf[96:100], 100) // backfilledFrames

	// Read marks
	binary.LittleEndian.PutUint32(buf[100:104], 0xFFFFFFFF) // mark 0 unused
	binary.LittleEndian.PutUint32(buf[104:108], 80)         // mark 1 active reader at frame 80
	binary.LittleEndian.PutUint32(buf[108:112], 115)        // mark 2 active reader at frame 115
	binary.LittleEndian.PutUint32(buf[112:116], 0xFFFFFFFF) // mark 3 unused
	binary.LittleEndian.PutUint32(buf[116:120], 0xFFFFFFFF) // mark 4 unused

	hdr, err := parseShmBytes(buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if hdr.Version != 3007000 {
		t.Errorf("expected version 3007000, got %d", hdr.Version)
	}
	if hdr.MaxFrame != 120 {
		t.Errorf("expected maxFrame 120, got %d", hdr.MaxFrame)
	}
	if hdr.BackfilledFrames != 100 {
		t.Errorf("expected backfilled 100, got %d", hdr.BackfilledFrames)
	}
	if hdr.ActiveReadersCount != 2 {
		t.Errorf("expected 2 active readers, got %d", hdr.ActiveReadersCount)
	}
	if hdr.MinActiveReadMark != 80 {
		t.Errorf("expected minActiveReadMark 80, got %d", hdr.MinActiveReadMark)
	}
	if hdr.BlockingFramesCount != 40 { // 120 - 80 = 40
		t.Errorf("expected blockingFramesCount 40, got %d", hdr.BlockingFramesCount)
	}
	if hdr.HasStaleReader {
		t.Errorf("expected HasStaleReader false for 40 frames lag")
	}
}
