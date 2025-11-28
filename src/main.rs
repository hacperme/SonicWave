use axum::body::Body;
use axum::http::{header, HeaderValue, Request, Response};
use axum::{routing::get_service, Router};
use serde::Deserialize;
use std::fs;
use std::net::SocketAddr;
use std::task::{Context, Poll};
use tower::ServiceBuilder;
use tower::Service;
use tower_http::{services::ServeDir, set_header::SetResponseHeaderLayer};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// 自定义中间件：根据文件类型设置不同的缓存策略
#[derive(Clone)]
struct CacheControlService<S> {
    inner: S,
    static_cache: String,
    html_cache: String,
}

impl<S> Service<Request<Body>> for CacheControlService<S>
where
    S: Service<Request<Body>, Response = Response<Body>> + Clone + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = std::pin::Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        let mut inner = self.inner.clone();
        let path = req.uri().path().to_string();
        let static_cache = self.static_cache.clone();
        let html_cache = self.html_cache.clone();

        Box::pin(async move {
            let mut response = inner.call(req).await?;
            
            // 根据文件扩展名设置缓存策略
            let cache_value = if path.ends_with(".html") || path.ends_with("/") || !path.contains('.') {
                &html_cache
            } else {
                &static_cache
            };

            if let Ok(header_value) = HeaderValue::from_str(cache_value) {
                response.headers_mut().insert(header::CACHE_CONTROL, header_value);
            }

            Ok(response)
        })
    }
}

#[derive(Deserialize, Debug)]
struct Config {
    port: Option<u16>,
    static_dir: Option<String>,
    #[serde(default = "default_cache_control")]
    cache_control: String,
    #[serde(default = "default_html_cache_control")]
    html_cache_control: String,
}

fn default_cache_control() -> String {
    "public, max-age=31536000, immutable".to_string()
}

fn default_html_cache_control() -> String {
    "no-cache, must-revalidate".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Config {
            port: Some(8089),
            static_dir: Some(".".to_string()),
            cache_control: default_cache_control(),
            html_cache_control: default_html_cache_control(),
        }
    }
}

fn load_config() -> Config {
    // 优先级: 环境变量 > 配置文件 > 默认值
    let mut config = if let Ok(content) = fs::read_to_string("config.toml") {
        match toml::from_str(&content) {
            Ok(cfg) => cfg,
            Err(e) => {
                warn!("Failed to parse config.toml: {}, using defaults", e);
                Config::default()
            }
        }
    } else {
        info!("No config.toml found, using defaults");
        Config::default()
    };

    // 环境变量覆盖
    if let Ok(port_str) = std::env::var("PORT") {
        if let Ok(port) = port_str.parse::<u16>() {
            info!("Port overridden by env: {}", port);
            config.port = Some(port);
        }
    }

    if let Ok(dir) = std::env::var("STATIC_DIR") {
        info!("Static dir overridden by env: {}", dir);
        config.static_dir = Some(dir);
    }

    config
}

#[tokio::main]
async fn main() {
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "sonic_wave=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = load_config();
    let port = config.port.unwrap_or(8089);
    let static_dir = config.static_dir.unwrap_or_else(|| ".".to_string());
    let cache_control = config.cache_control.clone();
    let html_cache_control = config.html_cache_control.clone();

    info!("Starting Sonic Wave server");
    info!("Port: {}", port);
    info!("Static directory: {}", static_dir);
    info!("Cache-Control (static): {}", cache_control);
    info!("Cache-Control (HTML): {}", html_cache_control);

    // 配置静态文件服务
    let serve_dir = ServeDir::new(&static_dir);

    // 构建路由，添加 COOP/COEP headers 和动态缓存策略
    let app = Router::new().fallback_service(
        ServiceBuilder::new()
            .layer(SetResponseHeaderLayer::if_not_present(
                header::HeaderName::from_static("cross-origin-opener-policy"),
                HeaderValue::from_static("same-origin"),
            ))
            .layer(SetResponseHeaderLayer::if_not_present(
                header::HeaderName::from_static("cross-origin-embedder-policy"),
                HeaderValue::from_static("require-corp"),
            ))
            .layer(tower::layer::layer_fn(move |service| {
                CacheControlService {
                    inner: service,
                    static_cache: cache_control.clone(),
                    html_cache: html_cache_control.clone(),
                }
            }))
            .service(get_service(serve_dir)),
    );

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🎵 Sonic Wave Server");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("🌐 Listening on: http://0.0.0.0:{}", port);
    println!("📁 Static directory: {}", static_dir);
    println!("🔒 Headers: COOP/COEP enabled");
    println!("💾 Cache-Control:");
    println!("   HTML files: {}", config.html_cache_control);
    println!("   Static assets: {}", config.cache_control);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("✨ Configuration priority: ENV > config.toml > default");
    println!("   PORT={}", port);
    println!("   STATIC_DIR={}", static_dir);
    println!("\n🛑 Press Ctrl+C to stop the server\n");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind address");

    info!("Server ready, listening on {}", addr);

    // 优雅关闭
    let server = axum::serve(listener, app).with_graceful_shutdown(shutdown_signal());

    if let Err(e) = server.await {
        tracing::error!("Server error: {}", e);
    }

    info!("Server stopped");
}

async fn shutdown_signal() {
    use tokio::signal;

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down gracefully...");
        },
        _ = terminate => {
            info!("Received SIGTERM, shutting down gracefully...");
        },
    }
}
