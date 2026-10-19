/**
 * Web Fetcher for Smart Reader
 * Respects access boundaries, handles HTTP status codes gracefully,
 * and enforces security constraints (SSRF protection, content-type checks, timeout control).
 */

'use strict';

/**
 * Validates whether an IPv4 address string belongs to private, loopback, link-local,
 * or reserved blocks.
 * @param {string} ip - Dotted quad IPv4 address
 * @returns {boolean}
 */
function isRestrictedIpv4(ip) {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [b0, b1, b2, b3] = parts;

  // 0.0.0.0/8 (broadcast / current network)
  if (b0 === 0) return true;

  // 127.0.0.0/8 (loopback)
  if (b0 === 127) return true;

  // 10.0.0.0/8 (Class A private)
  if (b0 === 10) return true;

  // 172.16.0.0/12 (Class B private: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (Class C private)
  if (b0 === 192 && b1 === 168) return true;

  // 169.254.0.0/16 (link-local / AWS & cloud metadata service)
  if (b0 === 169 && b1 === 254) return true;

  // 100.64.0.0/10 (carrier-grade NAT: 100.64.0.0 - 100.127.255.255)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 192.0.0.0/24 (IETF protocol assignments)
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET-1, 2, 3)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;

  // 224.0.0.0/4 (multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (reserved / future use)
  if (b0 >= 240) return true;

  // 255.255.255.255 (broadcast)
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

  return false;
}

/**
 * Validates whether a hostname is a local domain, private IP, IPv6 loopback,
 * IPv6 ULA/link-local, or IPv4-mapped IPv6 address.
 * @param {string} rawHostname
 * @returns {boolean}
 */
function isRestrictedHost(rawHostname) {
  if (!rawHostname || typeof rawHostname !== 'string') return true;
  let hostname = rawHostname.toLowerCase().trim();

  // Strip enclosing brackets for IPv6 literals
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  // Localhost aliases and private domain suffixes
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home.arpa')
  ) {
    return true;
  }

  // IPv6 loopback and unspecified addresses
  if (
    hostname === '::' ||
    hostname === '::1' ||
    /^0*(:0*)+$/.test(hostname) ||
    /^0*(:0*)+:1$/.test(hostname)
  ) {
    return true;
  }

  // IPv6 Unique Local Address (fc00::/7) or Link-Local (fe80::/10)
  if (/^f[cd][0-9a-f]{2}:/i.test(hostname) || /^fe[89ab][0-9a-f]:/i.test(hostname)) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (hostname.startsWith('::ffff:')) {
    const remainder = hostname.slice(7);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(remainder)) {
      return isRestrictedIpv4(remainder);
    }
    const parts = remainder.split(':');
    if (parts.length === 2) {
      const high = parseInt(parts[0], 16);
      const low = parseInt(parts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const ip = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isRestrictedIpv4(ip);
      }
    }
    return true;
  }

  // Canonical IPv4 check
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return isRestrictedIpv4(hostname);
  }

  return false;
}

class WebFetcher {
  constructor() {
    this.timeoutMs = 12000;
  }

  /**
   * Fetches an accessible web source safely
   * @param {string} rawUrl
   * @returns {Promise<{ success: boolean, url: string, finalUrl: string, statusCode: number, html: string, contentType: string }>}
   */
  async fetch(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('A valid web URL is required.');
    }

    const trimmedUrl = rawUrl.trim();

