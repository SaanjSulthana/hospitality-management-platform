{
  "id": "hospitality-management-platform-cr8i", 
  "lang": "typescript",
  "http": {
    "max_body_size": 33554432
  },
  "secrets": {
    "JWTSecret": {
      "description": "Secret key for JWT access tokens"
    },
    "RefreshSecret": {
      "description": "Secret key for JWT refresh tokens"
    },
    "OpenAI_API_Key": {
      "description": "OpenAI API key for LLM document extraction"
    },
    "RedisPassword": {
      "description": "Redis Cloud password for idempotency and caching"
    }
  },
  "global_cors": {
    "allow_origins_without_credentials": [
      "http://localhost:5173",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app"
    ],
    "allow_origins_with_credentials": [
      "http://localhost:5173",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app"
    ],
    "allow_headers": [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Idempotency-Key",
      "If-None-Match",
      "If-Modified-Since"
    ],
    "expose_headers": [
      "Content-Length",
      "ETag",
      "Last-Modified",
      "Cache-Control",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
      "Idempotent-Replayed",
      "X-Fields-Returned",
      "X-Fields-Available"
    ],
    "max_age_seconds": 7200
  }
}