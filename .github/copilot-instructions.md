# Sonic Wave - AI Coding Agent Instructions

## Project Overview
Sonic Wave is a **privacy-first, client-side audio converter** powered by FFmpeg.wasm. All audio processing happens in the browser using WebAssembly - no server uploads required. The architecture consists of:
- **Backend**: Rust static file server (Axum framework) serving the frontend
- **Frontend**: Vanilla JavaScript SPA using FFmpeg.wasm for audio conversion
- **Deployment**: Docker containerization with multi-stage builds

## Architecture & Data Flow

### Server (Rust/Axum)
The `src/main.rs` server is intentionally minimal - it only serves static files with critical headers:
- **COOP/COEP headers** are REQUIRED for SharedArrayBuffer (needed by FFmpeg.wasm)
- Configuration priority: `ENV vars > config.toml > defaults (port 8089)`
- Cache-Control strategy differs by environment (see config files)
- Graceful shutdown handling for both Ctrl+C and SIGTERM

### Client Architecture (index.html)
Single-page application with inline JavaScript (~780 lines):
1. **FFmpeg.wasm initialization**: Loads WASM files from `/assets/` directory
2. **File processing pipeline**: Upload → Metadata parsing → Conversion → Download/Zip
3. **Batch processing**: Processes files sequentially with progress tracking
4. **Memory management**: Critical to delete temp files via `ffmpeg.deleteFile()` after each operation

**Key FFmpeg.wasm patterns:**
```javascript
await ffmpeg.writeFile(inputName, await fetchFile(file));
await ffmpeg.exec(['-i', inputName, '-b:a', '128k', outputName]);
const data = await ffmpeg.readFile(outputName);
await ffmpeg.deleteFile(inputName); // Always cleanup!
```

## Critical Workflows

### Local Development
```powershell
# Build and run (requires Rust toolchain)
cargo build --release
.\target\release\sonic-wave.exe

# Development mode with no caching
Copy-Item config.dev.toml config.toml
.\target\release\sonic-wave.exe

# Server listens on http://0.0.0.0:8089 by default
```

### Docker Deployment
```powershell
# Using docker-compose (recommended)
docker-compose up -d

# Logs
docker logs -f sonic-wave

# Custom port via environment variable
docker run -d -p 9000:9000 -e PORT=9000 --name sonic-wave sonic-wave

# Pull from GitHub Container Registry
docker pull ghcr.io/hacperme/sonicwave:latest
```

### CI/CD Pipeline
GitHub Actions workflows automate builds and deployments:
- **`.github/workflows/ci-cd.yml`**: Runs on push/PR to main/dev branches
  - Rust formatting check (`cargo fmt`)
  - Clippy linting (`cargo clippy`)
  - Build and test
  - Docker image build and push to `ghcr.io`
  - Security scanning with Trivy
- **`.github/workflows/release.yml`**: Triggers on version tags (`v*.*.*`)
  - Creates GitHub Release
  - Builds cross-platform binaries (Linux/Windows/macOS, x86_64/ARM64)
  - Publishes multi-arch Docker images

**To create a release:**
```powershell
git tag v0.1.0
git push origin v0.1.0
```

### Configuration Management
- **Production**: `config.toml` with `cache_control = "public, max-age=31536000, immutable"`
- **Development**: Use `config.dev.toml` (disables caching for hot-reload)
- Environment variables override config file values

## Project-Specific Conventions

### Static Assets (`/assets/`)
All FFmpeg.wasm files MUST be served from `/assets/`:
- `ffmpeg-core.js`, `ffmpeg-core.wasm`: Core WASM runtime (large files ~30MB)
- `ffmpeg.js`, `util.js`: UMD wrappers exposing `FFmpegWASM` and `FFmpegUtil` globals
- `jszip.min.js`: For batch download packaging
- Assets are served with long-term caching in production

### Audio Format Configurations
Format settings in `index.html` define encoder parameters:
```javascript
const formatConfig = {
    mp3: { ext: 'mp3', encoder: 'libmp3lame', supportsBitrate: true },
    wav: { ext: 'wav', encoder: 'pcm_s16le', supportsBitrate: false },
    // ... see index.html for full list
};
```
When adding formats, update both `formatConfig` object and HTML `<select>` dropdown.

### Error Handling Pattern
FFmpeg.wasm throws expected errors during metadata parsing (`-i` without output):
```javascript
try {
    await ffmpeg.exec(['-i', inputName]); // Intentionally fails
} catch (e) {
    // Normal - metadata is captured in logs, not stderr
}
const logs = logEl.innerText; // Parse metadata from logs
```

## Dockerfile Multi-Stage Build
1. **Builder stage**: Compiles Rust binary with dependency caching optimization
2. **Runtime stage**: Minimal Debian image with wget for healthchecks
3. **Security**: Runs as non-root `sonicwave` user
4. **Healthcheck**: Uses wget on port 8089 endpoint

## Common Pitfalls
- **Missing COOP/COEP headers**: FFmpeg.wasm won't load without them (SharedArrayBuffer requirement)
- **WASM file paths**: Must use absolute paths starting with `/assets/`
- **Memory leaks**: Always call `ffmpeg.deleteFile()` for both input and output files
- **Bitrate validation**: WAV/FLAC are lossless, don't accept bitrate parameters
- **Cache issues in dev**: Use `config.dev.toml` to disable caching when testing changes

## Key Files Reference
- `src/main.rs`: Server configuration, header management, graceful shutdown
- `index.html`: Complete client-side logic (FFmpeg.wasm integration, batch processing)
- `config.toml` / `config.dev.toml`: Environment-specific caching strategies
- `Dockerfile`: Multi-stage build pattern with security hardening
- `docker-compose.yml`: Production deployment configuration
- `.github/workflows/ci-cd.yml`: Main CI/CD pipeline (build, lint, test, Docker)
- `.github/workflows/release.yml`: Release automation (binaries, multi-arch images)
