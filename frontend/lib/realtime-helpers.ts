/**
 * Dispatches a cross-tab property filter update for the realtime provider.
 * Using a helper ensures consistency across pages.
 */
export function setRealtimePropertyFilter(propertyId: number | null): void {
  try {
    window.dispatchEvent(new CustomEvent('realtime:set-property', { detail: { propertyId } }));
  } catch {}
}


