export const SESSION_TTL_HOURS = 100;
export const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

export function hasSessionExpired(lastActiveAt) {
  if (!lastActiveAt) {
    return true;
  }
  return Date.now() - lastActiveAt > SESSION_TTL_MS;
}

export function getSessionExpiryTimestamp(from = Date.now()) {
  return from + SESSION_TTL_MS;
}

