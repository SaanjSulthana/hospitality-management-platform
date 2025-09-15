import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";

export interface TestMinimalAddRequest {
  propertyId: number;
  amountCents: number;
  description?: string;
}

export interface TestMinimalAddResponse {
  success: boolean;
  message: string;
  receivedData: any;
}

// Minimal test endpoint to check if basic functionality works
export const testMinimalAdd = api<TestMinimalAddRequest, TestMinimalAddResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/test-minimal-add" },
  async (req) => {
    console.log('=== TEST MINIMAL ADD FUNCTION CALLED ===');
    console.log('Request data:', req);
    
    const authData = getAuthData();
    console.log('Auth data:', { userId: authData?.userID, role: authData?.role, orgId: authData?.orgId });
    
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    console.log('Test minimal add completed successfully');
    
    return {
      success: true,
      message: "Test minimal add completed successfully",
      receivedData: req
    };
  }
);

