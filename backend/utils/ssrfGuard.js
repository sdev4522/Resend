/**
 * SSRF Protection Utility for Outbound HTTP Requests and Webhooks.
 * Prevents requests to localhost, internal private IP ranges, link-local addresses, and non-HTTP protocols.
 */
const { URL } = require("node:url");
const dns = require("node:dns").promises;

// Check if an IP address string is a private, loopback, or link-local address
function isPrivateIp(ip) {
  if (!ip) return false;
  
  // Normalize IPv6-mapped IPv4 e.g. ::ffff:127.0.0.1
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // IPv4 checks
  const ipv4Parts = ip.split(".").map(Number);
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [p0, p1] = ipv4Parts;
    // 0.0.0.0/8
    if (p0 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (p0 === 10) return true;
    // 172.16.0.0/12 (Private)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (p0 === 192 && p1 === 168) return true;
    // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
    if (p0 === 169 && p1 === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;
    // Broadcast / Multicast
    if (p0 >= 224) return true;
    return false;
  }

  // IPv6 checks
  const normalized = ip.toLowerCase();
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") || // Link-local
    normalized.startsWith("fc00:") || // Unique local
    normalized.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
}

/**
 * Synchronous check of URL string / hostname against known private patterns.
 */
function isPrivateAddress(targetUrl) {
  try {
    const parsed = typeof targetUrl === "string" ? new URL(targetUrl) : targetUrl;
    
    // Only allow http: and https: protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return true;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Loopback / Localhost names
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return true;
    }

    // Direct IP address check
    if (isPrivateIp(hostname)) {
      return true;
    }

    return false;
  } catch {
    // If invalid URL, treat as dangerous
    return true;
  }
}

/**
 * Async validation that also resolves DNS to prevent DNS rebinding to private IPs.
 */
async function validateSafeUrl(targetUrl) {
  const parsed = new URL(targetUrl);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`SSRF Guard: Disallowed protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
  }

  if (isPrivateAddress(parsed)) {
    throw new Error(`SSRF Guard: Request to internal or private destination "${parsed.hostname}" is blocked.`);
  }

  // Resolve hostname via DNS to prevent DNS rebinding to internal IP
  try {
    const lookupResult = await dns.lookup(parsed.hostname, { all: true });
    for (const record of lookupResult) {
      if (isPrivateIp(record.address)) {
        throw new Error(`SSRF Guard: Destination "${parsed.hostname}" resolved to private IP "${record.address}". Access blocked.`);
      }
    }
  } catch (dnsErr) {
    // If the DNS lookup itself was an SSRF guard rejection, rethrow it
    if (dnsErr.message.startsWith("SSRF Guard:")) {
      throw dnsErr;
    }
    // If DNS resolution fails, allow standard network layer to fail or throw
  }

  return true;
}

module.exports = {
  isPrivateIp,
  isPrivateAddress,
  validateSafeUrl,
};
