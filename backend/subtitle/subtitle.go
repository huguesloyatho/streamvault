package subtitle

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// SubtitleEntry represents a single subtitle line
type SubtitleEntry struct {
	ID             int     `json:"id"`
	StartTime      float64 `json:"start_time"`
	EndTime        float64 `json:"end_time"`
	Text           string  `json:"text"`
	Language       string  `json:"language,omitempty"`
	ProcessingTime float64 `json:"processing_time,omitempty"` // Time taken to process this subtitle (ms)
}

// SubtitleSession represents an active subtitle generation session
type SubtitleSession struct {
	ID           string           `json:"id"`
	ChannelID    string           `json:"channel_id"`
	StreamURL    string           `json:"stream_url"`
	Status       string           `json:"status"` // starting, running, paused, stopped, error
	Language     string           `json:"language"`
	TargetLang   string           `json:"target_lang,omitempty"`
	Subtitles    []SubtitleEntry  `json:"subtitles"`
	CreatedAt    time.Time        `json:"created_at"`
	Error        string           `json:"error,omitempty"`

	// Processing time tracking
	ProcessingTimes    []float64 `json:"processing_times,omitempty"`     // Recent processing times in ms
	AvgProcessingTime  float64   `json:"avg_processing_time,omitempty"`  // Average processing time in ms

	// Internal
	ctx          context.Context
	cancel       context.CancelFunc
	ffmpegCmd    *exec.Cmd
	audioBuffer  chan []byte
	mu           sync.RWMutex
	entryCounter int
}

// SessionInfo returns public session information
type SessionInfo struct {
	ID                string    `json:"id"`
	ChannelID         string    `json:"channel_id"`
	Status            string    `json:"status"`
	Language          string    `json:"language"`
	TargetLang        string    `json:"target_lang,omitempty"`
	SubCount          int       `json:"subtitle_count"`
	CreatedAt         time.Time `json:"created_at"`
	Error             string    `json:"error,omitempty"`
	AvgProcessingTime float64   `json:"avg_processing_time,omitempty"` // Average processing time in ms
}

// VoskResult represents Vosk speech recognition result
type VoskResult struct {
	Partial string `json:"partial,omitempty"`
	Text    string `json:"text,omitempty"`
	Result  []struct {
		Conf  float64 `json:"conf"`
		End   float64 `json:"end"`
		Start float64 `json:"start"`
		Word  string  `json:"word"`
	} `json:"result,omitempty"`
}

// OllamaRequest represents a request to Ollama API
type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

// OllamaResponse represents Ollama API response
type OllamaResponse struct {
	Model     string `json:"model"`
	Response  string `json:"response"`
	Done      bool   `json:"done"`
}

// SubtitleServiceConfig holds configuration
type SubtitleServiceConfig struct {
	VoskModelPath   string        // Path to Vosk model directory
	VoskServerURL   string        // URL to Vosk server (alternative to local)
	OllamaURL       string        // Ollama API URL
	OllamaModel     string        // Ollama model for translation
	AudioSampleRate int           // Audio sample rate (16000 recommended for Vosk)
	BufferDuration  time.Duration // Audio buffer duration
	MaxSubtitles    int           // Max subtitles to keep in memory
	CacheDir        string        // Directory for SRT exports
}

// DefaultSubtitleConfig returns default configuration
func DefaultSubtitleConfig() SubtitleServiceConfig {
	return SubtitleServiceConfig{
		VoskModelPath:   "./models/vosk",
		VoskServerURL:   "ws://localhost:2700",
		OllamaURL:       "http://localhost:11434",
		OllamaModel:     "llama3.2",
		AudioSampleRate: 16000,
		BufferDuration:  3 * time.Second, // Shorter for faster updates
		MaxSubtitles:    1000,
		CacheDir:        "./pb_data/subtitles",
	}
}

// SubtitleService manages subtitle generation
type SubtitleService struct {
	config   SubtitleServiceConfig
	sessions map[string]*SubtitleSession
	mu       sync.RWMutex
}

// GetConfig returns current configuration
func (ss *SubtitleService) GetConfig() SubtitleServiceConfig {
	return ss.config
}

