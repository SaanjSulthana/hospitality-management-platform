import { useState, useEffect } from 'react';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { CacheStatus } from '@/components/CacheStatus';
import { API_CONFIG } from '@/src/config/api';

export function ReportsPageExample() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const { lastUpdate, isPolling } = useRealtimeUpdates(true);

  useEffect(() => {
    // Refetch when update detected
    fetchReports();
  }, [lastUpdate]);

  useEffect(() => {
    // Also listen for custom event
    const handleUpdate = () => fetchReports();
    window.addEventListener('finance-update', handleUpdate);
    return () => window.removeEventListener('finance-update', handleUpdate);
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_CONFIG.BASE_URL}/reports/daily-report?propertyId=1&date=2025-01-22`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setReports(Array.isArray(data) ? data : [data]);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <div className="flex items-center gap-2">
          {isPolling && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Live Updates
            </span>
          )}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Cache Status */}
      <CacheStatus />

      {/* Reports Content */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Daily Report - 2025-01-22</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading reports...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-sm font-medium text-green-800">Total Revenue</h3>
                <p className="text-2xl font-bold text-green-600">₹1,50,000</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h3 className="text-sm font-medium text-red-800">Total Expenses</h3>
                <p className="text-2xl font-bold text-red-600">₹1,00,000</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-800">Net Profit</h3>
                <p className="text-2xl font-bold text-blue-600">₹50,000</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event History */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Expense added - ₹75,000</span>
            <span className="text-gray-500">2 minutes ago</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span>Cash balance updated</span>
            <span className="text-gray-500">5 minutes ago</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Revenue added - ₹1,50,000</span>
            <span className="text-gray-500">10 minutes ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
