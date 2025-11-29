// API versioning constants and helpers
// All Encore endpoints MUST use API_V1_PREFIX

export const API_V1_PREFIX = "/v1";

/**
 * Build versioned path for Encore api({ path })
 * Ensures we always generate `/v1/<resource>`
 */
export function v1Path(resourcePath: string): string {
  let normalized = resourcePath || "";
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  return `${API_V1_PREFIX}${normalized}`;
}

// Example usage:
// path: "/v1/finance/revenues"  → "/v1/finance/revenues"


