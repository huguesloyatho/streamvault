# StreamVault

A self-hosted IPTV streaming application with M3U playlist management, EPG support, and multi-profile functionality.

## Features

- **M3U/M3U8 Playlist Management** - Import and manage multiple IPTV playlists
- **Quick Import** - One-click import from iptv-org (by country, category, language, or region)
- **EPG Support** - Electronic Program Guide integration
- **Multi-Profile** - Netflix-style profile management with PIN protection
- **Favorites & History** - Track your favorite channels and watch history
- **Live Subtitles** - AI-powered subtitle generation using Whisper
- **2FA Authentication** - TOTP-based two-factor authentication
- **Dark Theme** - Modern dark UI inspired by streaming platforms

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: PocketBase (Go)
- **Subtitles**: Whisper (faster-whisper)
- **Container**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A reverse proxy (Nginx Proxy Manager, Traefik, Caddy, etc.)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/streamvault.git
cd streamvault
```

2. Copy the environment file and configure it:
```bash
cp .env.example .env
```

3. Edit `.env` with your settings:
```env
# Required - Generate with: openssl rand -hex 16
PB_ENCRYPTION_KEY=your-32-character-encryption-key

# Your domain (for reverse proxy)
FQDN=streamvault.yourdomain.com
NEXT_PUBLIC_POCKETBASE_URL=https://streamvault.yourdomain.com
```

4. Start the application:
```bash
docker compose up -d
```

5. Access the application at `http://localhost:3000` (or via your reverse proxy)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PB_ENCRYPTION_KEY` | **Required** - 32-character encryption key | - |
| `FQDN` | Domain name for reverse proxy | `streamvault.local` |
| `NEXT_PUBLIC_POCKETBASE_URL` | PocketBase URL (as seen by browser) | `http://localhost:8090` |
| `PB_PORT` | Backend port | `8090` |
| `FRONTEND_PORT` | Frontend port | `3000` |
| `WHISPER_MODEL` | Whisper model (tiny/base/small/medium/large) | `base` |
| `OLLAMA_HOST` | Ollama URL for AI translation (optional) | - |
| `OLLAMA_MODEL` | Ollama model for translation | `llama3.2` |

### Reverse Proxy Setup

StreamVault expects you to use your own reverse proxy. Configure it to:

- Forward `/` to `http://<docker-host>:3000` (frontend)
- Forward `/api/*` and `/_/*` to `http://<docker-host>:8090` (backend)

#### Nginx Proxy Manager Example

1. Add a new Proxy Host with your domain
2. Set the forward hostname/IP to your Docker host
3. Set the forward port to `3000`
4. Add custom locations:
   - Location: `/api`  -> `http://<docker-host>:8090`
   - Location: `/_`    -> `http://<docker-host>:8090`

## Development

### Local Development

1. Start the backend:
```bash
cd backend
go run main.go serve --http=0.0.0.0:8090
```

2. Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

### Docker Development (with hot reload)

```bash
docker compose up
```

This uses `docker-compose.override.yml` for development settings.

### Production Build

```bash
docker compose -f docker-compose.yml up -d --build
```

## Project Structure

```
streamvault/
├── backend/                 # PocketBase backend
│   ├── main.go             # Entry point
│   ├── migrations/         # Database migrations
│   ├── scripts/            # Python scripts (Whisper)
│   ├── Dockerfile          # Production Dockerfile
│   └── Dockerfile.dev      # Development Dockerfile
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities & PocketBase client
│   │   ├── stores/        # Zustand stores
│   │   └── types/         # TypeScript types
│   ├── Dockerfile         # Production Dockerfile
│   └── Dockerfile.dev     # Development Dockerfile
├── docker-compose.yml      # Production compose
├── docker-compose.override.yml  # Dev overrides
├── .env.example            # Environment template
└── README.md
```

## API Endpoints

The backend exposes PocketBase's standard REST API:

- `POST /api/collections/users/auth-with-password` - Login
- `POST /api/collections/users/records` - Register
- `GET /api/collections/playlists/records` - List playlists
- `GET /api/collections/channels/records` - List channels
- `GET /api/health` - Health check

## Screenshots

*Coming soon*

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [iptv-org](https://github.com/iptv-org/iptv) - Free IPTV playlists
- [PocketBase](https://pocketbase.io) - Backend framework
- [Next.js](https://nextjs.org) - React framework
- [Whisper](https://github.com/openai/whisper) - Speech recognition
