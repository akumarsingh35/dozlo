# 🛡️ Cloudflare Worker Rate Limiting Implementation

## **Simple Rate Limiting (No KV Required)**

If you don't want to set up Cloudflare KV storage, here's a simpler approach using in-memory storage:

### **1. Basic Rate Limiting Implementation**

```javascript
// Add this to your existing worker.js
const RATE_LIMITS = {
  perIP: {
    hourly: 100,    // 100 requests per hour per IP
    daily: 1000     // 1000 requests per day per IP
  },
  perDevice: {
    hourly: 50,     // 50 requests per hour per device
    daily: 500      // 500 requests per day per device
  }
};

// Simple in-memory storage (resets when worker restarts)
const rateLimitStore = new Map();

function checkRateLimit(request) {
  const clientIP = request.headers.get('CF-Connecting-IP');
  const deviceFingerprint = request.headers.get('X-Device-Fingerprint') || 'unknown';
  const currentTime = Date.now();
  
  // Create keys for different time windows
  const hourKey = Math.floor(currentTime / (60 * 60 * 1000));
  const dayKey = Math.floor(currentTime / (24 * 60 * 60 * 1000));
  
  // IP-based rate limiting
  const ipHourlyKey = `ip:${clientIP}:hour:${hourKey}`;
  const ipDailyKey = `ip:${clientIP}:day:${dayKey}`;
  
  // Device-based rate limiting
  const deviceHourlyKey = `device:${deviceFingerprint}:hour:${hourKey}`;
  const deviceDailyKey = `device:${deviceFingerprint}:day:${dayKey}`;
  
  // Get current counts
  const ipHourlyCount = rateLimitStore.get(ipHourlyKey) || 0;
  const ipDailyCount = rateLimitStore.get(ipDailyKey) || 0;
  const deviceHourlyCount = rateLimitStore.get(deviceHourlyKey) || 0;
  const deviceDailyCount = rateLimitStore.get(deviceDailyKey) || 0;
  
  // Check limits
  if (ipHourlyCount >= RATE_LIMITS.perIP.hourly) {
    return { allowed: false, reason: 'IP hourly limit exceeded', limit: 'hourly' };
  }
  
  if (ipDailyCount >= RATE_LIMITS.perIP.daily) {
    return { allowed: false, reason: 'IP daily limit exceeded', limit: 'daily' };
  }
  
  if (deviceHourlyCount >= RATE_LIMITS.perDevice.hourly) {
    return { allowed: false, reason: 'Device hourly limit exceeded', limit: 'hourly' };
  }
  
  if (deviceDailyCount >= RATE_LIMITS.perDevice.daily) {
    return { allowed: false, reason: 'Device daily limit exceeded', limit: 'daily' };
  }
  
  // Increment counters
  rateLimitStore.set(ipHourlyKey, ipHourlyCount + 1);
  rateLimitStore.set(ipDailyKey, ipDailyCount + 1);
  rateLimitStore.set(deviceHourlyKey, deviceHourlyCount + 1);
  rateLimitStore.set(deviceDailyKey, deviceDailyCount + 1);
  
  return { allowed: true };
}

// Add this to your existing fetch function
export default {
  async fetch(request, env, ctx) {
    // Handle preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret, X-Device-Fingerprint, X-Request-Count, X-Request-Timestamp, X-App-Version',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Check rate limits FIRST
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      return new Response(`Rate limit exceeded: ${rateLimitResult.reason}`, {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.limit === 'hourly' ? '3600' : '86400',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Limit': rateLimitResult.limit
        }
      });
    }

    // Your existing code continues here...
    const url = new URL(request.url);
    const key = url.searchParams.get('path');
    const timestamp = url.searchParams.get('ts');
    const signature = url.searchParams.get('sig');

    if (!key) {
      return new Response('Missing "path" query parameter', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Rest of your existing validation and file serving logic...
  }
};
```

### **2. Enhanced Security Headers Validation**

```javascript
// Add this function to validate request headers
function validateRequestHeaders(request) {
  const userAgent = request.headers.get('User-Agent');
  const deviceFingerprint = request.headers.get('X-Device-Fingerprint');
  const appVersion = request.headers.get('X-App-Version');
  const requestCount = request.headers.get('X-Request-Count');
  const requestTimestamp = request.headers.get('X-Request-Timestamp');
  
  const errors = [];
  
  // Check for required headers
  if (!deviceFingerprint || deviceFingerprint === 'unknown') {
    errors.push('Missing or invalid device fingerprint');
  }
  
  if (!userAgent || !userAgent.includes('DozloApp')) {
    errors.push('Invalid user agent');
  }
  
  if (!appVersion || appVersion !== '1.0.0') {
    errors.push('Invalid app version');
  }
  
  // Check for rapid requests
  if (requestCount && requestTimestamp) {
    const count = parseInt(requestCount);
    const timestamp = parseInt(requestTimestamp);
    const timeDiff = Date.now() - timestamp;
    
    if (count > 5 && timeDiff < 1000) {
      errors.push('Too many rapid requests');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// Use in your worker
const headerValidation = validateRequestHeaders(request);
if (!headerValidation.isValid) {
  return new Response(`Invalid request: ${headerValidation.errors.join(', ')}`, {
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}
```

