export default {
  async fetch(request, env, ctx) {
    // Handle preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret, X-Device-Fingerprint, X-Request-Count, X-Request-Timestamp, X-Platform, X-App-Version, User-Agent, Range, If-Range, If-None-Match',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow GET/HEAD for streaming
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        },
      });
    }

    const url = new URL(request.url);
    const key = url.searchParams.get('path');
    const timestamp = url.searchParams.get('ts');
    const signature = url.searchParams.get('sig');
    const fp = url.searchParams.get('fp');

    if (!key) {
      return new Response('Missing "path" query parameter', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // SECURE: Verify signed URL (no expiration check for better UX)
    if (!timestamp || !signature) {
      return new Response('Missing signature parameters', {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Verify signature (using algorithm that matches frontend)
    const signaturePath = fp ? `${key}:${fp}` : key;
    const expectedSignature = this.generateSecureSignatureSync(signaturePath, timestamp, env.APP_SECRET_KEY);
    if (signature !== expectedSignature) {
      return new Response('Invalid signature', {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Create a stable cache key that ignores signature params (after signature validation)
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.delete('sig');
    cacheUrl.searchParams.delete('ts');
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

    // Enhanced security checks (since no expiration)
    const deviceFingerprint = request.headers.get('X-Device-Fingerprint');
    const requestCount = request.headers.get('X-Request-Count');
    const platform = request.headers.get('X-Platform');
    const appVersion = request.headers.get('X-App-Version');
    const userAgent = request.headers.get('User-Agent');

    // Rate limiting per device (scalable for growing userbase)
    const rateLimitKey = `rate_limit:${deviceFingerprint || 'unknown'}`;
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000)); // Current hour timestamp
    
    const rateLimitData = await this.getRateLimitData(env, rateLimitKey, currentHour);
    
    // Allow 300 requests per device per hour (increased for growing userbase)
    const maxRequestsPerHour = 300;
    if (rateLimitData.count >= maxRequestsPerHour) {
      console.log(`🚫 Rate limit exceeded for device: ${deviceFingerprint}`);
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': '3600', // Retry after 1 hour
        },
      });
    }

    // Update rate limit
    await this.updateRateLimitData(env, rateLimitKey, currentHour);

    // Log security info for monitoring (only for suspicious activity)
    const urlAge = Math.floor((Date.now() - parseInt(timestamp)) / (60 * 1000));
    if (urlAge > 60 || rateLimitData.count > 50) { // Log only old URLs or high usage
      console.log('🔐 Request security info:', {
        deviceFingerprint,
        requestCount,
        platform,
        appVersion,
        userAgent,
        rateLimitCount: rateLimitData.count,
        timestamp: new Date().toISOString(),
        urlAge: urlAge + ' minutes old'
      });
    }

    try {
      // Handle Range Requests for TRUE STREAMING
      const rangeHeader = request.headers.get('Range');
      let object;
      let isRangeRequest = false;

      // Fast path: cache full object (no range) to reduce R2 reads and improve startup
      if (!rangeHeader) {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          if (request.method === 'HEAD') {
            return new Response(null, {
              status: cached.status,
              headers: cached.headers,
            });
          }
          return cached;
        }
      }

      if (rangeHeader) {
        // Parse the range header properly
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : null;
          
          // Create proper range object for R2
          const range = end ? { offset: start, length: end - start + 1 } : { offset: start };
          object = await env.R2_BUCKET.get(key, { range });
          isRangeRequest = true;
        } else {
          // Invalid range format, get full object
          object = await env.R2_BUCKET.get(key);
        }
      } else {
        // No range header, get full object
        object = await env.R2_BUCKET.get(key);
      }

      if (!object || !object.body) {
        return new Response('File not found', {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const etag = object.etag;
      const ifRange = request.headers.get('If-Range');
      if (isRangeRequest && ifRange && ifRange !== etag) {
        object = await env.R2_BUCKET.get(key);
        isRangeRequest = false;
      }
      
      // COST OPTIMIZATION: Check If-None-Match for 304 responses (saves bandwidth)
      if (!rangeHeader && request.headers.get('If-None-Match') === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            'ETag': etag,
            'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, stale-if-error=604800, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const contentType = object.httpMetadata?.contentType || this.getContentType(key);
      
      // COST OPTIMIZATION: Aggressive caching headers to reduce R2 requests
      const headers = {
        'Content-Type': contentType,
        'ETag': etag,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, stale-if-error=604800, immutable', // 1 day browser + 7 days edge stale
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret, X-Device-Fingerprint, X-Request-Count, X-Request-Timestamp, X-Platform, X-App-Version, User-Agent, Range, If-Range, If-None-Match',
        'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length, ETag',
        'Access-Control-Max-Age': '86400',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Range', // Important for range request caching
      };

      // Handle range response for TRUE STREAMING
      if (isRangeRequest && object.range) {
        // Invalid or unsatisfiable ranges should return 416
        const rangeEnd = object.range.offset + object.range.length - 1;
        if (rangeEnd >= object.size || object.range.offset < 0) {
          return new Response(null, {
            status: 416,
            headers: {
              ...headers,
              'Content-Range': `bytes */${object.size}`,
            },
          });
        }

        headers['Content-Range'] = `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`;
        headers['Content-Length'] = object.range.length;
        
        // COST OPTIMIZATION: Cache range requests separately
        headers['Cache-Control'] = 'public, max-age=3600, immutable'; // 1 hour for range requests
        
        if (request.method === 'HEAD') {
          return new Response(null, {
            status: 206,
            headers,
          });
        }

        return new Response(object.body, {
          status: 206,
          headers,
        });
      }

      headers['Content-Length'] = object.size;
      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers,
        });
      }

      const response = new Response(object.body, {
        status: 200,
        headers,
      });
      // Store full objects in cache (not ranges) to speed up startup and reduce R2 reads
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      console.error('Fetch error:', err);
      return new Response('Error retrieving file', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },

  // COST OPTIMIZATION: In-memory rate limiting fallback (resets on worker restart)
  // For production, use Cloudflare KV for consistent rate limiting across instances.
  rateLimitStore: new Map(),

  async getRateLimitData(env, key, currentHour) {
    if (env.RATE_LIMIT_KV) {
      const kvKey = `${key}:${currentHour}`;
      const raw = await env.RATE_LIMIT_KV.get(kvKey);
      if (!raw) {
        return { count: 0, hour: currentHour };
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.hour === currentHour && typeof parsed.count === 'number') {
          return parsed;
        }
      } catch {
        // Fallback to reset
      }
      return { count: 0, hour: currentHour };
    }

    const data = this.rateLimitStore.get(key);
    if (!data || data.hour !== currentHour) {
      return { count: 0, hour: currentHour };
    }
    return data;
  },

  async updateRateLimitData(env, key, currentHour) {
    if (env.RATE_LIMIT_KV) {
      const kvKey = `${key}:${currentHour}`;
      const current = await this.getRateLimitData(env, key, currentHour);
      const next = { count: current.count + 1, hour: currentHour };
      // Expire after 2 hours to allow clock skew and late requests
      await env.RATE_LIMIT_KV.put(kvKey, JSON.stringify(next), { expirationTtl: 2 * 60 * 60 });
      return;
    }

    const data = await this.getRateLimitData(env, key, currentHour);
    data.count++;
    this.rateLimitStore.set(key, data);
  },

  // Generate signature using the same algorithm as frontend
  generateSecureSignatureSync(path, timestamp, secret) {
    const message = `${secret}:${timestamp}:${path}`;
    
    // Use the same hash algorithm as frontend (prime-based hash)
    let hash = 0;
    const prime = 31;
    const mod = 1000000007;
    
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash * prime) % mod + char) % mod;
    }
    
    // Add additional entropy (same as frontend)
    const entropy = timestamp.length + path.length;
    hash = (hash * prime + entropy) % mod;
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  },

  getContentType(key) {
    const lower = (key || '').toLowerCase();
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
    if (lower.endsWith('.opus')) return 'audio/opus';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.flac')) return 'audio/flac';
    if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
    return 'audio/mpeg';
  },
};



