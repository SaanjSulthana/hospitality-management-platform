import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getFlagBool } from '../lib/feature-flags';
import { setRealtimePropertyFilter } from '../lib/realtime-helpers';
import { useRealtimeService } from './useRealtimeService';
import { QUERY_KEYS } from '../src/utils/api-standardizer';
import { useRouteActive } from './use-route-aware-query';

export function useDashboardRealtime() {
    const queryClient = useQueryClient();
    const routeActive = useRouteActive(['/dashboard']);

    // Realtime: Dashboard events listener (debounced invalidation + telemetry)
    useEffect(() => {
        try { (window as any).__dashboardSelectedPropertyId = 'all'; } catch { }
        try { setRealtimePropertyFilter(null); } catch { }

        const enabled = getFlagBool('DASHBOARD_REALTIME_V1', true);
        if (!enabled) return;

        let timer: ReturnType<typeof setTimeout> | null = null;
        const scheduleInvalidate = (events: any[]) => {
            const impacted = new Set<string[]>();
            const patchMode = getFlagBool('REALTIME_PATCH_MODE', true);
            for (const ev of events) {
                const t = (ev?.eventType || '').toString();
                const entity = (ev?.entityType || '').toString();
                // In patch mode, skip list invalidations – lists are patched by service handlers.
                if (!patchMode) {
                    if (t.startsWith('revenue_') || entity === 'revenue') impacted.add(QUERY_KEYS.REVENUES);
                    if (t.startsWith('expense_') || entity === 'expense') impacted.add(QUERY_KEYS.EXPENSES);
                    if (t.startsWith('property_') || entity === 'property') impacted.add(QUERY_KEYS.PROPERTIES);
                    if (t.startsWith('task_') || entity === 'task') impacted.add(QUERY_KEYS.TASKS);
                    if (t.startsWith('user_') || entity === 'user') impacted.add(QUERY_KEYS.USERS);
                }
                if (t.includes('leave')) impacted.add(QUERY_KEYS.LEAVE_REQUESTS);
                if (t.includes('approval')) impacted.add(QUERY_KEYS.PENDING_APPROVALS);
                if (t.includes('dashboard') || t.includes('analytics')) impacted.add(QUERY_KEYS.ANALYTICS);
            }
            if (impacted.size === 0) {
                impacted.add(QUERY_KEYS.ANALYTICS);
            }
            impacted.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
        };

        const onEvents = (e: any) => {
            const events = e?.detail?.events || [];
            if (!Array.isArray(events) || events.length === 0) return;
            if (timer) clearTimeout(timer);
            const snapshot = events.slice(0, 200);
            timer = setTimeout(() => scheduleInvalidate(snapshot), 350);
        };
        const onHealth = (_e: any) => { };

        window.addEventListener('dashboard-stream-health', onHealth);
        return () => {
            window.removeEventListener('dashboard-stream-health', onHealth);
            if (timer) clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryClient]);

    // Realtime: Dashboard service (domain-agnostic) → refresh analytics/dashboard only
    useRealtimeService('dashboard', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ANALYTICS });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD });
        }, 250);
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));

    // Realtime: Finance events → narrow, debounced invalidations for dashboard tiles
    useRealtimeService('finance', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        let needsRevenuesInvalidate = false;
        let needsExpensesInvalidate = false;
        let needsDerivedInvalidate = false;
        let approvalEventOccurred = false;

        for (const ev of events) {
            const t = (ev?.eventType || '').toString();
            const entity = (ev?.entityType || '').toString();
            const id = ev?.entityId;
            const meta = ev?.metadata || {};

            // For create/delete (complex changes), prefer a narrow invalidation
            if (t === 'revenue_added') {
                // Optimistic insert to make counts instant; reconcile later via invalidate
                queryClient.setQueryData(QUERY_KEYS.REVENUES, (old: any) => {
                    if (!old?.revenues) return old;
                    const exists = old.revenues.some((r: any) => r.id === id);
                    if (exists) return old;
                    const newRow = {
                        id,
                        amountCents: meta?.amountCents ?? 0,
                        currency: meta?.currency ?? 'INR',
                        source: meta?.source ?? 'unknown',
                        description: meta?.description || 'Revenue',
                        propertyName: meta?.propertyName ?? '—',
                        status: meta?.newStatus ?? 'pending',
                        transactionDate: meta?.transactionDate ?? new Date().toISOString(),
                        // FIX: Include creator info from event metadata
                        createdByName: meta?.createdByName ?? 'Unknown User',
                        createdByUserId: meta?.createdByUserId ?? ev?.userId,
                        createdAt: ev?.timestamp ?? new Date().toISOString(),
                    };
                    return { ...old, revenues: [newRow, ...old.revenues] };
                });
                needsDerivedInvalidate = true;
                continue;
            }
            if (t === 'revenue_deleted') {
                queryClient.setQueryData(QUERY_KEYS.REVENUES, (old: any) => {
                    if (!old?.revenues) return old;
                    return { ...old, revenues: old.revenues.filter((r: any) => r.id !== id) };
                });
                needsDerivedInvalidate = true;
                continue;
            }
            if (t === 'expense_added') {
                queryClient.setQueryData(QUERY_KEYS.EXPENSES, (old: any) => {
                    if (!old?.expenses) return old;
                    const exists = old.expenses.some((e: any) => e.id === id);
                    if (exists) return old;
                    const newRow = {
                        id,
                        amountCents: meta?.amountCents ?? 0,
                        currency: meta?.currency ?? 'INR',
                        category: meta?.category ?? 'misc',
                        description: meta?.description || 'Expense',
                        propertyName: meta?.propertyName ?? '—',
                        status: meta?.newStatus ?? 'pending',
                        transactionDate: meta?.transactionDate ?? new Date().toISOString(),
                        // FIX: Include creator info from event metadata
                        createdByName: meta?.createdByName ?? 'Unknown User',
                        createdByUserId: meta?.createdByUserId ?? ev?.userId,
                        createdAt: ev?.timestamp ?? new Date().toISOString(),
                    };
                    return { ...old, expenses: [newRow, ...old.expenses] };
                });
                needsDerivedInvalidate = true;
                continue;
            }
            if (t === 'expense_deleted') {
                queryClient.setQueryData(QUERY_KEYS.EXPENSES, (old: any) => {
                    if (!old?.expenses) return old;
                    return { ...old, expenses: old.expenses.filter((e: any) => e.id !== id) };
                });
                needsDerivedInvalidate = true;
                continue;
            }

            // Row-level patches for updates/approvals to keep UI instant
            if ((t === 'revenue_updated' || t === 'revenue_approved' || entity === 'revenue') && id) {
                queryClient.setQueryData(QUERY_KEYS.REVENUES, (old: any) => {
                    if (!old?.revenues) return old;
                    return {
                        ...old,
                        revenues: old.revenues.map((r: any) =>
                            r.id === id
                                ? {
                                    ...r,
                                    amountCents: meta?.amountCents ?? r.amountCents,
                                    description: meta?.description ?? r.description,
                                    source: meta?.source ?? r.source,
                                    propertyName: meta?.propertyName ?? r.propertyName,
                                    // status exists on backend; keep if present in meta
                                    ...(meta?.newStatus ? { status: meta.newStatus } : {}),
                                }
                                : r
                        ),
                    };
                });
                try {
                    (window as any).__realtimeClientStats = (window as any).__realtimeClientStats || { invalidationsFlushed: 0, keys: 0, patchesApplied: 0 };
                    (window as any).__realtimeClientStats.patchesApplied++;
                } catch { }
                needsDerivedInvalidate = true;
                if (t.endsWith('_approved') || t.endsWith('_rejected')) approvalEventOccurred = true;
                continue;
            }

            if ((t === 'expense_updated' || t === 'expense_approved' || entity === 'expense') && id) {
                queryClient.setQueryData(QUERY_KEYS.EXPENSES, (old: any) => {
                    if (!old?.expenses) return old;
                    return {
                        ...old,
                        expenses: old.expenses.map((e: any) =>
                            e.id === id
                                ? {
                                    ...e,
                                    amountCents: meta?.amountCents ?? e.amountCents,
                                    description: meta?.description ?? e.description,
                                    category: meta?.category ?? e.category,
                                    propertyName: meta?.propertyName ?? e.propertyName,
                                    ...(meta?.newStatus ? { status: meta.newStatus } : {}),
                                }
                                : e
                        ),
                    };
                });
                try {
                    (window as any).__realtimeClientStats = (window as any).__realtimeClientStats || { invalidationsFlushed: 0, keys: 0, patchesApplied: 0 };
                    (window as any).__realtimeClientStats.patchesApplied++;
                } catch { }
                needsDerivedInvalidate = true;
                if (t.endsWith('_approved') || t.endsWith('_rejected')) approvalEventOccurred = true;
                continue;
            }

            if (t === 'daily_approval_granted') {
                approvalEventOccurred = true;
                needsDerivedInvalidate = true;

                // Patch individual items if transaction IDs are provided
                const transactionIds = meta?.transactionIds as number[] | undefined;
                const newStatus = meta?.newStatus || 'approved';

                console.log('[Dashboard] daily_approval_granted received', {
                    transactionIds,
                    newStatus,
                    userId: ev?.userId,
                    meta
                });

                if (transactionIds && transactionIds.length > 0) {
                    // Update revenues list
                    queryClient.setQueryData(QUERY_KEYS.REVENUES, (old: any) => {
                        if (!old?.revenues) return old;
                        return {
                            ...old,
                            revenues: old.revenues.map((r: any) =>
                                transactionIds.includes(r.id)
                                    ? { ...r, status: newStatus, approvedByUserId: ev?.userId, approvedAt: ev?.timestamp || new Date().toISOString() }
                                    : r
                            ),
                        };
                    });

                    // Update expenses list
                    queryClient.setQueryData(QUERY_KEYS.EXPENSES, (old: any) => {
                        if (!old?.expenses) return old;
                        return {
                            ...old,
                            expenses: old.expenses.map((e: any) =>
                                transactionIds.includes(e.id)
                                    ? { ...e, status: newStatus, approvedByUserId: ev?.userId, approvedAt: ev?.timestamp || new Date().toISOString() }
                                    : e
                            ),
                        };
                    });
                } else {
                    // Fallback: if no transactionIds, force invalidate the lists
                    console.log('[Dashboard] daily_approval_granted without transactionIds - forcing invalidation');
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REVENUES });
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.EXPENSES });
                }
                continue;
            }
        }
        // Debounce narrow invalidations for lists and aggregates
        const doInvalidate = () => {
            if (!routeActive) return;
            if (needsDerivedInvalidate) {
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROFIT_LOSS });
                if (approvalEventOccurred) {
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DAILY_APPROVAL_CHECK });
                }
            }
        };
        setTimeout(doInvalidate, 200);
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));

    // Realtime: Tasks events → update tasks tile (narrow invalidation)
    useRealtimeService('tasks', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        let needsTasksInvalidate = false;
        let touchedTask = false;
        for (const ev of events) {
            const t = String(ev?.eventType || '');
            const id = ev?.entityId;
            const meta = ev?.metadata || {};
            if (!id) continue;

            if (t === 'task_status_updated') {
                queryClient.setQueryData(QUERY_KEYS.TASKS, (old: any) => {
                    if (!old?.tasks) return old;
                    return {
                        ...old,
                        tasks: old.tasks.map((task: any) =>
                            task.id === id ? { ...task, status: meta?.newStatus ?? meta?.status ?? task.status } : task
                        ),
                    };
                });
                touchedTask = true;
                continue;
            }

            if (t === 'task_updated') {
                queryClient.setQueryData(QUERY_KEYS.TASKS, (old: any) => {
                    if (!old?.tasks) return old;
                    return {
                        ...old,
                        tasks: old.tasks.map((task: any) =>
                            task.id === id
                                ? {
                                    ...task,
                                    title: meta?.title ?? task.title,
                                    description: meta?.description ?? task.description,
                                    dueAt: meta?.dueAt ?? task.dueAt,
                                    priority: meta?.priority ?? task.priority,
                                }
                                : task
                        ),
                    };
                });
                touchedTask = true;
                continue;
            }

            if (t === 'task_created' || t === 'task_deleted') {
                needsTasksInvalidate = true;
            }
        }
        setTimeout(() => {
            if (needsTasksInvalidate) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
            if (touchedTask) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ANALYTICS });
        }, 200);
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));

    // Realtime: Users events → update managers count
    useRealtimeService('users', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        let needsUsersInvalidate = false;
        for (const ev of events) {
            const t = String(ev?.eventType || '');
            const id = ev?.entityId;
            const meta = ev?.metadata || {};
            if (t === 'user_updated' && id) {
                queryClient.setQueryData(QUERY_KEYS.USERS, (old: any) => {
                    if (!old?.users) return old;
                    return {
                        ...old,
                        users: old.users.map((u: any) =>
                            u.id === id
                                ? {
                                    ...u,
                                    displayName: meta?.displayName ?? u.displayName,
                                    email: meta?.email ?? u.email,
                                    role: meta?.role ?? u.role,
                                }
                                : u
                        ),
                    };
                });
            } else if (t === 'user_created' || t === 'user_deleted') {
                needsUsersInvalidate = true;
            }
        }
        if (needsUsersInvalidate) {
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
            }, 200);
        }
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));

    // Realtime: Properties events → update properties count
    useRealtimeService('properties', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        let needsPropsInvalidate = false;
        for (const ev of events) {
            const t = String(ev?.eventType || '');
            const id = ev?.entityId;
            const meta = ev?.metadata || {};

            if (t === 'property_updated' && id) {
                queryClient.setQueryData(QUERY_KEYS.PROPERTIES, (old: any) => {
                    if (!old?.properties) return old;
                    return {
                        ...old,
                        properties: old.properties.map((p: any) =>
                            p.id === id
                                ? {
                                    ...p,
                                    name: meta?.name ?? p.name,
                                    status: meta?.status ?? p.status,
                                    regionId: meta?.regionId ?? p.regionId,
                                }
                                : p
                        ),
                    };
                });
            } else if (t === 'property_created' || t === 'property_deleted') {
                needsPropsInvalidate = true;
            }
        }
        if (needsPropsInvalidate) {
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROPERTIES });
            }, 200);
        }
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));

    // Realtime: Staff/Leave events → update leave requests tile
    useRealtimeService('staff', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        const affectsLeave = events.some((ev: any) => {
            const t = String(ev?.eventType || '');
            return t.includes('leave_') || String(ev?.entityType || '') === 'leave_request';
        });
        if (affectsLeave) {
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.LEAVE_REQUESTS });
            }, 200);
        }
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));

    // Realtime: Analytics events → refresh analytics block
    useRealtimeService('analytics', (events) => {
        if (!Array.isArray(events) || events.length === 0) return;
        setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ANALYTICS] });
        }, 200);
    }, getFlagBool('DASHBOARD_REALTIME_V1', true));
}
