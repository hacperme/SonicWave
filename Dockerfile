# 多阶段构建 Rust 静态文件服务器
FROM rust:1.91-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache musl-dev

WORKDIR /build

# 复制依赖清单并预构建依赖（利用 Docker 缓存）
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# 复制源代码并重新构建
COPY src ./src
RUN touch src/main.rs && cargo build --release

# 最终镜像 - 使用精简的 Alpine
FROM alpine:3.19

# 安装 wget 用于健康检查
RUN apk add --no-cache wget

# 创建非 root 用户
RUN addgroup -g 1000 sonicwave && adduser -D -u 1000 -G sonicwave sonicwave

WORKDIR /app

# 复制编译好的二进制文件
COPY --from=builder /build/target/release/sonic-wave /app/sonic-wave

# 复制静态文件
COPY index.html ./
COPY assets ./assets

# 复制配置文件
COPY config.toml ./

# 修改文件所有者
RUN chown -R sonicwave:sonicwave /app

# 切换到非 root 用户
USER sonicwave

# 暴露端口（默认 8089，可通过环境变量覆盖）
EXPOSE 8089

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/bin/sh", "-c", "wget --no-verbose --tries=1 --spider http://localhost:8089/ || exit 1"]

# 设置环境变量
ENV PORT=8089

# 运行服务器
CMD ["/app/sonic-wave"]
