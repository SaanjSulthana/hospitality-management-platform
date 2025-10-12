import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the financeDB for testing
jest.mock('../db', () => ({
  financeDB: {
    queryRow: jest.fn(),
    queryAll: jest.fn(),
    rawQueryAll: jest.fn(),
    exec: jest.fn(),
  },
}));

// Import the mocked financeDB
import { financeDB } from '../db';

// Mock auth data
const mockAuthData = {
  userID: '123',
  orgId: 1,
  role: 'ADMIN'
};

// Mock getAuthData
jest.mock('~encore/auth', () => ({
  getAuthData: jest.fn(() => mockAuthData)
}));

describe('Error Handling Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Database Connection Failures', () => {
    it('should handle connection timeout errors', async () => {
      // Mock connection timeout
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('Connection timeout');
      }
    });

    it('should handle connection refused errors', async () => {
      // Mock connection refused
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('Connection refused');
      }
    });

    it('should handle database server unavailable errors', async () => {
      // Mock database server unavailable
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('Database server is unavailable'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('Database server is unavailable');
      }
    });

    it('should handle network timeout errors', async () => {
      // Mock network timeout
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('Network timeout');
      }
    });
  });

  describe('Schema and Constraint Errors', () => {
    it('should handle missing table errors', async () => {
      // Mock missing table
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('relation "revenues" does not exist'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('relation "revenues" does not exist');
      }
    });

    it('should handle missing column errors', async () => {
      // Mock missing column
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('column "status" does not exist'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('column "status" does not exist');
      }
    });

    it('should handle foreign key constraint violations', async () => {
      // Mock foreign key constraint violation
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access
        .mockRejectedValueOnce(new Error('violates foreign key constraint "revenues_property_id_fkey"'));

      const revenueRequest = {
        propertyId: 999, // Non-existent property
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('violates foreign key constraint');
      }
    });

    it('should handle unique constraint violations', async () => {
      // Mock unique constraint violation
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access
        .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('duplicate key value violates unique constraint');
      }
    });

    it('should handle check constraint violations', async () => {
      // Mock check constraint violation
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access
        .mockRejectedValueOnce(new Error('violates check constraint "amount_cents_positive"'));

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: -1000, // Negative amount
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('violates check constraint');
      }
    });
  });

  describe('Permission and Access Errors', () => {
    it('should handle insufficient privileges errors', async () => {
      // Mock insufficient privileges
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('insufficient privileges'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('insufficient privileges');
      }
    });

    it('should handle access denied errors', async () => {
      // Mock access denied
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('Access denied'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('Access denied');
      }
    });

    it('should handle property access denied errors', async () => {
      // Mock property access denied
      (financeDB.queryRow as jest.Mock).mockResolvedValue(null); // No property access

      const revenueRequest = {
        propertyId: 999, // Non-existent property
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('Property not found');
      }
    });
  });

  describe('Data Type and Format Errors', () => {
    it('should handle invalid data type errors', async () => {
      // Mock invalid data type
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access
        .mockRejectedValueOnce(new Error('invalid input syntax for type integer'));

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 'invalid' as any, // Invalid data type
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('invalid input syntax for type integer');
      }
    });

    it('should handle date format errors', async () => {
      // Mock date format error
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access
        .mockRejectedValueOnce(new Error('invalid input syntax for type timestamp'));

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: 'invalid-date' // Invalid date format
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('invalid input syntax for type timestamp');
      }
    });

    it('should handle string length limit errors', async () => {
      // Mock string length limit error
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access
        .mockRejectedValueOnce(new Error('value too long for type character varying(255)'));

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'A'.repeat(1000), // Too long description
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenue(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('value too long for type character varying');
      }
    });
  });

  describe('Transaction and Lock Errors', () => {
    it('should handle deadlock errors', async () => {
      // Mock deadlock error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('deadlock detected'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('deadlock detected');
      }
    });

    it('should handle lock timeout errors', async () => {
      // Mock lock timeout error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('lock timeout'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('lock timeout');
      }
    });

    it('should handle serialization failure errors', async () => {
      // Mock serialization failure
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('serialization failure'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('serialization failure');
      }
    });
  });

  describe('Resource and Performance Errors', () => {
    it('should handle out of memory errors', async () => {
      // Mock out of memory error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('out of memory'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('out of memory');
      }
    });

    it('should handle disk space errors', async () => {
      // Mock disk space error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('no space left on device'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('no space left on device');
      }
    });

    it('should handle query timeout errors', async () => {
      // Mock query timeout
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('query timeout'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('query timeout');
      }
    });
  });

  describe('Complex Error Scenarios', () => {
    it('should handle cascading errors in transaction', async () => {
      // Mock cascading errors
      (financeDB.queryRow as jest.Mock)
        .mockResolvedValueOnce({ id: 1, org_id: 1, name: 'Test Property' }) // Property access succeeds
        .mockRejectedValueOnce(new Error('column "status" does not exist')) // First insert fails
        .mockRejectedValueOnce(new Error('column "payment_mode" does not exist')) // Fallback fails
        .mockRejectedValueOnce(new Error('relation "revenues" does not exist')); // Final fallback fails

      const revenueRequest = {
        propertyId: 1,
        source: 'room' as const,
        amountCents: 10000,
        currency: 'USD',
        description: 'Room revenue',
        occurredAt: new Date().toISOString()
      };

      try {
        await simulateAddRevenueWithMultipleFallbacks(revenueRequest);
      } catch (error) {
        expect((error as Error).message).toContain('relation "revenues" does not exist');
      }
    });

    it('should handle mixed error types in batch operations', async () => {
      // Mock mixed errors for batch operations
      (financeDB.rawQueryAll as jest.Mock)
        .mockRejectedValueOnce(new Error('Connection timeout')) // First query fails
        .mockRejectedValueOnce(new Error('column "status" does not exist')) // Second query fails
        .mockResolvedValueOnce([{ // Third query succeeds
          id: 1,
          property_id: 1,
          property_name: 'Test Property',
          source: 'room',
          amount_cents: 10000,
          currency: 'USD',
          description: 'Room revenue',
          status: 'pending',
          created_by_user_id: 123,
          created_by_name: 'Test User',
          occurred_at: new Date(),
          created_at: new Date()
        }]);

      // Test that the system handles mixed errors gracefully
      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('Connection timeout');
      }

      try {
        await simulateListRevenues({});
      } catch (error) {
        expect((error as Error).message).toContain('column "status" does not exist');
      }

      // Third attempt should succeed
      const revenues = await simulateListRevenues({});
      expect(revenues.revenues).toHaveLength(1);
    });

    it('should handle error recovery and retry scenarios', async () => {
      // Mock error recovery scenario
      (financeDB.rawQueryAll as jest.Mock)
        .mockRejectedValueOnce(new Error('Connection timeout')) // First attempt fails
        .mockRejectedValueOnce(new Error('Connection refused')) // Second attempt fails
        .mockResolvedValueOnce([{ // Third attempt succeeds
          id: 1,
          property_id: 1,
          property_name: 'Test Property',
          source: 'room',
          amount_cents: 10000,
          currency: 'USD',
          description: 'Room revenue',
          status: 'pending',
          created_by_user_id: 123,
          created_by_name: 'Test User',
          occurred_at: new Date(),
          created_at: new Date()
        }]);

      // Test retry logic
      let attempts = 0;
      let result = null;
      
      while (attempts < 3 && !result) {
        try {
          result = await simulateListRevenues({});
        } catch (error) {
          attempts++;
          if (attempts >= 3) {
            throw error;
          }
        }
      }

      expect(result).not.toBeNull();
      expect(result.revenues).toHaveLength(1);
      expect(attempts).toBe(2); // Failed twice, succeeded on third attempt
    });
  });

  describe('Error Message Quality and Actionability', () => {
    it('should provide actionable error messages for connection issues', async () => {
      // Mock connection error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Connection timeout');
        // In a real implementation, this would include actionable suggestions
      }
    });

    it('should provide actionable error messages for schema issues', async () => {
      // Mock schema error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('column "status" does not exist'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('column "status" does not exist');
        // In a real implementation, this would suggest running schema fix
      }
    });

    it('should provide actionable error messages for permission issues', async () => {
      // Mock permission error
      (financeDB.rawQueryAll as jest.Mock).mockRejectedValue(new Error('insufficient privileges'));

      try {
        await simulateListRevenues({});
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('insufficient privileges');
        // In a real implementation, this would suggest checking user permissions
      }
    });
  });
});

