// Session never expires - users stay logged in until manual logout or browser data cleared
export const SESSION_TTL_HOURS = Infinity;
export const SESSION_TTL_MS = Infinity;

export function hasSessionExpired(lastActiveAt) {
  // Sessions never expire - always return false
  return false;
}

export function getSessionExpiryTimestamp(from = Date.now()) {
  // Return a very far future date (effectively never expires)
  return from + (100 * 365 * 24 * 60 * 60 * 1000); // 100 years from now
}

