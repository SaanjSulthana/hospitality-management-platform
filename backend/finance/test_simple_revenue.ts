import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";

export interface TestSimpleRevenueRequest {
  propertyId: number;
  amountCents: number;
  description?: string;
}

export interface TestSimpleRevenueResponse {
  success: boolean;
  message: string;
  receivedData: any;
  userId?: number;
  role?: string;
}

// Very simple test endpoint to check if basic functionality works
export const testSimpleRevenue = api<TestSimpleRevenueRequest, TestSimpleRevenueResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/test-simple-revenue" },
  async (req) => {
    console.log('=== TEST SIMPLE REVENUE FUNCTION CALLED ===');
    console.log('Request data:', req);
    
    const authData = getAuthData();
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    console.log('Test simple revenue completed successfully');
    
    return {
      success: true,
      message: "Test simple revenue completed successfully",
      receivedData: req,
      userId: authData.userID,
      role: authData.role
    };
  }
);

