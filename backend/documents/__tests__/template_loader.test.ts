/**
 * Template Loader Tests
 */

import { templateLoader } from '../template_loader';

describe('TemplateLoader', () => {
  describe('Helper Registration', () => {
    it('should register currency helpers', () => {
      const template = templateLoader.getTemplate('test-helpers');
      const html = template({
        amountCents: 123456,
      });
      
      expect(html).toContain('₹1,234.56');
    });

    it('should handle zero amounts', () => {
      const template = templateLoader.getTemplate('test-helpers');
      const html = template({ amountCents: 0 });
      
      expect(html).toContain('₹0.00');
    });
  });

  describe('Template Rendering', () => {
    it('should render daily report template', () => {
      const data = {
        propertyName: 'Test Property',
        date: '2025-01-29',
        openingBalanceCents: 100000,
        totalReceivedCents: 50000,
        totalExpensesCents: 30000,
        closingBalanceCents: 120000,
        transactions: [
          {
            description: 'Room Booking',
            type: 'revenue',
            paymentMode: 'cash',
            amountCents: 50000,
          },
        ],
        generatedAt: new Date('2025-01-29T12:00:00Z'),
      };

      const html = templateLoader.render('daily-report', data);

      expect(html).toContain('Test Property');
      expect(html).toContain('Room Booking');
      expect(html).toContain('₹500.00');
    });

    it('should handle missing optional fields', () => {
      const data = {
        propertyName: 'Test Property',
        date: '2025-01-29',
        openingBalanceCents: 0,
        totalReceivedCents: 0,
        totalExpensesCents: 0,
        closingBalanceCents: 0,
        transactions: [],
        generatedAt: new Date(),
      };

      expect(() => {
        templateLoader.render('daily-report', data);
      }).not.toThrow();
    });
  });

  describe('Template Cache', () => {
    it('should cache compiled templates', () => {
      const template1 = templateLoader.getTemplate('daily-report');
      const template2 = templateLoader.getTemplate('daily-report');

      expect(template1).toBe(template2);
    });

    it('should list available templates', () => {
      const templates = templateLoader.listTemplates();

      expect(templates).toContain('daily-report');
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should clear cache on demand', () => {
      templateLoader.getTemplate('daily-report');
      templateLoader.clearCache();

      const template = templateLoader.getTemplate('daily-report');
      expect(template).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for missing template', () => {
      expect(() => {
        templateLoader.getTemplate('non-existent-template');
      }).toThrow('Template not found');
    });
  });
});