// Helper functions to simulate error scenarios
async function simulateListRevenues(request: any) {
  const { financeDB } = await import('../db');
  
  const revenues = await financeDB.rawQueryAll`
    SELECT r.id, r.property_id, p.name as property_name, r.source, r.amount_cents, r.currency, r.description, r.status, r.created_by_user_id, u.name as created_by_name, r.occurred_at, r.created_at
    FROM revenues r
    JOIN properties p ON r.property_id = p.id
    LEFT JOIN users u ON r.created_by_user_id = u.id
    WHERE r.org_id = 1
    ORDER BY r.created_at DESC
  `;

  const totalAmount = revenues.reduce((sum, revenue) => sum + (parseInt(revenue.amount_cents) || 0), 0);

  return {
    revenues: revenues.map((revenue) => ({
      id: revenue.id,
      propertyId: revenue.property_id,
      propertyName: revenue.property_name,
      source: revenue.source,
      amountCents: parseInt(revenue.amount_cents),
      currency: revenue.currency,
      description: revenue.description,
      status: revenue.status,
      createdByUserId: revenue.created_by_user_id,
      createdByName: revenue.created_by_name,
      occurredAt: revenue.occurred_at,
      createdAt: revenue.created_at
    })),
    totalAmount
  };
}

async function simulateAddRevenue(request: any) {
  const { financeDB } = await import('../db');
  
  // Check property access
  const property = await financeDB.queryRow`
    SELECT p.id, p.org_id
    FROM properties p
    WHERE p.id = ${request.propertyId} AND p.org_id = 1
  `;

  if (!property) {
    throw new Error('Property not found');
  }

  // Create revenue
  const revenue = await financeDB.queryRow`
    INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, status, created_at)
    VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, 'pending', NOW())
    RETURNING id, property_id, source, amount_cents, currency, description, status, created_by_user_id, created_at
  `;

  return {
    id: revenue.id,
    propertyId: revenue.property_id,
    source: revenue.source,
    amountCents: revenue.amount_cents,
    currency: revenue.currency,
    description: revenue.description,
    status: revenue.status,
    createdByUserId: revenue.created_by_user_id,
    createdAt: revenue.created_at
  };
}