// UpdateOllamaConfig updates Ollama configuration
func (ss *SubtitleService) UpdateOllamaConfig(url, model string) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	if url != "" {
		ss.config.OllamaURL = url
	}
	if model != "" {
		ss.config.OllamaModel = model
	}
}

// GetOllamaModels fetches available models from Ollama
func (ss *SubtitleService) GetOllamaModels() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", ss.config.OllamaURL+"/api/tags", nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Ollama returned status %d", resp.StatusCode)
	}

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	models := make([]string, 0, len(result.Models))
	for _, m := range result.Models {
		models = append(models, m.Name)
	}

	return models, nil
}

// NewSubtitleService creates a new subtitle service
func NewSubtitleService(config SubtitleServiceConfig) *SubtitleService {
	os.MkdirAll(config.CacheDir, 0755)

	return &SubtitleService{
		config:   config,
		sessions: make(map[string]*SubtitleSession),
	}
}

// StartSession starts a new subtitle generation session
func (ss *SubtitleService) StartSession(sessionID, channelID, streamURL, language, targetLang string) (*SubtitleSession, error) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	// Check if session already exists
	if _, exists := ss.sessions[sessionID]; exists {
		return nil, fmt.Errorf("session %s already exists", sessionID)
	}

	ctx, cancel := context.WithCancel(context.Background())

	session := &SubtitleSession{
		ID:          sessionID,
		ChannelID:   channelID,
		StreamURL:   streamURL,
		Status:      "starting",
		Language:    language,
		TargetLang:  targetLang,
		Subtitles:   make([]SubtitleEntry, 0),
		CreatedAt:   time.Now(),
		ctx:         ctx,
		cancel:      cancel,
		audioBuffer: make(chan []byte, 100),
	}

	ss.sessions[sessionID] = session

	// Start processing in background
	go ss.processStream(session)

	return session, nil
}

// processStream handles audio extraction and speech recognition
func (ss *SubtitleService) processStream(session *SubtitleSession) {
	log.Printf("Starting subtitle session %s for channel %s (language: %s, target: %s)",
		session.ID, session.ChannelID, session.Language, session.TargetLang)

	// Update status
	session.mu.Lock()
	session.Status = "running"
	session.mu.Unlock()

	// Extract audio using FFmpeg
	err := ss.extractAndProcessAudio(session)
	if err != nil {
		session.mu.Lock()
		session.Status = "error"
		session.Error = err.Error()
		session.mu.Unlock()
		log.Printf("Subtitle session %s error: %v", session.ID, err)
		return
	}

	session.mu.Lock()
	session.Status = "stopped"
	session.mu.Unlock()
}

