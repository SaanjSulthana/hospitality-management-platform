# DNS Configuration for Custom Domain

## Current Issue

The frontend is configured to use `https://api.curat.ai` as the backend API URL, but this domain is not resolving (`net::ERR_NAME_NOT_RESOLVED`). This means the DNS records for `api.curat.ai` have not been configured in Encore Cloud.

## Current Configuration

- **Frontend**: `curat.ai` (Netlify)
- **Backend API**: `https://api.curat.ai` (Encore Cloud - **NOT CONFIGURED YET**)
- **Fallback**: `https://hospitality-management-platform-cr8i.encr.app` (Encore Cloud default - **CURRENTLY IN USE**)

## Solution: Configure Custom Domain in Encore Cloud

### Step 1: Set up Custom Domain in Encore Cloud Dashboard

1. Go to [Encore Cloud Dashboard](https://app.encore.dev)
2. Navigate to your app: `hospitality-management-platform-cr8i`
3. Go to **Settings** → **Custom Domains**
4. Click **Add Custom Domain**
5. Enter: `api.curat.ai`
6. Follow the DNS configuration instructions

### Step 2: Configure DNS Records

You'll need to add a CNAME record in your DNS provider (where `curat.ai` is hosted):

```
Type: CNAME
Name: api
Value: hospitality-management-platform-cr8i.encr.app
TTL: 3600 (or default)
```

**OR** if Encore provides an A record:

```
Type: A
Name: api
Value: [IP address provided by Encore]
TTL: 3600
```

### Step 3: Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours to propagate
- You can check propagation status using: https://www.whatsmydns.net/#CNAME/api.curat.ai

### Step 4: Verify Domain is Working

Once DNS is configured, test the domain:

```bash
# Test DNS resolution
nslookup api.curat.ai

# Test HTTPS endpoint
curl https://api.curat.ai/v1/config/health
```

### Step 5: Update Frontend Configuration

Once `api.curat.ai` is working, update `frontend/src/utils/env.ts`:

Change:
```typescript
// TODO: Once api.curat.ai DNS is configured, change this to CUSTOM_DOMAIN_API_URL
if (hostname === 'curat.ai' || hostname.endsWith('.curat.ai')) {
  return ENCORE_CLOUD_API_URL; // Change this line
}
```

To:
```typescript
if (hostname === 'curat.ai' || hostname.endsWith('.curat.ai')) {
  return CUSTOM_DOMAIN_API_URL; // Use custom domain
}
```

## Temporary Workaround (Current Implementation)

The frontend is currently configured to use the Encore Cloud default URL (`https://hospitality-management-platform-cr8i.encr.app`) as a fallback. This works immediately but doesn't use your custom domain.

**Current behavior:**
- All API calls go to `https://hospitality-management-platform-cr8i.encr.app/v1/...`
- This works without any DNS configuration
- Once DNS is configured, you can switch to `api.curat.ai`

## Testing

After DNS is configured, verify:

1. **DNS Resolution:**
   ```bash
   nslookup api.curat.ai
   # Should return Encore Cloud IP or CNAME
   ```

2. **HTTPS Certificate:**
   ```bash
   curl -I https://api.curat.ai/v1/config/health
   # Should return 200 OK with valid SSL certificate
   ```

3. **CORS:**
   - Open browser console on `curat.ai`
   - Make an API call
   - Check for CORS errors (should be none)

## Troubleshooting

### DNS Not Resolving

- **Check DNS records**: Verify CNAME/A record is correct
- **Wait for propagation**: Can take up to 48 hours
- **Check DNS provider**: Ensure records are saved correctly

### SSL Certificate Issues

- Encore Cloud automatically provisions SSL certificates
- May take a few minutes after DNS is configured
- Check Encore Cloud dashboard for certificate status

### CORS Errors

- Ensure `api.curat.ai` is in `backend/encore.app` CORS configuration
- Verify frontend origin matches CORS allowlist exactly

## References

- [Encore Custom Domains Documentation](https://encore.dev/docs/how-to/custom-domains)
- [Encore Cloud Dashboard](https://app.encore.dev)

