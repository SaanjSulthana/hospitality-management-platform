# Complete Tech Stack Analysis & Future Development Guide

**Generated**: 2025-01-27  
**Platform**: Hospitality Management Platform  
**Scale Target**: 1M Organizations (1M × 5 properties × 5 users)

---

## 📋 Table of Contents

1. [Backend Stack](#backend-stack)
2. [Frontend Stack](#frontend-stack)
3. [Database & Storage](#database--storage)
4. [Real-time & Pub/Sub](#real-time--pubsub)
5. [Caching Strategy](#caching-strategy)
6. [Authentication & Security](#authentication--security)
7. [Infrastructure & DevOps](#infrastructure--devops)
8. [Monitoring & Observability](#monitoring--observability)
9. [Testing Framework](#testing-framework)
10. [Future Development Recommendations](#future-development-recommendations)

---

## 🎯 Backend Stack

### Core Framework
- **Encore.ts** (`encore.dev` v1.51.5)
  - **Location**: `backend/encore.app`, all service files
  - **Usage**: Type-safe microservices framework
  - **Features Used**:
    - SQL databases with migrations
    - Pub/Sub topics and subscriptions
    - Cron jobs
    - Object storage buckets
    - Service gateways
    - Type-safe API generation

### Runtime & Package Manager
- **Bun** (v1.2.21)
  - **Location**: Root `package.json`, `backend/package.json`
  - **Usage**: Package manager, runtime, and build tool
  - **Benefits**: Fast installs, native TypeScript support

### Language
- **TypeScript** (v5.9.2)
  - **Location**: All `.ts` files
  - **Config**: `backend/tsconfig.json` (ES2022 target, strict mode)
  - **Features**: Full type safety, strict null checks

### Services Architecture
**23 Encore Services Deployed:**
1. `auth` - Authentication & authorization
2. `finance` - Financial transactions & realtime
3. `reports` - Analytics & reporting
4. `guest-checkin` - Guest management & documents
5. `tasks` - Task management
6. `staff` - Staff management
7. `properties` - Property management
8. `users` - User management
9. `analytics` - Analytics service
10. `branding` - White-label branding
11. `documents` - Document generation
12. `uploads` - File upload handling
13. `cache` - Caching service
14. `monitoring` - Observability
15. `telemetry` - Client telemetry ingestion
16. `eventsourcing` - Event store
17. `config` - Configuration
18. `orgs` - Organization management
19. `communication` - Communication gateway
20. `resilience` - Circuit breakers, retries
21. `validation` - Input validation
22. `shared` - Shared utilities
23. `database` - Database utilities

---

## 🎨 Frontend Stack

### Core Framework
- **React** (v19.1.1)
  - **Location**: `frontend/`
  - **Features**: Hooks, Context API, Concurrent features
  - **Config**: `frontend/tsconfig.json`

### Build Tool
- **Vite** (v6.3.5)
  - **Location**: `frontend/vite.config.ts`
  - **Features**:
    - HMR (Hot Module Replacement)
    - Dev proxy for `/finance/realtime/*` (CORS reduction)
    - Lightning-fast builds

### State Management
- **TanStack Query** (v5.85.3) (formerly React Query)
  - **Location**: All page components
  - **Usage**:
    - Server state management
    - Cache invalidation
    - Optimistic updates
    - Dynamic `staleTime` based on realtime health

### Routing
- **React Router DOM** (v7.8.1)
  - **Location**: `frontend/App.tsx`, `frontend/main.tsx`
  - **Features**: Client-side routing, protected routes

### UI Framework
- **shadcn/ui** (Radix UI primitives)
  - **Location**: `frontend/components/ui/`
  - **Components Used**:
    - `@radix-ui/react-dialog`
    - `@radix-ui/react-select`
    - `@radix-ui/react-tabs`
    - `@radix-ui/react-toast`
    - `@radix-ui/react-checkbox`
    - `@radix-ui/react-label`
    - `@radix-ui/react-avatar`
    - `@radix-ui/react-slot`

### Styling
- **Tailwind CSS** (v4.1.12)
  - **Location**: `frontend/tailwind.config.js`, `frontend/index.css`
  - **Features**:
    - Utility-first CSS
    - Custom theming per organization
    - Mobile-first responsive design
    - `@tailwindcss/vite` plugin

### Animations
- **Framer Motion** (v12.23.12)
  - **Location**: Various components
  - **Usage**: Smooth transitions, page animations

### Icons
- **Lucide React** (v0.484.0)
  - **Location**: Throughout components
  - **Usage**: Consistent icon system

### Utilities
- **date-fns** (v2.30.0) - Date formatting
- **class-variance-authority** (v0.7.1) - Component variants
- **clsx** (v2.1.1) - Conditional classnames
- **tailwind-merge** (v3.3.1) - Tailwind class merging
- **react-dropzone** (v14.3.8) - File uploads

---

## 🗄️ Database & Storage

### Primary Database
- **PostgreSQL** (via Encore SQLDatabase)
  - **Location**: All `backend/*/db.ts` files
  - **Databases**:
    1. `hospitality` - Main application DB
    2. `finance` - Financial transactions
    3. `guest_checkin_db` - Guest check-in data
    4. `event_store` - Event sourcing events
    5. `read_models` - Materialized read models
    6. `health_check_db` - Health monitoring
    7. `shared` - Cross-service shared data

### Database Features
- **Partitioning**:
  - Hash partitioning: `daily_cash_balances_partitioned` (16 partitions by org_id)
  - Range partitioning: `revenues_partitioned`, `expenses_partitioned` (12 monthly partitions)
  - **Location**: `backend/database/partitioning_manager.ts`
  
- **Read Replicas**:
  - Round-robin load balancing
  - Health checks with failover
  - **Location**: `backend/database/replica_manager.ts`

- **Migrations**:
  - Encore-managed migrations
  - Location: `backend/*/migrations/*.sql`
  - Command: `encore db migrate`

### Object Storage
- **Encore Cloud Storage** (S3-compatible)
  - **Location**: `backend/storage/buckets.ts`
  - **Buckets**:
    1. `receipts` (Private) - Finance receipts
    2. `guest-documents` (Private) - ID documents
    3. `task-images` (Public) - Task attachments
    4. `logos` (Public) - Organization logos
  - **Features**: Signed URLs, CDN support, automatic scaling

### File Storage (Legacy)
- **Local File System**
  - **Location**: `backend/uploads/`
  - **Status**: Hybrid (new files → cloud, legacy → disk)
  - **Migration**: In progress to Encore buckets

---

## ⚡ Real-time & Pub/Sub

### Pub/Sub System
- **Encore Pub/Sub**
  - **Location**: `backend/*/events.ts`, `backend/*/*_subscriber.ts`
  - **Topics**:
    1. `finance-events` - Financial transaction events (6 subscribers)
    2. `realtime-updates` - General realtime updates
    3. `balance-corrections` - Balance correction events (1 subscriber)
    4. `guest-checkin-events` - Guest check-in events
    5. `audit-events` - Audit log events

### Real-time Architecture
- **Long-Poll Pattern**:
  - **Backend**: `GET /finance/realtime/subscribe`
  - **Location**: `backend/finance/subscribe_realtime.ts`
  - **Features**:
    - 25s timeout
    - In-memory per-org buffer
    - Bounded queue (200 events)
    - Event TTL (25s)
    - Waiter cap (5000 per org)

- **Frontend Hook**:
  - **Location**: `frontend/hooks/useFinanceRealtimeV2.ts`
  - **Features**:
    - Leader/Follower pattern (BroadcastChannel + Web Locks)
    - RTT-aware backoff
    - Cross-tab coordination
    - 2% telemetry sampling

### Event Sourcing
- **Event Store**:
  - **Location**: `backend/eventsourcing/event_store.ts`
  - **Database**: `event_store` DB
  - **Features**: Optimistic concurrency control, snapshots

- **Read Models**:
  - **Location**: `backend/eventsourcing/read_models.ts`
  - **Database**: `read_models` DB
  - **Features**: Materialized projections, GIN indexes for JSONB

---

## 💾 Caching Strategy

### Multi-Tier Cache System
- **L1: In-Memory Cache**
  - **Location**: `backend/cache/backends/memory.ts`
  - **Type**: Map-based, per-service instance
  - **TTL**: Dynamic (5s for today, 10s for yesterday, etc.)

- **L2: Encore Cache** (Planned)
  - **Location**: `backend/cache/backends/encore.ts`
  - **Status**: Stub implementation (API pending)
  - **Purpose**: Distributed cache across services

- **L3: Redis** (Optional)
  - **Location**: `backend/cache/backends/redis.ts`
  - **Library**: `ioredis` (v5.3.2)
  - **Status**: Optional, fallback to memory if unavailable
  - **Configuration**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

### Cache Managers
- **DistributedCacheManager**:
  - **Location**: `backend/cache/distributed_cache_manager.ts`
  - **Features**: TTL-based expiration, org-scoped keys

- **TieredCache**:
  - **Location**: `backend/cache/tiered_cache.ts`
  - **Features**: L1 → L2 → L3 fallback chain

- **Cache Factory**:
  - **Location**: `backend/cache/cache_factory.ts`
  - **Features**: Dynamic tier selection based on env vars

### Cache Invalidation
- **Event-Driven**:
  - **Location**: `backend/cache/cache_invalidation_subscriber.ts`
  - **Pattern**: Pub/Sub subscribers invalidate on events

- **TTL Strategy**:
  - Today: 5s
  - Yesterday: 10s
  - Last 3 days: 30s
  - Last week: 2m
  - Last month: 10m
  - Historical: 30m

---

## 🔐 Authentication & Security

### Authentication System
- **JWT Tokens**:
  - **Library**: `jsonwebtoken` (v9.0.2)
  - **Location**: `backend/auth/utils.ts`
  - **Tokens**:
    - Access Token: 15min expiry
    - Refresh Token: 7-day expiry
  - **Secrets**: `JWTSecret`, `RefreshSecret` (Encore secrets)

### Password Security
- **Hashing**: `bcrypt` (v6.0.0) / `bcryptjs` (v3.0.2)
  - **Location**: `backend/auth/utils.ts`
  - **Rounds**: 10 (default)

### Frontend Auth
- **AuthContext**:
  - **Location**: `frontend/contexts/AuthContext.tsx`
  - **Features**:
    - Token refresh mutex (Web Locks/localStorage)
    - Cross-tab token sharing (BroadcastChannel)
    - Logout broadcast
    - Exponential backoff on auth failures
    - Global session banner

- **Token Manager**:
  - **Location**: `frontend/services/token-manager.ts`
  - **Features**: Secure token storage, automatic refresh

### Authorization
- **Role-Based Access Control (RBAC)**:
  - **Location**: `backend/auth/middleware.ts`
  - **Roles**: ADMIN, MANAGER, STAFF, etc.
  - **Middleware**: `requireRole()`, `requireOrgAccess()`

### CORS
- **Configuration**: `backend/encore.app`
  - **max_age_seconds**: 7200 (2 hours)
  - **Allowed Origins**: Dev + Production domains
  - **Credentials**: Supported

---

## 🏗️ Infrastructure & DevOps

### Deployment Platform
- **Encore Cloud**
  - **Location**: `backend/encore.app`
  - **Features**: Auto-scaling, managed databases, Pub/Sub, object storage
  - **URLs**: `*.encr.app`

### Cron Jobs
- **7 Cron Jobs Configured**:
  1. Cache warming
  2. Consistency checks
  3. Night audit
  4. OTA sync (placeholder)
  5. Task reminders
  6. Partition maintenance
  7. Balance corrections

- **Location**: `backend/cron/*.ts`

### Resilience Patterns
- **Circuit Breaker**:
  - **Location**: `backend/resilience/circuit_breaker.ts`
  - **Features**: Failure threshold, timeout, half-open state

- **Retry Logic**:
  - **Location**: `backend/resilience/retry.ts`
  - **Features**: Exponential backoff, jitter

- **Rate Limiting**:
  - **Location**: `backend/resilience/rate_limiter.ts`
  - **Features**: Token bucket algorithm

- **Bulkhead**:
  - **Location**: `backend/resilience/bulkhead.ts`
  - **Features**: Resource isolation

### Development Tools
- **Concurrently** (v8.2.2)
  - **Location**: Root `package.json`
  - **Usage**: Run backend + frontend simultaneously

---

## 📊 Monitoring & Observability

### Monitoring Endpoints
- **Unified Metrics**:
  - **Location**: `backend/monitoring/unified_metrics.ts`
  - **Endpoint**: `GET /monitoring/unified/metrics`
  - **Features**: System health, cache stats, partition status, alerts

- **Health Checks**:
  - `/health` - Load balancer health
  - `/live` - Kubernetes liveness
  - `/ready` - Kubernetes readiness

### Telemetry
- **Client Telemetry**:
  - **Location**: `backend/telemetry/ingest.ts`
  - **Endpoint**: `POST /telemetry/client`
  - **Features**: 2% sampled events (fast_empty, leader changes, errors)

- **Server Telemetry**:
  - **Location**: `backend/finance/subscribe_realtime.ts`
  - **Features**: Completion/failure logs with context (orgId, userId, durationMs)

### Metrics
- **Realtime Metrics**:
  - **Location**: `backend/finance/realtime_metrics.ts`
  - **Endpoint**: `GET /finance/realtime/metrics`
  - **Features**: Buffer sizes, published/delivered counts, drop totals

- **Cache Metrics**:
  - **Location**: `backend/cache/cache_metrics.ts`
  - **Features**: Hit rates, TTL stats, invalidation counts

### Logging
- **Encore Logging**:
  - **Location**: `encore.dev/log`
  - **Features**: Structured logging, log levels, context tags

---

## 🧪 Testing Framework

### Backend Testing
- **Jest** (v29.7.0)
  - **Location**: `backend/__tests__/`, `backend/*/__tests__/`
  - **Config**: `backend/jest.config.cjs`
  - **Coverage**: Integration tests, unit tests, E2E tests

### Frontend Testing
- **Jest** (v29.7.0) + **React Testing Library** (v16.1.0)
  - **Location**: `frontend/__tests__/`
  - **Config**: `frontend/jest.config.cjs`
  - **Coverage**: Component tests, integration tests, E2E workflows

### Test Types
- **Unit Tests**: Component logic, utilities
- **Integration Tests**: API endpoints, database queries
- **E2E Tests**: Complete workflows
- **Smoke Tests**: Infrastructure validation

---

## 🚀 Future Development Recommendations

### 1. **Real-time Expansion**
**Current**: Finance realtime only  
**Recommendation**: Extend to all services

- **Tasks Service**: Real-time task updates
- **Staff Service**: Live attendance, schedule changes
- **Properties Service**: Occupancy updates
- **Analytics Service**: Live dashboard metrics

**Implementation**: Reuse `useFinanceRealtimeV2` pattern from `docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md`

### 2. **Caching Enhancements**
**Current**: L1 (memory) + optional L3 (Redis)  
**Recommendation**: Complete L2 (Encore Cache) integration

- **Priority**: High (when Encore Cache API available)
- **Impact**: Distributed cache across all service instances
- **Benefit**: Reduced database load at 1M org scale

### 3. **Database Optimization**
**Current**: Partitioning + read replicas  
**Recommendation**: Additional optimizations

- **Connection Pooling**: Fine-tune per-service pools
- **Query Optimization**: Add covering indexes for common queries
- **Archival Strategy**: Move old data to cold storage (S3/Glacier)
- **Materialized Views**: Pre-compute expensive aggregations

### 4. **Monitoring & Alerting**
**Current**: Basic metrics endpoints  
**Recommendation**: Full observability stack

- **Grafana Dashboards**: Visualize metrics (see `backend/monitoring/MONITORING_DASHBOARDS.md`)
- **Alerting**: PagerDuty/Slack integration for critical alerts
- **Distributed Tracing**: OpenTelemetry for request tracing
- **APM**: Application Performance Monitoring (New Relic/Datadog)

### 5. **Frontend Performance**
**Current**: Vite + React 19  
**Recommendation**: Additional optimizations

- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: Next-gen formats (WebP, AVIF)
- **Service Worker**: Offline support, background sync
- **Bundle Analysis**: Identify and reduce large dependencies

### 6. **Mobile App**
**Current**: Web-only  
**Recommendation**: Native mobile apps

- **React Native**: Reuse business logic
- **Expo**: Fast development, OTA updates
- **Offline-First**: Local SQLite cache, sync on reconnect

### 7. **API Gateway & Rate Limiting**
**Current**: Per-service auth  
**Recommendation**: Centralized gateway

- **Rate Limiting**: Per-org, per-user limits
- **API Versioning**: `/v1/`, `/v2/` support
- **Request Throttling**: Prevent abuse
- **GraphQL Option**: For complex queries

### 8. **Document Processing**
**Current**: OpenAI extraction  
**Recommendation**: Enhanced pipeline

- **OCR**: Tesseract.js (already installed) for fallback
- **Document Validation**: ML-based fraud detection
- **Batch Processing**: Queue for large uploads
- **Compression**: Automatic image optimization

### 9. **Event Sourcing Maturity**
**Current**: Basic event store  
**Recommendation**: Full CQRS implementation

- **Command/Query Separation**: Separate read/write models
- **Event Replay**: Rebuild read models from events
- **Snapshot Strategy**: Reduce replay time for large aggregates
- **Event Versioning**: Handle schema migrations

### 10. **Security Hardening**
**Current**: JWT + RBAC  
**Recommendation**: Additional layers

- **2FA/MFA**: TOTP/SMS for sensitive operations
- **IP Whitelisting**: For admin accounts
- **Audit Logging**: Comprehensive action tracking
- **Data Encryption**: At-rest encryption for sensitive fields
- **GDPR Compliance**: Data export, deletion, consent management

### 11. **CI/CD Pipeline**
**Current**: Manual deployment  
**Recommendation**: Automated pipeline

- **GitHub Actions**: Automated tests, builds
- **Encore Cloud Integration**: Auto-deploy on merge
- **Staging Environment**: Pre-production validation
- **Rollback Strategy**: Quick revert on issues

### 12. **Multi-Region Support**
**Current**: Single region  
**Recommendation**: Global distribution

- **CDN**: Cloudflare/Fastly for static assets
- **Database Replication**: Cross-region replicas
- **Pub/Sub**: Multi-region event distribution
- **Latency Optimization**: Route users to nearest region

### 13. **Advanced Analytics**
**Current**: Basic reports  
**Recommendation**: Business intelligence

- **Data Warehouse**: Snowflake/BigQuery for analytics
- **ETL Pipeline**: Extract finance/operations data
- **Dashboards**: Power BI/Tableau integration
- **Predictive Analytics**: ML-based forecasting

### 14. **Integration Ecosystem**
**Current**: Placeholder OTA sync  
**Recommendation**: Real integrations

- **Booking.com API**: Sync reservations
- **Airbnb API**: Property listings
- **Stripe/PayPal**: Payment processing
- **Email/SMS**: SendGrid/Twilio
- **Accounting**: QuickBooks/Xero sync

### 15. **Developer Experience**
**Current**: Good documentation  
**Recommendation**: Enhanced DX

- **API Documentation**: OpenAPI/Swagger UI
- **SDK Generation**: TypeScript/JavaScript SDKs
- **CLI Tools**: Developer utilities
- **Local Development**: Docker Compose for full stack
- **Testing Tools**: Postman collections, test data generators

---

## 📈 Scaling Roadmap

### Phase 1: Current (1K-10K Orgs)
✅ **Completed**:
- Multi-tier caching
- Database partitioning
- Real-time finance updates
- Leader/follower pattern
- Cross-tab coordination

### Phase 2: Near-Term (10K-100K Orgs)
**Target**: Q2 2025
- Complete L2 cache integration
- Expand realtime to all services
- Enhanced monitoring dashboards
- Mobile app (MVP)

### Phase 3: Medium-Term (100K-500K Orgs)
**Target**: Q3-Q4 2025
- Multi-region deployment
- Advanced analytics pipeline
- Full CQRS implementation
- Integration ecosystem

### Phase 4: Long-Term (500K-1M+ Orgs)
**Target**: 2026
- Global CDN
- Data warehouse
- ML-based features
- Enterprise features (SSO, advanced RBAC)

---

## 🎯 Key Metrics to Track

### Performance
- **P95 Response Time**: < 500ms
- **Cache Hit Rate**: > 85%
- **Database Query Time**: < 100ms (p95)
- **Realtime Event Latency**: < 200ms

### Scalability
- **Concurrent Users**: 25M (1M orgs × 5 users × 5 properties)
- **Requests/Second**: 50K+ RPS
- **Database Connections**: < 80% pool utilization
- **Pub/Sub Throughput**: 10K+ events/sec

### Reliability
- **Uptime**: 99.9% (8.76 hours downtime/year)
- **Error Rate**: < 0.1%
- **MTTR**: < 15 minutes
- **Data Consistency**: 100% (eventual consistency acceptable for some reads)

---

## 📚 Reference Documents

- **Realtime Architecture**: `docs/NETWORKING_AND_REALTIME_IMPROVEMENTS.md`
- **Quick Start**: `docs/REALTIME_QUICKSTART.md`
- **Database Architecture**: `DATABASE_ARCHITECTURE.md`
- **Development Guide**: `DEVELOPMENT_GUIDE.md`
- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **Monitoring**: `backend/monitoring/MONITORING_DASHBOARDS.md`

---

**Last Updated**: 2025-01-27  
**Maintained By**: Development Team  
**Questions**: See documentation or create an issue

