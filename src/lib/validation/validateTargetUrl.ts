import { isDevEnv } from "lib/config/env.config";

/**
 * Validate a target URL to prevent SSRF attacks.
 * Rejects private/internal IP ranges and requires HTTPS in production.
 * @param url - URL to validate
 * @throws If the URL is invalid, uses a blocked scheme, or resolves to a private IP
 */
const validateTargetUrl = async (url: string): Promise<void> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  // Require HTTPS in production
  if (parsed.protocol !== "https:") {
    if (!(isDevEnv && parsed.protocol === "http:")) {
      throw new Error("Only HTTPS URLs are allowed");
    }
  }

  const hostname = parsed.hostname;

  // Block obvious private/reserved hostnames
  if (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private or reserved hostname not allowed");
  }

  // Resolve hostname and check for private CIDRs
  const { resolve4, resolve6 } = await import("node:dns/promises");

  const ips: string[] = [];
  try {
    ips.push(...(await resolve4(hostname)));
  } catch {
    // No A records
  }
  try {
    ips.push(...(await resolve6(hostname)));
  } catch {
    // No AAAA records
  }

  if (ips.length === 0) {
    throw new Error("Could not resolve hostname");
  }

  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      throw new Error("Private or reserved IP address not allowed");
    }
  }
};

/**
 * Check if an IP address belongs to a private or reserved CIDR range.
 */
const isPrivateIp = (ip: string): boolean => {
  // IPv6 loopback and private
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }

  // IPv4 ranges
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;

  const [a, b] = parts;

  // 127.0.0.0/8
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;

  return false;
};

export default validateTargetUrl;
