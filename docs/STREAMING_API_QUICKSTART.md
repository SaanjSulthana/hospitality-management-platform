# 🚀 Encore Streaming API - Quick Start Guide

Get started with the new WebSocket-based streaming in 5 minutes!

---

## 📋 Prerequisites

- Encore CLI installed
- Node.js 18+
- PostgreSQL running
- Access token for testing

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### Step 2: Run Database Migrations

```bash
# Run chat tables migration
cd backend/realtime
encore db migrate
```

### Step 3: Start Development Server

```bash
# Backend (Encore)
cd backend
encore run

# Frontend (Vite)
cd frontend
npm run dev
```

### Step 4: Enable Streaming Feature Flag

```bash
# Set environment variable or feature flag
export REALTIME_STREAMING_V2=true
export REALTIME_ROLLOUT_PERCENT=100
```

### Step 5: Test WebSocket Connection

```bash
# Install wscat for testing
npm install -g wscat

# Get your access token
TOKEN="your_access_token_here"

# Connect to streaming endpoint
wscat -c "ws://localhost:4000/v2/realtime/stream" \
  -H "Authorization: Bearer $TOKEN"

# Send handshake
> {"services": ["finance", "guest", "staff"], "version": 1}

# You should receive:
< {"type": "ack", "seq": 0, "timestamp": "..."}
```

---

## 🎯 Usage Examples

### Example 1: Realtime Events (StreamOut)

**Mount provider in your app:**

```tsx
// src/App.tsx
import RealtimeProviderV2 from './providers/RealtimeProviderV2';

function App() {
  return (
    <AuthProvider>
      <RealtimeProviderV2 />
      {/* Your app components */}
    </AuthProvider>
  );
}
```

**Listen for events:**

```typescript
// Any component
useEffect(() => {
  const handleFinanceEvents = (event: CustomEvent) => {
    const { events } = event.detail;
    console.log('Finance events received:', events);
    
    // Update UI, invalidate queries, etc.
    queryClient.invalidateQueries(['finance']);
  };

  window.addEventListener('finance-stream-events', handleFinanceEvents);

  return () => {
    window.removeEventListener('finance-stream-events', handleFinanceEvents);
  };
}, []);
```

**Health monitoring:**

```typescript
useEffect(() => {
  const handleHealthUpdate = (event: CustomEvent) => {
    const { healthy, lastEventAt } = event.detail;
    setIsLive(healthy);
    setLastUpdateTime(lastEventAt);
  };

  window.addEventListener('finance-stream-health', handleHealthUpdate);

  return () => {
    window.removeEventListener('finance-stream-health', handleHealthUpdate);
  };
}, []);
```

### Example 2: File Upload (StreamIn)

```tsx
import { StreamingDocumentUpload } from '@/components/StreamingDocumentUpload';

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      {file && (
        <StreamingDocumentUpload
          file={file}
          documentType="aadhaar"
          guestId={123}
          propertyId={456}
          onProgress={(percent) => console.log(`Upload: ${percent}%`)}
          onComplete={(response) => {
            console.log('Upload complete!', response.fileId);
            toast.success('Document uploaded successfully');
            refetchDocuments();
          }}
          onError={(error) => {
            console.error('Upload failed:', error);
            toast.error(error.message);
          }}
          autoStart
        />
      )}
    </div>
  );
}
```

### Example 3: Real-Time Chat (StreamInOut)

```tsx
import { CollaborativeChat } from '@/components/CollaborativeChat';

function PropertyPage({ propertyId }: { propertyId: number }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Property content */}
      <div>
        <PropertyDetails propertyId={propertyId} />
      </div>

      {/* Chat sidebar */}
      <div>
        <CollaborativeChat
          roomId={`property-${propertyId}`}
          onMessageSent={(msg) => console.log('Sent:', msg)}
          onMessageReceived={(msg) => {
            console.log('Received:', msg);
            // Show notification if minimized
          }}
          showOnlineUsers
          autoScroll
        />
      </div>
    </div>
  );
}
```

---

## 🧪 Testing

### Test Realtime Events

