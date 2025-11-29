// Simple feature-flag helpers backed by localStorage with safe defaults
// Usage:
//   getFlagBool('FIN_LEADER_ENABLED', true)
//   getFlagNumber('FIN_DERIVED_DEBOUNCE_MS', 1000)
//
// All reads are tolerant of unavailable storage (SSR or blocking).

export function getFlagBool(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    const v = raw.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function getFlagNumber(key: string, defaultValue: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function getAccessTokenHash(): string | null {
  try {
    const token = localStorage.getItem('accessToken') || '';
    if (!token) return null;
    // Non-cryptographic short hash: first 16 chars of base64 of string
    // Avoids leaking full token in channel names
    const b64 = btoa(unescape(encodeURIComponent(token))).replace(/=+$/, '');
    return b64.slice(0, 16);
  } catch {
    return null;
  }
}