    // 1. URL syntax validation
    let parsedUrl;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      throw new Error(`Invalid URL format: "${trimmedUrl}". Must start with http:// or https://`);
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only http:// and https:// are supported.`);
    }

    // 2. Security & SSRF Protection on initial host
    if (isRestrictedHost(parsedUrl.hostname)) {
      throw new Error(`Access to local or private network address "${parsedUrl.hostname}" is restricted for security.`);
    }

    // 3. Wikipedia endpoint optimization
    // Wikipedia provides a dedicated semantic HTML endpoint that delivers high-quality content without nav/ads
    let fetchUrl = trimmedUrl;
    const wikiMatch = trimmedUrl.match(/^https?:\/\/([a-z]+)\.wikipedia\.org\/wiki\/([^#?]+)/i);
    if (wikiMatch) {
      const lang = wikiMatch[1];
      const title = wikiMatch[2];
      const restUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${title}`;
      try {
        const restResult = await this.executeFetch(restUrl);
        if (restResult.success) {
          return {
            ...restResult,
            url: trimmedUrl, // preserve user's canonical URL
          };
        }
      } catch {
        // Fall back to standard fetch below
      }
    }

    return this.executeFetch(fetchUrl);
  }

  async executeFetch(initialUrl) {
    let currentUrl = initialUrl;
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;

    while (redirectCount <= MAX_REDIRECTS) {
      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch {
        throw new Error(`Invalid URL format: "${currentUrl}"`);
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Unsupported protocol: ${parsed.protocol}. Only http:// and https:// are supported.`);
      }

      if (isRestrictedHost(parsed.hostname)) {
        throw new Error(`Access to local or private network address "${parsed.hostname}" is restricted for security.`);
      }

      let res;
      try {
        res = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'SmartReader/1.0 (Mozilla/5.0; Personal Research & Knowledge Acquisition)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          throw new Error(`Connection timed out while reaching ${currentUrl}. The web server took too long to respond.`);
        }
        throw new Error(`Failed to reach ${currentUrl}: ${err.message}`);
      }

      // Handle HTTP redirects securely
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect status ${res.status} received without Location header from ${currentUrl}`);
        }
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          throw new Error(`Too many redirects (exceeded limit of ${MAX_REDIRECTS}) while reaching ${initialUrl}`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      // 4. HTTP Status Code Boundary Handling
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(`Access restricted (401 Unauthorized): "${currentUrl}" requires login credentials or membership.`);
        }
        if (res.status === 403) {
          throw new Error(`Access forbidden (403 Forbidden): The website at "${currentUrl}" restricts automated access.`);
        }
        if (res.status === 404) {
          throw new Error(`Page not found (404): The requested webpage address does not exist.`);
        }
        if (res.status === 429) {
          throw new Error(`Rate limited (429): The destination website has temporarily limited access. Please wait a moment.`);
        }
        if (res.status >= 500) {
          throw new Error(`Destination server error (${res.status}): The remote website is experiencing issues.`);
        }
        throw new Error(`HTTP Error ${res.status}: Unable to fetch webpage.`);
      }

      // 5. Content-Type Validation
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/pdf')) {
        throw new Error('This web link points directly to a PDF file. Please use the "Import File" tab to upload or process PDFs.');
      }
      if (contentType.includes('application/epub+zip')) {
        throw new Error('This web link points directly to an EPUB file. Please use the "Import File" tab to process EPUBs.');
      }
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('text/plain') &&
        !contentType.includes('application/xhtml+xml') &&
        !contentType.includes('text/xml')
      ) {
        throw new Error(`Unsupported content type "${contentType}". Smart Reader acquires readable HTML web content.`);
      }

      const html = await res.text();
      if (!html || html.trim() === '') {
        throw new Error('The retrieved webpage was empty.');
      }

      // 6. Paywall & Login Detection in content
      const lowerHtml = html.toLowerCase();
      if (
        lowerHtml.includes('name="paywall" content="true"') ||
        lowerHtml.includes('article:content_tier" content="locked"') ||
        (lowerHtml.includes('this article is exclusive to subscribers') && html.length < 5000) ||
        (lowerHtml.includes('sign in to read the full story') && html.length < 4000)
      ) {
        throw new Error('Access boundary: This webpage appears to be behind a paywall or subscriber gate.');
      }

      return {
        success: true,
        url: initialUrl,
        finalUrl: currentUrl,
        statusCode: res.status,
        contentType,
        html,
      };
    }

    throw new Error(`Too many redirects while reaching ${initialUrl}`);
  }
}

const defaultFetcher = new WebFetcher();
defaultFetcher.isRestrictedHost = isRestrictedHost;
defaultFetcher.isRestrictedIpv4 = isRestrictedIpv4;

module.exports = defaultFetcher;

module.exports = defaultFetcher;

