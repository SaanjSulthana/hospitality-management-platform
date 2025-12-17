import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { formatCurrency as formatCurrencyUtil } from '../lib/currency';
import { formatCardDateTime } from '../lib/datetime';
import { formatDateForAPI, getCurrentDateString, getCurrentDateTimeString, formatDateForInput, formatDateForDisplay } from '../lib/date-utils';
import { compressImageIfNeeded, bufferToBase64 } from '../lib/image-compression';
import { API_CONFIG } from '../src/config/api';
import { envUtils } from '@/src/utils/environment-detector';
import { useRouteActive } from '@/hooks/use-route-aware-query';
import { QUERY_CATEGORIES } from '@/src/config/query-config';
import { useDailyApprovalCheck } from '@/hooks/useDailyApprovalCheck';
import { getFlagNumber, getFlagBool } from '../lib/feature-flags';
import { FileUpload } from '@/components/ui/file-upload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinanceTabs, FinanceTabsList, FinanceTabsTrigger } from '@/components/ui/finance-tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ReceiptViewer } from '@/components/ui/receipt-viewer';
import { DailyApprovalManager } from '@/components/ui/daily-approval-manager';
import { StatsCard } from '@/components/ui/stats-card';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
  CalendarDays,
  Building2,
  Hotel,
  Upload,
  Check,
  X,
  Eye,
  RefreshCw,
  BarChart3,
  Banknote,
  Wallet,
  CreditCard,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  SlidersHorizontal,
  IndianRupee,
  Landmark,
  AlertCircle
} from 'lucide-react';
import { setRealtimePropertyFilter } from '../lib/realtime-helpers';
import { FinanceFilters } from '@/components/finance/FinanceFilters';
// Development flag (use Vite's dev indicator consistently across this module)
const __DEV__ = import.meta.env.DEV;

// Helper function to get current timestamp (deprecated - use date utils instead)
const getCurrentTimestamp = (): string => {
  const timestamp = getCurrentDateTimeString();
  if (__DEV__) console.log('Current timestamp being sent:', timestamp);
  return timestamp;
};

