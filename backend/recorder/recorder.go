package recorder

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type RecordingStatus string

const (
	StatusRecording RecordingStatus = "recording"
	StatusPaused    RecordingStatus = "paused"
	StatusCompleted RecordingStatus = "completed"
	StatusFailed    RecordingStatus = "failed"
)

type Recording struct {
	ID           string
	ChannelURL   string
	OutputPath   string
	Status       RecordingStatus
	StartedAt    time.Time
	PausedAt     *time.Time
	StoppedAt    *time.Time
	BytesWritten int64
	Segments     int
	ctx          context.Context
	cancel       context.CancelFunc
	paused       bool
	pauseMu      sync.RWMutex
	cmd          *exec.Cmd
	cmdMu        sync.Mutex
}

type RecorderService struct {
	recordings map[string]*Recording
	mu         sync.RWMutex
	outputDir  string
}

func NewRecorderService(outputDir string) *RecorderService {
	// Create output directory if not exists
	os.MkdirAll(outputDir, 0755)

	return &RecorderService{
		recordings: make(map[string]*Recording),
		outputDir:  outputDir,
	}
}

func (rs *RecorderService) StartRecording(id, channelURL, title string) (*Recording, error) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	// Check if already recording
	if _, exists := rs.recordings[id]; exists {
		return nil, fmt.Errorf("recording with ID %s already exists", id)
	}

	// Create output file path
	timestamp := time.Now().Format("20060102_150405")
	safeTitle := strings.ReplaceAll(title, "/", "_")
	safeTitle = strings.ReplaceAll(safeTitle, " ", "_")
	filename := fmt.Sprintf("%s_%s.ts", safeTitle, timestamp)
	outputPath := filepath.Join(rs.outputDir, filename)

	ctx, cancel := context.WithCancel(context.Background())

	recording := &Recording{
		ID:         id,
		ChannelURL: channelURL,
		OutputPath: outputPath,
		Status:     StatusRecording,
		StartedAt:  time.Now(),
		ctx:        ctx,
		cancel:     cancel,
	}

	rs.recordings[id] = recording

	// Start recording in background using ffmpeg
	go rs.recordWithFFmpeg(recording)

	return recording, nil
}

func (rs *RecorderService) PauseRecording(id string) error {
	rs.mu.RLock()
	recording, exists := rs.recordings[id]
	rs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("recording not found")
	}

	recording.pauseMu.Lock()
	defer recording.pauseMu.Unlock()

	if recording.paused {
		return fmt.Errorf("recording already paused")
	}

	// Kill current ffmpeg process
	recording.cmdMu.Lock()
	if recording.cmd != nil && recording.cmd.Process != nil {
		recording.cmd.Process.Kill()
	}
	recording.cmdMu.Unlock()

	recording.paused = true
	now := time.Now()
	recording.PausedAt = &now
	recording.Status = StatusPaused

	return nil
}

func (rs *RecorderService) ResumeRecording(id string) error {
	rs.mu.RLock()
	recording, exists := rs.recordings[id]
	rs.mu.RUnlock()

	if !exists {
		return fmt.Errorf("recording not found")
	}

	recording.pauseMu.Lock()
	if !recording.paused {
		recording.pauseMu.Unlock()
		return fmt.Errorf("recording not paused")
	}
	recording.paused = false
	recording.PausedAt = nil
	recording.Status = StatusRecording
	recording.pauseMu.Unlock()

	// Restart ffmpeg process (append mode)
	go rs.recordWithFFmpeg(recording)

	return nil
}

func (rs *RecorderService) StopRecording(id string) (*Recording, error) {
	rs.mu.Lock()
	recording, exists := rs.recordings[id]
	if !exists {
		rs.mu.Unlock()
		return nil, fmt.Errorf("recording not found")
	}
	delete(rs.recordings, id)
	rs.mu.Unlock()

	// Cancel the context to stop recording
	recording.cancel()

	// Kill ffmpeg process
	recording.cmdMu.Lock()
	if recording.cmd != nil && recording.cmd.Process != nil {
		recording.cmd.Process.Kill()
		recording.cmd.Wait()
	}
	recording.cmdMu.Unlock()

	// Update file size
	if info, err := os.Stat(recording.OutputPath); err == nil {
		recording.BytesWritten = info.Size()
	}

	now := time.Now()
	recording.StoppedAt = &now
	recording.Status = StatusCompleted

	return recording, nil
}

func (rs *RecorderService) GetRecording(id string) (*Recording, bool) {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	rec, exists := rs.recordings[id]
	return rec, exists
}

func (rs *RecorderService) GetAllRecordings() []*Recording {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	recs := make([]*Recording, 0, len(rs.recordings))
	for _, rec := range rs.recordings {
		recs = append(recs, rec)
	}
	return recs
}

