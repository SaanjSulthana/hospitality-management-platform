// Date Format Standardization Tests

import { formatDateDDMMYYYY, formatDateWithDayName, formatDateForDisplay, formatDateTimeForDisplay } from '../../lib/date-utils';
import { formatDateOnly, formatDateTimeDDMMYYYY, formatTransactionDateTime } from '../../lib/datetime';

describe('Date Format Standardization - DD/MM/YYYY', () => {
  describe('formatDateDDMMYYYY', () => {
    it('should format date string as DD/MM/YYYY', () => {
      expect(formatDateDDMMYYYY('2025-10-08')).toBe('08/10/2025');
      expect(formatDateDDMMYYYY('2025-01-01')).toBe('01/01/2025');
      expect(formatDateDDMMYYYY('2025-12-31')).toBe('31/12/2025');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-10-08T10:30:00Z');
      const result = formatDateDDMMYYYY(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      // Note: Exact date may vary due to timezone conversion to IST
    });

    it('should handle ISO date strings', () => {
      const result = formatDateDDMMYYYY('2025-10-08T10:30:00.000Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should handle null/undefined', () => {
      expect(formatDateDDMMYYYY(null)).toBe('N/A');
      expect(formatDateDDMMYYYY(undefined)).toBe('N/A');
    });

    it('should handle invalid dates', () => {
      expect(formatDateDDMMYYYY('invalid')).toBe('Invalid Date');
      expect(formatDateDDMMYYYY('2025-13-45')).toBe('Invalid Date');
    });

    it('should use Asia/Kolkata timezone', () => {
      // Test with a UTC date that would be different day in IST
      const utcDate = '2025-10-07T23:00:00.000Z'; // 11 PM UTC
      const result = formatDateDDMMYYYY(utcDate);
      // In IST (UTC+5:30), this would be 4:30 AM on 08/10/2025
      expect(result).toBe('08/10/2025');
    });
  });

  describe('formatDateWithDayName', () => {
    it('should format date with day name', () => {
      const result = formatDateWithDayName('2025-10-08');
      expect(result).toContain('08/10/2025');
      expect(result).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/);
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-10-08T00:00:00Z');
      const result = formatDateWithDayName(date);
      expect(result).toContain('/10/2025');
      expect(result).toContain(',');
    });

    it('should handle null/undefined', () => {
      expect(formatDateWithDayName(null)).toBe('N/A');
      expect(formatDateWithDayName(undefined)).toBe('N/A');
    });

    it('should handle invalid dates', () => {
      expect(formatDateWithDayName('invalid')).toBe('Invalid Date');
    });
  });

  describe('formatDateForDisplay', () => {
    it('should use DD/MM/YYYY format', () => {
      expect(formatDateForDisplay('2025-10-08')).toBe('08/10/2025');
      expect(formatDateForDisplay('2025-01-15')).toBe('15/01/2025');
    });

    it('should be consistent with formatDateDDMMYYYY', () => {
      const date = '2025-10-08';
      expect(formatDateForDisplay(date)).toBe(formatDateDDMMYYYY(date));
    });
  });

  describe('formatDateTimeForDisplay', () => {
    it('should format date and time', () => {
      const result = formatDateTimeForDisplay('2025-10-08T10:30:00Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    });

    it('should use 24-hour format', () => {
      const result = formatDateTimeForDisplay('2025-10-08T14:30:00Z');
      expect(result).not.toContain('PM');
      expect(result).not.toContain('AM');
    });

    it('should handle empty string', () => {
      expect(formatDateTimeForDisplay('')).toBe('');
    });
  });

  describe('formatDateOnly (from datetime.ts)', () => {
    it('should format date without time in DD/MM/YYYY', () => {
      expect(formatDateOnly('2025-10-08', 'DD/MM/YYYY')).toBe('08/10/2025');
    });

    it('should support DD MMM YYYY format', () => {
      const date = '2025-10-08';
      const result = formatDateOnly(date, 'DD MMM YYYY');
      expect(result).toContain('Oct');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{2}/); // Should have 2-digit day
    });

    it('should support DD MMMM YYYY format', () => {
      const date = '2025-10-08';
      const result = formatDateOnly(date, 'DD MMMM YYYY');
      expect(result).toContain('October');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{2}/); // Should have 2-digit day
    });

    it('should handle null/undefined', () => {
      expect(formatDateOnly(null)).toBe('N/A');
      expect(formatDateOnly(undefined)).toBe('N/A');
    });

    it('should handle invalid dates', () => {
      expect(formatDateOnly('invalid')).toBe('Invalid Date');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-10-08T10:30:00Z');
      const result = formatDateOnly(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('formatDateTimeDDMMYYYY', () => {
    it('should format date and time with DD/MM/YYYY', () => {
      const result = formatDateTimeDDMMYYYY('2025-10-08T10:30:00Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    });

    it('should use 24-hour format', () => {
      const result = formatDateTimeDDMMYYYY('2025-10-08T14:30:00Z');
      expect(result).not.toContain('PM');
      expect(result).not.toContain('AM');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-10-08T10:30:00Z');
      const result = formatDateTimeDDMMYYYY(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    });

    it('should handle null/undefined', () => {
      expect(formatDateTimeDDMMYYYY(null)).toBe('N/A');
      expect(formatDateTimeDDMMYYYY(undefined)).toBe('N/A');
    });

    it('should handle invalid dates', () => {
      expect(formatDateTimeDDMMYYYY('invalid')).toBe('Invalid Date');
    });
  });

  describe('formatTransactionDateTime', () => {
    it('should use DD/MM/YYYY format', () => {
      const result = formatTransactionDateTime('2025-10-08T10:30:00Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should be consistent with formatDateTimeDDMMYYYY', () => {
      const date = '2025-10-08T10:30:00Z';
      expect(formatTransactionDateTime(date)).toBe(formatDateTimeDDMMYYYY(date));
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year dates', () => {
      expect(formatDateDDMMYYYY('2024-02-29')).toBe('29/02/2024');
      expect(formatDateDDMMYYYY('2025-02-28')).toBe('28/02/2025');
    });

    it('should handle month boundaries', () => {
      expect(formatDateDDMMYYYY('2025-01-31')).toBe('31/01/2025');
      expect(formatDateDDMMYYYY('2025-02-01')).toBe('01/02/2025');
      expect(formatDateDDMMYYYY('2025-12-31')).toBe('31/12/2025');
    });

    it('should handle year boundaries', () => {
      expect(formatDateDDMMYYYY('2024-12-31')).toBe('31/12/2024');
      expect(formatDateDDMMYYYY('2025-01-01')).toBe('01/01/2025');
    });

    it('should handle single-digit days and months correctly', () => {
      expect(formatDateDDMMYYYY('2025-01-05')).toBe('05/01/2025');
      expect(formatDateDDMMYYYY('2025-09-09')).toBe('09/09/2025');
    });
  });

  describe('Consistency Across Functions', () => {
    it('should produce consistent date parts', () => {
      const date = '2025-10-08T10:30:00Z';
      
      const dateOnly = formatDateDDMMYYYY(date);
      const dateTime = formatDateTimeDDMMYYYY(date);
      const transaction = formatTransactionDateTime(date);
      
      // All should start with the same date part
      expect(dateTime).toContain(dateOnly);
      expect(transaction).toContain(dateOnly);
    });

    it('should handle same date in different formats', () => {
      const date1 = '2025-10-08';
      const date2 = '2025-10-08T00:00:00Z';
      const date3 = new Date('2025-10-08');
      
      // All should produce similar results (may differ slightly due to timezone)
      const result1 = formatDateDDMMYYYY(date1);
      const result2 = formatDateDDMMYYYY(date2);
      const result3 = formatDateDDMMYYYY(date3);
      
      expect(result1).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result2).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result3).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('Timezone Handling', () => {
    it('should consistently use Asia/Kolkata timezone', () => {
      // Test with a date that would be different in different timezones
      const utcMidnight = '2025-10-08T00:00:00.000Z';
      const result = formatDateDDMMYYYY(utcMidnight);
      
      // In IST (UTC+5:30), midnight UTC is 5:30 AM same day
      expect(result).toBe('08/10/2025');
    });

    it('should handle timezone edge cases', () => {
      // Late evening UTC should be next day in IST
      const lateEvening = '2025-10-07T20:00:00.000Z'; // 8 PM UTC
      const result = formatDateDDMMYYYY(lateEvening);
      
      // In IST (UTC+5:30), 8 PM UTC is 1:30 AM next day
      expect(result).toBe('08/10/2025');
    });
  });

  describe('Format Variations', () => {
    it('should support different format styles in formatDateOnly', () => {
      const date = '2025-10-08';
      
      const format1 = formatDateOnly(date, 'DD/MM/YYYY');
      const format2 = formatDateOnly(date, 'DD MMM YYYY');
      const format3 = formatDateOnly(date, 'DD MMMM YYYY');
      
      expect(format1).toBe('08/10/2025');
      expect(format2).toContain('Oct');
      expect(format3).toContain('October');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle rapid successive calls', () => {
      const date = '2025-10-08';
      const results = Array.from({ length: 100 }, () => formatDateDDMMYYYY(date));
      
      // All results should be identical
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe('08/10/2025');
    });

    it('should not throw errors for any input', () => {
      const testInputs = [
        null,
        undefined,
        '',
        'invalid',
        '2025-13-45',
        {},
        [],
        123,
        NaN
      ];
      
      testInputs.forEach(input => {
        expect(() => formatDateDDMMYYYY(input as any)).not.toThrow();
      });
    });

    it('should handle errors gracefully', () => {
      // Should not throw errors for invalid inputs
      expect(() => formatDateDDMMYYYY('invalid')).not.toThrow();
      expect(formatDateDDMMYYYY('invalid')).toBe('Invalid Date');
    });
  });

  describe('Real-world Date Scenarios', () => {
    it('should handle common Indian festival dates', () => {
      // Diwali 2025
      expect(formatDateDDMMYYYY('2025-10-20')).toBe('20/10/2025');
      
      // Holi 2025
      expect(formatDateDDMMYYYY('2025-03-14')).toBe('14/03/2025');
      
      // Independence Day
      expect(formatDateDDMMYYYY('2025-08-15')).toBe('15/08/2025');
    });

    it('should handle financial year dates', () => {
      // Start of FY 2025-26
      expect(formatDateDDMMYYYY('2025-04-01')).toBe('01/04/2025');
      
      // End of FY 2024-25
      expect(formatDateDDMMYYYY('2025-03-31')).toBe('31/03/2025');
    });

    it('should handle month-end dates correctly', () => {
      expect(formatDateDDMMYYYY('2025-01-31')).toBe('31/01/2025');
      expect(formatDateDDMMYYYY('2025-02-28')).toBe('28/02/2025');
      expect(formatDateDDMMYYYY('2025-04-30')).toBe('30/04/2025');
    });
  });

  describe('Integration with Other Functions', () => {
    it('should work with formatDateWithDayName', () => {
      const date = '2025-10-08';
      const withDay = formatDateWithDayName(date);
      const withoutDay = formatDateDDMMYYYY(date);
      
      expect(withDay).toContain(withoutDay);
    });

    it('should work with formatDateTimeDDMMYYYY', () => {
      const date = '2025-10-08T10:30:00Z';
      const dateTime = formatDateTimeDDMMYYYY(date);
      const dateOnly = formatDateDDMMYYYY(date);
      
      expect(dateTime).toContain(dateOnly.split('/')[0]); // Should contain day
      expect(dateTime).toContain(dateOnly.split('/')[1]); // Should contain month
      expect(dateTime).toContain(dateOnly.split('/')[2]); // Should contain year
    });
  });
});
