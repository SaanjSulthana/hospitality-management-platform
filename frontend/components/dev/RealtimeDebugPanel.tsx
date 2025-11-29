import React, { useEffect, useRef, useState } from 'react';

/**
 * RealtimeDebugPanel
 * Small dev-only helper to visualize provider health and toggle flags.
 * Rendered only when NODE_ENV === 'development' or flag REALTIME_DEBUG_PANEL === 'true'.
 */
export default function RealtimeDebugPanel(): React.ReactElement | null {
  const [visible, setVisible] = useState<boolean>(false);
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [circuitOpen, setCircuitOpen] = useState<boolean>(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [shadowMode, setShadowMode] = useState<boolean>(false);
  const [masterEnabled, setMasterEnabled] = useState<boolean>(false);
  const [rollout, setRollout] = useState<number>(0);
  const lastShadowCountRef = useRef<number>(0);

  useEffect(() => {
    const shouldShow =
      (typeof window !== 'undefined' && (window as any)?.location?.hostname === 'localhost') ||
      process.env.NODE_ENV === 'development' ||
      (() => {
        try { return localStorage.getItem('REALTIME_DEBUG_PANEL') === 'true'; } catch { return false; }
      })();
    setVisible(shouldShow);
  }, []);

  useEffect(() => {
    const onHealth = (e: any) => {
      const d = e?.detail || {};
      setCircuitOpen(Boolean(d?.circuitOpen)); // not provided today; stays false
      setLastSuccessAt(d?.lastSuccessAt ? new Date(d.lastSuccessAt).getTime?.() || Date.now() : Date.now());
    };
    const onFinanceHealth = (e: any) => {
      const d = e?.detail || {};
      setLastSuccessAt(d?.lastSuccessAt ? new Date(d.lastSuccessAt).getTime?.() || Date.now() : Date.now());
    };
    const onShadow = () => { lastShadowCountRef.current += 1; };
    window.addEventListener('realtime-health', onHealth as EventListener);
    window.addEventListener('finance-stream-health', onFinanceHealth as EventListener);
    window.addEventListener('finance-shadow-events', onShadow as EventListener);
    return () => {
      window.removeEventListener('realtime-health', onHealth as EventListener);
      window.removeEventListener('finance-stream-health', onFinanceHealth as EventListener);
      window.removeEventListener('finance-shadow-events', onShadow as EventListener);
    };
  }, []);

  useEffect(() => {
    try {
      setShadowMode(localStorage.getItem('REALTIME_SHADOW_MODE') === 'true');
      setMasterEnabled(localStorage.getItem('REALTIME_PROVIDER_V2') === 'true');
      setRollout(Number(localStorage.getItem('REALTIME_ROLLOUT_PERCENT') || '0') || 0);
    } catch {}
  }, []);

  if (!visible) return null;

  const setFlag = (k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch {}
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        color: '#9BE7FF',
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 12,
        width: 260,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Realtime Debug</div>
      <div>Leader: {isLeader ? '👑' : '👥'} (panel reflects health events)</div>
      <div>Circuit: {circuitOpen ? 'OPEN' : 'closed'}</div>
      <div>Last success: {lastSuccessAt ? `${Math.floor((Date.now() - lastSuccessAt) / 1000)}s ago` : '—'}</div>
      <div>Shadow batches: {lastShadowCountRef.current}</div>
      <hr style={{ borderColor: '#333', margin: '8px 0' }} />
      <div>Master: {String(masterEnabled)}</div>
      <div>Shadow: {String(shadowMode)}</div>
      <div>Rollout%: {rollout}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <button onClick={() => { setFlag('REALTIME_PROVIDER_V2', 'true'); setMasterEnabled(true); }} style={{ padding: '4px 6px' }}>Master ON</button>
        <button onClick={() => { setFlag('REALTIME_PROVIDER_V2', 'false'); setMasterEnabled(false); }} style={{ padding: '4px 6px' }}>Master OFF</button>
        <button onClick={() => { setFlag('REALTIME_SHADOW_MODE', 'true'); setShadowMode(true); }} style={{ padding: '4px 6px' }}>Shadow ON</button>
        <button onClick={() => { setFlag('REALTIME_SHADOW_MODE', 'false'); setShadowMode(false); }} style={{ padding: '4px 6px' }}>Shadow OFF</button>
        <button onClick={() => { const n = prompt('Set rollout % (0-100)', String(rollout)) || '0'; setFlag('REALTIME_ROLLOUT_PERCENT', n); setRollout(Number(n) || 0); }} style={{ padding: '4px 6px' }}>Set %</button>
      </div>
      <div style={{ marginTop: 6, opacity: 0.8 }}>Hard refresh after changes.</div>
    </div>
  );
}


