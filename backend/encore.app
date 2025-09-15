{
  "id": "hospitality-management-platform-cr8i", 
  "lang": "typescript",
  "secrets": {
    "JWTSecret": {
      "description": "Secret key for JWT access tokens"
    },
    "RefreshSecret": {
      "description": "Secret key for JWT refresh tokens"
    }
  },
  "global_cors": {
    "allow_origins_without_credentials": [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app",
      "https://www.curat.ai"
    ],
    "allow_origins_with_credentials": [
      "http://localhost:5173",
      "http://localhost:5174",
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
    ]
  }
}