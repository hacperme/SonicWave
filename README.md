# 🎵 Sonic Wave

> 快速、安全、客户端音频转换工具 - 支持多格式转换，零服务器上传

**Sonic Wave** 是一个基于 FFmpeg.wasm 的纯前端音频转换工具，所有处理都在浏览器中完成，保护您的隐私。

## ✨ 特性

- 🚀 **纯客户端处理** - 文件不上传服务器，隐私安全
- 🎯 **多格式支持** - MP3, WAV, AAC/M4A, OGG Vorbis, FLAC
- 📦 **批量转换** - 一次处理多个文件，支持打包下载
- 🔧 **参数可调** - 自定义比特率、采样率、声道
- ⚡ **零依赖** - 所有库文件本地化，无需网络请求
- 🐳 **Docker 支持** - 一键部署到任何服务器

## 快速开始

### 方式 1: Docker (推荐，一键部署)

```powershell
# 构建并运行
docker-compose up -d

# 或使用 docker 命令
docker build -t sonic-wave .
docker run -d -p 8089:8089 --name sonic-wave sonic-wave

# 访问
# http://localhost:8089
```

### 方式 2: 直接运行可执行文件
```powershell
.\target\release\sonic-wave.exe
```

### 方式 2: 通过配置文件
编辑 `config.toml`:
```toml
port = 9000
static_dir = "."
```

### 方式 3: 通过环境变量（优先级最高）
```powershell
$env:PORT=9000; .\target\release\sonic-wave.exe
```

或同时设置多个：
```powershell
$env:PORT=9000; $env:STATIC_DIR="./public"; .\target\release\sonic-wave.exe
```

## 配置优先级
环境变量 > config.toml > 默认值 (8089)

## 默认配置
- 端口: 8089
- 静态目录: 当前目录 (.)
- Headers: COOP/COEP 已启用
- 缓存策略: `public, max-age=31536000, immutable` (生产环境优化)

## 缓存策略说明

### 生产环境 (默认)
```toml
cache_control = "public, max-age=31536000, immutable"
```
- 静态资源缓存 1 年
- 提升性能，减少带宽消耗
- 适合部署到服务器

### 开发环境
使用 `config.dev.toml`:
```powershell
Copy-Item config.dev.toml config.toml; .\target\release\audio-server.exe
```
或直接编辑 `config.toml`:
```toml
cache_control = "no-cache, no-store, must-revalidate"
```

## Docker 部署详细说明

### Docker 命令参数

**自定义端口**:
```powershell
docker run -d -p 9000:9000 -e PORT=9000 --name audio-converter audio-converter
```

**挂载自定义配置**:
```powershell
docker run -d -p 8089:8089 -v ${PWD}/config.toml:/app/config.toml:ro --name audio-converter audio-converter
```

**查看日志**:
```powershell
docker logs -f sonic-wave
```

**停止/重启**:
```powershell
docker stop sonic-wave
docker restart sonic-wave
```

### 镜像构建优化

镜像使用多阶段构建，最终大小约 **50MB**（相比完整 Rust 镜像节省 >90% 空间）

**生产环境推荐**: 使用 Docker Compose 管理
```powershell
# 启动
docker-compose up -d

# 查看状态
docker-compose ps

# 停止
docker-compose down
```
