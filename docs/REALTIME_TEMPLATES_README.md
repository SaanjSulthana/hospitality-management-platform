# Realtime Implementation Templates - Usage Guide

This directory contains production-ready templates for implementing the Finance-page realtime/networking playbook across any service or page in the platform.

---

## 📁 Available Documents

### 1. [NETWORKING_AND_REALTIME_IMPROVEMENTS.md](./NETWORKING_AND_REALTIME_IMPROVEMENTS.md)
**Purpose:** Architecture reference and patterns library  
**Use When:** Understanding the system, troubleshooting, architecture decisions  
**Reading Time:** 15-20 minutes

This is your **source of truth** for:
- Long-poll + buffer architecture
- Leader/follower pattern
- Auth lifecycle management
- Performance targets and metrics
- Operational checklists

### 2. [REALTIME_IMPLEMENTATION_TEMPLATE.md](./REALTIME_IMPLEMENTATION_TEMPLATE.md) ⭐
**Purpose:** Complete, step-by-step implementation guide  
**Use When:** Implementing realtime for a new domain/page  
**Implementation Time:** 8-12 hours (including testing)

**What's included:**
- ✅ Prerequisites checklist with domain analysis
- ✅ Phase-by-phase implementation (Backend → Frontend → Integration → Testing)
- ✅ Complete code examples with explanations
- ✅ Error handling matrix
- ✅ 7 mandatory test scenarios
- ✅ Performance targets and validation
- ✅ Rollback plan and feature flags
- ✅ Troubleshooting guide
- ✅ Documentation requirements

**Best for:**
- First-time implementers
- Complex domains with unique requirements
- Teams needing comprehensive testing coverage
- Production-critical implementations

### 3. [REALTIME_QUICKSTART.md](./REALTIME_QUICKSTART.md) ⚡
**Purpose:** Fast-track implementation for experienced developers  
**Use When:** You've done this before, just need a reminder  
**Implementation Time:** ~50 minutes (core features only)

**What's included:**
- 5-step implementation
- Minimal code examples
- Quick test checklist
- Common issues reference

**Best for:**
- Second+ domain implementation
- Experienced team members
- Rapid prototyping
- When time is critical

---

## 🎯 Which Document Should I Use?

```
┌─────────────────────────────────────────────────────────────┐
│                    Decision Tree                             │
└─────────────────────────────────────────────────────────────┘

Is this your first realtime implementation?
├─ YES → Start with REALTIME_IMPLEMENTATION_TEMPLATE.md
│         Read NETWORKING_AND_REALTIME_IMPROVEMENTS.md first
│
└─ NO → Have you implemented realtime before?
    ├─ YES, and I'm comfortable → Use REALTIME_QUICKSTART.md
    │                               Keep TEMPLATE.md open for reference
    │
    └─ YES, but need refresher → Skim TEMPLATE.md, then use QUICKSTART.md

Need to understand WHY something works?
└─ Read NETWORKING_AND_REALTIME_IMPROVEMENTS.md (Architecture)

Something broken in production?
└─ Check TEMPLATE.md → Troubleshooting section
```

---

## 🚀 Recommended Workflow

### For First Implementation

1. **Read (30 min):**
   - NETWORKING_AND_REALTIME_IMPROVEMENTS.md (full read)
   - Review Finance implementation:
     - `backend/finance/realtime_*.ts`
     - `frontend/hooks/useFinanceRealtimeV2.ts`

2. **Plan (30 min):**
   - Complete Prerequisites section in TEMPLATE.md
   - Identify event types and payloads
   - Map existing React Query keys
   - Check for conflicts

3. **Implement (6-8 hours):**
   - Follow TEMPLATE.md phases 1-6
   - Test after each phase
   - Use Finance code as reference

4. **Test (2-3 hours):**
   - Run all 7 test scenarios
   - Verify performance targets
   - Load test with multiple tabs/users

5. **Document (30 min):**
   - Update File Index
   - Update Operational Checklists
   - Add inline JSDoc

6. **Deploy (1 hour):**
   - Enable feature flag
   - Monitor for 24-48 hours
   - Remove legacy code when stable

### For Subsequent Implementations

