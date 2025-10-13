import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import log from "encore.dev/log";

interface DebugResult {
  success: boolean;
  results?: {
    total: string;
    orgTotal: string;
    checkinTotal: string;
    combinedTotal: string;
  };
  error?: string;
  stack?: string;
}

export const debugDocuments = api(
  { expose: true, method: "GET", path: "/guest-checkin/debug/db-test", auth: true },
  async (): Promise<DebugResult> => {
    const authData = getAuthData()!;
    
    log.info("Debug documents endpoint called", { 
      userId: authData.userID,
      orgId: authData.orgId 
    });

    try {
      // Test basic database connection
      const testQuery = await guestCheckinDB.queryRow`
        SELECT COUNT(*) as total FROM guest_documents
      `;
      
      log.info("Basic query successful", { total: testQuery?.total });

      // Test with org filter
      const orgQuery = await guestCheckinDB.queryRow`
        SELECT COUNT(*) as total FROM guest_documents WHERE org_id = ${authData.orgId}
      `;
      
      log.info("Org query successful", { total: orgQuery?.total });

      // Test with check-in filter
      const checkinQuery = await guestCheckinDB.queryRow`
        SELECT COUNT(*) as total FROM guest_documents WHERE guest_checkin_id = 4
      `;
      
      log.info("Check-in query successful", { total: checkinQuery?.total });

      // Test combined query
      const combinedQuery = await guestCheckinDB.queryRow`
        SELECT COUNT(*) as total FROM guest_documents 
        WHERE guest_checkin_id = 4 AND org_id = ${authData.orgId}
      `;
      
      log.info("Combined query successful", { total: combinedQuery?.total });

      return {
        success: true,
        results: {
          total: testQuery?.total,
          orgTotal: orgQuery?.total,
          checkinTotal: checkinQuery?.total,
          combinedTotal: combinedQuery?.total
        }
      };
    } catch (error: any) {
      log.error("Debug query failed", { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
);