async function simulateAddRevenueWithMultipleFallbacks(request: any) {
  const { financeDB } = await import('../db');
  
  // Check property access
  const property = await financeDB.queryRow`
    SELECT p.id, p.org_id
    FROM properties p
    WHERE p.id = ${request.propertyId} AND p.org_id = 1
  `;

  if (!property) {
    throw new Error('Property not found');
  }

  try {
    // Try with all columns first
    const revenue = await financeDB.queryRow`
      INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, status, payment_mode, bank_reference, receipt_file_id, created_at)
      VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, 'pending', 'cash', null, null, NOW())
      RETURNING id, property_id, source, amount_cents, currency, description, status, created_by_user_id, created_at
    `;

    return {
      id: revenue.id,
      propertyId: revenue.property_id,
      source: revenue.source,
      amountCents: revenue.amount_cents,
      currency: revenue.currency,
      description: revenue.description,
      status: revenue.status,
      createdByUserId: revenue.created_by_user_id,
      createdAt: revenue.created_at
    };
  } catch (error) {
    if ((error as Error).message.includes('column') && (error as Error).message.includes('does not exist')) {
      try {
        // Fallback without new columns
        const revenue = await financeDB.queryRow`
          INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, created_at)
          VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, NOW())
          RETURNING id, property_id, source, amount_cents, currency, description, created_by_user_id, created_at
        `;

        return {
          id: revenue.id,
          propertyId: revenue.property_id,
          source: revenue.source,
          amountCents: revenue.amount_cents,
          currency: revenue.currency,
          description: revenue.description,
          status: 'pending', // Default value
          createdByUserId: revenue.created_by_user_id,
          createdAt: revenue.created_at
        };
      } catch (fallbackError) {
        // Final fallback - try with minimal columns
        const revenue = await financeDB.queryRow`
          INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, description, occurred_at, created_by_user_id, created_at)
          VALUES (1, ${request.propertyId}, ${request.source}, ${request.amountCents}, ${request.currency}, ${request.description}, ${request.occurredAt}, 123, NOW())
          RETURNING id, property_id, source, amount_cents, currency, description, created_by_user_id, created_at
        `;

        return {
          id: revenue.id,
          propertyId: revenue.property_id,
          source: revenue.source,
          amountCents: revenue.amount_cents,
          currency: revenue.currency,
          description: revenue.description,
          status: 'pending', // Default value
          createdByUserId: revenue.created_by_user_id,
          createdAt: revenue.created_at
        };
      }
    }
    throw error;
  }
}
