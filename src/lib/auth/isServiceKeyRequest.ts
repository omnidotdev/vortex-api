import secretsMatch from "lib/crypto/secretsMatch";

/**
 * Whether an Authorization header carries the internal service key, the
 * credential first-party Omni services emit events with. The comparison is
 * in-memory and constant-time, so the global rate limiter can call it on every
 * request without any I/O.
 *
 * First-party services reach Vortex through its public URL, so they all share
 * the cluster's egress IP: an IP-keyed limit would make one service's burst
 * reject every other service's events. A request bearing the service key is
 * already fully trusted (it may emit the reserved platform source and act on
 * behalf of any org), so the IP limit adds no protection for it. Tenant keys and
 * sessions are not service keys and stay limited by IP
 * @param authHeader - Authorization header value, with or without `Bearer `
 * @param serviceKey - The configured internal service key
 */
const isServiceKeyRequest = (
  authHeader: string | null | undefined,
  serviceKey: string | undefined,
): boolean => {
  if (!authHeader || !serviceKey) return false;

  const key = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return secretsMatch(key, serviceKey);
};

export default isServiceKeyRequest;