// extractAndProcessAudio extracts audio from stream and processes it
func (ss *SubtitleService) extractAndProcessAudio(session *SubtitleSession) error {
	// FFmpeg command to extract audio as raw PCM
	// -i: input stream
	// -vn: no video
	// -acodec pcm_s16le: 16-bit PCM audio
	// -ar: sample rate
	// -ac 1: mono
	// -f s16le: raw PCM format
	args := []string{
		"-i", session.StreamURL,
		"-vn",
		"-acodec", "pcm_s16le",
		"-ar", strconv.Itoa(ss.config.AudioSampleRate),
		"-ac", "1",
		"-f", "s16le",
		"-",
	}

	cmd := exec.CommandContext(session.ctx, "ffmpeg", args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	session.ffmpegCmd = cmd

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	// Start Vosk processing goroutine
	go ss.processWithVosk(session, stdout)

	// Wait for ffmpeg to finish or context cancellation
	err = cmd.Wait()
	if session.ctx.Err() != nil {
		return nil // Cancelled, not an error
	}
	if err != nil {
		return fmt.Errorf("ffmpeg error: %w", err)
	}

	return nil
}

// processWithVosk sends audio to Vosk for speech recognition
func (ss *SubtitleService) processWithVosk(session *SubtitleSession, audioReader io.Reader) {
	// Buffer to accumulate audio chunks
	bufferSize := ss.config.AudioSampleRate * 2 * int(ss.config.BufferDuration.Seconds()) // 16-bit samples
	buffer := make([]byte, bufferSize)

	startTime := time.Now()

	for {
		select {
		case <-session.ctx.Done():
			return
		default:
		}

		// Read exactly bufferSize bytes to ensure complete audio chunks
		// This prevents sending incomplete audio to Whisper
		n, err := io.ReadFull(audioReader, buffer)
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				// If we got some data, process it
				if n > 0 {
					// Process the partial buffer
					goto processAudio
				}
				return
			}
			log.Printf("Audio read error: %v", err)
			return
		}

	processAudio:
		if n == 0 {
			continue
		}

		// Calculate timing
		elapsedSeconds := time.Since(startTime).Seconds()

		// Measure processing time
		processingStart := time.Now()

		// Process audio chunk with Whisper
		text, err := ss.recognizeWithWhisper(buffer[:n], session.Language)
		if err != nil {
			log.Printf("Whisper recognition error: %v", err)
			continue
		}

		if text == "" {
			continue
		}

		// Translate if target language is different
		finalText := text
		if session.TargetLang != "" && session.TargetLang != session.Language {
			log.Printf("Translating from %s to %s: %s", session.Language, session.TargetLang, text)
			translated, err := ss.translateWithOllama(text, session.Language, session.TargetLang)
			if err != nil {
				log.Printf("Translation error: %v", err)
				// Keep original text if translation fails
			} else {
				log.Printf("Translation result: %s", translated)
				finalText = translated
			}
		}

		// Calculate processing time in milliseconds
		processingTimeMs := float64(time.Since(processingStart).Milliseconds())

		// Add subtitle entry
		session.mu.Lock()
		session.entryCounter++
		entry := SubtitleEntry{
			ID:             session.entryCounter,
			StartTime:      elapsedSeconds - ss.config.BufferDuration.Seconds(),
			EndTime:        elapsedSeconds,
			Text:           finalText,
			Language:       session.TargetLang,
			ProcessingTime: processingTimeMs,
		}
		if entry.Language == "" {
			entry.Language = session.Language
		}

		session.Subtitles = append(session.Subtitles, entry)

		// Track processing times (keep last 20 samples for averaging)
		session.ProcessingTimes = append(session.ProcessingTimes, processingTimeMs)
		if len(session.ProcessingTimes) > 20 {
			session.ProcessingTimes = session.ProcessingTimes[len(session.ProcessingTimes)-20:]
		}

		// Calculate average processing time
		var sum float64
		for _, pt := range session.ProcessingTimes {
			sum += pt
		}
		session.AvgProcessingTime = sum / float64(len(session.ProcessingTimes))

		// Trim old subtitles if needed
		if len(session.Subtitles) > ss.config.MaxSubtitles {
			session.Subtitles = session.Subtitles[len(session.Subtitles)-ss.config.MaxSubtitles:]
		}
		session.mu.Unlock()

		log.Printf("Subtitle [%s]: %s", session.ID, finalText)
	}
}

// recognizeWithWhisper uses faster-whisper for speech recognition
func (ss *SubtitleService) recognizeWithWhisper(audioData []byte, language string) (string, error) {
	// Create temp WAV file for audio (Whisper needs WAV format)
	tmpRaw, err := os.CreateTemp("", "audio-*.raw")
	if err != nil {
		return "", err
	}
	tmpRawName := tmpRaw.Name()
	defer os.Remove(tmpRawName)

	if _, err := tmpRaw.Write(audioData); err != nil {
		tmpRaw.Close()
		return "", err
	}
	tmpRaw.Close()

	// Convert raw PCM to WAV using ffmpeg
	tmpWav := tmpRawName + ".wav"
	defer os.Remove(tmpWav)

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Convert raw PCM (s16le, 16000Hz, mono) to WAV
	convertCmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "s16le",
		"-ar", strconv.Itoa(ss.config.AudioSampleRate),
		"-ac", "1",
		"-i", tmpRawName,
		"-y",
		"-loglevel", "error",
		tmpWav,
	)
	if err := convertCmd.Run(); err != nil {
		return "", fmt.Errorf("failed to convert audio to WAV: %w", err)
	}

	// Use our Python script for transcription (uses faster-whisper)
	scriptPath := filepath.Join(filepath.Dir(os.Args[0]), "scripts", "transcribe.py")

	// Check if script exists, fallback to whisper CLI if not
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		// Fallback to whisper CLI
		return ss.recognizeWithWhisperCLI(ctx, tmpWav, language)
	}

	whisperCmd := exec.CommandContext(ctx, "python3", scriptPath, tmpWav, language)

	output, err := whisperCmd.CombinedOutput()
	if err != nil {
		log.Printf("Transcription script error: %v, output: %s", err, string(output))
		// Fallback to whisper CLI
		return ss.recognizeWithWhisperCLI(ctx, tmpWav, language)
	}

	var result struct {
		Success bool   `json:"success"`
		Text    string `json:"text"`
		Error   string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		log.Printf("Failed to parse transcription output: %v, raw: %s", err, string(output))
		return "", fmt.Errorf("failed to parse transcription output: %w", err)
	}

	if !result.Success {
		return "", fmt.Errorf("transcription failed: %s", result.Error)
	}

	return strings.TrimSpace(result.Text), nil
}

