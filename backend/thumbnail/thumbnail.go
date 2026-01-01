package thumbnail

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// ThumbnailInfo contains metadata about a cached thumbnail
type ThumbnailInfo struct {
	ChannelID   string    `json:"channel_id"`
	StreamURL   string    `json:"stream_url"`
	FilePath    string    `json:"file_path"`
	GeneratedAt time.Time `json:"generated_at"`
	Size        int64     `json:"size"`
	Width       int       `json:"width"`
	Height      int       `json:"height"`
}

// ThumbnailService manages thumbnail generation and caching
type ThumbnailService struct {
	cacheDir     string
	cacheTTL     time.Duration
	cache        map[string]*ThumbnailInfo
	generating   map[string]bool
	mu           sync.RWMutex
	genMu        sync.Mutex
	maxWidth     int
	maxHeight    int
	quality      int
	timeout      time.Duration
}

// ServiceConfig holds configuration for the thumbnail service
type ServiceConfig struct {
	CacheDir  string
	CacheTTL  time.Duration
	MaxWidth  int
	MaxHeight int
	Quality   int
	Timeout   time.Duration
}

// DefaultConfig returns the default service configuration
func DefaultConfig() ServiceConfig {
	return ServiceConfig{
		CacheDir:  "./pb_data/thumbnails",
		CacheTTL:  5 * time.Minute, // Thumbnails are valid for 5 minutes
		MaxWidth:  320,
		MaxHeight: 180,
		Quality:   85,
		Timeout:   15 * time.Second,
	}
}

// NewThumbnailService creates a new thumbnail service
func NewThumbnailService(config ServiceConfig) *ThumbnailService {
	// Create cache directory if not exists
	os.MkdirAll(config.CacheDir, 0755)

	service := &ThumbnailService{
		cacheDir:   config.CacheDir,
		cacheTTL:   config.CacheTTL,
		cache:      make(map[string]*ThumbnailInfo),
		generating: make(map[string]bool),
		maxWidth:   config.MaxWidth,
		maxHeight:  config.MaxHeight,
		quality:    config.Quality,
		timeout:    config.Timeout,
	}

	// Start cache cleanup goroutine
	go service.cleanupLoop()

	return service
}

// generateCacheKey creates a unique cache key for a channel
func (ts *ThumbnailService) generateCacheKey(channelID string) string {
	hash := md5.Sum([]byte(channelID))
	return hex.EncodeToString(hash[:])
}

// GetThumbnail retrieves a thumbnail, generating it if necessary
func (ts *ThumbnailService) GetThumbnail(channelID, streamURL string) (*ThumbnailInfo, error) {
	cacheKey := ts.generateCacheKey(channelID)

	// Check if we have a valid cached thumbnail
	ts.mu.RLock()
	if info, exists := ts.cache[cacheKey]; exists {
		if time.Since(info.GeneratedAt) < ts.cacheTTL {
			// Check if file still exists
			if _, err := os.Stat(info.FilePath); err == nil {
				ts.mu.RUnlock()
				return info, nil
			}
		}
	}
	ts.mu.RUnlock()

	// Check if already generating
	ts.genMu.Lock()
	if ts.generating[cacheKey] {
		ts.genMu.Unlock()
		// Wait a bit and return cached if available
		time.Sleep(500 * time.Millisecond)
		ts.mu.RLock()
		if info, exists := ts.cache[cacheKey]; exists {
			ts.mu.RUnlock()
			return info, nil
		}
		ts.mu.RUnlock()
		return nil, fmt.Errorf("thumbnail generation in progress")
	}
	ts.generating[cacheKey] = true
	ts.genMu.Unlock()

	defer func() {
		ts.genMu.Lock()
		delete(ts.generating, cacheKey)
		ts.genMu.Unlock()
	}()

	// Generate new thumbnail
	info, err := ts.generateThumbnail(channelID, streamURL, cacheKey)
	if err != nil {
		return nil, err
	}

	// Update cache
	ts.mu.Lock()
	ts.cache[cacheKey] = info
	ts.mu.Unlock()

	return info, nil
}

