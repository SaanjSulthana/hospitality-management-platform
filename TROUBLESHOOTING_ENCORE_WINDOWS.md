# Troubleshooting Encore on Windows

## 🔴 Error: Socket Bind Error (10013)

### Problem
```
ERR pingora_core::services::listening > Listen() failed: BindError context: bind() failed on 127.0.0.1:50838 
cause: An attempt was made to access a socket in a way forbidden by its access permissions. (os error 10013)
```

This is a **Windows-specific** issue where Encore/Pingora cannot bind to an ephemeral port due to Windows port restrictions.

### Solutions

#### Solution 1: Check Windows Reserved Port Ranges (Recommended)

Windows reserves certain port ranges that applications cannot use. Check and adjust:

```powershell
# Run PowerShell as Administrator

# Check current excluded port ranges
netsh interface ipv4 show excludedportrange protocol=tcp

# If port 50838 is in a reserved range, you can exclude that specific range
# Example: Exclude ports 50800-50900 (if that's the problematic range)
# Note: This requires careful consideration of your system's port usage
```

**Important:** Be cautious when modifying Windows port ranges. Only do this if you understand the implications.

#### Solution 2: Run Encore as Administrator

Try running Encore with administrator privileges:

```powershell
# Right-click PowerShell and select "Run as Administrator"
cd backend
encore run
```

**Note:** This is a temporary workaround. Not recommended for production.

#### Solution 3: Check for Port Conflicts

Check if something else is using port 50838:

```powershell
# Check what's using the port
netstat -ano | findstr :50838

# If something is using it, you can kill it (replace PID with actual process ID)
taskkill /F /PID <PID>
```

#### Solution 4: Check Windows Firewall

Ensure Windows Firewall isn't blocking Encore:

```powershell
# Allow Encore through Windows Firewall
New-NetFirewallRule -DisplayName "Encore Development" -Direction Inbound -Program "C:\path\to\encore.exe" -Action Allow
```

#### Solution 5: Check Antivirus/Anti-Malware

Some antivirus software can block socket binding. Temporarily disable or add Encore to exclusions:

1. Open your antivirus settings
2. Add Encore executable to exclusions/whitelist
3. Try running Encore again

### Why This Happens

- Windows reserves certain port ranges for system use
- Port 50838 falls in the ephemeral port range (49152-65535)
- Windows may have excluded this specific port range
- Antivirus or security software may be blocking it

### Is This Critical?

**No, this error is usually non-critical.** Encore will typically:
- Try other ports automatically
- Continue running despite the error
- Still serve your application

If your application is working correctly, you can safely ignore this warning.

---

## ⚠️ Warning: Redis Cache Not Configured

### Problem
```
[RedisCache] No REDIS_HOST configured, using in-memory cache
[AlertingSystem] 🚨 WARNING: Cache Redis Down - Redis cache is not available, falling back to memory cache
```

### Solution

This is **expected behavior** for local development. You have two options:

#### Option 1: Use In-Memory Cache (Current - No Action Needed)

This is fine for development. The application will work with in-memory caching.

#### Option 2: Set Up Redis (For Production-like Development)

1. **Start Redis using Docker** (if not already running):

```powershell
docker-compose up -d redis
```

2. **Set Environment Variables**:

Create a `.env` file in the `backend` directory or set environment variables:

```powershell
# For local development
$env:REDIS_HOST="localhost"
$env:REDIS_PORT="6379"
$env:REDIS_USE_TLS="false"
```

Or create `backend/.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USE_TLS=false
```

3. **Restart Encore**:

```powershell
# Stop Encore (Ctrl+C)
# Then restart
cd backend
encore run
```

### Verification

After setting up Redis, you should see:
```
[RedisCache] ✅ Connected to external Redis at localhost:6379
```

---

## ✅ Quick Fix Checklist

1. **Socket Bind Error (10013)**:
   - [ ] Verify application is still working (error may be non-critical)
   - [ ] Try running as administrator (if needed)
   - [ ] Check Windows port exclusions
   - [ ] Verify firewall/antivirus isn't blocking

2. **Redis Warning**:
   - [ ] Decide: Use in-memory (fine for dev) or set up Redis
   - [ ] If Redis: Start Docker container (`docker-compose up -d redis`)
   - [ ] If Redis: Set `REDIS_HOST=localhost` environment variable
   - [ ] Restart Encore

---

## 🎯 Recommended Development Setup

For local development, this setup is sufficient:

1. **PostgreSQL**: Running via Docker ✅
2. **Redis**: Optional (in-memory cache works fine) ⚠️
3. **Encore**: Running (socket errors can be ignored if app works) ✅

**Bottom Line**: If your application is working correctly, you can safely ignore both warnings. They don't prevent the application from functioning.

---

## 📞 Getting More Help

If issues persist:

1. **Check Encore Logs**: Look for actual errors (not warnings)
2. **Verify Services**: Ensure PostgreSQL is running (`docker-compose ps`)
3. **Check Network**: Verify localhost connectivity
4. **Encore Docs**: [https://encore.dev/docs](https://encore.dev/docs)

---

## 🔍 Additional Debugging Commands

```powershell
# Check if Docker services are running
docker-compose ps

# Check Encore process
Get-Process encore -ErrorAction SilentlyContinue

# Check port usage
netstat -ano | findstr :4000  # Encore's main port
netstat -ano | findstr :6379  # Redis port
netstat -ano | findstr :5432  # PostgreSQL port

# View Docker logs
docker-compose logs postgres
docker-compose logs redis
```






