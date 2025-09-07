export interface LocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface GeolocationResponse {
  ip: string;
  country: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
}

// Get user's geolocation data using IP address
export async function getUserLocation(): Promise<LocationData | null> {
  try {
    // First try to get location from IP using a free geolocation service
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }
    
    const data: GeolocationResponse = await response.json();
    
    return {
      country: data.country,
      region: data.region,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
    };
  } catch (error) {
    console.warn('Failed to get geolocation data:', error);
    
    // Fallback: try to get basic location info from browser
    try {
      if ('geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          });
        });
        
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
    } catch (geoError) {
      console.warn('Browser geolocation failed:', geoError);
    }
    
    // Final fallback: just return timezone
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

// Get user's IP address (approximate)
export async function getUserIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      throw new Error('Failed to fetch IP address');
    }
    
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('Failed to get IP address:', error);
    return null;
  }
}

// Get user agent string
export function getUserAgent(): string {
  return navigator.userAgent;
}

// Get user's locale
export function getUserLocale(): string {
  return navigator.language || 'en-US';
}