// recognizeWithWhisperCLI uses whisper CLI as fallback
func (ss *SubtitleService) recognizeWithWhisperCLI(ctx context.Context, wavFile, language string) (string, error) {
	// Run whisper with JSON output
	tmpDir := filepath.Dir(wavFile)

	whisperCmd := exec.CommandContext(ctx, "whisper",
		wavFile,
		"--language", language,
		"--output_format", "json",
		"--output_dir", tmpDir,
		"--model", "base",
	)

	output, err := whisperCmd.CombinedOutput()
	if err != nil {
		log.Printf("Whisper CLI error: %v, output: %s", err, string(output))
		return "", fmt.Errorf("whisper failed: %w", err)
	}

	// Read the JSON output - whisper names output based on input filename
	baseName := filepath.Base(wavFile)
	jsonFile := filepath.Join(tmpDir, strings.TrimSuffix(baseName, filepath.Ext(baseName))+".json")
	defer os.Remove(jsonFile)

	jsonData, err := os.ReadFile(jsonFile)
	if err != nil {
		return "", fmt.Errorf("failed to read whisper output: %w", err)
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(jsonData, &result); err != nil {
		return "", fmt.Errorf("failed to parse whisper output: %w", err)
	}

	return strings.TrimSpace(result.Text), nil
}

// callVoskServer calls a Vosk WebSocket server
func (ss *SubtitleService) callVoskServer(ctx context.Context, audioData []byte, language string) (string, error) {
	// Simple HTTP fallback if WebSocket not available
	// This assumes a Vosk HTTP API endpoint
	url := strings.Replace(ss.config.VoskServerURL, "ws://", "http://", 1)
	url = strings.Replace(url, "wss://", "https://", 1)
	url = url + "/recognize"

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(audioData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "audio/raw")
	req.Header.Set("X-Language", language)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("vosk server returned %d", resp.StatusCode)
	}

	var result VoskResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.Text, nil
}

// translateWithOllama translates text using Ollama
func (ss *SubtitleService) translateWithOllama(text, fromLang, toLang string) (string, error) {
	// Use a strict system prompt to avoid commentary
	prompt := fmt.Sprintf(
		`You are a subtitle translator. Translate the following from %s to %s.

RULES:
- Output ONLY the translation, nothing else
- No explanations, notes, or commentary
- No quotation marks around the translation
- Keep the same tone and style
- If text is unclear, translate it as best as you can

Text: %s

Translation:`,
		getLanguageName(fromLang),
		getLanguageName(toLang),
		text,
	)

	reqBody := OllamaRequest{
		Model:  ss.config.OllamaModel,
		Prompt: prompt,
		Stream: false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", ss.config.OllamaURL+"/api/generate", bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama returned %d: %s", resp.StatusCode, string(body))
	}

	var result OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	translation := strings.TrimSpace(result.Response)

	// Clean up common LLM artifacts
	// Remove parenthetical notes like "(Note: ...)" or "(correction: ...)"
	notePattern := regexp.MustCompile(`\s*\([Nn]ote\s*:.*?\)`)
	translation = notePattern.ReplaceAllString(translation, "")
	correctionPattern := regexp.MustCompile(`\s*\([Cc]orrection\s*:.*?\)`)
	translation = correctionPattern.ReplaceAllString(translation, "")

	// Remove leading/trailing quotes if present
	translation = strings.Trim(translation, `"'`)

	// Remove any trailing explanations after newlines
	if idx := strings.Index(translation, "\n"); idx > 0 {
		translation = translation[:idx]
	}

	return strings.TrimSpace(translation), nil
}