// generateThumbnail creates a new thumbnail using ffmpeg
func (ts *ThumbnailService) generateThumbnail(channelID, streamURL, cacheKey string) (*ThumbnailInfo, error) {
	log.Printf("Generating thumbnail for channel %s from %s", channelID, streamURL)

	outputPath := filepath.Join(ts.cacheDir, cacheKey+".jpg")

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), ts.timeout)
	defer cancel()

	// ffmpeg command to capture a single frame
	// -ss 0: start at beginning
	// -i: input URL
	// -vframes 1: capture only 1 frame
	// -vf scale: resize to max dimensions while maintaining aspect ratio
	// -q:v 2-5: quality (2=best, 31=worst)
	// -y: overwrite output
	args := []string{
		"-y",
		"-ss", "0",
		"-i", streamURL,
		"-vframes", "1",
		"-vf", fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease", ts.maxWidth, ts.maxHeight),
		"-q:v", fmt.Sprintf("%d", 31-((ts.quality*29)/100)), // Convert quality to ffmpeg scale
		outputPath,
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stderr = nil // Suppress ffmpeg stderr output

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("thumbnail generation timed out")
		}
		return nil, fmt.Errorf("failed to generate thumbnail: %w", err)
	}

	// Get file info
	fileInfo, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat thumbnail file: %w", err)
	}

	info := &ThumbnailInfo{
		ChannelID:   channelID,
		StreamURL:   streamURL,
		FilePath:    outputPath,
		GeneratedAt: time.Now(),
		Size:        fileInfo.Size(),
		Width:       ts.maxWidth,
		Height:      ts.maxHeight,
	}

	log.Printf("Generated thumbnail for channel %s: %s (%d bytes)", channelID, outputPath, fileInfo.Size())

	return info, nil
}

// GetThumbnailPath returns the path to a thumbnail if it exists and is valid
func (ts *ThumbnailService) GetThumbnailPath(channelID string) (string, bool) {
	cacheKey := ts.generateCacheKey(channelID)

	ts.mu.RLock()
	defer ts.mu.RUnlock()

	if info, exists := ts.cache[cacheKey]; exists {
		if time.Since(info.GeneratedAt) < ts.cacheTTL {
			if _, err := os.Stat(info.FilePath); err == nil {
				return info.FilePath, true
			}
		}
	}

	// Check if file exists on disk even if not in memory cache
	filePath := filepath.Join(ts.cacheDir, cacheKey+".jpg")
	if info, err := os.Stat(filePath); err == nil {
		// File exists, check if it's recent enough
		if time.Since(info.ModTime()) < ts.cacheTTL {
			return filePath, true
		}
	}

	return "", false
}

// InvalidateThumbnail removes a thumbnail from cache
func (ts *ThumbnailService) InvalidateThumbnail(channelID string) {
	cacheKey := ts.generateCacheKey(channelID)

	ts.mu.Lock()
	defer ts.mu.Unlock()

	if info, exists := ts.cache[cacheKey]; exists {
		os.Remove(info.FilePath)
		delete(ts.cache, cacheKey)
	}
}

// cleanupLoop periodically removes expired thumbnails
func (ts *ThumbnailService) cleanupLoop() {
	ticker := time.NewTicker(ts.cacheTTL)
	defer ticker.Stop()

	for range ticker.C {
		ts.cleanup()
	}
}

// cleanup removes expired thumbnails from cache and disk
func (ts *ThumbnailService) cleanup() {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	now := time.Now()
	expiredKeys := make([]string, 0)

	for key, info := range ts.cache {
		if now.Sub(info.GeneratedAt) > ts.cacheTTL*2 {
			// Remove file
			os.Remove(info.FilePath)
			expiredKeys = append(expiredKeys, key)
		}
	}

	for _, key := range expiredKeys {
		delete(ts.cache, key)
	}

	if len(expiredKeys) > 0 {
		log.Printf("Cleaned up %d expired thumbnails", len(expiredKeys))
	}
}

// GetCacheStats returns statistics about the thumbnail cache
func (ts *ThumbnailService) GetCacheStats() map[string]interface{} {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	var totalSize int64
	for _, info := range ts.cache {
		totalSize += info.Size
	}

	return map[string]interface{}{
		"cached_count": len(ts.cache),
		"total_size":   totalSize,
		"cache_dir":    ts.cacheDir,
		"cache_ttl":    ts.cacheTTL.String(),
	}
}

// BatchGenerate generates thumbnails for multiple channels concurrently
func (ts *ThumbnailService) BatchGenerate(channels map[string]string, concurrency int) map[string]*ThumbnailInfo {
	results := make(map[string]*ThumbnailInfo)
	resultsMu := sync.Mutex{}

	// Create a semaphore channel to limit concurrency
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup

	for channelID, streamURL := range channels {
		wg.Add(1)
		go func(cID, sURL string) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire
			defer func() { <-sem }() // Release

			info, err := ts.GetThumbnail(cID, sURL)
			if err == nil {
				resultsMu.Lock()
				results[cID] = info
				resultsMu.Unlock()
			}
		}(channelID, streamURL)
	}

	wg.Wait()
	return results
}