1. **Quick Review (5 min):**
   - QUICKSTART.md for steps
   - TEMPLATE.md for any gaps

2. **Implement (50 min):**
   - Copy/adapt from previous implementation
   - Follow 5-step guide

3. **Test (30 min):**
   - Quick test checklist
   - Performance spot check

4. **Deploy (15 min):**
   - Feature flag + monitor

---

## 📋 Implementation Checklist

Use this as your progress tracker:

```markdown
## Domain: _______________

### Pre-Implementation
- [ ] Read architecture docs
- [ ] Reviewed Finance implementation
- [ ] Completed domain analysis
- [ ] Identified event types
- [ ] Checked for conflicts

### Backend (2-4 hours)
- [ ] Created realtime_buffer.ts
- [ ] Created realtime_subscriber.ts
- [ ] Created subscribe_realtime.ts
- [ ] Created realtime_metrics.ts
- [ ] Verified CORS config

### Frontend (3-5 hours)
- [ ] Created use<Domain>RealtimeV2.ts
- [ ] Configured Vite proxy
- [ ] Integrated in page component
- [ ] Added cache patching logic
- [ ] Added degraded mode

### Testing (2-3 hours)
- [ ] Multi-tab leader election ✅
- [ ] Event delivery ✅
- [ ] Auth expiry ✅
- [ ] Logout broadcast ✅
- [ ] Fast-empty behavior ✅
- [ ] Performance under burst ✅
- [ ] Offline/online ✅

### Documentation (30 min)
- [ ] Updated File Index
- [ ] Updated Operational Checklists
- [ ] Added inline JSDoc

### Deployment
- [ ] Feature flag configured
- [ ] Rollback plan ready
- [ ] Monitoring active
- [ ] 24-48h observation complete
```

---

## 🎓 Learning Path

### Beginner (Never done realtime before)

**Week 1: Learn**
1. Read NETWORKING_AND_REALTIME_IMPROVEMENTS.md
2. Study Finance implementation in detail
3. Understand leader/follower pattern
4. Learn React Query cache manipulation

**Week 2: Implement**
1. Choose simple domain (e.g., Tasks)
2. Follow TEMPLATE.md step-by-step
3. Ask questions when stuck
4. Complete all test scenarios

**Week 3: Master**
1. Implement second domain using QUICKSTART.md
2. Compare performance between domains
3. Optimize and tune

### Intermediate (Done this 1-2 times)

**Day 1: Refresh**
- Skim TEMPLATE.md
- Review previous implementation

**Day 2-3: Implement**
- Use QUICKSTART.md as guide
- Reference TEMPLATE.md for details
- Complete testing

**Day 4: Deploy & Monitor**

### Expert (Done this 3+ times)

**Morning: Implement**
- QUICKSTART.md (50 min)

**Afternoon: Test & Deploy**
- Quick test (30 min)
- Deploy with monitoring

---

## 🔍 Key Concepts Quick Reference

### Long-Poll
- Client holds open HTTP connection for up to 25s
- Server responds immediately if events exist, else waits
- More efficient than rapid short polling

### Leader/Follower
- One tab ("leader") maintains long-poll connection
- Other tabs ("followers") receive events via BroadcastChannel
- Prevents N× duplication of backend requests

### RTT-Aware Backoff
- If server responds "empty" quickly (<1.5s), slow down next request
- Prevents tight loops when system is quiet
- Maintains instant updates when events occur

### In-Memory Buffer
- Bounded queue per org (200 events max)
- TTL prevents stale data (25s)
- Idle eviction prevents memory leaks

### Row-Level Patching
- Update specific items in React Query cache
- Instant UI updates without full refetch
- Debounce expensive aggregates

---

## 📊 Success Metrics

After implementation, you should see:

| Metric | Before (Polling) | After (Realtime) |
|--------|------------------|------------------|
| **Backend requests** | 1/sec per tab | 1/25s per session |
| **UI latency** | 1-5 seconds | <2 seconds |
| **Concurrent connections** | N tabs × M users | ~M users (sessions) |
| **CORS preflights** | High | Low (cached) |
| **401 error bursts** | Frequent | Rare |
| **Logout tail errors** | Common | Zero |