export default function FinancePage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const routeActive = useRouteActive(['/finance']);

  // Set page title and description
  useEffect(() => {
    setPageTitle('Financial Management', 'Track expenses, revenues, and financial performance');
  }, [setPageTitle]);

  // Subscribe to real-time finance events (transport handled globally by RealtimeProvider)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const queryClient = useQueryClient();
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  // Soft refresh timer to backstop any missed cache patches
  const financeSoftRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Health from global RealtimeProvider (emits 'finance-stream-health')
  const [realtimeHealth, setRealtimeHealth] = useState<any>({ isLive: true });
  useEffect(() => {
    const onHealth = (e: any) => {
      const h = e?.detail || {};
      setRealtimeHealth(h);
    };
    window.addEventListener('finance-stream-health', onHealth as EventListener);
    return () => window.removeEventListener('finance-stream-health', onHealth as EventListener);
  }, []);

  // Telemetry helper: posts with Authorization and keepalive; falls back silently on errors
  const sendTelemetry = (_sampleRate: number, events: any[]) => {
    if (envUtils.isProduction()) return;
    try {
      const token = localStorage.getItem('accessToken') || '';
      if (!token) return;
      const url = `${API_CONFIG.BASE_URL}/telemetry/client`;
      const normalized = (Array.isArray(events) ? events : []).map((_e: any) => ({
        type: 'derived_debounce_fired',
        coalescedCount: 1,
        ts: new Date().toISOString(),
      }));
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ events: normalized }),
        keepalive: true,
      }).catch(() => { });
    } catch { }
  };

  // Propagate current property filter to the realtime provider (for scoped WS fanout)
  useEffect(() => {
    try {
      const pid = selectedPropertyId === 'all' ? null : Number(selectedPropertyId);
      setRealtimePropertyFilter(pid);
    } catch { }
  }, [selectedPropertyId]);
  const isFinanceEvent = (ev: any): ev is {
    eventId: string; eventType: string; entityId: number; timestamp: string | Date; metadata?: any; propertyId: number; orgId: number; userId: number; entityType: string;
  } => {
    return !!ev
      && typeof ev.eventId === 'string'
      && typeof ev.eventType === 'string'
      && typeof ev.entityId === 'number'
      && (typeof ev.timestamp === 'string' || ev.timestamp instanceof Date)
      && typeof ev.propertyId === 'number'
      && typeof ev.orgId === 'number'
      && typeof ev.userId === 'number'
      && typeof ev.entityType === 'string';
  };
  // Apply cache updates to all matching queries for a cache group ('expenses' | 'revenues'),
  // respecting each query's property/date filters encoded in its queryKey.
  const applyToMatchingQueries = (
    cacheGroup: 'expenses' | 'revenues',
    eventPropertyId: number | undefined,
    eventDateISO: string | undefined,
    apply: (old: any) => any
  ) => {
    const candidates = queryClient.getQueriesData({ queryKey: [cacheGroup] });
    for (const [qk, _data] of candidates) {
      // Keys look like: ['expenses' | 'revenues', selectedPropertyId, dateRange]
      const keyArr = Array.isArray(qk) ? qk : [qk];
      const keyGroup = keyArr[0];
      if (keyGroup !== cacheGroup) continue;
      const propFilter = keyArr[1]; // string 'all' | propertyId string | undefined
      const dr = keyArr[2] as { startDate?: string; endDate?: string } | undefined;
      const propertyMatches =
        eventPropertyId == null
          ? true
          : (!propFilter ||
            propFilter === 'all' ||
            String(eventPropertyId) === String(propFilter));
      let dateMatches = true;
      if (dr && (dr.startDate || dr.endDate) && eventDateISO) {
        const d = new Date(eventDateISO);
        const start = dr.startDate ? new Date(dr.startDate) : undefined;
        const end = dr.endDate ? new Date(dr.endDate) : undefined;
        if (start && d < start) dateMatches = false;
        if (end && d > end) dateMatches = false;
      }
      if (propertyMatches && dateMatches) {
        queryClient.setQueryData(qk as any, (old: any) => apply(old));
      }
    }
  };
  // Small jitter utility for degraded-mode polling
  const jitterMs = (minMs: number, maxMs: number) => {
    const delta = maxMs - minMs;
    return Math.floor(minMs + Math.random() * (delta <= 0 ? 0 : delta));
  };

  // Incremental aggregates for summary cards
  const [totals, setTotals] = useState<{
    cashRevenue: number;
    bankRevenue: number;
    cashExpense: number;
    bankExpense: number;
  }>({ cashRevenue: 0, bankRevenue: 0, cashExpense: 0, bankExpense: 0 });
  // Debounced derived invalidations (profit-loss, approvals)
  const derivedPendingRef = useRef<{ profitLoss: boolean; approvals: boolean; todayPending: boolean }>({
    profitLoss: false,
    approvals: false,
    todayPending: false,
  });
  const derivedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDerivedInvalidations = (changes: { profitLoss?: boolean; approvals?: boolean; todayPending?: boolean }) => {
    // Merge pending flags
    derivedPendingRef.current = {
      profitLoss: derivedPendingRef.current.profitLoss || !!changes.profitLoss,
      approvals: derivedPendingRef.current.approvals || !!changes.approvals,
      todayPending: derivedPendingRef.current.todayPending || !!changes.todayPending,
    };
    if (derivedTimerRef.current) return;
    const debounceMs = getFlagNumber('FIN_DERIVED_DEBOUNCE_MS', 1000);
    derivedTimerRef.current = setTimeout(() => {
      const pending = derivedPendingRef.current;
      derivedTimerRef.current = null;
      derivedPendingRef.current = { profitLoss: false, approvals: false, todayPending: false };
      if (pending.profitLoss) queryClient.invalidateQueries({ queryKey: ['profit-loss'] });
      if (pending.approvals) queryClient.invalidateQueries({ queryKey: ['daily-approval-check'] });
      if (pending.todayPending) queryClient.invalidateQueries({ queryKey: ['today-pending-transactions'] });
    }, Math.max(50, debounceMs));
  };

  // ROW-LEVEL cache patching: update specific items instead of invalidating entire lists
  useEffect(() => {
    const onFinanceEvents = (e: any) => {
      try {
        const raw = e?.detail?.events || [];
        if (!Array.isArray(raw) || raw.length === 0) return;
        // Deduplicate by eventId and validate structure
        const unique = raw.filter((ev: any) => {
          if (!ev?.eventId) return false;
          if (processedEventIdsRef.current.has(ev.eventId)) return false;
          processedEventIdsRef.current.add(ev.eventId);
          return true;
        });
        const safeEvents = unique.filter(isFinanceEvent).sort((a: any, b: any) => {
          const ta = new Date(a.timestamp as any).getTime();
          const tb = new Date(b.timestamp as any).getTime();
          if (ta !== tb) return ta - tb;
          return String(a.eventId).localeCompare(String(b.eventId));
        });

        // Incremental totals update for immediate UI response
        setTotals(prev => {
          let next = { ...prev };
          for (const ev of safeEvents) {
            const type: string = ev?.eventType || '';
            const amount: number | undefined = ev?.metadata?.amountCents;
            const mode: string | undefined = ev?.metadata?.paymentMode;
            if (!type || typeof amount !== 'number' || !mode) continue;

            const isRevenue = type.startsWith('revenue_');
            const isExpense = type.startsWith('expense_');
            const isApproved = type.endsWith('_approved');
            const isDeleted = type.endsWith('_deleted');

            const bucket = (isRevenue ? (mode === 'cash' ? 'cashRevenue' : 'bankRevenue')
              : (mode === 'cash' ? 'cashExpense' : 'bankExpense')) as keyof typeof prev;

            if (isApproved) {
              next[bucket] = Math.max(0, (next[bucket] || 0) + amount);
            } else if (isDeleted) {
              next[bucket] = Math.max(0, (next[bucket] || 0) - amount);
            }
          }
          return next;
        });

        // Row-level cache updates for each event
        let hasExpenseChange = false;
        let hasRevenueChange = false;
        let hasApprovalChange = false;

        for (const ev of safeEvents) {
          try {
            const { eventType, entityId, entityType, metadata, propertyId } = ev;
            if (!eventType || !entityId || !entityType) continue;
            const eventDateISO: string | undefined = metadata?.transactionDate || (typeof ev.timestamp === 'string' ? ev.timestamp : undefined);

            const isExpense = entityType === 'expense';
            const isRevenue = entityType === 'revenue';
            const cacheKey = isExpense ? 'expenses' : isRevenue ? 'revenues' : null;

            if (!cacheKey) {
              // Handle special events
              if (eventType === 'daily_approval_granted') {
                hasApprovalChange = true;

                // Patch individual items if transaction IDs are provided
                const transactionIds = metadata?.transactionIds as number[] | undefined;
                const newStatus = metadata?.newStatus || 'approved';

                console.log('[Finance] daily_approval_granted received', {
                  transactionIds,
                  newStatus,
                  userId: ev.userId,
                  metadata
                });

                if (transactionIds && transactionIds.length > 0) {
                  // Update revenues list - use setQueriesData for partial key matching
                  queryClient.setQueriesData(
                    { queryKey: ['revenues'] },
                    (old: any) => {
                      if (!old?.revenues) return old;
                      const updated = {
                        ...old,
                        revenues: old.revenues.map((r: any) =>
                          transactionIds.includes(r.id)
                            ? { ...r, status: newStatus, approvedByUserId: ev.userId, approvedAt: ev.timestamp || new Date().toISOString() }
                            : r
                        ),
                      };
                      console.log('[Finance] Updated revenues cache', {
                        affected: transactionIds.length,
                        newStatus
                      });
                      return updated;
                    }
                  );

                  // Update expenses list
                  queryClient.setQueriesData(
                    { queryKey: ['expenses'] },
                    (old: any) => {
                      if (!old?.expenses) return old;
                      const updated = {
                        ...old,
                        expenses: old.expenses.map((e: any) =>
                          transactionIds.includes(e.id)
                            ? { ...e, status: newStatus, approvedByUserId: ev.userId, approvedAt: ev.timestamp || new Date().toISOString() }
                            : e
                        ),
                      };
                      console.log('[Finance] Updated expenses cache', {
                        affected: transactionIds.length,
                        newStatus
                      });
                      return updated;
                    }
                  );

                  hasExpenseChange = true;
                  hasRevenueChange = true;
                } else {
                  // Fallback: if no transactionIds, force invalidate the lists
                  console.log('[Finance] daily_approval_granted without transactionIds - forcing invalidation');
                  queryClient.invalidateQueries({ queryKey: ['revenues'] });
                  queryClient.invalidateQueries({ queryKey: ['expenses'] });
                  hasExpenseChange = true;
                  hasRevenueChange = true;
                }
              }
              continue;
            }

            // Track which types changed for derived queries
            if (isExpense) hasExpenseChange = true;
            if (isRevenue) hasRevenueChange = true;
            if (eventType.includes('approved') || eventType.includes('rejected')) {
              hasApprovalChange = true;
            }

            // Update cache based on event type
            if (eventType.endsWith('_added')) {
              // Treat newly added pending transactions as approval-list affecting
              const isPending =
                metadata?.newStatus === 'pending' || !metadata?.newStatus;
              if (isPending) {
                hasApprovalChange = true;
              }

              // Insert new row at top, preferring replacement of matching optimistic rows to avoid duplicates
              applyToMatchingQueries(cacheKey, propertyId, eventDateISO, (old: any) => {
                if (!old || !Array.isArray(old[cacheKey])) return old;
                const list = old[cacheKey] as any[];
                // Build row from event metadata
                const newRow: any = {
                  id: entityId,
                  propertyId: propertyId,
                  // Prefer backend-provided name, then derive from existing caches
                  propertyName:
                    metadata?.propertyName ||
                    (propertyId != null ? getPropertyName(propertyId) : 'Property'),
                  amountCents: metadata?.amountCents || 0,
                  currency: metadata?.currency || 'INR',
                  paymentMode: metadata?.paymentMode || 'cash',
                  status: metadata?.newStatus || 'pending',
                  createdAt: ev.timestamp || new Date().toISOString(),
                  // FIX: Include creator info from event metadata for realtime UI updates
                  createdByName: metadata?.createdByName || 'Unknown User',
                  createdByUserId: metadata?.createdByUserId || ev.userId,
                  description: metadata?.description || '',
                };
                if (isExpense) {
                  newRow.category = metadata?.category || 'other';
                  newRow.expenseDate =
                    metadata?.transactionDate ||
                    new Date().toISOString().split('T')[0];
                } else {
                  newRow.source = metadata?.source || 'other';
                  newRow.occurredAt =
                    metadata?.transactionDate || new Date().toISOString();
                }
                // If a real row already exists, skip
                if (list.find((item: any) => item.id === entityId)) return old;
                // Try to replace a matching optimistic row
                const matchIndex = list.findIndex((item: any) => {
                  if (!item?.isOptimistic) return false;
                  if (item.propertyId !== propertyId) return false;
                  if (item.amountCents !== newRow.amountCents) return false;
                  if (item.paymentMode !== newRow.paymentMode) return false;
                  if (isExpense) {
                    return (
                      item.category === newRow.category &&
                      String(item.expenseDate).slice(0, 10) ===
                      String(newRow.expenseDate).slice(0, 10)
                    );
                  } else {
                    return (
                      item.source === newRow.source &&
                      String(item.occurredAt).slice(0, 10) ===
                      String(newRow.occurredAt).slice(0, 10)
                    );
                  }
                });
                if (matchIndex >= 0) {
                  const newList = [...list];
                  newList[matchIndex] = { ...newRow };
                  return { ...old, [cacheKey]: newList };
                }
                return { ...old, [cacheKey]: [newRow, ...list] };
              });
            }

            else if (eventType.endsWith('_updated')) {
              // Patch existing row with new values
              applyToMatchingQueries(cacheKey, propertyId, eventDateISO, (old: any) => {
                if (!old || !Array.isArray(old[cacheKey])) return old;
                const list = old[cacheKey];
                const idx = list.findIndex((item: any) => item.id === entityId);
                if (idx === -1) return old; // Not in cache, skip

                // Merge metadata into existing row
                const updated = {
                  ...list[idx],
                  amountCents: metadata?.amountCents ?? list[idx].amountCents,
                  currency: metadata?.currency ?? list[idx].currency,
                  paymentMode: metadata?.paymentMode ?? list[idx].paymentMode,
                  status: metadata?.newStatus ?? list[idx].status,
                  updatedAt: new Date().toISOString(),
                };

                if (isExpense && metadata?.category) {
                  updated.category = metadata.category;
                }
                if (isRevenue && metadata?.source) {
                  updated.source = metadata.source;
                }
                if (metadata?.transactionDate) {
                  if (isExpense) updated.expenseDate = metadata.transactionDate;
                  else updated.occurredAt = metadata.transactionDate;
                }

                const newList = [...list];
                newList[idx] = updated;
                return { ...old, [cacheKey]: newList };
              });
            }

            else if (eventType.endsWith('_approved') || eventType.endsWith('_rejected')) {
              // Patch status and approval fields
              applyToMatchingQueries(cacheKey, propertyId, eventDateISO, (old: any) => {
                if (!old || !Array.isArray(old[cacheKey])) return old;
                const list = old[cacheKey];
                const idx = list.findIndex((item: any) => item.id === entityId);
                if (idx === -1) return old;

                const updated = {
                  ...list[idx],
                  status: metadata?.newStatus || (eventType.endsWith('_approved') ? 'approved' : 'rejected'),
                  approvedByUserId: ev.userId,
                  approvedAt: ev.timestamp || new Date().toISOString(),
                };

                const newList = [...list];
                newList[idx] = updated;
                return { ...old, [cacheKey]: newList };
              });
            }

            else if (eventType.endsWith('_deleted')) {
              // Remove row from cache
              applyToMatchingQueries(cacheKey, propertyId, eventDateISO, (old: any) => {
                if (!old || !Array.isArray(old[cacheKey])) return old;
                return {
                  ...old,
                  [cacheKey]: old[cacheKey].filter((item: any) => item.id !== entityId)
                };
              });
            }
          } catch (innerErr) {
            console.error('[Finance] Event processing error', innerErr);
          }
        }

        // Only invalidate DERIVED queries (not the lists themselves)
        scheduleDerivedInvalidations({
          profitLoss: hasExpenseChange || hasRevenueChange,
          approvals: hasApprovalChange,
          todayPending: hasApprovalChange,
        });

        // Soft refresh safety net: ensure lists converge even if a patch was missed
        // Only needed in non-patch mode; in patch mode, scheduleDerivedInvalidations
        // already handles profit-loss and daily-approval-check at ~1s debounce
        if (financeSoftRefreshTimerRef.current) {
          clearTimeout(financeSoftRefreshTimerRef.current);
        }
        if (!getFlagBool('REALTIME_PATCH_MODE', true)) {
          financeSoftRefreshTimerRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['revenues'] });
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
          }, 5000);
        }
        // In patch mode: no 5s safety net needed - derived queries already
        // invalidated by scheduleDerivedInvalidations, lists patched in real-time
      } catch (outerErr) {
        console.error('[Finance] Event batch failed', outerErr);
      }
    };
    window.addEventListener('finance-stream-events', onFinanceEvents as EventListener);
    return () => window.removeEventListener('finance-stream-events', onFinanceEvents as EventListener);
  }, [queryClient]);

  // Fallback refresh is now handled by RealtimeProvider (global hardRecover on long disconnections).

  const formatAgo = (value?: Date | number | string) => {
    if (!value) return '—';

    // Normalize to Date instance; handle timestamps and ISO strings safely
    const d = value instanceof Date ? value : new Date(value);
    if (!(d instanceof Date) || isNaN(d.getTime())) return '—';

    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec <= 0) return 'now';
    return `${sec}s ago`;
  };

  // Helper function to invalidate all expense-related queries
  const invalidateAllExpenseQueries = () => {
    if (!getFlagBool('REALTIME_PATCH_MODE', true)) {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
    // Use the shared scheduler to coalesce derived invalidations
    scheduleDerivedInvalidations({
      profitLoss: true,
      approvals: true,
      todayPending: true,
    });
  };

  // Helper function to invalidate all revenue-related queries
  const invalidateAllRevenueQueries = () => {
    if (!getFlagBool('REALTIME_PATCH_MODE', true)) {
      queryClient.invalidateQueries({ queryKey: ['revenues'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
    // Use the shared scheduler to coalesce derived invalidations
    scheduleDerivedInvalidations({
      profitLoss: true,
      approvals: true,
      todayPending: true,
    });
  };

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isEditExpenseDialogOpen, setIsEditExpenseDialogOpen] = useState(false);
  const [isEditRevenueDialogOpen, setIsEditRevenueDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editingRevenue, setEditingRevenue] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: number;
    type: 'expense' | 'revenue';
    category?: string;
    source?: string;
    propertyName: string;
    amountCents: number;
    description?: string;
    receiptUrl?: string;
    receiptFileId?: number;
    date: Date;
    createdAt?: Date;
    createdByName: string;
    status?: string;
    paymentMode?: string;
    bankReference?: string;
    approvedByName?: string;
    approvedAt?: Date;
  } | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Debug date range changes
  React.useEffect(() => {
    if (__DEV__) {
      console.log('=== DATE RANGE STATE CHANGED ===');
      console.log('New dateRange:', dateRange);
    }
  }, [dateRange]);

  // Date validation function
  const validateDateRange = (startDate: string, endDate: string) => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        toast({
          variant: "destructive",
          title: "Invalid date range",
          description: "Start date must be before or equal to end date.",
        });
        return false;
      }
    }
    return true;
  };

  // Enhanced date range change handler
  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    if (__DEV__) {
      console.log('=== DATE RANGE CHANGE DEBUG ===');
      console.log('Field:', field);
      console.log('Value:', value);
      console.log('Current dateRange:', dateRange);
    }

    const newDateRange = { ...dateRange, [field]: value };

    // If only start date is provided, set end date to the same date for full day filtering
    if (field === 'startDate' && value && !newDateRange.endDate) {
      newDateRange.endDate = value;
      if (__DEV__) console.log('Auto-setting endDate to:', value);
    }

    // If only end date is provided, set start date to the same date for full day filtering
    if (field === 'endDate' && value && !newDateRange.startDate) {
      newDateRange.startDate = value;
      if (__DEV__) console.log('Auto-setting startDate to:', value);
    }

    if (field === 'startDate' && newDateRange.endDate && value > newDateRange.endDate) {
      // Auto-adjust end date if it's before start date
      newDateRange.endDate = value;
      if (__DEV__) console.log('Auto-adjusting endDate to:', value);
    }

    if (__DEV__) console.log('New dateRange:', newDateRange);

    if (validateDateRange(newDateRange.startDate, newDateRange.endDate)) {
      setDateRange(newDateRange);
      if (__DEV__) console.log('Date range updated successfully');
    } else {
      if (__DEV__) console.log('Date range validation failed');
    }
  };
  const [expenseForm, setExpenseForm] = useState({
    propertyId: '',
    category: '',
    amountCents: '',
    description: '',
    receiptUrl: '',
    receiptFile: null as { fileId: number; filename: string } | null,
    expenseDate: getCurrentDateString(),
    paymentMode: 'cash' as 'cash' | 'bank',
    bankReference: '',
  });
  const [revenueForm, setRevenueForm] = useState({
    propertyId: '',
    source: 'other' as 'room' | 'addon' | 'other',
    amountCents: '',
    description: '',
    receiptUrl: '',
    receiptFile: null as { fileId: number; filename: string } | null,
    occurredAt: getCurrentDateString(),
    paymentMode: 'cash' as 'cash' | 'bank',
    bankReference: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
    enabled: routeActive,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  // Helper to resolve property name for optimistic rows
  const getPropertyName = (propertyId: number): string => {
    const fromProps = (properties?.properties || []).find((p: any) => p.id === propertyId)?.name;
    if (fromProps) return fromProps;
    try {
      const candidates = queryClient.getQueriesData({ queryKey: ['revenues'] });
      for (const [, data] of candidates) {
        const found = (data as any)?.revenues?.find((r: any) => r.propertyId === propertyId);
        if (found?.propertyName) return found.propertyName;
      }
    } catch { }
    try {
      const candidates = queryClient.getQueriesData({ queryKey: ['expenses'] });
      for (const [, data] of candidates) {
        const found = (data as any)?.expenses?.find((e: any) => e.propertyId === propertyId);
        if (found?.propertyName) return found.propertyName;
      }
    } catch { }
    return `Property #${propertyId}`;
  };

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', selectedPropertyId, dateRange],
    queryFn: async () => {
      if (__DEV__) console.log('Fetching expenses with filters:', {
        propertyId: selectedPropertyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const backend = getAuthenticatedBackend();
      const result = await backend.finance.listExpenses({
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        limit: 100,
        offset: 0
      });

      // Debug logging for approval information
      if (__DEV__ && result?.expenses) {
        console.log('Expenses with approval info:', result.expenses.map((expense: any) => ({
          id: expense.id,
          status: expense.status,
          approvedByName: expense.approvedByName,
          approvedAt: expense.approvedAt,
          createdByName: expense.createdByName
        })));
      }

      return result;
    },
    enabled: routeActive,
    ...(getFlagBool('REALTIME_PATCH_MODE', true) ? QUERY_CATEGORIES['realtime-connected'] : QUERY_CATEGORIES.expenses),
  });

  const { data: revenues, isLoading: revenuesLoading } = useQuery({
    queryKey: ['revenues', selectedPropertyId, dateRange],
    queryFn: async () => {
      if (__DEV__) {
        console.log('=== REVENUE FILTER DEBUG ===');
        console.log('Date range state:', dateRange);
        console.log('Selected property ID:', selectedPropertyId);
        console.log('Start date:', dateRange.startDate);
        console.log('End date:', dateRange.endDate);
        console.log('Will send to backend:', {
          propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        });
      }

      const backend = getAuthenticatedBackend();
      const result = await backend.finance.listRevenues({
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });

      // Debug logging for approval information
      if (__DEV__ && result?.revenues) {
        console.log('Revenues with approval info:', result.revenues.map((revenue: any) => ({
          id: revenue.id,
          status: revenue.status,
          approvedByName: revenue.approvedByName,
          approvedAt: revenue.approvedAt,
          createdByName: revenue.createdByName
        })));
      }

      return result;
    },
    enabled: routeActive,
    ...(getFlagBool('REALTIME_PATCH_MODE', true) ? QUERY_CATEGORIES['realtime-connected'] : QUERY_CATEGORIES.revenues),
  });

  // Reconcile totals from server lists (base truth)
  useEffect(() => {
    const cashRev = revenues?.revenues
      ?.filter((r: any) => r.paymentMode === 'cash' && r.status === 'approved')
      ?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0;
    const bankRev = revenues?.revenues
      ?.filter((r: any) => r.paymentMode === 'bank' && r.status === 'approved')
      ?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0;
    const cashExp = expenses?.expenses
      ?.filter((e: any) => e.paymentMode === 'cash' && e.status === 'approved')
      ?.reduce((sum: number, e: any) => sum + e.amountCents, 0) || 0;
    const bankExp = expenses?.expenses
      ?.filter((e: any) => e.paymentMode === 'bank' && e.status === 'approved')
      ?.reduce((sum: number, e: any) => sum + e.amountCents, 0) || 0;
    setTotals({
      cashRevenue: cashRev,
      bankRevenue: bankRev,
      cashExpense: cashExp,
      bankExpense: bankExp,
    });
  }, [expenses, revenues]);

  const { data: profitLoss } = useQuery({
    queryKey: ['profit-loss', selectedPropertyId, dateRange],
    queryFn: async () => {
      if (__DEV__) console.log('Fetching profit-loss with filters:', {
        propertyId: selectedPropertyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      const backend = getAuthenticatedBackend();
      return backend.reports.getMonthlyYearlyReport({
        propertyId: selectedPropertyId && selectedPropertyId !== 'all' ? parseInt(selectedPropertyId) : undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
    },
    enabled: routeActive,
    ...QUERY_CATEGORIES.analytics,
  });

  // Check daily approval status for managers (centralized hook)
  const { data: approvalStatus } = useDailyApprovalCheck();

  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      if (__DEV__) {
        console.log('=== ADD EXPENSE MUTATION ===');
        console.log('Input data:', data);
      }

      const backend = getAuthenticatedBackend();
      const result = await backend.finance.addExpense({
        ...data,
        propertyId: parseInt(data.propertyId),
        amountCents: parseInt(data.amountCents),
        receiptFileId: data.receiptFile?.fileId || undefined,
        expenseDate: formatDateForAPI(data.expenseDate),
        paymentMode: data.paymentMode || 'cash',
        bankReference: data.bankReference || undefined,
      });

      if (__DEV__) console.log('Add expense result:', result);
      return result;
    },
    onMutate: async (newExpense) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });

      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData(['expenses']);

      // Generate a unique temporary ID for optimistic update
      const tempId = `temp_${Date.now()}_${Math.random()}`;

      // Optimistically update the cache across matching queries
      applyToMatchingQueries(
        'expenses',
        parseInt(newExpense.propertyId),
        formatDateForAPI(newExpense.expenseDate),
        (old: any) => {
          if (!old?.expenses) return old;
          const statusForRole = user?.role === 'ADMIN' ? 'approved' : 'pending';
          const approvedFields = user?.role === 'ADMIN'
            ? { approvedByUserId: parseInt(user.userID), approvedAt: new Date().toISOString() }
            : {};
          const optimisticExpense = {
            id: tempId, // Unique temporary ID
            ...newExpense,
            amountCents: parseInt(newExpense.amountCents),
            propertyId: parseInt(newExpense.propertyId),
            propertyName: getPropertyName(parseInt(newExpense.propertyId)),
            status: statusForRole,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isOptimistic: true,
            ...approvedFields,
          };
          return {
            ...old,
            expenses: [optimisticExpense, ...old.expenses],
            totalAmount: (old.totalAmount || 0) + parseInt(newExpense.amountCents),
          };
        }
      );

      // Store temp ID for later removal
      (newExpense as any).tempId = tempId;

      return { previousExpenses };
    },
    onSuccess: (data, variables) => {
      if (__DEV__) console.log('Expense added successfully:', data);

      // Update the cache with real data from the server across matching queries
      applyToMatchingQueries(
        'expenses',
        data.propertyId,
        data.expenseDate ? new Date(data.expenseDate as any).toISOString() : undefined,
        (old: any) => {
          if (!old?.expenses) return old;
          const tempId = (variables as any).tempId;
          // Remove optimistic placeholder if present
          const filteredExpenses = tempId ? old.expenses.filter((expense: any) => expense.id !== tempId) : [...old.expenses];
          // If realtime already inserted the real row, avoid duplicate
          if (filteredExpenses.some((e: any) => e.id === data.id)) {
            return { ...old, expenses: filteredExpenses };
          }
          const realExpense = {
            id: data.id,
            propertyId: data.propertyId,
            // Prefer backend propertyName, otherwise resolve from cache to avoid "Unknown Property"
            propertyName: data.propertyName || getPropertyName(data.propertyId),
            category: data.category,
            amountCents: data.amountCents,
            currency: data.currency,
            description: data.description,
            receiptUrl: data.receiptUrl,
            receiptFileId: data.receiptFileId,
            expenseDate: data.expenseDate,
            status: data.status || 'pending',
            createdByUserId: data.createdByUserId,
            createdByName: data.createdByName || 'Current User',
            approvedByUserId: data.approvedByUserId,
            approvedByName: data.approvedByName,
            approvedAt: data.approvedAt,
            createdAt: data.createdAt,
            paymentMode: data.paymentMode,
            bankReference: data.bankReference,
          };
          return {
            ...old,
            expenses: [realExpense, ...filteredExpenses],
            totalAmount: (old.totalAmount || 0) + data.amountCents,
          };
        }
      );

      // Clear form and show success
      setIsExpenseDialogOpen(false);
      setExpenseForm({
        propertyId: '',
        category: '',
        amountCents: '',
        description: '',
        receiptUrl: '',
        receiptFile: null,
        expenseDate: getCurrentDateString(),
        paymentMode: 'cash',
        bankReference: '',
      });
      toast({
        title: "Expense added",
        description: "The expense has been recorded successfully.",
      });
    },
    onError: (error: any, newExpense, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses'], context.previousExpenses);
      }

      console.error('Add expense error:', error);

      // Check if this is an authentication error
      if (error.message?.includes('Invalid token') || error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Your session has expired. Please log in again to continue.",
        });

        // Redirect to login after a short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);

        return;
      }

      // Handle other errors
      toast({
        variant: "destructive",
        title: "Failed to add expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const addRevenueMutation = useMutation({
    mutationFn: async (data: any) => {
      if (__DEV__) {
        console.log('=== ADD REVENUE MUTATION ===');
        console.log('Input data:', data);
      }

      const backend = getAuthenticatedBackend();
      const result = await backend.finance.addRevenue({
        ...data,
        propertyId: parseInt(data.propertyId),
        amountCents: parseInt(data.amountCents),
        receiptFileId: data.receiptFile?.fileId || undefined,
        occurredAt: formatDateForAPI(data.occurredAt),
        paymentMode: data.paymentMode || 'cash',
        bankReference: data.bankReference || undefined,
      });

      if (__DEV__) console.log('Add revenue result:', result);
      return result;
    },
    onMutate: async (newRevenue) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['revenues'] });

      // Snapshot the previous value
      const previousRevenues = queryClient.getQueryData(['revenues']);

      // Optimistically update the cache across matching queries
      applyToMatchingQueries(
        'revenues',
        parseInt(newRevenue.propertyId),
        formatDateForAPI(newRevenue.occurredAt),
        (old: any) => {
          if (!old?.revenues) return old;
          const statusForRole = user?.role === 'ADMIN' ? 'approved' : 'pending';
          const approvedFields = user?.role === 'ADMIN'
            ? { approvedByUserId: parseInt(user.userID), approvedAt: new Date().toISOString() }
            : {};
          const optimisticRevenue = {
            id: Date.now(),
            ...newRevenue,
            amountCents: parseInt(newRevenue.amountCents),
            propertyId: parseInt(newRevenue.propertyId),
            propertyName: getPropertyName(parseInt(newRevenue.propertyId)),
            status: statusForRole,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isOptimistic: true,
            ...approvedFields,
          };
          return {
            ...old,
            revenues: [optimisticRevenue, ...old.revenues],
          };
        }
      );

      return { previousRevenues };
    },
    onSuccess: (data) => {
      if (__DEV__) console.log('Revenue added successfully');
      // Reconcile optimistic entry with server data across matching queries
      applyToMatchingQueries(
        'revenues',
        data.propertyId,
        data.occurredAt ? new Date(data.occurredAt as any).toISOString() : undefined,
        (old: any) => {
          if (!old?.revenues) return old;
          const updated = [...old.revenues];
          // If realtime already inserted the real row, avoid duplicate and remove optimistic leftovers
          if (updated.some((r: any) => r.id === data.id)) {
            const cleaned = updated.filter((r: any) => !(r.isOptimistic && typeof r.id === 'number' && r.id > 9e11));
            return { ...old, revenues: cleaned };
          }
          const idx = updated.findIndex((r: any) => r.isOptimistic && typeof r.id === 'number' && r.id > 9e11);
          const real = data && data.id ? {
            id: data.id,
            propertyId: data.propertyId,
            // Prefer backend propertyName, otherwise resolve from cache to avoid "Unknown Property"
            propertyName: data.propertyName || getPropertyName(data.propertyId),
            source: data.source,
            amountCents: data.amountCents,
            currency: data.currency,
            description: data.description,
            receiptUrl: data.receiptUrl,
            receiptFileId: data.receiptFileId,
            occurredAt: data.occurredAt,
            status: data.status || 'pending',
            createdByUserId: data.createdByUserId,
            createdByName: data.createdByName || 'Current User',
            approvedByUserId: data.approvedByUserId,
            approvedByName: data.approvedByName,
            approvedAt: data.approvedAt,
            createdAt: data.createdAt,
            paymentMode: data.paymentMode,
            bankReference: data.bankReference,
          } : null;
          if (real && idx >= 0) {
            updated[idx] = real;
          } else if (real) {
            updated.unshift(real);
          }
          return { ...old, revenues: updated };
        }
      );
      // Clear form and show success
      setIsRevenueDialogOpen(false);
      setRevenueForm({
        propertyId: '',
        source: 'other',
        amountCents: '',
        description: '',
        receiptUrl: '',
        receiptFile: null,
        occurredAt: getCurrentDateString(),
        paymentMode: 'cash',
        bankReference: '',
      });
      toast({
        title: "Revenue added",
        description: "The revenue has been recorded successfully.",
      });
    },
    onError: (error: any, newRevenue, context) => {
      // Rollback on error
      if (context?.previousRevenues) {
        queryClient.setQueryData(['revenues'], context.previousRevenues);
      }

      console.error('Add revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to add revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await backend.finance.approveExpenseById(id, { approved });
        return response;
      } catch (error: any) {
        console.error('Approve expense error:', error);
        throw new Error(error.message || 'Failed to approve expense');
      }
    },
    onMutate: async ({ id, approved }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });

      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData(['expenses']);

      // Optimistically update the cache across matching queries
      applyToMatchingQueries('expenses', undefined, undefined, (old: any) => {
        if (!old?.expenses) return old;
        return {
          ...old,
          expenses: old.expenses.map((expense: any) =>
            expense.id === id
              ? { ...expense, status: approved ? 'approved' : 'rejected' }
              : expense
          )
        };
      });

      return { previousExpenses };
    },
    onSuccess: (data, variables) => {
      if (__DEV__) console.log('Expense approval successful:', data);

      // Update cache with server response across matching queries
      applyToMatchingQueries('expenses', data.propertyId, data.expenseDate ? new Date(data.expenseDate as any).toISOString() : undefined, (old: any) => {
        if (!old?.expenses) return old;
        return {
          ...old,
          expenses: old.expenses.map((expense: any) =>
            expense.id === variables.id
              ? {
                ...expense,
                status: variables.approved ? 'approved' : 'rejected',
                approvedByUserId: data.approvedByUserId,
                approvedByName: data.approvedByName,
                approvedAt: data.approvedAt
              }
              : expense
          )
        };
      });

      toast({
        title: "Expense updated",
        description: "The expense status has been updated.",
      });
    },
    onError: (error: any, { id, approved }, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses'], context.previousExpenses);
      }

      console.error('Approve expense error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const approveRevenueMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: number; approved: boolean }) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await backend.finance.approveRevenueById(id, { approved });
        return response;
      } catch (error: any) {
        console.error('Approve revenue error:', error);
        throw new Error(error.message || 'Failed to approve revenue');
      }
    },
    onMutate: async ({ id, approved }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['revenues'] });

      // Snapshot the previous value
      const previousRevenues = queryClient.getQueryData(['revenues']);

      // Optimistically update the cache across matching queries
      applyToMatchingQueries('revenues', undefined, undefined, (old: any) => {
        if (!old?.revenues) return old;
        return {
          ...old,
          revenues: old.revenues.map((revenue: any) =>
            revenue.id === id
              ? { ...revenue, status: approved ? 'approved' : 'rejected' }
              : revenue
          )
        };
      });

      return { previousRevenues };
    },
    onSuccess: () => {
      if (__DEV__) console.log('Revenue approval successful');

      toast({
        title: "Revenue updated",
        description: "The revenue status has been updated.",
      });
    },
    onError: (error: any, { id, approved }, context) => {
      // Rollback on error
      if (context?.previousRevenues) {
        queryClient.setQueryData(['revenues'], context.previousRevenues);
      }

      console.error('Approve revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      // Extract ID and pass it as first parameter, rest as second parameter
      const expenseId = parseInt(data.id);
      if (isNaN(expenseId) || expenseId <= 0) {
        throw new Error('Invalid expense ID');
      }

      return backend.finance.updateExpense(expenseId, {
        propertyId: parseInt(data.propertyId),
        category: data.category,
        amountCents: parseInt(data.amountCents),
        description: data.description,
        receiptUrl: data.receiptUrl,
        receiptFileId: data.receiptFileId, // Fixed: was data.receiptFile?.fileId
        expenseDate: new Date(data.expenseDate), // Convert string to Date object
        paymentMode: data.paymentMode || 'cash',
        bankReference: data.bankReference || undefined,
      });
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });

      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData(['expenses']);

      // Optimistically update the expense in the cache across matching queries
      applyToMatchingQueries('expenses', parseInt(data.propertyId), data.expenseDate, (old: any) => {
        if (!old?.expenses) return old;
        const expenseId = parseInt(data.id);
        const oldExpense = old.expenses.find((expense: any) => expense.id === expenseId);
        if (!oldExpense) return old;
        const updatedExpenses = old.expenses.map((expense: any) =>
          expense.id === expenseId
            ? {
              ...expense,
              propertyId: parseInt(data.propertyId),
              category: data.category,
              amountCents: parseInt(data.amountCents),
              description: data.description,
              receiptUrl: data.receiptUrl,
              receiptFileId: data.receiptFile?.fileId || expense.receiptFileId,
              expenseDate: new Date(data.expenseDate),
              paymentMode: data.paymentMode || 'cash',
              bankReference: data.bankReference || expense.bankReference,
              status: user?.role === 'MANAGER' ? 'pending' : expense.status,
              updatedAt: new Date().toISOString(),
            }
            : expense
        );
        const newTotalAmount = updatedExpenses.reduce((sum: number, expense: any) => sum + expense.amountCents, 0);
        return { ...old, expenses: updatedExpenses, totalAmount: newTotalAmount };
      });

      return { previousExpenses };
    },
    onSuccess: (data) => {
      // Update with real server data across matching queries
      applyToMatchingQueries('expenses', data.propertyId, data.expenseDate ? new Date(data.expenseDate as any).toISOString() : undefined, (old: any) => {
        if (!old?.expenses) return old;
        const updatedExpenses = old.expenses.map((expense: any) =>
          expense.id === data.id ? { ...expense, ...data } : expense
        );
        const newTotalAmount = updatedExpenses.reduce((sum: number, expense: any) => sum + expense.amountCents, 0);
        return { ...old, expenses: updatedExpenses, totalAmount: newTotalAmount };
      });

      setIsEditExpenseDialogOpen(false);
      setEditingExpense(null);
      toast({
        title: "Expense updated",
        description: user?.role === 'MANAGER'
          ? "The expense has been updated and is pending approval."
          : "The expense has been updated successfully.",
      });
    },
    onError: (error: any, data, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses'], context.previousExpenses);
      }

      console.error('Update expense error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const updateRevenueMutation = useMutation({
    mutationFn: async (data: any) => {
      const backend = getAuthenticatedBackend();
      // Extract ID and pass it as first parameter, rest as second parameter
      const revenueId = parseInt(data.id);
      if (isNaN(revenueId) || revenueId <= 0) {
        throw new Error('Invalid revenue ID');
      }

      return backend.finance.updateRevenue(revenueId, {
        propertyId: parseInt(data.propertyId),
        source: data.source,
        amountCents: parseInt(data.amountCents),
        description: data.description,
        receiptUrl: data.receiptUrl,
        receiptFileId: data.receiptFileId, // Fixed: was data.receiptFile?.fileId
        occurredAt: data.occurredAt, // This is already a Date object from handleUpdateRevenueSubmit
        paymentMode: data.paymentMode || 'cash',
        bankReference: data.bankReference || undefined,
      });
    },
    onSuccess: (data) => {
      // Row-level update for revenue list across matching queries
      applyToMatchingQueries('revenues', data.propertyId, data.occurredAt ? new Date(data.occurredAt as any).toISOString() : undefined, (old: any) => {
        if (!old?.revenues) return old;
        const updated = old.revenues.map((r: any) => r.id === data.id ? { ...r, ...data } : r);
        return { ...old, revenues: updated };
      });
      setIsEditRevenueDialogOpen(false);
      setEditingRevenue(null);
      toast({
        title: "Revenue updated",
        description: user?.role === 'MANAGER'
          ? "The revenue has been updated and is pending approval."
          : "The revenue has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Update revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to update revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await backend.finance.deleteExpense(id);
        return response;
      } catch (error: any) {
        console.error('Delete expense error:', error);
        throw new Error(error.message || 'Failed to delete expense');
      }
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] });

      // Snapshot the previous value
      const previousExpenses = queryClient.getQueryData(['expenses']);

      // Optimistically update to remove the expense immediately
      queryClient.setQueryData(['expenses'], (old: any) => {
        if (!old?.expenses) return old;

        const expenseToDelete = old.expenses.find((expense: any) => expense.id === deletedId);
        const updatedExpenses = old.expenses.filter((expense: any) => expense.id !== deletedId);

        return {
          ...old,
          expenses: updatedExpenses,
          totalCount: old.totalCount - 1,
          totalAmount: expenseToDelete ? (old.totalAmount || 0) - expenseToDelete.amountCents : old.totalAmount
        };
      });

      // Return a context object with the snapshotted value
      return { previousExpenses };
    },
    onSuccess: (data) => {
      // Fallback: ensure lists revalidate quickly even if realtime is delayed
      try { queryClient.invalidateQueries({ queryKey: ['expenses'] }); } catch { }
      // Keep optimistic removal; nothing else to do for list
      try {
        const payload = { type: 'expense_deleted', id: (data as any)?.id ?? null, ts: new Date().toISOString() };
        sendTelemetry(1.0, [payload]);
      } catch { }
      toast({
        title: data.deleted ? "Expense deleted" : "Deletion requested",
        description: data.deleted
          ? "The expense has been deleted successfully."
          : "Expense deletion has been requested and is pending approval.",
      });
    },
    onError: (error: any, deletedId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousExpenses) {
        queryClient.setQueryData(['expenses'], context.previousExpenses);
      }

      console.error('Delete expense error:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete expense",
        description: error.message || "Please try again.",
      });
    },
  });

  const deleteRevenueMutation = useMutation({
    mutationFn: async (id: number) => {
      const backend = getAuthenticatedBackend();
      if (!backend) {
        throw new Error('Not authenticated');
      }

      try {
        const response = await backend.finance.deleteRevenue(id);
        return response;
      } catch (error: any) {
        console.error('Delete revenue error:', error);
        throw new Error(error.message || 'Failed to delete revenue');
      }
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['revenues'] });

      // Snapshot the previous value
      const previousRevenues = queryClient.getQueryData(['revenues']);

      // Optimistically update to remove the revenue immediately
      queryClient.setQueryData(['revenues'], (old: any) => {
        if (!old?.revenues) return old;
        return {
          ...old,
          revenues: old.revenues.filter((revenue: any) => revenue.id !== deletedId)
        };
      });

      // Return a context object with the snapshotted value
      return { previousRevenues };
    },
    onSuccess: (data) => {
      // Fallback: ensure lists revalidate quickly even if realtime is delayed
      try { queryClient.invalidateQueries({ queryKey: ['revenues'] }); } catch { }
      // Keep optimistic removal; avoid broad invalidations
      try {
        const payload = { type: 'revenue_deleted', id: (data as any)?.id ?? null, ts: new Date().toISOString() };
        sendTelemetry(1.0, [payload]);
      } catch { }
      toast({
        title: data.deleted ? "Revenue deleted" : "Deletion requested",
        description: data.deleted
          ? "The revenue has been deleted successfully."
          : "Revenue deletion has been requested and is pending approval.",
      });
    },
    onError: (error: any, deletedId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousRevenues) {
        queryClient.setQueryData(['revenues'], context.previousRevenues);
      }

      console.error('Delete revenue error:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete revenue",
        description: error.message || "Please try again.",
      });
    },
  });

  const formatCurrency = (amountCents: number) => {
    return formatCurrencyUtil(amountCents, theme.currency);
  };

  // Helper function to format period label
  const formatPeriodLabel = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // If same month and year, show just the month
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }

    // If different months, show the range
    return `${monthNames[start.getMonth()]} ${start.getFullYear()} - ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
  };

  // File upload handler for revenue form
  const handleRevenueFileUpload = async (file: File): Promise<{ fileId: number; filename: string; url: string }> => {
    if (isUploading) {
      throw new Error('Upload in progress, please wait...');
    }

    setIsUploading(true);

    try {
      if (__DEV__) console.log(`Starting revenue file upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Compress image if needed (only for images > 10MB)
      const compressionResult = await compressImageIfNeeded(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
        quality: 0.8
      });

      if (__DEV__ && compressionResult.wasCompressed) {
        console.log(`Image compressed: ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)}MB`);
      }

      // Convert compressed/original file to base64 using chunked approach
      const arrayBuffer = await compressionResult.file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const base64String = bufferToBase64(buffer);

      if (__DEV__) console.log(`Base64 encoding complete, sending to API...`);

      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          fileData: base64String,
          filename: compressionResult.file.name,
          mimeType: compressionResult.file.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();

      const result = {
        fileId: uploadResult.fileId,
        filename: uploadResult.filename,
        url: uploadResult.url,
      };

      // Update revenue form state
      setRevenueForm(prev => ({
        ...prev,
        receiptFile: { fileId: result.fileId, filename: result.filename }
      }));

      if (__DEV__) console.log(`Revenue file upload successful: ${result.filename}`);
      return result;
    } catch (error) {
      console.error('Revenue file upload error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  // File upload handler for expense form
  const handleExpenseFileUpload = async (file: File): Promise<{ fileId: number; filename: string; url: string }> => {
    if (isUploading) {
      throw new Error('Upload in progress, please wait...');
    }

    setIsUploading(true);

    try {
      if (__DEV__) console.log(`Starting expense file upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // Compress image if needed (only for images > 10MB)
      const compressionResult = await compressImageIfNeeded(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
        quality: 0.8
      });

      if (__DEV__ && compressionResult.wasCompressed) {
        console.log(`Image compressed: ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)}MB`);
      }

      // Convert compressed/original file to base64 using chunked approach
      const arrayBuffer = await compressionResult.file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const base64String = bufferToBase64(buffer);

      if (__DEV__) console.log(`Base64 encoding complete, sending to API...`);

      // Direct API call since uploads service isn't in generated client yet
      const response = await fetch(`${API_CONFIG.BASE_URL}/uploads/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          fileData: base64String,
          filename: compressionResult.file.name,
          mimeType: compressionResult.file.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();

      const result = {
        fileId: uploadResult.fileId,
        filename: uploadResult.filename,
        url: uploadResult.url,
      };

      // Update expense form state
      setExpenseForm(prev => ({
        ...prev,
        receiptFile: { fileId: result.fileId, filename: result.filename }
      }));

      if (__DEV__) console.log(`Expense file upload successful: ${result.filename}`);
      return result;
    } catch (error) {
      console.error('Expense file upload error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'room': return 'bg-blue-100 text-blue-800';
      case 'addon': return 'bg-purple-100 text-purple-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExpenseSubmit = () => {
    setFormError(null);
    const missingFields: string[] = [];
    if (!expenseForm.propertyId) missingFields.push("Property");
    if (!expenseForm.category) missingFields.push("Category");
    if (!expenseForm.amountCents) missingFields.push("Amount");
    if (!expenseForm.expenseDate) missingFields.push("Date");

    if (missingFields.length > 0) {
      setFormError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }
    addExpenseMutation.mutate(expenseForm);
  };

  const handleRevenueSubmit = () => {
    setFormError(null);
    const missingFields: string[] = [];
    if (!revenueForm.propertyId) missingFields.push("Property");
    if (!revenueForm.amountCents) missingFields.push("Amount");
    if (!revenueForm.occurredAt) missingFields.push("Date");

    if (missingFields.length > 0) {
      setFormError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }
    addRevenueMutation.mutate(revenueForm);
  };

  const handleEditExpense = (expense: any) => {
    console.log('=== EDIT EXPENSE DEBUG ===');
    console.log('Expense object:', expense);
    console.log('Expense ID:', expense.id, 'Type:', typeof expense.id);
    console.log('Expense ID parsed:', parseInt(expense.id), 'Is NaN:', isNaN(parseInt(expense.id)));

    // Comprehensive validation of expense object
    if (!expense) {
      console.error('Expense object is null or undefined');
      toast({
        variant: "destructive",
        title: "Invalid expense",
        description: "Cannot edit expense: expense data is missing.",
      });
      return;
    }

    if (!expense.id) {
      console.error('Expense ID is missing:', expense);
      toast({
        variant: "destructive",
        title: "Invalid expense",
        description: "Cannot edit expense: missing expense ID.",
      });
      return;
    }

    // Check if expense.id is an object (this is the bug!)
    if (typeof expense.id === 'object') {
      console.error('Expense ID is an object instead of a number:', expense.id);
      console.error('Expense ID stringified:', JSON.stringify(expense.id));
      toast({
        variant: "destructive",
        title: "Invalid expense ID",
        description: "Cannot edit expense: ID is in wrong format. Please refresh and try again.",
      });
      return;
    }

    // Convert to string first, then parse to number
    const expenseIdString = String(expense.id);
    const expenseId = parseInt(expenseIdString);

    console.log('Expense ID conversion:', {
      original: expense.id,
      stringified: expenseIdString,
      parsed: expenseId,
      isNaN: isNaN(expenseId)
    });

    if (isNaN(expenseId) || expenseId <= 0) {
      console.error('Expense ID is not a valid number after conversion:', {
        original: expense.id,
        stringified: expenseIdString,
        parsed: expenseId,
        type: typeof expense.id
      });
      toast({
        variant: "destructive",
        title: "Invalid expense ID",
        description: `Cannot edit expense: invalid ID "${expense.id}". Please refresh and try again.`,
      });
      return;
    }

    // Validate required expense fields
    if (!expense.propertyId || !expense.category || !expense.amountCents) {
      console.error('Expense missing required fields:', {
        propertyId: expense.propertyId,
        category: expense.category,
        amountCents: expense.amountCents
      });
      toast({
        variant: "destructive",
        title: "Incomplete expense data",
        description: "Cannot edit expense: missing required information. Please refresh and try again.",
      });
      return;
    }

    console.log('Expense validation passed, proceeding with edit');

    // Ensure the expense object has a proper numeric ID
    const validatedExpense = {
      ...expense,
      id: expenseId // Ensure ID is a number
    };

    setEditingExpense(validatedExpense);
    setExpenseForm({
      propertyId: expense.propertyId.toString(),
      category: expense.category,
      amountCents: expense.amountCents.toString(),
      description: expense.description || '',
      receiptUrl: expense.receiptUrl || '',
      receiptFile: expense.receiptFileId ? { fileId: expense.receiptFileId, filename: 'Existing file' } : null,
      expenseDate: formatDateForInput(expense.expenseDate),
      paymentMode: expense.paymentMode,
      bankReference: expense.bankReference || '',
    });
    setIsEditExpenseDialogOpen(true);
  };

  const handleEditRevenue = (revenue: any) => {
    console.log('=== EDIT REVENUE DEBUG ===');
    console.log('Revenue object:', revenue);
    console.log('Revenue ID:', revenue.id, 'Type:', typeof revenue.id);
    console.log('Revenue ID parsed:', parseInt(revenue.id), 'Is NaN:', isNaN(parseInt(revenue.id)));
    console.log('Revenue occurredAt:', revenue.occurredAt, 'Type:', typeof revenue.occurredAt);
    console.log('Formatted for input:', formatDateForInput(revenue.occurredAt));

    if (!revenue || !revenue.id) {
      console.error('Invalid revenue object or missing ID:', revenue);
      toast({
        variant: "destructive",
        title: "Invalid revenue",
        description: "Cannot edit revenue: missing ID.",
      });
      return;
    }

    setEditingRevenue(revenue);
    setRevenueForm({
      propertyId: revenue.propertyId.toString(),
      source: revenue.source,
      amountCents: revenue.amountCents.toString(),
      description: revenue.description || '',
      receiptUrl: revenue.receiptUrl || '',
      receiptFile: revenue.receiptFileId ? { fileId: revenue.receiptFileId, filename: 'Existing file' } : null,
      occurredAt: formatDateForInput(revenue.occurredAt),
      paymentMode: revenue.paymentMode,
      bankReference: revenue.bankReference || '',
    });
    setIsEditRevenueDialogOpen(true);
  };

  const handleUpdateExpenseSubmit = () => {
    console.log('=== UPDATE EXPENSE SUBMIT DEBUG ===');
    console.log('Expense form:', expenseForm);
    console.log('Editing expense:', editingExpense);

    // Validate form fields
    if (!expenseForm.propertyId || !expenseForm.category || !expenseForm.amountCents) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // Validate expense ID
    if (!editingExpense || !editingExpense.id) {
      console.error('Expense ID validation failed:', { editingExpense });
      toast({
        variant: "destructive",
        title: "Invalid expense",
        description: "Cannot update expense: missing expense ID. Please refresh and try again.",
      });
      return;
    }

    console.log('=== UPDATE EXPENSE ID DEBUG ===');
    console.log('Editing expense:', editingExpense);
    console.log('Editing expense ID:', editingExpense.id, 'Type:', typeof editingExpense.id);

    // Check if editingExpense.id is an object (this should not happen after our fix)
    if (typeof editingExpense.id === 'object') {
      console.error('CRITICAL: Editing expense ID is still an object:', editingExpense.id);
      toast({
        variant: "destructive",
        title: "Invalid expense ID",
        description: "Cannot update expense: ID is in wrong format. Please refresh and try again.",
      });
      return;
    }

    // Convert to string first, then parse to number
    const expenseIdString = String(editingExpense.id);
    const expenseId = parseInt(expenseIdString);

    console.log('Update expense ID conversion:', {
      original: editingExpense.id,
      stringified: expenseIdString,
      parsed: expenseId,
      isNaN: isNaN(expenseId)
    });

    if (isNaN(expenseId) || expenseId <= 0) {
      console.error('Expense ID is not a valid number during update:', {
        original: editingExpense.id,
        stringified: expenseIdString,
        parsed: expenseId,
        type: typeof editingExpense.id
      });
      toast({
        variant: "destructive",
        title: "Invalid expense ID",
        description: `Cannot update expense: invalid ID "${editingExpense.id}". Please refresh and try again.`,
      });
      return;
    }

    // Validate amount is a positive number
    const amountCents = parseInt(expenseForm.amountCents);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than zero.",
      });
      return;
    }

    // Validate property ID
    const propertyId = parseInt(expenseForm.propertyId);
    if (isNaN(propertyId) || propertyId <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid property",
        description: "Please select a valid property.",
      });
      return;
    }

    console.log('All validations passed, submitting expense update with ID:', expenseId);

    const updateData = {
      id: expenseId,
      propertyId: propertyId,
      category: expenseForm.category,
      amountCents: amountCents,
      description: expenseForm.description || undefined,
      receiptUrl: expenseForm.receiptUrl || undefined,
      receiptFileId: expenseForm.receiptFile?.fileId || undefined,
      expenseDate: expenseForm.expenseDate, // Pass the date string directly - will be converted to Date object in mutation
      paymentMode: expenseForm.paymentMode || 'cash',
      bankReference: expenseForm.bankReference || undefined,
    };

    console.log('Update data being sent:', updateData);
    updateExpenseMutation.mutate(updateData);
  };

  const handleUpdateRevenueSubmit = () => {
    console.log('=== UPDATE REVENUE SUBMIT DEBUG ===');
    console.log('Revenue form:', revenueForm);
    console.log('Editing revenue:', editingRevenue);

    // Validate form fields
    if (!revenueForm.propertyId || !revenueForm.amountCents) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // Validate date field with comprehensive checks
    if (!revenueForm.occurredAt) {
      toast({
        variant: "destructive",
        title: "Missing date",
        description: "Please select a date for the revenue.",
      });
      return;
    }

    // Check if occurredAt is a string
    if (typeof revenueForm.occurredAt !== 'string') {
      console.error('Revenue occurredAt is not a string:', revenueForm.occurredAt, 'Type:', typeof revenueForm.occurredAt);
      toast({
        variant: "destructive",
        title: "Invalid date type",
        description: "Date field contains invalid data. Please refresh and try again.",
      });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(revenueForm.occurredAt)) {
      toast({
        variant: "destructive",
        title: "Invalid date format",
        description: "Please enter a valid date in YYYY-MM-DD format.",
      });
      return;
    }

    // Additional validation: check if the date is valid
    const testDate = new Date(revenueForm.occurredAt);
    if (isNaN(testDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "The selected date is not valid. Please choose a different date.",
      });
      return;
    }

    // Validate revenue ID
    if (!editingRevenue || !editingRevenue.id) {
      console.error('Revenue ID validation failed: editingRevenue or ID is missing', { editingRevenue });
      toast({
        variant: "destructive",
        title: "Invalid revenue",
        description: "Cannot update revenue: ID is missing or invalid.",
      });
      return;
    }

    const revenueId = parseInt(editingRevenue.id);
    if (isNaN(revenueId)) {
      console.error('Revenue ID is not a valid number:', {
        editingRevenue,
        revenueId: editingRevenue.id,
        type: typeof editingRevenue.id
      });
      toast({
        variant: "destructive",
        title: "Invalid revenue ID",
        description: "The revenue ID is not a valid number. Please try again.",
      });
      return;
    }

    // Validate amount is a positive number
    const amountCents = parseInt(revenueForm.amountCents);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than zero.",
      });
      return;
    }

    // Validate property ID
    const propertyId = parseInt(revenueForm.propertyId);
    if (isNaN(propertyId) || propertyId <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid property",
        description: "Please select a valid property.",
      });
      return;
    }

    console.log('All validations passed, submitting revenue update with ID:', revenueId);

    // Validate and format the date properly
    const formattedDate = formatDateForAPI(revenueForm.occurredAt);
    console.log('Date formatting debug:', {
      originalDate: revenueForm.occurredAt,
      formattedDate: formattedDate,
      isValidDate: !isNaN(new Date(formattedDate).getTime())
    });

    // Validate the formatted date
    if (!formattedDate || isNaN(new Date(formattedDate).getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Please enter a valid date for the revenue.",
      });
      return;
    }

    const updateData = {
      id: revenueId,
      propertyId: propertyId,
      source: revenueForm.source,
      amountCents: amountCents,
      description: revenueForm.description || undefined,
      receiptUrl: revenueForm.receiptUrl || undefined,
      receiptFileId: revenueForm.receiptFile?.fileId || undefined,
      occurredAt: new Date(formattedDate), // Convert to Date object for backend
      paymentMode: revenueForm.paymentMode || 'cash',
      bankReference: revenueForm.bankReference || undefined,
    };

    console.log('Update data being sent:', updateData);
    updateRevenueMutation.mutate(updateData);
  };

  const handleDeleteExpense = (id: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteExpenseMutation.mutate(id);
    }
  };

  const handleDeleteRevenue = (id: number) => {
    if (window.confirm('Are you sure you want to delete this revenue?')) {
      deleteRevenueMutation.mutate(id);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 pt-safe pb-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-20 sm:pb-0 lg:bg-[#F5F7FA]">
        {/* Desktop Header Actions - Sticky on Desktop only */}
        <div className="hidden sm:flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-14 lg:top-20 z-10 p-2 -mx-2 mb-4 rounded-xl border border-gray-100/50 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Financial Overview</h2>
          </div>
          <div className="flex gap-2">
            {/* Add Revenue Dialog */}
            <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 shadow-sm hover:shadow text-white transition-all duration-200">
                  <IndianRupee className="mr-2 h-4 w-4" />
                  Add Revenue
                </Button>
              </DialogTrigger>
              <DialogContent className="w-screen h-screen max-w-none m-0 rounded-none border-0 sm:h-auto sm:max-w-lg sm:rounded-2xl flex flex-col overflow-hidden bg-white">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                      <IndianRupee className="h-5 w-5 text-green-600" />
                    </div>
                    Add Revenue
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600">
                    Record new revenue for your property
                  </DialogDescription>
                  {formError && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {formError}
                    </div>
                  )}
                </DialogHeader>
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-0">
                  <div className="space-y-6 px-6">
                    <div className="space-y-2">
                      <Label htmlFor="revenue-property" className="text-sm font-medium text-gray-700">Property *</Label>
                      <Select value={revenueForm.propertyId} onValueChange={(value) => setRevenueForm(prev => ({ ...prev, propertyId: value }))}>
                        <SelectTrigger className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties?.properties.map((property: any) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="revenue-source" className="text-sm font-medium text-gray-700">Source</Label>
                        <Select value={revenueForm.source} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, source: value }))}>
                          <SelectTrigger className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="room">Room Revenue</SelectItem>
                            <SelectItem value="addon">Add-on Services</SelectItem>
                            <SelectItem value="other">Other Revenue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="revenue-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                        <Select value={revenueForm.paymentMode} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, paymentMode: value }))}>
                          <SelectTrigger className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {revenueForm.paymentMode === 'bank' && (
                      <div className="space-y-2 w-full">
                        <FileUpload
                          label="Receipt Upload"
                          description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 100MB"
                          onFileUpload={handleRevenueFileUpload}
                          value={revenueForm.receiptFile}
                          onClear={() => setRevenueForm(prev => ({ ...prev, receiptFile: null }))}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="revenue-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                      <Input
                        id="revenue-amount"
                        type="number"
                        step="0.01"
                        value={revenueForm.amountCents ? (parseInt(revenueForm.amountCents) / 100).toString() : ''}
                        onChange={(e) => setRevenueForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                        placeholder="0.00"
                        className="h-14 text-lg font-medium bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm"
                      />
                    </div>

                    {revenueForm.paymentMode === 'bank' && (
                      <div className="space-y-2">
                        <Label htmlFor="revenue-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                        <Input
                          id="revenue-bank-reference"
                          value={revenueForm.bankReference}
                          onChange={(e) => setRevenueForm(prev => ({ ...prev, bankReference: e.target.value }))}
                          placeholder="Transaction ID, UPI reference, etc."
                          className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="revenue-description" className="text-sm font-medium text-gray-700">Description</Label>
                      <Textarea
                        id="revenue-description"
                        value={revenueForm.description}
                        onChange={(e) => setRevenueForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Revenue description"
                        className="min-h-[100px] text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="revenue-date" className="text-sm font-medium text-gray-700">Date</Label>
                      <Input
                        id="revenue-date"
                        type="date"
                        value={revenueForm.occurredAt}
                        onChange={(e) => setRevenueForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                        className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="border-t border-gray-100 bg-white/80 backdrop-blur p-4 sm:p-6 sm:bg-gray-50 sticky bottom-0 z-10">
                  <div className="flex items-center justify-between w-full">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRevenueDialogOpen(false);
                        setFormError(null);
                      }}
                      className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRevenueSubmit}
                      disabled={addRevenueMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      {addRevenueMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <IndianRupee className="mr-2 h-4 w-4" />
                          Add Revenue
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Expense Dialog */}
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 shadow-sm hover:shadow text-white transition-all duration-200">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="w-screen h-screen max-w-none m-0 rounded-none border-0 sm:h-auto sm:max-w-lg sm:rounded-2xl flex flex-col overflow-hidden bg-white">
                <DialogHeader className="pb-4">
                  <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                      <Plus className="h-5 w-5 text-red-600" />
                    </div>
                    Add Expense
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600">
                    Record a new expense for your property
                  </DialogDescription>
                  {formError && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {formError}
                    </div>
                  )}
                </DialogHeader>
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-0">
                  <div className="space-y-6 px-6">
                    <div className="space-y-2">
                      <Label htmlFor="expense-property" className="text-sm font-medium text-gray-700">Property *</Label>
                      <Select value={expenseForm.propertyId} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, propertyId: value }))}>
                        <SelectTrigger className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties?.properties.map((property: any) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expense-category" className="text-sm font-medium text-gray-700">Category *</Label>
                        <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="supplies">Supplies</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="utilities">Utilities</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="expense-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                        <Select value={expenseForm.paymentMode} onValueChange={(value: any) => setExpenseForm(prev => ({ ...prev, paymentMode: value }))}>
                          <SelectTrigger className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 w-full">
                      <FileUpload
                        label="Receipt Upload"
                        description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 100MB"
                        onFileUpload={handleExpenseFileUpload}
                        value={expenseForm.receiptFile}
                        onClear={() => setExpenseForm(prev => ({ ...prev, receiptFile: null }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                      <Input
                        id="expense-amount"
                        type="number"
                        step="0.01"
                        value={expenseForm.amountCents ? (parseInt(expenseForm.amountCents) / 100).toString() : ''}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                        placeholder="0.00"
                        className="h-14 text-lg font-medium bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm"
                      />
                    </div>

                    {expenseForm.paymentMode === 'bank' && (
                      <div className="space-y-2">
                        <Label htmlFor="expense-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                        <Input
                          id="expense-bank-reference"
                          value={expenseForm.bankReference}
                          onChange={(e) => setExpenseForm(prev => ({ ...prev, bankReference: e.target.value }))}
                          placeholder="Transaction ID, UPI reference, etc."
                          className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="expense-description" className="text-sm font-medium text-gray-700">Description</Label>
                      <Textarea
                        id="expense-description"
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Expense description"
                        className="min-h-[100px] text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense-date" className="text-sm font-medium text-gray-700">Date</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={expenseForm.expenseDate}
                        onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                        className="h-14 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="border-t border-gray-100 bg-white/80 backdrop-blur p-4 sm:p-6 sm:bg-gray-50 sticky bottom-0 z-10">
                  <div className="flex items-center justify-between w-full">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsExpenseDialogOpen(false);
                        setFormError(null);
                      }}
                      className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleExpenseSubmit}
                      disabled={addExpenseMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      {addExpenseMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Expense
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {/* Daily Approval Status Banner for Managers */}
        {user?.role === 'MANAGER' && approvalStatus && (
          <Card className={`border-l-4 ${!approvalStatus.canAddTransactions
            ? 'border-l-red-500 bg-red-50 border-red-200'
            : approvalStatus.hasUnapprovedTransactions
              ? 'border-l-yellow-500 bg-yellow-50 border-yellow-200'
              : 'border-l-green-500 bg-green-50 border-green-200'
            } shadow-sm hover:shadow-md transition-shadow duration-200`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${!approvalStatus.canAddTransactions
                    ? 'bg-red-100'
                    : approvalStatus.hasUnapprovedTransactions
                      ? 'bg-yellow-100'
                      : 'bg-green-100'
                    }`}>
                    <Calendar className={`h-5 w-5 ${!approvalStatus.canAddTransactions
                      ? 'text-red-600'
                      : approvalStatus.hasUnapprovedTransactions
                        ? 'text-yellow-600'
                        : 'text-green-600'
                      }`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${!approvalStatus.canAddTransactions
                      ? 'text-red-800'
                      : approvalStatus.hasUnapprovedTransactions
                        ? 'text-yellow-800'
                        : 'text-green-800'
                      }`}>
                      {!approvalStatus.canAddTransactions
                        ? 'Approval Required'
                        : approvalStatus.hasUnapprovedTransactions
                          ? 'Pending Approval'
                          : 'Approved'}
                    </h3>
                    {approvalStatus.message && (
                      <p className={`text-sm mt-1 ${!approvalStatus.canAddTransactions
                        ? 'text-red-700'
                        : approvalStatus.hasUnapprovedTransactions
                          ? 'text-yellow-700'
                          : 'text-green-700'
                        }`}>
                        {approvalStatus.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live stream health badge (from global RealtimeProvider) */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${realtimeHealth?.isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-xs text-gray-600">
                    {realtimeHealth?.isLive ? 'Live' : 'Reconnecting'} • {formatAgo(realtimeHealth?.lastEventAt || realtimeHealth?.lastSuccessAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Responsive Financial Filters */}
        <FinanceFilters
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          properties={properties?.properties || []}
          onReset={() => {
            setSelectedPropertyId('all');
            setDateRange({ startDate: '', endDate: '' });
          }}
        />

        {/* Enhanced Action Buttons Section (desktop and tablet only) */}
        {/* Edit Review Dialog - Kept in DOM for functionality */}
        <Dialog open={isEditExpenseDialogOpen} onOpenChange={setIsEditExpenseDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                  <Edit className="h-5 w-5 text-orange-600" />
                </div>
                Edit Expense
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Update the expense details
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-expense-property" className="text-sm font-medium text-gray-700">Property *</Label>
                  <Select value={expenseForm.propertyId} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, propertyId: value }))}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties?.properties.map((property: any) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-category" className="text-sm font-medium text-gray-700">Category *</Label>
                  <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplies">Supplies</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                  <Input
                    id="edit-expense-amount"
                    type="number"
                    step="0.01"
                    value={expenseForm.amountCents ? (parseInt(expenseForm.amountCents) / 100).toString() : ''}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                    placeholder="0.00"
                    className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-description" className="text-sm font-medium text-gray-700">Description</Label>
                  <Textarea
                    id="edit-expense-description"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Expense description"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <FileUpload
                    label="Receipt Upload"
                    description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 100MB"
                    onFileUpload={handleExpenseFileUpload}
                    value={expenseForm.receiptFile}
                    onClear={() => setExpenseForm(prev => ({ ...prev, receiptFile: null }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                  <Select value={expenseForm.paymentMode} onValueChange={(value: any) => setExpenseForm(prev => ({ ...prev, paymentMode: value }))}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {expenseForm.paymentMode === 'bank' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-expense-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                    <Input
                      id="edit-expense-bank-reference"
                      value={expenseForm.bankReference}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, bankReference: e.target.value }))}
                      placeholder="Transaction ID, UPI reference, etc."
                      className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-date" className="text-sm font-medium text-gray-700">Date</Label>
                  <Input
                    id="edit-expense-date"
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                    className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  onClick={() => setIsEditExpenseDialogOpen(false)}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateExpenseSubmit}
                  disabled={updateExpenseMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {updateExpenseMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Update Expense
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditRevenueDialogOpen} onOpenChange={setIsEditRevenueDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                  <Edit className="h-5 w-5 text-blue-600" />
                </div>
                Edit Revenue
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Update the revenue details
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-property" className="text-sm font-medium text-gray-700">Property *</Label>
                  <Select value={revenueForm.propertyId} onValueChange={(value) => setRevenueForm(prev => ({ ...prev, propertyId: value }))}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties?.properties.map((property: any) => (
                        <SelectItem key={property.id} value={property.id.toString()}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-source" className="text-sm font-medium text-gray-700">Source</Label>
                  <Select value={revenueForm.source} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Room Revenue</SelectItem>
                      <SelectItem value="addon">Add-on Services</SelectItem>
                      <SelectItem value="other">Other Revenue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-amount" className="text-sm font-medium text-gray-700">Amount *</Label>
                  <Input
                    id="edit-revenue-amount"
                    type="number"
                    step="0.01"
                    value={revenueForm.amountCents ? (parseInt(revenueForm.amountCents) / 100).toString() : ''}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, amountCents: (parseFloat(e.target.value) * 100).toString() }))}
                    placeholder="0.00"
                    className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-description" className="text-sm font-medium text-gray-700">Description</Label>
                  <Textarea
                    id="edit-revenue-description"
                    value={revenueForm.description}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Revenue description"
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <FileUpload
                    label="Receipt Upload"
                    description="Upload receipt images (JPG, PNG, GIF, WebP) or PDF files. Max size: 100MB"
                    onFileUpload={handleRevenueFileUpload}
                    value={revenueForm.receiptFile}
                    onClear={() => setRevenueForm(prev => ({ ...prev, receiptFile: null }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-payment-mode" className="text-sm font-medium text-gray-700">Payment Mode *</Label>
                  <Select value={revenueForm.paymentMode} onValueChange={(value: any) => setRevenueForm(prev => ({ ...prev, paymentMode: value }))}>
                    <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank (UPI/Net Banking/Online)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {revenueForm.paymentMode === 'bank' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-revenue-bank-reference" className="text-sm font-medium text-gray-700">Bank Reference</Label>
                    <Input
                      id="edit-revenue-bank-reference"
                      value={revenueForm.bankReference}
                      onChange={(e) => setRevenueForm(prev => ({ ...prev, bankReference: e.target.value }))}
                      placeholder="Transaction ID, UPI reference, etc."
                      className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-date" className="text-sm font-medium text-gray-700">Date</Label>
                  <Input
                    id="edit-revenue-date"
                    type="date"
                    value={revenueForm.occurredAt}
                    onChange={(e) => setRevenueForm(prev => ({ ...prev, occurredAt: e.target.value }))}
                    className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  onClick={() => setIsEditRevenueDialogOpen(false)}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateRevenueSubmit}
                  disabled={updateRevenueMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {updateRevenueMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Update Revenue
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Daily Approval Manager (Admin Only) */}
        {user?.role === 'ADMIN' && (
          <DailyApprovalManager
            className="mt-6"
            propertyId={selectedPropertyId}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
          />
        )}


        {/* Stats Grid - Responsive Layout */}
        <div className="flex overflow-x-auto pb-4 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:pb-0 snap-x snap-mandatory px-4 sm:px-0 -mx-4 sm:mx-0 scrollbar-hide">
          <StatsCard
            title="Cash Revenue"
            value={formatCurrency(totals.cashRevenue || 0)}
            subtitle={selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate ? 'Filtered' : 'All time'}
            icon={Wallet}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
            className="snap-center border-none shadow-md bg-white/90 backdrop-blur-sm min-w-[85%] sm:min-w-0"
            compact
          />
          <StatsCard
            title="Bank/UPI Revenue"
            value={formatCurrency(totals.bankRevenue || 0)}
            subtitle={selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate ? 'Filtered' : 'All time'}
            icon={CreditCard}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            className="snap-center border-none shadow-md bg-white/90 backdrop-blur-sm min-w-[85%] sm:min-w-0"
            compact
          />
          <StatsCard
            title="Cash Expenses"
            value={formatCurrency(totals.cashExpense || 0)}
            subtitle={selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate ? 'Filtered' : 'All time'}
            icon={Wallet}
            iconColor="text-red-600"
            iconBgColor="bg-red-100"
            valueColor="text-red-600"
            className="snap-center border-none shadow-md bg-white/90 backdrop-blur-sm min-w-[85%] sm:min-w-0"
            compact
          />
          <StatsCard
            title="Bank/UPI Expenses"
            value={formatCurrency(totals.bankExpense || 0)}
            subtitle={selectedPropertyId !== 'all' || dateRange.startDate || dateRange.endDate ? 'Filtered' : 'All time'}
            icon={CreditCard}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
            valueColor="text-orange-600"
            className="snap-center border-none shadow-md bg-white/90 backdrop-blur-sm min-w-[85%] sm:min-w-0"
            compact
          />
        </div>

        {/* Enhanced Transactions Tabs */}
        <FinanceTabs defaultValue="expenses" theme={theme}>
          <FinanceTabsList className="grid-cols-2" theme={theme}>
            <FinanceTabsTrigger value="expenses" theme={theme}>
              <TrendingDown className="h-4 w-4 mr-2" />
              Expenses
            </FinanceTabsTrigger>
            <FinanceTabsTrigger value="revenues" theme={theme}>
              <IndianRupee className="h-4 w-4 mr-2" />
              Revenues
            </FinanceTabsTrigger>
          </FinanceTabsList>

          {/* Content Container */}
          <div className="px-0 sm:px-6 py-2 sm:py-6">
            <TabsContent value="expenses" className="space-y-6 mt-0">
              <Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3 px-3 pt-4 sm:px-6 sm:pt-6">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                      <IndianRupee className="h-5 w-5 text-red-600" />
                    </div>
                    Recent Expenses
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Live</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Track and manage property expenses
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 py-2 sm:p-6">
                  {expensesLoading ? (
                    <Card className="border-none shadow-sm bg-gray-50/50">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                          <p className="text-lg font-medium text-gray-900">Loading expenses...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your expense data</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : expenses?.expenses.length === 0 ? (
                    <Card className="border-none shadow-sm bg-gray-50/50">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Receipt className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses recorded</h3>
                        <p className="text-gray-500 text-center mb-4">Start tracking your property expenses</p>
                        <Button
                          onClick={() => setIsExpenseDialogOpen(true)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Expense
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {expenses?.expenses.map((expense: any) => (
                        <div key={expense.id} className="group relative bg-white rounded-2xl p-3 sm:p-4 transition-all duration-200 hover:bg-gray-50 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
                          <div className="flex flex-col gap-4">
                            {/* Header: Category + Badges */}
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h4 className="text-lg font-bold text-gray-900 capitalize leading-tight">
                                {expense.category}
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge className={`${getStatusColor(expense.status)} rounded-md px-2 py-0.5 font-normal text-xs uppercase tracking-wide border-0`}>
                                  {expense.status}
                                </Badge>
                                <Badge className={`${expense.paymentMode === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} rounded-md px-2 py-0.5 font-normal text-xs uppercase tracking-wide border-0`}>
                                  {expense.paymentMode}
                                </Badge>
                                {expense.bankReference && (
                                  <Badge variant="outline" className="text-xs text-gray-500 border-gray-200 rounded-md px-2 py-0.5 font-normal">
                                    {expense.bankReference}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Meta Info */}
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-slate-500">
                                {expense.propertyName}
                              </p>

                              <div className="flex items-center text-xs text-gray-400 font-medium">
                                <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-300" />
                                {formatCardDateTime(expense.createdAt)}
                              </div>

                              <div className="inline-flex items-center bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-1.5">
                                <Calendar className="h-3.5 w-3.5 mr-2 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-700">
                                  For: {formatDateForDisplay(expense.expenseDate)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-400 font-medium">
                                By {expense.createdByName}
                              </p>

                              {expense.description && (
                                <p className="text-sm text-gray-600 leading-relaxed pt-1">{expense.description}</p>
                              )}
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-gray-100/80 my-1"></div>

                            {/* Footer: Amount & Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-2xl font-bold text-red-600 tracking-tight">
                                {formatCurrency(expense.amountCents)}
                              </span>

                              <div className="flex items-center gap-3">
                                {(expense.receiptUrl || expense.receiptFileId) && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 rounded-full border-gray-100 bg-white text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                                    onClick={() => setSelectedReceipt({
                                      id: expense.id,
                                      type: 'expense',
                                      category: expense.category,
                                      propertyName: expense.propertyName,
                                      amountCents: expense.amountCents,
                                      description: expense.description,
                                      receiptUrl: expense.receiptUrl,
                                      receiptFileId: expense.receiptFileId,
                                      date: expense.expenseDate,
                                      createdAt: expense.createdAt,
                                      createdByName: expense.createdByName,
                                      status: expense.status,
                                      paymentMode: expense.paymentMode,
                                      bankReference: expense.bankReference,
                                      approvedByName: expense.approvedByName,
                                      approvedAt: expense.approvedAt,
                                    })}
                                  >
                                    <Eye className="h-5 w-5" />
                                  </Button>
                                )}

                                {user?.role === 'ADMIN' && expense.status === 'pending' && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: true })}
                                      disabled={approveExpenseMutation.isPending}
                                      className="h-11 w-11 rounded-full border-green-100 bg-green-50 text-green-600 hover:bg-green-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Check className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => approveExpenseMutation.mutate({ id: expense.id, approved: false })}
                                      disabled={approveExpenseMutation.isPending}
                                      className="h-11 w-11 rounded-full border-red-100 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      <X className="h-5 w-5" />
                                    </Button>
                                  </>
                                )}

                                {(user?.role === 'ADMIN' || (user?.role === 'MANAGER' && expense.createdByUserId === parseInt(user.userID))) && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => handleEditExpense(expense)}
                                      disabled={updateExpenseMutation.isPending}
                                      className="h-11 w-11 rounded-full border-gray-100 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Edit className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => handleDeleteExpense(expense.id)}
                                      disabled={deleteExpenseMutation.isPending}
                                      className="h-11 w-11 rounded-full border-red-50 bg-white text-red-500 hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Trash2 className="h-5 w-5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revenues" className="space-y-6 mt-0">
              <Card className="border-none shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3 px-3 pt-4 sm:px-6 sm:pt-6">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                      <IndianRupee className="h-5 w-5 text-green-600" />
                    </div>
                    Recent Revenues
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Live</span>
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600">
                    Track property income and revenue streams
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-2 py-2 sm:p-6">
                  {revenuesLoading ? (
                    <Card className="border-none shadow-sm bg-gray-50/50">
                      <CardContent className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                          <p className="text-lg font-medium text-gray-900">Loading revenues...</p>
                          <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your revenue data</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : revenues?.revenues.length === 0 ? (
                    <Card className="border-none shadow-sm bg-gray-50/50">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <IndianRupee className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No revenue recorded</h3>
                        <p className="text-gray-500 text-center mb-4">Start tracking your property revenue</p>
                        <Button
                          onClick={() => setIsRevenueDialogOpen(true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add First Revenue
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {revenues?.revenues.map((revenue: any) => (
                        <div key={revenue.id} className="group relative bg-white rounded-2xl p-3 sm:p-4 transition-all duration-200 hover:bg-gray-50 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
                          <div className="flex flex-col gap-4">
                            {/* Header: Source + Badges */}
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h4 className="text-lg font-bold text-gray-900 capitalize leading-tight">
                                {revenue.source} Revenue
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge className={`${getStatusColor(revenue.status)} rounded-md px-2 py-0.5 font-normal text-xs uppercase tracking-wide border-0`}>
                                  {revenue.status}
                                </Badge>
                                <Badge className={`${revenue.paymentMode === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} rounded-md px-2 py-0.5 font-normal text-xs uppercase tracking-wide border-0`}>
                                  {revenue.paymentMode}
                                </Badge>
                                {revenue.bankReference && (
                                  <Badge variant="outline" className="text-xs text-gray-500 border-gray-200 rounded-md px-2 py-0.5 font-normal">
                                    {revenue.bankReference}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Meta Info */}
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-slate-500">
                                {revenue.propertyName}
                              </p>

                              <div className="flex items-center text-xs text-gray-400 font-medium">
                                <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-300" />
                                {formatCardDateTime(revenue.createdAt)}
                              </div>

                              <div className="inline-flex items-center bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-1.5">
                                <Calendar className="h-3.5 w-3.5 mr-2 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-700">
                                  For: {formatDateForDisplay(revenue.occurredAt)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-400 font-medium">
                                By {revenue.createdByName}
                              </p>

                              {revenue.description && (
                                <p className="text-sm text-gray-600 leading-relaxed pt-1">{revenue.description}</p>
                              )}
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-gray-100/80 my-1"></div>

                            {/* Footer: Amount & Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-2xl font-bold text-green-600 tracking-tight">
                                {formatCurrency(revenue.amountCents)}
                              </span>

                              <div className="flex items-center gap-3">
                                {(revenue.receiptUrl || revenue.receiptFileId) && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 rounded-full border-gray-100 bg-white text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                                    onClick={() => setSelectedReceipt({
                                      id: revenue.id,
                                      type: 'revenue',
                                      source: revenue.source,
                                      propertyName: revenue.propertyName,
                                      amountCents: revenue.amountCents,
                                      description: revenue.description,
                                      receiptUrl: revenue.receiptUrl,
                                      receiptFileId: revenue.receiptFileId,
                                      date: revenue.occurredAt,
                                      createdAt: revenue.createdAt,
                                      createdByName: revenue.createdByName,
                                      status: revenue.status,
                                      paymentMode: revenue.paymentMode,
                                      bankReference: revenue.bankReference,
                                      approvedByName: revenue.approvedByName,
                                      approvedAt: revenue.approvedAt,
                                    })}
                                  >
                                    <Eye className="h-5 w-5" />
                                  </Button>
                                )}

                                {user?.role === 'ADMIN' && revenue.status === 'pending' && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: true })}
                                      disabled={approveRevenueMutation.isPending}
                                      className="h-11 w-11 rounded-full border-green-100 bg-green-50 text-green-600 hover:bg-green-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Check className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => approveRevenueMutation.mutate({ id: revenue.id, approved: false })}
                                      disabled={approveRevenueMutation.isPending}
                                      className="h-11 w-11 rounded-full border-red-100 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      <X className="h-5 w-5" />
                                    </Button>
                                  </>
                                )}

                                {(user?.role === 'ADMIN' || (user?.role === 'MANAGER' && revenue.createdByUserId === parseInt(user.userID))) && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => handleEditRevenue(revenue)}
                                      disabled={updateRevenueMutation.isPending}
                                      className="h-11 w-11 rounded-full border-gray-100 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-200 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Edit className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      onClick={() => handleDeleteRevenue(revenue.id)}
                                      disabled={deleteRevenueMutation.isPending}
                                      className="h-11 w-11 rounded-full border-red-50 bg-white text-red-500 hover:bg-red-50 hover:border-red-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Trash2 className="h-5 w-5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </FinanceTabs>

        {/* Receipt Viewer Modal */}
        {
          selectedReceipt && (
            <ReceiptViewer
              isOpen={!!selectedReceipt}
              onClose={() => setSelectedReceipt(null)}
              transaction={selectedReceipt}
            />
          )
        }

        {/* Premium Mobile Floating Action Button (FAB) - iPhone 6s optimized */}
        {/* Backdrop for closing menu */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 sm:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* FAB Container */}
        <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-4 sm:hidden">

          {/* Action Buttons (Reveal upwards) */}
          <div className={`flex flex-col gap-3 transition-all duration-300 ease-out origin-bottom ${isMobileMenuOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'}`}>
            <Button
              onClick={() => {
                setIsRevenueDialogOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="h-11 pl-4 pr-5 rounded-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30 border-0 flex items-center gap-2 transition-transform active:scale-95"
            >
              <div className="bg-white/20 p-1 rounded-full">
                <IndianRupee className="h-4 w-4" />
              </div>
              <span className="font-semibold tracking-wide">Add Revenue</span>
            </Button>

            <Button
              onClick={() => {
                setIsExpenseDialogOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="h-11 pl-4 pr-5 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30 border-0 flex items-center gap-2 transition-transform active:scale-95"
            >
              <div className="bg-white/20 p-1 rounded-full">
                <Plus className="h-4 w-4" />
              </div>
              <span className="font-semibold tracking-wide">Add Expense</span>
            </Button>
          </div>

          {/* Main Trigger Button */}
          <Button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 border-0 ${isMobileMenuOpen ? 'bg-gray-800 rotate-90' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Plus className={`h-8 w-8 text-white transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-45' : 'rotate-0'}`} />
          </Button>
        </div>
      </div >
    </div >
  );
}