/**
 * Per-browser player preferences. Conveniences only: if storage is blocked (private mode,
 * sandboxed previews) reads fall back to the default and writes are dropped.
 */
export function loadPref<T extends string | boolean>(key: string, fallback: T, valid?: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(`bulwark.${key}`);
    if (raw === null) return fallback;
    const value: unknown = typeof fallback === 'boolean' ? raw === 'true' : raw;
    return !valid || valid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: string | boolean): void {
  try {
    localStorage.setItem(`bulwark.${key}`, String(value));
  } catch {
    // Not critical.
  }
}
