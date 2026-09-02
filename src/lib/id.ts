/**
 * crypto.randomUUID() isn't available in older browsers (e.g. Safari <15.4)
 * or outside a secure context. Falls back to a non-cryptographic id — these
 * are only ever used as local React keys, not for security.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
