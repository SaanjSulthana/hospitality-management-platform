import { formatDateForAPI } from '../../lib/date-utils';

describe('Date Utils - Timezone Fix', () => {
  it('should format date correctly without timezone shift', () => {
    // Test with a specific date that was causing issues
    const inputDate = '2025-09-14';
    const result = formatDateForAPI(inputDate);
    
    // The result should be an ISO string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Parse the result and check the date components
    const resultDate = new Date(result);
    expect(resultDate.getFullYear()).toBe(2025);
    expect(resultDate.getMonth()).toBe(8); // September is month 8 (0-indexed)
    expect(resultDate.getDate()).toBe(14);
    
    // The time should be start of day (00:00:00)
    expect(resultDate.getHours()).toBe(0);
    expect(resultDate.getMinutes()).toBe(0);
    expect(resultDate.getSeconds()).toBe(0);
  });

  it('should handle different dates correctly', () => {
    const testCases = [
      { input: '2025-01-01', expectedYear: 2025, expectedMonth: 0, expectedDay: 1 },
      { input: '2025-12-31', expectedYear: 2025, expectedMonth: 11, expectedDay: 31 },
      { input: '2024-02-29', expectedYear: 2024, expectedMonth: 1, expectedDay: 29 }, // Leap year
    ];

    testCases.forEach(({ input, expectedYear, expectedMonth, expectedDay }) => {
      const result = formatDateForAPI(input);
      const resultDate = new Date(result);
      
      expect(resultDate.getFullYear()).toBe(expectedYear);
      expect(resultDate.getMonth()).toBe(expectedMonth);
      expect(resultDate.getDate()).toBe(expectedDay);
    });
  });

  it('should handle empty string gracefully', () => {
    const result = formatDateForAPI('');
    expect(result).toBeDefined();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should create dates in local timezone', () => {
    const inputDate = '2025-09-14';
    const result = formatDateForAPI(inputDate);
    const resultDate = new Date(result);
    
    // Create a reference date in local timezone
    const referenceDate = new Date(2025, 8, 14, 0, 0, 0, 0); // September 14, 2025, 00:00:00 local time
    
    // The dates should represent the same moment in time
    expect(resultDate.getTime()).toBe(referenceDate.getTime());
  });
});