func (rs *RecorderService) recordWithFFmpeg(recording *Recording) {
	log.Printf("Starting ffmpeg recording for %s: %s -> %s", recording.ID, recording.ChannelURL, recording.OutputPath)

	for {
		select {
		case <-recording.ctx.Done():
			log.Printf("Recording %s stopped (context cancelled)", recording.ID)
			return
		default:
		}

		// Check if paused
		recording.pauseMu.RLock()
		isPaused := recording.paused
		recording.pauseMu.RUnlock()

		if isPaused {
			time.Sleep(500 * time.Millisecond)
			continue
		}

		// Build ffmpeg command
		// -y: overwrite output file
		// -i: input URL
		// -map 0:v:0 -map 0:a:0: select first video and first audio stream
		// -c:v copy: copy video without re-encoding
		// -c:a aac: re-encode audio to standard AAC (fixes SSR/HE-AAC issues)
		// -f mpegts: output format
		args := []string{
			"-y",
			"-i", recording.ChannelURL,
			"-map", "0:v:0",
			"-map", "0:a:0",
			"-c:v", "copy",
			"-c:a", "aac",
			"-b:a", "128k",
			"-f", "mpegts",
		}

		// If file exists, append to it
		if _, err := os.Stat(recording.OutputPath); err == nil {
			// File exists, we need to append
			// Create a temp file and then concat
			tempPath := recording.OutputPath + ".temp"
			args = append(args, tempPath)

			cmd := exec.CommandContext(recording.ctx, "ffmpeg", args...)
			cmd.Stderr = os.Stderr // Log ffmpeg errors
			recording.cmdMu.Lock()
			recording.cmd = cmd
			recording.cmdMu.Unlock()

			log.Printf("Recording %s: starting ffmpeg (append mode) with args: %v", recording.ID, args)
			err := cmd.Run()

			if err != nil {
				select {
				case <-recording.ctx.Done():
					// Context was cancelled, normal exit
					os.Remove(tempPath)
					return
				default:
					log.Printf("Recording %s: ffmpeg error: %v", recording.ID, err)
				}
			}

			// Concat temp file to main file
			if _, err := os.Stat(tempPath); err == nil {
				rs.appendFile(recording.OutputPath, tempPath)
				os.Remove(tempPath)
			}
		} else {
			// New file
			args = append(args, recording.OutputPath)

			cmd := exec.CommandContext(recording.ctx, "ffmpeg", args...)
			cmd.Stderr = os.Stderr // Log ffmpeg errors
			recording.cmdMu.Lock()
			recording.cmd = cmd
			recording.cmdMu.Unlock()

			log.Printf("Recording %s: starting ffmpeg with args: %v", recording.ID, args)
			err := cmd.Run()

			if err != nil {
				select {
				case <-recording.ctx.Done():
					// Context was cancelled, normal exit
					return
				default:
					log.Printf("Recording %s: ffmpeg error: %v", recording.ID, err)
					time.Sleep(2 * time.Second)
					continue
				}
			}
		}

		// Update file size
		if info, err := os.Stat(recording.OutputPath); err == nil {
			recording.BytesWritten = info.Size()
		}

		// If we get here without error, ffmpeg exited normally (stream ended?)
		// Wait a bit and retry
		time.Sleep(2 * time.Second)
	}
}

func (rs *RecorderService) appendFile(dst, src string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.OpenFile(dst, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	buf := make([]byte, 1024*1024) // 1MB buffer
	for {
		n, err := srcFile.Read(buf)
		if n > 0 {
			dstFile.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}

	return nil
}

// RecordingInfo returns a safe struct for JSON serialization
type RecordingInfo struct {
	ID           string          `json:"id"`
	ChannelURL   string          `json:"channel_url"`
	OutputPath   string          `json:"output_path"`
	Status       RecordingStatus `json:"status"`
	StartedAt    time.Time       `json:"started_at"`
	PausedAt     *time.Time      `json:"paused_at,omitempty"`
	StoppedAt    *time.Time      `json:"stopped_at,omitempty"`
	BytesWritten int64           `json:"bytes_written"`
	Segments     int             `json:"segments"`
	Duration     int64           `json:"duration_seconds"`
}

func (r *Recording) Info() RecordingInfo {
	duration := time.Since(r.StartedAt).Seconds()
	if r.StoppedAt != nil {
		duration = r.StoppedAt.Sub(r.StartedAt).Seconds()
	}

	// Update file size
	if info, err := os.Stat(r.OutputPath); err == nil {
		r.BytesWritten = info.Size()
	}

	return RecordingInfo{
		ID:           r.ID,
		ChannelURL:   r.ChannelURL,
		OutputPath:   r.OutputPath,
		Status:       r.Status,
		StartedAt:    r.StartedAt,
		PausedAt:     r.PausedAt,
		StoppedAt:    r.StoppedAt,
		BytesWritten: r.BytesWritten,
		Segments:     r.Segments,
		Duration:     int64(duration),
	}
}
