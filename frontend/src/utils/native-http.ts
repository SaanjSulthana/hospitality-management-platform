/**
 * Native HTTP Wrapper for Capacitor
 * 
 * Uses native HTTP when running in Capacitor (bypasses CORS)
 * Falls back to regular fetch when running in browser
 */

import { Capacitor } from '@capacitor/core';
import { Http, HttpResponse, HttpOptions } from '@capacitor-community/http';

/**
 * Check if we should use native HTTP
 */
export function shouldUseNativeHttp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Native HTTP GET request
 */
export async function nativeGet(url: string, headers?: Record<string, string>): Promise<any> {
  if (!shouldUseNativeHttp()) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  const options: HttpOptions = {
    url,
    headers: headers || {},
  };

  const response: HttpResponse = await Http.get(options);
  
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

/**
 * Native HTTP POST request
 */
export async function nativePost(url: string, data: any, headers?: Record<string, string>): Promise<any> {
  if (!shouldUseNativeHttp()) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      const error = new Error(responseData.message || `HTTP ${response.status}`);
      (error as any).response = { status: response.status, data: responseData };
      throw error;
    }
    
    return responseData;
  }

  const options: HttpOptions = {
    url,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    data,
  };

  console.log('[NativeHTTP] POST request:', url);
  const response: HttpResponse = await Http.post(options);
  console.log('[NativeHTTP] Response status:', response.status);
  console.log('[NativeHTTP] Response data:', response.data);
  
  if (response.status >= 400) {
    const error = new Error(response.data?.message || `HTTP ${response.status}`);
    (error as any).response = { status: response.status, data: response.data };
    throw error;
  }
  
  return response.data;
}

/**
 * Native HTTP PUT request
 */
export async function nativePut(url: string, data: any, headers?: Record<string, string>): Promise<any> {
  if (!shouldUseNativeHttp()) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  const options: HttpOptions = {
    url,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    data,
  };

  const response: HttpResponse = await Http.put(options);
  
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

/**
 * Native HTTP DELETE request
 */
export async function nativeDelete(url: string, headers?: Record<string, string>): Promise<any> {
  if (!shouldUseNativeHttp()) {
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  const options: HttpOptions = {
    url,
    headers: headers || {},
  };

  const response: HttpResponse = await Http.del(options);
  
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

/**
 * Create a native HTTP client for authentication
 */
export function createNativeAuthClient(baseUrl: string) {
  return {
    login: async (email: string, password: string) => {
      const url = `${baseUrl}/auth/login`;
      console.log('[NativeAuthClient] Login URL:', url);
      return nativePost(url, { email, password });
    },
    
    signup: async (data: any) => {
      const url = `${baseUrl}/auth/signup`;
      return nativePost(url, data);
    },
    
    me: async (token: string) => {
      const url = `${baseUrl}/auth/me`;
      return nativeGet(url, { Authorization: `Bearer ${token}` });
    },
    
    refresh: async (refreshToken: string) => {
      const url = `${baseUrl}/auth/refresh`;
      return nativePost(url, { refreshToken });
    },
    
    logout: async (token: string) => {
      const url = `${baseUrl}/auth/logout`;
      return nativePost(url, {}, { Authorization: `Bearer ${token}` });
    },
  };
}