---

## 🛠️ Tools & Utilities

### Verification Scripts

**Check leader count:**
```javascript
// Run in any tab console
localStorage.getItem('<domain>-leader-lease');
// Only 1 tab should have recent timestamp
```

**Check BroadcastChannel:**
```javascript
// Run in follower tab console
const channel = new BroadcastChannel('<domain>-events');
channel.onmessage = (e) => console.log('Received:', e.data);
```

**Trigger fast logout test:**
```javascript
// Run in one tab
new BroadcastChannel('auth-control').postMessage({ 
  type: 'logout', 
  id: crypto.randomUUID(), 
  ts: Date.now() 
});
```

**Check metrics:**
```bash
# Backend health
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/<domain>/realtime/metrics | jq
```

---

## 🐛 Common Pitfalls & Solutions

### Pitfall 1: Multiple tabs all long-polling
**Why:** Leader election not working  
**Fix:** Check `'locks' in navigator` and localStorage lease logic

### Pitfall 2: Events duplicate in UI
**Why:** Not deduplicating by eventId  
**Fix:** Track processed IDs: `processedEventIds.current.add(event.eventId)`

### Pitfall 3: "jwt malformed" errors
**Why:** Sending empty Authorization header  
**Fix:** Guard: `if (token && token.length > 0) { headers.Authorization = ... }`

### Pitfall 4: Aggregate queries fire rapidly
**Why:** Not debouncing invalidations  
**Fix:** Use debounced invalidate with 1000-1500ms delay

### Pitfall 5: Memory leak in backend
**Why:** Org buffers not evicting  
**Fix:** Verify idle eviction interval and TTL cleanup

---

## 🎯 Domain-Specific Considerations

### Tasks Domain
- **High frequency:** Use larger buffer (300 events)
- **Property-scoped:** Always filter by propertyId
- **Status changes:** Separate event types for status transitions

### Staff Domain
- **Low frequency:** Standard buffer (200 events)
- **Org-scoped:** No propertyId filter needed
- **Leave requests:** Consider separate realtime stream

### Analytics Domain
- **Very high frequency:** Consider aggregation at buffer level
- **Heavy aggregates:** Longer debounce (2-3 seconds)
- **Historical data:** May not need realtime for all queries

### Users Domain
- **Very low frequency:** Standard buffer
- **Sensitive data:** Ensure proper auth checks
- **Role changes:** Trigger full refetch of permissions

---

## 📞 Getting Help

### Self-Service
1. **Check Troubleshooting:** TEMPLATE.md → Troubleshooting section
2. **Review Finance code:** Working reference implementation
3. **Check metrics:** `/<domain>/realtime/metrics` endpoint

### Team Support
1. **Architecture questions:** Reference NETWORKING doc → Patterns section
2. **Performance issues:** Share metrics endpoint output
3. **Auth problems:** Check AuthContext and GlobalAuthBanner patterns

### Escalation
1. **Production incidents:** Check rollback plan, disable feature flag
2. **Memory leaks:** Review buffer metrics, idle eviction logs
3. **Data consistency:** Verify event deduplication and TTL

---

## 📚 Additional Resources

- **Encore Docs:** https://encore.dev/docs
- **React Query:** https://tanstack.com/query
- **Web Locks API:** [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- **BroadcastChannel:** [MDN](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- **Long Polling vs WebSockets:** [Architecture Decision](https://encore.dev/docs/primitives/pubsub)

---

## 🎉 Success Stories

### Finance Domain (First Implementation)
- **Reduction:** 95% fewer backend requests
- **Latency:** 5s → <2s UI updates
- **Scale:** Handles 1M+ orgs without performance degradation

### [Your Domain Here]
- **Reduction:** ___% fewer requests
- **Latency:** ___s → ___s
- **Scale:** Tested up to ___ concurrent users

---

## 📝 Feedback & Improvements

Found an issue or have a suggestion?

1. **Template issues:** Update TEMPLATE.md and increment version
2. **Pattern improvements:** Update NETWORKING doc and notify team
3. **New patterns:** Document and add to pattern library

---

**Happy implementing! 🚀**

For questions, refer to the architecture team or review the Finance implementation.