// StopSession stops a subtitle session
func (ss *SubtitleService) StopSession(sessionID string) error {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	session, exists := ss.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	session.cancel()

	if session.ffmpegCmd != nil && session.ffmpegCmd.Process != nil {
		session.ffmpegCmd.Process.Kill()
	}

	session.mu.Lock()
	session.Status = "stopped"
	session.mu.Unlock()

	return nil
}

// GetSession returns session information
func (ss *SubtitleService) GetSession(sessionID string) (*SessionInfo, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()

	session, exists := ss.sessions[sessionID]
	if !exists {
		return nil, false
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	return &SessionInfo{
		ID:                session.ID,
		ChannelID:         session.ChannelID,
		Status:            session.Status,
		Language:          session.Language,
		TargetLang:        session.TargetLang,
		SubCount:          len(session.Subtitles),
		CreatedAt:         session.CreatedAt,
		Error:             session.Error,
		AvgProcessingTime: session.AvgProcessingTime,
	}, true
}

// GetSubtitles returns subtitles from a session
func (ss *SubtitleService) GetSubtitles(sessionID string, since int) ([]SubtitleEntry, error) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()

	session, exists := ss.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	// Return subtitles after the given ID
	result := make([]SubtitleEntry, 0)
	for _, sub := range session.Subtitles {
		if sub.ID > since {
			result = append(result, sub)
		}
	}

	return result, nil
}

// GetLatestSubtitle returns the most recent subtitle
func (ss *SubtitleService) GetLatestSubtitle(sessionID string) (*SubtitleEntry, error) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()

	session, exists := ss.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session %s not found", sessionID)
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	if len(session.Subtitles) == 0 {
		return nil, nil
	}

	latest := session.Subtitles[len(session.Subtitles)-1]
	return &latest, nil
}

// ExportSRT exports subtitles to SRT format
func (ss *SubtitleService) ExportSRT(sessionID string) (string, error) {
	ss.mu.RLock()
	session, exists := ss.sessions[sessionID]
	ss.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("session %s not found", sessionID)
	}

	session.mu.RLock()
	subtitles := make([]SubtitleEntry, len(session.Subtitles))
	copy(subtitles, session.Subtitles)
	session.mu.RUnlock()

	var buf strings.Builder

	for i, sub := range subtitles {
		// SRT format:
		// 1
		// 00:00:01,000 --> 00:00:04,000
		// Subtitle text
		//
		buf.WriteString(strconv.Itoa(i + 1))
		buf.WriteString("\n")
		buf.WriteString(formatSRTTime(sub.StartTime))
		buf.WriteString(" --> ")
		buf.WriteString(formatSRTTime(sub.EndTime))
		buf.WriteString("\n")
		buf.WriteString(sub.Text)
		buf.WriteString("\n\n")
	}

	// Save to file
	filename := fmt.Sprintf("%s_%s.srt", sessionID, time.Now().Format("20060102_150405"))
	filepath := filepath.Join(ss.config.CacheDir, filename)

	if err := os.WriteFile(filepath, []byte(buf.String()), 0644); err != nil {
		return "", fmt.Errorf("failed to save SRT: %w", err)
	}

	return filepath, nil
}

// DeleteSession removes a session
func (ss *SubtitleService) DeleteSession(sessionID string) error {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	session, exists := ss.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session %s not found", sessionID)
	}

	session.cancel()
	delete(ss.sessions, sessionID)

	return nil
}