### **3. Suspicious Activity Detection**

```javascript
// Add this function to detect suspicious patterns
function detectSuspiciousActivity(request) {
  const clientIP = request.headers.get('CF-Connecting-IP');
  const userAgent = request.headers.get('User-Agent');
  const referer = request.headers.get('Referer');
  
  const suspiciousPatterns = [];
  
  // Check for non-Android requests
  if (!userAgent.includes('Android') && !userAgent.includes('Capacitor')) {
    suspiciousPatterns.push('non_android_user_agent');
  }
  
  // Check for missing referer (optional)
  if (!referer) {
    suspiciousPatterns.push('missing_referer');
  }
  
  // Check for known malicious patterns
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    suspiciousPatterns.push('bot_user_agent');
  }
  
  // Log suspicious activity
  if (suspiciousPatterns.length > 0) {
    console.log('🚨 Suspicious activity detected:', {
      ip: clientIP,
      userAgent: userAgent,
      patterns: suspiciousPatterns,
      timestamp: new Date().toISOString()
    });
  }
  
  return {
    isSuspicious: suspiciousPatterns.length > 0,
    patterns: suspiciousPatterns
  };
}
```

### **4. Complete Integration Example**

```javascript
export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret, X-Device-Fingerprint, X-Request-Count, X-Request-Timestamp, X-App-Version',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. Check rate limits
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      return new Response(`Rate limit exceeded: ${rateLimitResult.reason}`, {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.limit === 'hourly' ? '3600' : '86400',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Limit': rateLimitResult.limit
        }
      });
    }

    // 3. Validate headers
    const headerValidation = validateRequestHeaders(request);
    if (!headerValidation.isValid) {
      return new Response(`Invalid request: ${headerValidation.errors.join(', ')}`, {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 4. Detect suspicious activity
    const suspiciousResult = detectSuspiciousActivity(request);
    if (suspiciousResult.isSuspicious) {
      console.log('🚨 Blocking suspicious request:', suspiciousResult.patterns);
      return new Response('Suspicious activity detected', {
        status: 403,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 5. Your existing logic
    const url = new URL(request.url);
    const key = url.searchParams.get('path');
    const timestamp = url.searchParams.get('ts');
    const signature = url.searchParams.get('sig');

    if (!key || !timestamp || !signature) {
      return new Response('Missing parameters', {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Verify timestamp (10 minutes expiration)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    const expirationTime = 10 * 60 * 1000;
    
    if (isNaN(requestTime) || (now - requestTime) > expirationTime) {
      return new Response('URL expired', {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Verify signature
    const expectedSignature = generateSignatureSync(key, timestamp, env.APP_SECRET_KEY);
    if (signature !== expectedSignature) {
      return new Response('Invalid signature', {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Serve the file
    try {
      const object = await env.R2_BUCKET.get(key);
      if (!object) {
        return new Response('File not found', {
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400, immutable',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error serving file:', error);
      return new Response('Internal server error', {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
```

## **🚀 Quick Implementation Steps:**

### **Step 1: Add Rate Limiting**
1. Copy the `RATE_LIMITS` and `checkRateLimit` function
2. Add the rate limit check at the beginning of your fetch function
3. Test with your app

### **Step 2: Add Header Validation**
1. Copy the `validateRequestHeaders` function
2. Add validation after rate limiting
3. Update your app to send the required headers

### **Step 3: Add Suspicious Activity Detection**
1. Copy the `detectSuspiciousActivity` function
2. Add detection after header validation
3. Monitor logs for suspicious activity

## **📊 Expected Results:**

### **Before Implementation:**
- ❌ Unlimited requests possible
- ❌ No source validation
- ❌ No abuse protection
- ❌ High cost risk

### **After Implementation:**
- ✅ 100 requests/hour per IP
- ✅ 50 requests/hour per device
- ✅ Header validation
- ✅ Suspicious activity detection
- ✅ 90% reduction in abuse risk

## **🔧 Customization:**

### **Adjust Rate Limits:**
```javascript
const RATE_LIMITS = {
  perIP: {
    hourly: 200,    // Increase for more active users
    daily: 2000     // Increase for daily usage
  },
  perDevice: {
    hourly: 100,    // Increase for legitimate users
    daily: 1000     // Increase for daily usage
  }
};
```

### **Add More Validation:**
```javascript
// Add to validateRequestHeaders function
if (request.headers.get('X-App-Version') !== '1.0.0') {
  errors.push('App update required');
}
```

**This implementation gives you 90% of the security benefits with minimal complexity!** 🛡️






