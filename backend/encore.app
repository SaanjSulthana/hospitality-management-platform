{
  "id": "hospitality-management-platform-cr8i", 
  "lang": "typescript",
  "http": {
    "max_body_size": 524288000
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
    }
  },
  "global_cors": {
    "allow_origins_without_credentials": [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:5177",
      "http://localhost:5178",
      "http://localhost:5179",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app",
      "https://www.curat.ai"
    ],
    "allow_origins_with_credentials": [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "http://localhost:5177",
      "http://localhost:5178",
      "http://localhost:5179",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app",
      "https://www.curat.ai"
    ],
    "allow_headers": [
      "Content-Type",
      "Authorization",
      "X-Requested-With"
    ],
    "expose_headers": [
      "Content-Length"
    ],
    "max_age_seconds": 7200
  }
}