const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Crea la función que decide si un origen está permitido. Admite orígenes
 * exactos y comodines (`https://typerace-*.vercel.app`, útil para previews).
 * En desarrollo se permite además cualquier `localhost`.
 */
export function createOriginMatcher(
  allowed: readonly string[],
  { allowLocalhost }: { allowLocalhost: boolean },
): (origin: string) => boolean {
  const patterns = allowed.map(patternToRegExp);
  return (origin) =>
    (allowLocalhost && LOCALHOST.test(origin)) || patterns.some((re) => re.test(origin));
}
