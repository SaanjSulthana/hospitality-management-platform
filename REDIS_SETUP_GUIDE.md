# 🚀 Local Redis Setup Guide

This guide will help you set up Redis locally for your Hospitality Management Platform.

## 📋 Prerequisites

- **Docker Desktop** installed and running
- Basic knowledge of command line

## 🎯 Quick Setup (Recommended)

### Step 1: Start Redis with Docker

Your project already has Redis configured in `docker-compose.yml`. Simply start it:

```bash
# Start Redis (and PostgreSQL if needed)
docker-compose up -d redis

# Or start both PostgreSQL and Redis
docker-compose up -d postgres redis
```

### Step 2: Verify Redis is Running

```bash
# Check if Redis container is running
docker ps | grep redis

# Test Redis connection
docker exec -it hospitality-redis redis-cli ping
# Expected output: PONG
```

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory (if you don't have one) and add:

```bash
# Redis Configuration for Local Development
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # Leave empty for local development (no password)
REDIS_USE_TLS=false
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=5000
```

**Note:** The local Redis setup doesn't require a password by default.

### Step 4: Test the Connection

Start your backend and check the logs:

```bash
cd backend
encore run
```

You should see:
```
[RedisCache] ✅ Connected to external Redis at localhost:6379
```

## 🔧 Alternative: Install Redis Directly (Without Docker)

### Windows

#### Option 1: Using WSL2 (Recommended)
```bash
# In WSL2 terminal
sudo apt update
sudo apt install redis-server -y

# Start Redis
sudo service redis-server start

# Test
redis-cli ping
```

#### Option 2: Using Memurai (Windows Native)
1. Download from: https://www.memurai.com/
2. Install and start the service
3. Redis will run on `localhost:6379` by default

### macOS

```bash
# Using Homebrew
brew install redis

# Start Redis
brew services start redis

# Or run manually
redis-server

# Test
redis-cli ping
```

### Linux

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install redis-server -y

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test
redis-cli ping
```

## 🧪 Testing Redis Connection

### Method 1: Using Docker Exec

```bash
# Connect to Redis CLI
docker exec -it hospitality-redis redis-cli

# Test commands
PING                    # Should return PONG
SET test "Hello Redis"  # Set a key
GET test                # Get the key (should return "Hello Redis")
DEL test                # Delete the key
INFO                    # Get Redis server information
EXIT                    # Exit CLI
```

### Method 2: Using redis-cli (if installed locally)

```bash
# Connect to local Redis
redis-cli -h localhost -p 6379

# Or if password is set
redis-cli -h localhost -p 6379 -a your-password
```

### Method 3: Test from Node.js

Create a test file `test-redis.js`:

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

redis.ping()
  .then(() => {
    console.log('✅ Redis connection successful!');
    return redis.set('test', 'Hello Redis');
  })
  .then(() => {
    return redis.get('test');
  })
  .then((value) => {
    console.log('✅ Test value:', value);
    redis.quit();
  })
  .catch((error) => {
    console.error('❌ Redis connection failed:', error);
  });
```

Run it:
```bash
node test-redis.js
```

## 🔒 Securing Redis (Optional for Local Development)

For local development, Redis without a password is fine. However, if you want to add a password:

### Using Docker Compose

Update `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: hospitality-redis
  command: redis-server --requirepass your-secure-password
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

Then update your `.env`:
```bash
REDIS_PASSWORD=your-secure-password
```

## 📊 Redis Management Tools

### Option 1: Redis Insight (Free GUI)

1. Download from: https://redis.com/redis-enterprise/redis-insight/
2. Connect to `localhost:6379`
3. No password needed for local setup

### Option 2: Redis Commander (Web-based)

```bash
# Install globally
npm install -g redis-commander

# Run
redis-commander

# Access at http://localhost:8081
```

### Option 3: Another Redis Desktop Manager

1. Download from: https://github.com/qishibo/AnotherRedisDesktopManager
2. Connect to `localhost:6379`

## 🐛 Troubleshooting

### Issue 1: Redis Container Won't Start

```bash
# Check Docker logs
docker logs hospitality-redis

# Restart the container
docker restart hospitality-redis

# Remove and recreate
docker-compose down redis
docker-compose up -d redis
```

### Issue 2: Connection Refused

```bash
# Check if Redis is listening on port 6379
# Windows
netstat -an | findstr 6379

# macOS/Linux
lsof -i :6379
# or
netstat -an | grep 6379

# If nothing shows, Redis isn't running
```

### Issue 3: Port Already in Use

```bash
# Find what's using port 6379
# Windows
netstat -ano | findstr :6379

# macOS/Linux
lsof -i :6379

# Kill the process or change Redis port in docker-compose.yml
```

### Issue 4: Backend Can't Connect to Redis

1. **Check environment variables:**
   ```bash
   # Make sure REDIS_HOST is set
   echo $REDIS_HOST  # Linux/macOS
   echo %REDIS_HOST% # Windows CMD
   $env:REDIS_HOST   # Windows PowerShell
   ```

2. **Verify Redis is accessible:**
   ```bash
   # From your host machine
   telnet localhost 6379
   # Or
   nc -zv localhost 6379
   ```

3. **Check backend logs** for specific error messages

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_HOST` | Redis server hostname | - | Yes (to enable Redis) |
| `REDIS_PORT` | Redis server port | `6379` | No |
| `REDIS_PASSWORD` | Redis password | - | No (for local dev) |
| `REDIS_USE_TLS` | Enable TLS encryption | `false` | No |
| `REDIS_MAX_RETRIES` | Max connection retries | `3` | No |
| `REDIS_CONNECT_TIMEOUT` | Connection timeout (ms) | `5000` | No |

## ✅ Verification Checklist

- [ ] Docker Desktop is running
- [ ] Redis container is running (`docker ps`)
- [ ] Redis responds to PING (`docker exec -it hospitality-redis redis-cli ping`)
- [ ] `.env` file has `REDIS_HOST=localhost`
- [ ] Backend logs show: `✅ Connected to external Redis`
- [ ] Application can cache data successfully

## 🎉 Next Steps

Once Redis is set up:

1. **Monitor Redis usage:**
   ```bash
   docker exec -it hospitality-redis redis-cli INFO stats
   ```

2. **Check cache keys:**
   ```bash
   docker exec -it hospitality-redis redis-cli KEYS "*"
   ```

3. **Monitor memory usage:**
   ```bash
   docker exec -it hospitality-redis redis-cli INFO memory
   ```

4. **Clear cache if needed:**
   ```bash
   docker exec -it hospitality-redis redis-cli FLUSHDB
   ```

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/docs/)
- [ioredis (Node.js Redis Client)](https://github.com/redis/ioredis)
- [Docker Redis Image](https://hub.docker.com/_/redis)

---

**Need Help?** Check the backend logs or Redis container logs for detailed error messages.


