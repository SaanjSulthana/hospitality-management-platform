# Android App API Configuration

## Production API Endpoint

The Android app is configured to use the production backend API:

- **API Base URL**: `https://api.curat.ai`
- **API Version**: `/v1`
- **Full API URL**: `https://api.curat.ai/v1`

## Configuration Files

### 1. Network Security Config
**File**: `app/src/main/res/xml/network_security_config.xml`

This file configures Android's network security to allow HTTPS connections to `api.curat.ai`:

```xml
<domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">api.curat.ai</domain>
    <trust-anchors>
        <certificates src="system" />
    </trust-anchors>
</domain-config>
```

### 2. Gradle Properties
**File**: `gradle.properties`

Contains API configuration constants:

```properties
API_BASE_URL=https://api.curat.ai
API_VERSION=/v1
```

### 3. Build Configuration
**File**: `app/build.gradle`

Build config fields are set for production:

```gradle
buildConfigField "String", "API_BASE_URL", "\"https://api.curat.ai\""
buildConfigField "String", "API_VERSION", "\"/v1\""
```

### 4. JavaScript Environment Detection
**File**: `frontend/src/utils/env.ts`

The app automatically detects when running in a Capacitor (native) environment and uses the production API:

```typescript
// For Capacitor native apps - use api.curat.ai (Encore public API)
if (isCapacitor()) {
  return 'https://api.curat.ai';
}
```

## Building the Android App

### Production Build

```bash
cd frontend
npm run build:android
```

This will:
1. Build the web assets with `VITE_API_URL=https://api.curat.ai`
2. Sync the built assets to the Android project
3. The app will use `https://api.curat.ai` for all API calls

### Development Build (for testing with local backend)

```bash
cd frontend
npm run build:android:dev
```

This uses `http://10.0.2.2:4000` (Android emulator's localhost) for development.

**Note**: For development builds, ensure your backend is running and accessible from the Android emulator.

## Environment Variables

The app uses the following environment variables (set during build):

- `VITE_API_URL`: API base URL (defaults to `https://api.curat.ai` for production)

## Testing API Connection

1. Build and install the app on a device/emulator
2. Open the app and check the browser console (if using remote debugging)
3. Verify API calls are going to `https://api.curat.ai/v1/...`

## Troubleshooting

### API calls failing

1. **Check network security config**: Ensure `api.curat.ai` is in `network_security_config.xml`
2. **Verify internet permission**: Check `AndroidManifest.xml` has `<uses-permission android:name="android.permission.INTERNET" />`
3. **Check CORS**: Ensure backend CORS allows requests from your app
4. **Verify SSL certificate**: Ensure `api.curat.ai` has a valid SSL certificate

### Using different API endpoint

To use a different API endpoint:

1. Update `gradle.properties`:
   ```properties
   API_BASE_URL=https://your-api-domain.com
   ```

2. Update `app/build.gradle`:
   ```gradle
   buildConfigField "String", "API_BASE_URL", "\"https://your-api-domain.com\""
   ```

3. Rebuild the app:
   ```bash
   npm run build:android
   ```

## Backend CORS Configuration

Ensure your backend (`backend/encore.app`) has CORS configured to allow requests from the Android app. The current configuration allows all origins, but for production you may want to restrict it.

## Related Files

- `frontend/src/utils/env.ts` - API URL detection logic
- `frontend/src/config/environment.ts` - Environment configuration
- `frontend/capacitor.config.ts` - Capacitor configuration
- `backend/encore.app` - Backend CORS configuration

