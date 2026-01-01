package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tokens"
	"github.com/pocketbase/pocketbase/tools/types"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	qrcode "github.com/skip2/go-qrcode"

	_ "iptv-backend/migrations"
	"iptv-backend/recorder"
	"iptv-backend/subtitle"
	"iptv-backend/thumbnail"
)

// Global recorder service
var recorderService *recorder.RecorderService

// Global thumbnail service
var thumbnailService *thumbnail.ThumbnailService

// Global subtitle service
var subtitleService *subtitle.SubtitleService

func main() {
	app := pocketbase.New()

	// Initialize recorder service
	recordingsDir := filepath.Join(app.DataDir(), "recordings")
	recorderService = recorder.NewRecorderService(recordingsDir)

	// Initialize thumbnail service
	thumbnailConfig := thumbnail.DefaultConfig()
	thumbnailConfig.CacheDir = filepath.Join(app.DataDir(), "thumbnails")
	thumbnailService = thumbnail.NewThumbnailService(thumbnailConfig)

	// Initialize subtitle service
	subtitleConfig := subtitle.DefaultSubtitleConfig()
	subtitleConfig.CacheDir = filepath.Join(app.DataDir(), "subtitles")
	subtitleConfig.VoskModelPath = filepath.Join(app.DataDir(), "models", "vosk")
	subtitleService = subtitle.NewSubtitleService(subtitleConfig)

	// Register migrations
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: true,
	})

	// Load Ollama configuration from database on startup
	app.OnAfterBootstrap().Add(func(e *core.BootstrapEvent) error {
		settingsCollection, err := app.Dao().FindCollectionByNameOrId("app_settings")
		if err != nil {
			return nil // Collection doesn't exist yet, will be created later
		}

		record, err := app.Dao().FindFirstRecordByFilter(settingsCollection.Id, "key = 'ollama_config'")
		if err != nil || record == nil {
			return nil // No saved config
		}

		valueStr := record.GetString("value")
		var savedConfig map[string]interface{}
		if json.Unmarshal([]byte(valueStr), &savedConfig) == nil {
			if url, ok := savedConfig["url"].(string); ok && url != "" {
				subtitleService.UpdateOllamaConfig(url, "")
				log.Printf("Loaded Ollama URL from database: %s", url)
			}
			if model, ok := savedConfig["model"].(string); ok && model != "" {
				subtitleService.UpdateOllamaConfig("", model)
				log.Printf("Loaded Ollama model from database: %s", model)
			}
		}

		return nil
	})

	// Setup routes
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		// Health check endpoint
		e.Router.GET("/api/health", func(c echo.Context) error {
			return c.JSON(http.StatusOK, map[string]string{
				"status": "healthy",
				"time":   time.Now().Format(time.RFC3339),
			})
		})

		// TOTP Setup endpoint - generates secret and QR code
		e.Router.POST("/api/auth/totp/setup", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			appName := os.Getenv("NEXT_PUBLIC_APP_NAME")
			if appName == "" {
				appName = "StreamVault"
			}

			// Generate new TOTP key
			key, err := totp.Generate(totp.GenerateOpts{
				Issuer:      appName,
				AccountName: authRecord.Email(),
				Period:      30,
				SecretSize:  32,
				Digits:      otp.DigitsSix,
				Algorithm:   otp.AlgorithmSHA1,
			})
			if err != nil {
				return apis.NewBadRequestError("Failed to generate TOTP key", err)
			}

			// Generate QR code as base64
			qr, err := qrcode.Encode(key.URL(), qrcode.Medium, 256)
			if err != nil {
				return apis.NewBadRequestError("Failed to generate QR code", err)
			}
			qrBase64 := base64.StdEncoding.EncodeToString(qr)

			// Store secret temporarily (not verified yet)
			authRecord.Set("totp_secret_pending", key.Secret())
			if err := app.Dao().SaveRecord(authRecord); err != nil {
				return apis.NewBadRequestError("Failed to save TOTP secret", err)
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"secret":     key.Secret(),
				"qrCode":     "data:image/png;base64," + qrBase64,
				"otpAuthUrl": key.URL(),
			})
		}, apis.RequireRecordAuth())

		// TOTP Verify endpoint - verifies code and enables 2FA
		e.Router.POST("/api/auth/totp/verify", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				Code string `json:"code"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			// Get pending or active secret
			secret := authRecord.GetString("totp_secret_pending")
			if secret == "" {
				secret = authRecord.GetString("totp_secret")
			}
			if secret == "" {
				return apis.NewBadRequestError("No TOTP secret configured", nil)
			}

			// Validate the code
			valid := totp.Validate(data.Code, secret)
			if !valid {
				return apis.NewBadRequestError("Invalid TOTP code", nil)
			}

			// If this was a pending secret, activate it
			if authRecord.GetString("totp_secret_pending") != "" {
				authRecord.Set("totp_secret", secret)
				authRecord.Set("totp_secret_pending", "")
				authRecord.Set("totp_enabled", true)
				authRecord.Set("totp_verified_at", time.Now().Format(time.RFC3339))
				if err := app.Dao().SaveRecord(authRecord); err != nil {
					return apis.NewBadRequestError("Failed to enable TOTP", err)
				}
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"verified": true,
				"message":  "Two-factor authentication enabled successfully",
			})
		}, apis.RequireRecordAuth())

		// TOTP Validate endpoint - validates code during login
		e.Router.POST("/api/auth/totp/validate", func(c echo.Context) error {
			data := struct {
				UserId string `json:"userId"`
				Code   string `json:"code"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			// Find user
			record, err := app.Dao().FindRecordById("users", data.UserId)
			if err != nil {
				return apis.NewNotFoundError("User not found", err)
			}

			secret := record.GetString("totp_secret")
			if secret == "" {
				return apis.NewBadRequestError("TOTP not configured for this user", nil)
			}

			// Validate the code
			valid := totp.Validate(data.Code, secret)
			if !valid {
				return apis.NewBadRequestError("Invalid TOTP code", nil)
			}

			// Generate auth token
			token, err := tokens.NewRecordAuthToken(app, record)
			if err != nil {
				return apis.NewBadRequestError("Failed to generate token", err)
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"token":  token,
				"record": record,
			})
		})

		// TOTP Disable endpoint
		e.Router.POST("/api/auth/totp/disable", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				Code     string `json:"code"`
				Password string `json:"password"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			// Verify password
			if !authRecord.ValidatePassword(data.Password) {
				return apis.NewBadRequestError("Invalid password", nil)
			}

			// Verify TOTP code
			secret := authRecord.GetString("totp_secret")
			if secret != "" && !totp.Validate(data.Code, secret) {
				return apis.NewBadRequestError("Invalid TOTP code", nil)
			}

			// Disable TOTP
			authRecord.Set("totp_secret", "")
			authRecord.Set("totp_enabled", false)
			authRecord.Set("totp_verified_at", "")
			if err := app.Dao().SaveRecord(authRecord); err != nil {
				return apis.NewBadRequestError("Failed to disable TOTP", err)
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"message": "Two-factor authentication disabled",
			})
		}, apis.RequireRecordAuth())

		// Check TOTP status endpoint
		e.Router.GET("/api/auth/totp/status", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"enabled":    authRecord.GetBool("totp_enabled"),
				"verifiedAt": authRecord.GetString("totp_verified_at"),
			})
		}, apis.RequireRecordAuth())

		// Serve static files for recordings
		e.Router.GET("/recordings/*", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			path := strings.TrimPrefix(c.Request().URL.Path, "/recordings/")
			filePath := "./pb_data/recordings/" + path
			return c.File(filePath)
		}, apis.RequireRecordAuth())

		// Recording API endpoints

		// Start recording
		e.Router.POST("/api/recorder/start", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				RecordingID string `json:"recording_id"`
				ChannelURL  string `json:"channel_url"`
				Title       string `json:"title"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			if data.RecordingID == "" || data.ChannelURL == "" || data.Title == "" {
				return apis.NewBadRequestError("Missing required fields", nil)
			}

			rec, err := recorderService.StartRecording(data.RecordingID, data.ChannelURL, data.Title)
			if err != nil {
				return apis.NewBadRequestError("Failed to start recording", err)
			}

			return c.JSON(http.StatusOK, rec.Info())
		}, apis.RequireRecordAuth())

		// Pause recording
		e.Router.POST("/api/recorder/pause", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				RecordingID string `json:"recording_id"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			if err := recorderService.PauseRecording(data.RecordingID); err != nil {
				return apis.NewBadRequestError("Failed to pause recording", err)
			}

			rec, _ := recorderService.GetRecording(data.RecordingID)
			return c.JSON(http.StatusOK, rec.Info())
		}, apis.RequireRecordAuth())

		// Resume recording
		e.Router.POST("/api/recorder/resume", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				RecordingID string `json:"recording_id"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			if err := recorderService.ResumeRecording(data.RecordingID); err != nil {
				return apis.NewBadRequestError("Failed to resume recording", err)
			}

			rec, _ := recorderService.GetRecording(data.RecordingID)
			return c.JSON(http.StatusOK, rec.Info())
		}, apis.RequireRecordAuth())

		// Stop recording
		e.Router.POST("/api/recorder/stop", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				RecordingID string `json:"recording_id"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			rec, err := recorderService.StopRecording(data.RecordingID)
			if err != nil {
				return apis.NewBadRequestError("Failed to stop recording", err)
			}

			return c.JSON(http.StatusOK, rec.Info())
		}, apis.RequireRecordAuth())

		// Get recording status
		e.Router.GET("/api/recorder/status/:id", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			id := c.PathParam("id")
			rec, exists := recorderService.GetRecording(id)
			if !exists {
				return apis.NewNotFoundError("Recording not found", nil)
			}

			return c.JSON(http.StatusOK, rec.Info())
		}, apis.RequireRecordAuth())

		// Get all active recordings
		e.Router.GET("/api/recorder/active", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			recs := recorderService.GetAllRecordings()
			infos := make([]recorder.RecordingInfo, len(recs))
			for i, rec := range recs {
				infos[i] = rec.Info()
			}

			return c.JSON(http.StatusOK, infos)
		}, apis.RequireRecordAuth())

		// List all recorded files
		e.Router.GET("/api/recorder/files", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			recordingsDir := filepath.Join(app.DataDir(), "recordings")
			files, err := os.ReadDir(recordingsDir)
			if err != nil {
				if os.IsNotExist(err) {
					return c.JSON(http.StatusOK, []map[string]interface{}{})
				}
				return apis.NewBadRequestError("Failed to read recordings directory", err)
			}

			var recordings []map[string]interface{}
			for _, file := range files {
				if file.IsDir() {
					continue
				}
				info, err := file.Info()
				if err != nil {
					continue
				}
				recordings = append(recordings, map[string]interface{}{
					"name":       file.Name(),
					"size":       info.Size(),
					"created_at": info.ModTime().Format(time.RFC3339),
				})
			}

			return c.JSON(http.StatusOK, recordings)
		}, apis.RequireRecordAuth())

		// Delete a recorded file
		e.Router.DELETE("/api/recorder/files/:filename", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			filename := c.PathParam("filename")
			// Security: prevent path traversal
			if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
				return apis.NewBadRequestError("Invalid filename", nil)
			}

			filePath := filepath.Join(app.DataDir(), "recordings", filename)
			if err := os.Remove(filePath); err != nil {
				if os.IsNotExist(err) {
					return apis.NewNotFoundError("File not found", nil)
				}
				return apis.NewBadRequestError("Failed to delete file", err)
			}

			return c.JSON(http.StatusOK, map[string]string{"message": "File deleted"})
		}, apis.RequireRecordAuth())

		// =========================================
		// Thumbnail API endpoints
		// =========================================

		// Generate and get thumbnail for a channel
		e.Router.GET("/api/thumbnail/:channelId", func(c echo.Context) error {
			channelId := c.PathParam("channelId")
			streamURL := c.QueryParam("url")

			if streamURL == "" {
				// Try to get from database
				authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
				if authRecord == nil {
					return apis.NewUnauthorizedError("Authentication required", nil)
				}

				channel, err := app.Dao().FindRecordById("channels", channelId)
				if err != nil {
					return apis.NewNotFoundError("Channel not found", err)
				}

				streamURL = channel.GetString("url")
			}

			if streamURL == "" {
				return apis.NewBadRequestError("Stream URL is required", nil)
			}

			// Check for If-Modified-Since header for caching
			if ifModifiedSince := c.Request().Header.Get("If-Modified-Since"); ifModifiedSince != "" {
				if path, exists := thumbnailService.GetThumbnailPath(channelId); exists {
					if info, err := os.Stat(path); err == nil {
						parsedTime, err := http.ParseTime(ifModifiedSince)
						if err == nil && !info.ModTime().After(parsedTime) {
							return c.NoContent(http.StatusNotModified)
						}
					}
				}
			}

			info, err := thumbnailService.GetThumbnail(channelId, streamURL)
			if err != nil {
				return apis.NewBadRequestError("Failed to generate thumbnail: "+err.Error(), nil)
			}

			// Set cache headers
			c.Response().Header().Set("Cache-Control", "public, max-age=300") // 5 minutes
			c.Response().Header().Set("Last-Modified", info.GeneratedAt.UTC().Format(http.TimeFormat))

			return c.File(info.FilePath)
		})

		// Get thumbnail if cached (no generation)
		e.Router.GET("/api/thumbnail/:channelId/cached", func(c echo.Context) error {
			channelId := c.PathParam("channelId")

			path, exists := thumbnailService.GetThumbnailPath(channelId)
			if !exists {
				return c.JSON(http.StatusOK, map[string]interface{}{
					"cached":  false,
					"message": "No cached thumbnail available",
				})
			}

			c.Response().Header().Set("Cache-Control", "public, max-age=300")
			return c.File(path)
		})

		// Invalidate thumbnail cache for a channel
		e.Router.DELETE("/api/thumbnail/:channelId", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			channelId := c.PathParam("channelId")
			thumbnailService.InvalidateThumbnail(channelId)

			return c.JSON(http.StatusOK, map[string]string{"message": "Thumbnail cache invalidated"})
		}, apis.RequireRecordAuth())

		// Batch generate thumbnails for multiple channels
		e.Router.POST("/api/thumbnails/batch", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				Channels    map[string]string `json:"channels"` // channelId -> streamURL
				Concurrency int               `json:"concurrency"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			if len(data.Channels) == 0 {
				return apis.NewBadRequestError("No channels provided", nil)
			}

			concurrency := data.Concurrency
			if concurrency <= 0 || concurrency > 5 {
				concurrency = 3 // Default to 3 concurrent generations
			}

			results := thumbnailService.BatchGenerate(data.Channels, concurrency)

			response := make(map[string]interface{})
			for channelId, info := range results {
				response[channelId] = map[string]interface{}{
					"success":      true,
					"generated_at": info.GeneratedAt,
					"size":         info.Size,
				}
			}

			// Mark failed channels
			for channelId := range data.Channels {
				if _, ok := results[channelId]; !ok {
					response[channelId] = map[string]interface{}{
						"success": false,
						"error":   "Failed to generate thumbnail",
					}
				}
			}

			return c.JSON(http.StatusOK, response)
		}, apis.RequireRecordAuth())

		// Get thumbnail cache statistics
		e.Router.GET("/api/thumbnails/stats", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			return c.JSON(http.StatusOK, thumbnailService.GetCacheStats())
		}, apis.RequireRecordAuth())

		// Get thumbnail URL for a channel (returns URL instead of image)
		e.Router.GET("/api/thumbnail/:channelId/url", func(c echo.Context) error {
			channelId := c.PathParam("channelId")
			streamURL := c.QueryParam("url")

			if streamURL == "" {
				authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
				if authRecord == nil {
					return apis.NewUnauthorizedError("Authentication required", nil)
				}

				channel, err := app.Dao().FindRecordById("channels", channelId)
				if err != nil {
					return apis.NewNotFoundError("Channel not found", err)
				}
				streamURL = channel.GetString("url")
			}

			// Check if cached
			cacheTTL := 300 // 5 minutes in seconds
			_, cached := thumbnailService.GetThumbnailPath(channelId)

			// Generate timestamp for cache busting
			timestamp := strconv.FormatInt(time.Now().Unix()/int64(cacheTTL)*int64(cacheTTL), 10)

			return c.JSON(http.StatusOK, map[string]interface{}{
				"url":       fmt.Sprintf("/api/thumbnail/%s?t=%s", channelId, timestamp),
				"cached":    cached,
				"stream_url": streamURL,
			})
		})

		// =========================================
		// Subtitle API endpoints
		// =========================================

		// Start subtitle generation session
		e.Router.POST("/api/subtitle/start", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				SessionID  string `json:"session_id"`
				ChannelID  string `json:"channel_id"`
				StreamURL  string `json:"stream_url"`
				Language   string `json:"language"`
				TargetLang string `json:"target_lang"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			if data.SessionID == "" || data.ChannelID == "" || data.StreamURL == "" {
				return apis.NewBadRequestError("Missing required fields", nil)
			}

			// Default language to auto-detect
			if data.Language == "" {
				data.Language = "en"
			}

			log.Printf("Starting subtitle session: language=%s, target_lang=%s", data.Language, data.TargetLang)

			session, err := subtitleService.StartSession(data.SessionID, data.ChannelID, data.StreamURL, data.Language, data.TargetLang)
			if err != nil {
				return apis.NewBadRequestError("Failed to start subtitle session", err)
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"session_id": session.ID,
				"status":     session.Status,
				"language":   session.Language,
				"target_lang": session.TargetLang,
			})
		}, apis.RequireRecordAuth())

		// Stop subtitle session
		e.Router.POST("/api/subtitle/stop", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				SessionID string `json:"session_id"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			if err := subtitleService.StopSession(data.SessionID); err != nil {
				return apis.NewBadRequestError("Failed to stop session", err)
			}

			return c.JSON(http.StatusOK, map[string]string{"message": "Session stopped"})
		}, apis.RequireRecordAuth())

		// Get subtitle session status
		e.Router.GET("/api/subtitle/session/:id", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessionID := c.PathParam("id")
			info, exists := subtitleService.GetSession(sessionID)
			if !exists {
				return apis.NewNotFoundError("Session not found", nil)
			}

			return c.JSON(http.StatusOK, info)
		}, apis.RequireRecordAuth())

		// Get subtitles (polling endpoint)
		e.Router.GET("/api/subtitle/session/:id/subtitles", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessionID := c.PathParam("id")
			sinceStr := c.QueryParam("since")
			since := 0
			if sinceStr != "" {
				since, _ = strconv.Atoi(sinceStr)
			}

			subtitles, err := subtitleService.GetSubtitles(sessionID, since)
			if err != nil {
				log.Printf("[DEBUG] GetSubtitles error for session %s: %v", sessionID, err)
				return c.JSON(http.StatusOK, map[string]interface{}{
					"subtitles": []interface{}{},
					"count":     0,
				})
			}

			if len(subtitles) > 0 {
				log.Printf("[DEBUG] Returning %d subtitles for session %s (since=%d)", len(subtitles), sessionID, since)
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"subtitles": subtitles,
				"count":     len(subtitles),
			})
		}, apis.RequireRecordAuth())

		// Get latest subtitle only
		e.Router.GET("/api/subtitle/session/:id/latest", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessionID := c.PathParam("id")
			latest, err := subtitleService.GetLatestSubtitle(sessionID)
			if err != nil {
				return apis.NewBadRequestError("Failed to get latest subtitle", err)
			}

			if latest == nil {
				return c.JSON(http.StatusOK, map[string]interface{}{
					"subtitle": nil,
				})
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"subtitle": latest,
			})
		}, apis.RequireRecordAuth())

		// Export subtitles as SRT
		e.Router.POST("/api/subtitle/session/:id/export", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessionID := c.PathParam("id")
			filepath, err := subtitleService.ExportSRT(sessionID)
			if err != nil {
				return apis.NewBadRequestError("Failed to export SRT", err)
			}

			return c.JSON(http.StatusOK, map[string]string{
				"filepath": filepath,
				"message":  "SRT file exported successfully",
			})
		}, apis.RequireRecordAuth())

		// Download SRT file
		e.Router.GET("/api/subtitle/session/:id/download", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessionID := c.PathParam("id")
			filepath, err := subtitleService.ExportSRT(sessionID)
			if err != nil {
				return apis.NewBadRequestError("Failed to export SRT", err)
			}

			c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.srt\"", sessionID))
			return c.File(filepath)
		}, apis.RequireRecordAuth())

		// Delete subtitle session
		e.Router.DELETE("/api/subtitle/session/:id", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessionID := c.PathParam("id")
			if err := subtitleService.DeleteSession(sessionID); err != nil {
				return apis.NewBadRequestError("Failed to delete session", err)
			}

			return c.JSON(http.StatusOK, map[string]string{"message": "Session deleted"})
		}, apis.RequireRecordAuth())

		// Get all active subtitle sessions
		e.Router.GET("/api/subtitle/sessions", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			sessions := subtitleService.GetAllSessions()
			return c.JSON(http.StatusOK, sessions)
		}, apis.RequireRecordAuth())

		// Get available languages for speech recognition
		e.Router.GET("/api/subtitle/languages", func(c echo.Context) error {
			return c.JSON(http.StatusOK, subtitleService.GetAvailableLanguages())
		})

		// Check Ollama status (for translation)
		e.Router.GET("/api/subtitle/ollama/status", func(c echo.Context) error {
			available, message := subtitleService.CheckOllamaStatus()
			config := subtitleService.GetConfig()
			return c.JSON(http.StatusOK, map[string]interface{}{
				"available": available,
				"message":   message,
				"url":       config.OllamaURL,
				"model":     config.OllamaModel,
			})
		})

		// Get Ollama configuration (load from database if available)
		e.Router.GET("/api/subtitle/ollama/config", func(c echo.Context) error {
			// Try to load from database first
			settingsCollection, err := app.Dao().FindCollectionByNameOrId("app_settings")
			if err == nil {
				record, err := app.Dao().FindFirstRecordByFilter(settingsCollection.Id, "key = 'ollama_config'")
				if err == nil && record != nil {
					valueStr := record.GetString("value")
					var savedConfig map[string]interface{}
					if json.Unmarshal([]byte(valueStr), &savedConfig) == nil {
						if url, ok := savedConfig["url"].(string); ok && url != "" {
							subtitleService.UpdateOllamaConfig(url, "")
						}
						if model, ok := savedConfig["model"].(string); ok && model != "" {
							subtitleService.UpdateOllamaConfig("", model)
						}
					}
				}
			}

			config := subtitleService.GetConfig()
			available, _ := subtitleService.CheckOllamaStatus()
			availableModels := []string{}
			if available {
				availableModels, _ = subtitleService.GetOllamaModels()
			}
			return c.JSON(http.StatusOK, map[string]interface{}{
				"url":              config.OllamaURL,
				"model":            config.OllamaModel,
				"available":        available,
				"available_models": availableModels,
			})
		})

		// Update Ollama configuration (persist to database)
		e.Router.POST("/api/subtitle/ollama/config", func(c echo.Context) error {
			authRecord, _ := c.Get(apis.ContextAuthRecordKey).(*models.Record)
			if authRecord == nil {
				return apis.NewUnauthorizedError("Authentication required", nil)
			}

			data := struct {
				URL   string `json:"url"`
				Model string `json:"model"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			// Update in-memory config
			subtitleService.UpdateOllamaConfig(data.URL, data.Model)

			// Persist to database
			settingsCollection, err := app.Dao().FindCollectionByNameOrId("app_settings")
			if err == nil {
				configValue := map[string]string{
					"url":   data.URL,
					"model": data.Model,
				}
				configJSON, _ := json.Marshal(configValue)

				// Try to find existing record
				record, err := app.Dao().FindFirstRecordByFilter(settingsCollection.Id, "key = 'ollama_config'")
				if err != nil || record == nil {
					// Create new record
					record = models.NewRecord(settingsCollection)
					record.Set("key", "ollama_config")
				}
				record.Set("value", string(configJSON))
				if err := app.Dao().SaveRecord(record); err != nil {
					log.Printf("Failed to save Ollama config: %v", err)
				} else {
					log.Printf("Ollama config saved: url=%s, model=%s", data.URL, data.Model)
				}
			}

			// Check if the new configuration works
			available, message := subtitleService.CheckOllamaStatus()

			return c.JSON(http.StatusOK, map[string]interface{}{
				"success":   true,
				"available": available,
				"message":   message,
				"url":       data.URL,
				"model":     data.Model,
			})
		}, apis.RequireRecordAuth())

		// Test Ollama connection with specific URL
		e.Router.POST("/api/subtitle/ollama/test", func(c echo.Context) error {
			data := struct {
				URL string `json:"url"`
			}{}
			if err := c.Bind(&data); err != nil {
				return apis.NewBadRequestError("Invalid request body", err)
			}

			// Temporarily test the connection
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			testURL := data.URL
			if testURL == "" {
				testURL = "http://localhost:11434"
			}

			req, err := http.NewRequestWithContext(ctx, "GET", testURL+"/api/tags", nil)
			if err != nil {
				return c.JSON(http.StatusOK, map[string]interface{}{
					"available": false,
					"message":   err.Error(),
				})
			}

			client := &http.Client{Timeout: 5 * time.Second}
			resp, err := client.Do(req)
			if err != nil {
				return c.JSON(http.StatusOK, map[string]interface{}{
					"available": false,
					"message":   "Failed to connect: " + err.Error(),
				})
			}
			defer resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				// Get available models
				var result struct {
					Models []struct {
						Name string `json:"name"`
					} `json:"models"`
				}
				json.NewDecoder(resp.Body).Decode(&result)

				models := make([]string, 0, len(result.Models))
				for _, m := range result.Models {
					models = append(models, m.Name)
				}

				return c.JSON(http.StatusOK, map[string]interface{}{
					"available": true,
					"message":   "Connected successfully",
					"models":    models,
				})
			}

			return c.JSON(http.StatusOK, map[string]interface{}{
				"available": false,
				"message":   fmt.Sprintf("Server returned status %d", resp.StatusCode),
			})
		})

		return nil
	})

	// Hook to check TOTP on login
	app.OnRecordAuthRequest().Add(func(e *core.RecordAuthEvent) error {
		// Check if user has TOTP enabled
		if e.Record.GetBool("totp_enabled") {
			// Set flag for frontend to know 2FA is required
			e.Record.Set("requires_2fa", true)
		}
		return nil
	})

	// Initialize collections and add TOTP fields
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		usersCollection, err := app.Dao().FindCollectionByNameOrId("users")
		if err != nil {
			log.Println("Users collection not found, will be created on first admin setup")
			return nil
		}

		// Check if totp_enabled field exists
		if usersCollection.Schema.GetFieldByName("totp_enabled") == nil {
			log.Println("Adding TOTP fields to users collection...")

			usersCollection.Schema.AddField(&schema.SchemaField{
				Name:    "totp_enabled",
				Type:    schema.FieldTypeBool,
				Options: &schema.BoolOptions{},
			})
			usersCollection.Schema.AddField(&schema.SchemaField{
				Name: "totp_secret",
				Type: schema.FieldTypeText,
				Options: &schema.TextOptions{
					Max: types.Pointer(256),
				},
			})
			usersCollection.Schema.AddField(&schema.SchemaField{
				Name: "totp_secret_pending",
				Type: schema.FieldTypeText,
				Options: &schema.TextOptions{
					Max: types.Pointer(256),
				},
			})
			usersCollection.Schema.AddField(&schema.SchemaField{
				Name: "totp_verified_at",
				Type: schema.FieldTypeText,
				Options: &schema.TextOptions{
					Max: types.Pointer(64),
				},
			})

			if err := app.Dao().SaveCollection(usersCollection); err != nil {
				log.Printf("Failed to add TOTP fields: %v", err)
			} else {
				log.Println("TOTP fields added successfully")
			}
		}

		// Create profiles collection if not exists
		if _, err := app.Dao().FindCollectionByNameOrId("profiles"); err != nil {
			log.Println("Creating profiles collection...")
			profilesCollection := &models.Collection{
				Name:       "profiles",
				Type:       models.CollectionTypeBase,
				ListRule:   types.Pointer("user = @request.auth.id"),
				ViewRule:   types.Pointer("user = @request.auth.id"),
				CreateRule: types.Pointer("@request.auth.id != ''"),
				UpdateRule: types.Pointer("user = @request.auth.id"),
				DeleteRule: types.Pointer("user = @request.auth.id"),
				Schema: schema.NewSchema(
					&schema.SchemaField{Name: "user", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: usersCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "name", Type: schema.FieldTypeText, Required: true,
						Options: &schema.TextOptions{Min: types.Pointer(1), Max: types.Pointer(50)}},
					&schema.SchemaField{Name: "avatar", Type: schema.FieldTypeFile, Required: false,
						Options: &schema.FileOptions{MaxSelect: 1, MaxSize: 5242880, MimeTypes: []string{"image/jpeg", "image/png", "image/gif", "image/webp"}}},
					&schema.SchemaField{Name: "is_kids", Type: schema.FieldTypeBool, Required: false, Options: &schema.BoolOptions{}},
					&schema.SchemaField{Name: "pin", Type: schema.FieldTypeText, Required: false, Options: &schema.TextOptions{Max: types.Pointer(4)}},
					&schema.SchemaField{Name: "language", Type: schema.FieldTypeText, Required: false, Options: &schema.TextOptions{Max: types.Pointer(10)}},
				),
			}
			if err := app.Dao().SaveCollection(profilesCollection); err != nil {
				log.Printf("Failed to create profiles collection: %v", err)
			} else {
				log.Println("Profiles collection created")
			}
		}

		// Create playlists collection if not exists
		if _, err := app.Dao().FindCollectionByNameOrId("playlists"); err != nil {
			log.Println("Creating playlists collection...")
			playlistsCollection := &models.Collection{
				Name:       "playlists",
				Type:       models.CollectionTypeBase,
				ListRule:   types.Pointer("user = @request.auth.id"),
				ViewRule:   types.Pointer("user = @request.auth.id"),
				CreateRule: types.Pointer("@request.auth.id != ''"),
				UpdateRule: types.Pointer("user = @request.auth.id"),
				DeleteRule: types.Pointer("user = @request.auth.id"),
				Schema: schema.NewSchema(
					&schema.SchemaField{Name: "user", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: usersCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "name", Type: schema.FieldTypeText, Required: true,
						Options: &schema.TextOptions{Min: types.Pointer(1), Max: types.Pointer(100)}},
					&schema.SchemaField{Name: "url", Type: schema.FieldTypeUrl, Required: false, Options: &schema.UrlOptions{}},
					&schema.SchemaField{Name: "is_active", Type: schema.FieldTypeBool, Required: false, Options: &schema.BoolOptions{}},
					&schema.SchemaField{Name: "auto_sync", Type: schema.FieldTypeBool, Required: false, Options: &schema.BoolOptions{}},
					&schema.SchemaField{Name: "sync_interval", Type: schema.FieldTypeNumber, Required: false, Options: &schema.NumberOptions{}},
					&schema.SchemaField{Name: "last_synced", Type: schema.FieldTypeDate, Required: false, Options: &schema.DateOptions{}},
				),
			}
			if err := app.Dao().SaveCollection(playlistsCollection); err != nil {
				log.Printf("Failed to create playlists collection: %v", err)
			} else {
				log.Println("Playlists collection created")
			}
		}

		// Create channels collection if not exists
		playlistsCollection, _ := app.Dao().FindCollectionByNameOrId("playlists")
		if _, err := app.Dao().FindCollectionByNameOrId("channels"); err != nil && playlistsCollection != nil {
			log.Println("Creating channels collection...")
			channelsCollection := &models.Collection{
				Name:       "channels",
				Type:       models.CollectionTypeBase,
				ListRule:   types.Pointer("playlist.user = @request.auth.id"),
				ViewRule:   types.Pointer("playlist.user = @request.auth.id"),
				CreateRule: types.Pointer("@request.auth.id != ''"),
				UpdateRule: types.Pointer("playlist.user = @request.auth.id"),
				DeleteRule: types.Pointer("playlist.user = @request.auth.id"),
				Schema: schema.NewSchema(
					&schema.SchemaField{Name: "playlist", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: playlistsCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "name", Type: schema.FieldTypeText, Required: true,
						Options: &schema.TextOptions{Min: types.Pointer(1), Max: types.Pointer(200)}},
					&schema.SchemaField{Name: "url", Type: schema.FieldTypeText, Required: true,
						Options: &schema.TextOptions{Max: types.Pointer(2000)}},
					&schema.SchemaField{Name: "tvg_id", Type: schema.FieldTypeText, Required: false,
						Options: &schema.TextOptions{Max: types.Pointer(200)}},
					&schema.SchemaField{Name: "tvg_name", Type: schema.FieldTypeText, Required: false,
						Options: &schema.TextOptions{Max: types.Pointer(200)}},
					&schema.SchemaField{Name: "tvg_logo", Type: schema.FieldTypeUrl, Required: false, Options: &schema.UrlOptions{}},
					&schema.SchemaField{Name: "group_title", Type: schema.FieldTypeText, Required: false,
						Options: &schema.TextOptions{Max: types.Pointer(100)}},
					&schema.SchemaField{Name: "is_active", Type: schema.FieldTypeBool, Required: false, Options: &schema.BoolOptions{}},
					&schema.SchemaField{Name: "language", Type: schema.FieldTypeText, Required: false,
						Options: &schema.TextOptions{Max: types.Pointer(50)}},
					&schema.SchemaField{Name: "country", Type: schema.FieldTypeText, Required: false,
						Options: &schema.TextOptions{Max: types.Pointer(50)}},
					&schema.SchemaField{Name: "sort_order", Type: schema.FieldTypeNumber, Required: false, Options: &schema.NumberOptions{}},
				),
			}
			if err := app.Dao().SaveCollection(channelsCollection); err != nil {
				log.Printf("Failed to create channels collection: %v", err)
			} else {
				log.Println("Channels collection created")
			}
		}

		// Create favorites collection if not exists
		profilesCollection, _ := app.Dao().FindCollectionByNameOrId("profiles")
		channelsCollection, _ := app.Dao().FindCollectionByNameOrId("channels")
		if _, err := app.Dao().FindCollectionByNameOrId("favorites"); err != nil && profilesCollection != nil && channelsCollection != nil {
			log.Println("Creating favorites collection...")
			favoritesCollection := &models.Collection{
				Name:       "favorites",
				Type:       models.CollectionTypeBase,
				ListRule:   types.Pointer("profile.user = @request.auth.id"),
				ViewRule:   types.Pointer("profile.user = @request.auth.id"),
				CreateRule: types.Pointer("@request.auth.id != ''"),
				UpdateRule: types.Pointer("profile.user = @request.auth.id"),
				DeleteRule: types.Pointer("profile.user = @request.auth.id"),
				Schema: schema.NewSchema(
					&schema.SchemaField{Name: "profile", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: profilesCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "channel", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: channelsCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "sort_order", Type: schema.FieldTypeNumber, Required: false, Options: &schema.NumberOptions{}},
				),
			}
			if err := app.Dao().SaveCollection(favoritesCollection); err != nil {
				log.Printf("Failed to create favorites collection: %v", err)
			} else {
				log.Println("Favorites collection created")
			}
		}

		// Create watch_history collection if not exists
		if _, err := app.Dao().FindCollectionByNameOrId("watch_history"); err != nil && profilesCollection != nil && channelsCollection != nil {
			log.Println("Creating watch_history collection...")
			watchHistoryCollection := &models.Collection{
				Name:       "watch_history",
				Type:       models.CollectionTypeBase,
				ListRule:   types.Pointer("profile.user = @request.auth.id"),
				ViewRule:   types.Pointer("profile.user = @request.auth.id"),
				CreateRule: types.Pointer("@request.auth.id != ''"),
				UpdateRule: types.Pointer("profile.user = @request.auth.id"),
				DeleteRule: types.Pointer("profile.user = @request.auth.id"),
				Schema: schema.NewSchema(
					&schema.SchemaField{Name: "profile", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: profilesCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "channel", Type: schema.FieldTypeRelation, Required: true,
						Options: &schema.RelationOptions{CollectionId: channelsCollection.Id, CascadeDelete: true}},
					&schema.SchemaField{Name: "watched_at", Type: schema.FieldTypeDate, Required: true, Options: &schema.DateOptions{}},
					&schema.SchemaField{Name: "duration", Type: schema.FieldTypeNumber, Required: false, Options: &schema.NumberOptions{}},
				),
			}
			if err := app.Dao().SaveCollection(watchHistoryCollection); err != nil {
				log.Printf("Failed to create watch_history collection: %v", err)
			} else {
				log.Println("Watch history collection created")
			}
		}

		// Create app_settings collection if not exists (for persistent configuration)
		if _, err := app.Dao().FindCollectionByNameOrId("app_settings"); err != nil {
			log.Println("Creating app_settings collection...")
			appSettingsCollection := &models.Collection{
				Name:       "app_settings",
				Type:       models.CollectionTypeBase,
				ListRule:   types.Pointer("@request.auth.id != ''"),
				ViewRule:   types.Pointer("@request.auth.id != ''"),
				CreateRule: types.Pointer("@request.auth.id != ''"),
				UpdateRule: types.Pointer("@request.auth.id != ''"),
				DeleteRule: types.Pointer("@request.auth.id != ''"),
				Schema: schema.NewSchema(
					&schema.SchemaField{Name: "key", Type: schema.FieldTypeText, Required: true, Options: &schema.TextOptions{}},
					&schema.SchemaField{Name: "value", Type: schema.FieldTypeJson, Required: false, Options: &schema.JsonOptions{}},
				),
			}
			if err := app.Dao().SaveCollection(appSettingsCollection); err != nil {
				log.Printf("Failed to create app_settings collection: %v", err)
			} else {
				log.Println("App settings collection created")
			}
		}

		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
