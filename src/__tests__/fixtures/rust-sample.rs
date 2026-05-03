use std::env;
use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use reqwest::Client;
use tokio::main;
use tracing::{info, error, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse<T> {
    data: Option<T>,
    error: Option<String>,
    success: bool,
}

pub struct AppState {
    config: Config,
    client: Client,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    pub async fn fetch_data(&self, url: &str) -> Result<ApiResponse<HashMap<String, String>>, reqwest::Error> {
        let api_key = env::var("RS_API_KEY").unwrap_or_default();
        let resp = self.client
            .get(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await?;
        resp.json().await
    }
}

pub fn load_config() -> Config {
    Config {
        host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
        port: env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse()
            .unwrap_or(8080),
        database_url: env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/shadow".to_string()),
    }
}

fn helper_function(value: i32) -> i32 {
    value * 2
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = load_config();
    let state = AppState::new(config);

    info!("Starting Rust application");

    match state.fetch_data("https://api.example.com/data").await {
        Ok(response) => info!("Data fetched: {:?}", response),
        Err(e) => error!("Failed to fetch data: {}", e),
    }
}