// GetAllSessions returns all active sessions
func (ss *SubtitleService) GetAllSessions() []SessionInfo {
	ss.mu.RLock()
	defer ss.mu.RUnlock()

	sessions := make([]SessionInfo, 0, len(ss.sessions))
	for _, session := range ss.sessions {
		session.mu.RLock()
		sessions = append(sessions, SessionInfo{
			ID:                session.ID,
			ChannelID:         session.ChannelID,
			Status:            session.Status,
			Language:          session.Language,
			TargetLang:        session.TargetLang,
			SubCount:          len(session.Subtitles),
			CreatedAt:         session.CreatedAt,
			Error:             session.Error,
			AvgProcessingTime: session.AvgProcessingTime,
		})
		session.mu.RUnlock()
	}

	return sessions
}

// GetAvailableLanguages returns supported languages for STT
func (ss *SubtitleService) GetAvailableLanguages() []map[string]string {
	// Common Vosk models available
	return []map[string]string{
		{"code": "en", "name": "English"},
		{"code": "fr", "name": "French"},
		{"code": "de", "name": "German"},
		{"code": "es", "name": "Spanish"},
		{"code": "it", "name": "Italian"},
		{"code": "pt", "name": "Portuguese"},
		{"code": "ru", "name": "Russian"},
		{"code": "zh", "name": "Chinese"},
		{"code": "ja", "name": "Japanese"},
		{"code": "ko", "name": "Korean"},
		{"code": "ar", "name": "Arabic"},
		{"code": "hi", "name": "Hindi"},
		{"code": "nl", "name": "Dutch"},
		{"code": "pl", "name": "Polish"},
		{"code": "tr", "name": "Turkish"},
	}
}

// CheckOllamaStatus checks if Ollama is available
func (ss *SubtitleService) CheckOllamaStatus() (bool, string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", ss.config.OllamaURL+"/api/tags", nil)
	if err != nil {
		return false, err.Error()
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, "Ollama not available: " + err.Error()
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, "Ollama is running"
	}

	return false, fmt.Sprintf("Ollama returned status %d", resp.StatusCode)
}

// Helper functions

func formatSRTTime(seconds float64) string {
	hours := int(seconds) / 3600
	minutes := (int(seconds) % 3600) / 60
	secs := int(seconds) % 60
	millis := int((seconds - float64(int(seconds))) * 1000)

	return fmt.Sprintf("%02d:%02d:%02d,%03d", hours, minutes, secs, millis)
}

func getLanguageName(code string) string {
	names := map[string]string{
		"en": "English",
		"fr": "French",
		"de": "German",
		"es": "Spanish",
		"it": "Italian",
		"pt": "Portuguese",
		"ru": "Russian",
		"zh": "Chinese",
		"ja": "Japanese",
		"ko": "Korean",
		"ar": "Arabic",
		"hi": "Hindi",
		"nl": "Dutch",
		"pl": "Polish",
		"tr": "Turkish",
	}

	if name, ok := names[code]; ok {
		return name
	}
	return code
}

// DetectLanguage attempts to detect the language of text
func DetectLanguage(text string) string {
	// Simple heuristic detection based on character sets
	// In production, use a proper language detection library

	hasKorean := regexp.MustCompile(`[\uAC00-\uD7AF]`).MatchString(text)
	hasJapanese := regexp.MustCompile(`[\u3040-\u309F\u30A0-\u30FF]`).MatchString(text)
	hasChinese := regexp.MustCompile(`[\u4E00-\u9FFF]`).MatchString(text)
	hasArabic := regexp.MustCompile(`[\u0600-\u06FF]`).MatchString(text)
	hasCyrillic := regexp.MustCompile(`[\u0400-\u04FF]`).MatchString(text)

	if hasKorean {
		return "ko"
	}
	if hasJapanese {
		return "ja"
	}
	if hasChinese {
		return "zh"
	}
	if hasArabic {
		return "ar"
	}
	if hasCyrillic {
		return "ru"
	}

	// Default to English for Latin scripts
	return "en"
}

// CleanSubtitleText cleans up subtitle text
func CleanSubtitleText(text string) string {
	// Remove multiple spaces
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	// Trim
	text = strings.TrimSpace(text)
	return text
}
