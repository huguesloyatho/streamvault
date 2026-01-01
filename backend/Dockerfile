# Build stage
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download || true

# Copy source code
COPY . .

# Download dependencies and build
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build \
    -ldflags="-w -s" \
    -o /pocketbase \
    ./main.go

# Runtime stage
FROM alpine:3.19

WORKDIR /pb

# Install runtime dependencies including Python for Whisper
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    wget \
    curl \
    ffmpeg \
    python3 \
    py3-pip

# Install Python dependencies for speech recognition
RUN pip3 install --no-cache-dir --break-system-packages \
    faster-whisper || \
    pip3 install --no-cache-dir --break-system-packages \
    openai-whisper || true

# Copy binary from builder
COPY --from=builder /pocketbase /pb/pocketbase

# Copy Python scripts
COPY scripts/ /pb/scripts/

# Create data directories
RUN mkdir -p /pb/pb_data /pb/pb_migrations /pb/recordings /pb/pb_data/subtitles /pb/pb_data/thumbnails

# Set permissions
RUN chmod +x /pb/pocketbase && \
    chmod +x /pb/scripts/*.py 2>/dev/null || true

# Expose port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8090/api/health || exit 1

# Environment variables
ENV WHISPER_MODEL=base

# Run PocketBase
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