```bash
# Terminal 1: Start backend
cd backend
encore run

# Terminal 2: Connect with wscat
wscat -c "ws://localhost:4000/v2/realtime/stream" \
  -H "Authorization: Bearer $TOKEN"

# Send handshake
> {"services": ["finance"], "version": 1}

# Terminal 3: Create a revenue
curl -X POST http://localhost:4000/finance/revenue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "source": "Room Booking",
    "propertyId": 1,
    "transactionDate": "2024-11-27",
    "paymentMode": "cash"
  }'

# Terminal 2: You should receive event in <100ms
< {"type":"event","service":"finance","events":[{...}],"seq":1}
```

### Test File Upload

```bash
# Upload a file using curl (simulating chunks)
curl -N -X POST http://localhost:4000/v2/documents/upload/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  --data-binary @test-document.pdf
```

### Test Chat

```bash
# Terminal 1: User A
wscat -c "ws://localhost:4000/v2/collaboration/chat/stream" \
  -H "Authorization: Bearer $TOKEN_USER_A"

> {"roomId": "property-123", "userId": 1}

# Terminal 2: User B
wscat -c "ws://localhost:4000/v2/collaboration/chat/stream" \
  -H "Authorization: Bearer $TOKEN_USER_B"

> {"roomId": "property-123", "userId": 2}

# Terminal 1: Send message
> {"type": "chat", "text": "Hello!", "roomId": "property-123"}

# Terminal 2: Receive message
< {"type":"chat","id":"...","userId":1,"userName":"User A","text":"Hello!"}
```

---

## 📊 Monitoring

### Check Metrics

```bash
curl http://localhost:4000/v2/realtime/metrics \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**

```json
{
  "activeConnections": 5,
  "totalConnections": 25,
  "eventsDelivered": 1250,
  "eventsByService": {
    "finance": 500,
    "guest": 300,
    "staff": 250,
    "tasks": 100,
    "properties": 50,
    "users": 30,
    "dashboard": 10,
    "branding": 5,
    "analytics": 5,
    "reports": 0
  },
  "errorCount": 0,
  "avgLatencyMs": 45
}
```

### Check Chat Room Stats

```bash
curl http://localhost:4000/v2/collaboration/rooms/property-123/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**

```json
{
  "activeConnections": 3,
  "totalMessages": 127,
  "unreadMessages": 5
}
```

---

## 🚨 Troubleshooting

### WebSocket Connection Fails

**Symptom:**
```
[RealtimeV2][error] WebSocket connection failed
```

**Fix:**
```bash
# 1. Check if Encore is running
curl http://localhost:4000/health

# 2. Check if token is valid
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Check Encore logs
encore logs
```

### Events Not Received

**Symptom:**
```
[RealtimeV2][connected] but no events received
```

**Fix:**
```typescript
// Check if services are subscribed
console.log('Subscribed services:', handshake.services);

// Verify orgId matches
console.log('My orgId:', user.orgId);
console.log('Event orgId:', event.orgId);

// Check Pub/Sub is publishing
// Look for logs like:
// [Finance][event-published] eventId: ...
```

### High Latency

**Symptom:**
```
avgLatencyMs: 500 (should be <100ms)
```

**Fix:**
```bash
# 1. Check system load
top

# 2. Check network latency
ping localhost

# 3. Check for slow Pub/Sub subscribers
encore trace

# 4. Increase batch window if needed
# In unified_stream.ts:
BATCH_WINDOW_MS: 100 // From 50ms
```

---

## 🎯 Next Steps

1. ✅ Complete Quick Start
2. 📖 Read [STREAMING_MIGRATION.md](./STREAMING_MIGRATION.md)
3. 🧪 Run unit tests: `npm test`
4. 🚀 Enable feature flags for your org
5. 📊 Set up monitoring dashboard
6. 🔔 Configure alerts
7. 🎉 Deploy to production!

---

## 📚 Additional Resources

- [Streaming Migration Guide](./STREAMING_MIGRATION.md)
- [Implementation Complete](./STREAMING_API_IMPLEMENTATION_COMPLETE.md)
- [Encore Streaming Docs](https://encore.dev/docs/develop/streaming)
- [WebSocket MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Happy Streaming! 🚀**

