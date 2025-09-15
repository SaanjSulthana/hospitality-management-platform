import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { financeDB } from "./db";
import { requireRole } from "../auth/middleware";

export interface AddRevenueMinimalRequest {
  propertyId: number;
  source: 'room' | 'addon' | 'other';
  amountCents: number;
  description?: string;
  occurredAt: string;
}

export interface AddRevenueMinimalResponse {
  id: number;
  success: boolean;
  message: string;
}

// Minimal version of add revenue to isolate issues
export const addRevenueMinimal = api<AddRevenueMinimalRequest, AddRevenueMinimalResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/revenues-minimal" },
  async (req) => {
    console.log('=== ADD REVENUE MINIMAL FUNCTION CALLED ===');
    console.log('Request data:', req);
    
    const authData = getAuthData();
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    console.log('Auth check passed, proceeding with minimal insert');

    const { propertyId, source, amountCents, description, occurredAt } = req;
    
    if (amountCents <= 0) {
      throw APIError.invalidArgument("Amount must be greater than zero");
    }

    try {
      console.log('Attempting minimal database insert');
      
      // Very basic insert without complex schema checks
      const result = await financeDB.queryRow`
        INSERT INTO revenues (
          property_id, source, amount_cents, currency, description, 
          receipt_url, occurred_at, created_by_user_id, created_at, org_id
        ) VALUES (
          ${propertyId}, ${source}, ${amountCents}, 'USD', ${description || ''}, 
          '', ${occurredAt}, ${parseInt(authData.userID)}, NOW(), ${authData.orgId}
        ) RETURNING id
      `;

      console.log('Insert successful, result:', result);
      
      return {
        id: result.id,
        success: true,
        message: "Revenue added successfully (minimal version)"
      };
    } catch (error) {
      console.error('Minimal add revenue error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      
      throw APIError.internal(`Failed to add revenue (minimal): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

