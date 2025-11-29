import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { guestCheckinDB } from "./db";
import { DeleteCheckInResponse } from "./types";
import { deleteImageFromDisk } from "./image-processor";
import { createAuditLog } from "./audit-middleware";
import log from "encore.dev/log";
import { guestCheckinEvents, type GuestEventPayload } from "./guest-checkin-events";
import { recordGuestEventPublished } from "./event-metrics";

interface DeleteCheckInRequest {
  id: number;
}

async function deleteCheckInHandler({ id }: DeleteCheckInRequest): Promise<DeleteCheckInResponse> {
    const authData = getAuthData()!;

    log.info("Deleting guest check-in", {
      checkInId: id,
      userId: authData.userID,
      role: authData.role,
    });

    // Only admin/owner can delete check-ins (case-insensitive check)
    const userRole = authData.role.toLowerCase();
    if (!['admin', 'owner'].includes(userRole)) {
      log.warn("Permission denied for delete operation", {
        checkInId: id,
        userId: authData.userID,
        role: authData.role,
        normalizedRole: userRole,
      });
      throw APIError.permissionDenied("Only admin or owner can delete check-ins");
    }

    // Verify check-in exists and fetch guest details for audit log
    const checkIn = await guestCheckinDB.queryRow`
      SELECT id, full_name, email, property_name
      FROM guest_checkins
      WHERE id = ${id} AND org_id = ${authData.orgId}
    `;

    if (!checkIn) {
      throw APIError.notFound("Check-in not found");
    }

    // Store guest info for audit log (needed before deletion)
    const guestName = checkIn.full_name;
    const guestEmail = checkIn.email;
    const propertyName = checkIn.property_name;

    try {
      // Step 1: Get all documents associated with this check-in
      let documents: any[] = [];
      try {
        documents = await guestCheckinDB.queryAll`
          SELECT id, file_path, thumbnail_path, storage_location, bucket_key
          FROM guest_documents
          WHERE guest_checkin_id = ${id}
            AND org_id = ${authData.orgId}
        `;

        log.info("Found documents to delete", {
          checkInId: id,
          documentCount: documents.length,
        });
      } catch (queryError: any) {
        log.error("Error querying documents", {
          error: queryError.message || queryError,
          checkInId: id,
        });
        // Continue with deletion even if document query fails
      }

      // Step 2: Delete document files from disk/storage
      let filesDeleted = 0;
      for (const doc of documents) {
        try {
          if (doc.storage_location === 'local' || !doc.storage_location) {
            // Delete from local disk (synchronous operation)
            deleteImageFromDisk(doc.file_path, doc.thumbnail_path);
            filesDeleted++;
            log.info("Deleted document files from disk", {
              documentId: doc.id,
              filePath: doc.file_path,
            });
          }
          // Note: Cloud storage deletion would go here if needed
        } catch (fileError: any) {
          log.error("Failed to delete document files", {
            error: fileError.message || fileError,
            documentId: doc.id,
            filePath: doc.file_path,
          });
          // Continue deletion even if file deletion fails
        }
      }

      // Step 3: Delete documents from database
      try {
        await guestCheckinDB.exec`
          DELETE FROM guest_documents
          WHERE guest_checkin_id = ${id}
            AND org_id = ${authData.orgId}
        `;

        log.info("Deleted documents from database", {
          checkInId: id,
          documentCount: documents.length,
          filesDeleted,
        });
      } catch (deleteDocsError: any) {
        log.error("Error deleting documents from database", {
          error: deleteDocsError.message || deleteDocsError,
          checkInId: id,
        });
        // Continue with check-in deletion even if document deletion fails
      }

      // Step 4: Delete the guest check-in record (CRITICAL - must succeed)
      try {
        await guestCheckinDB.exec`
          DELETE FROM guest_checkins
          WHERE id = ${id}
            AND org_id = ${authData.orgId}
        `;

        log.info("Guest check-in deleted successfully", {
          checkInId: id,
          userId: authData.userID,
          documentsDeleted: documents.length,
          filesDeleted,
        });

        // Create audit log for deletion
        await createAuditLog({
          actionType: "delete_checkin",
          resourceType: "guest_checkin",
          resourceId: id,
          guestCheckInId: id,
          guestName: guestName,
          actionDetails: {
            guestEmail: guestEmail,
            propertyName: propertyName,
            documentsDeleted: documents.length,
            filesDeleted: filesDeleted,
            deletedBy: authData.email,
            reason: "Admin/Owner deleted guest check-in",
          },
        });

        // Publish guest_deleted event
        const event: GuestEventPayload = {
          eventId: `${authData.orgId}-${id}-${Date.now()}`,
          eventVersion: "v1",
          eventType: "guest_deleted",
          orgId: Number(authData.orgId),
          propertyId: (checkIn as any).property_id || 0,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityType: "guest_checkin",
          entityId: id,
          metadata: { guestName },
        };
        recordGuestEventPublished(event);
        guestCheckinEvents.publish(event).catch((e) => {
          log.warn("Failed to publish guest_deleted event", { error: e });
        });

        return {
          message: "Guest check-in and associated documents deleted successfully",
        };
      } catch (deleteCheckInError: any) {
        log.error("Error deleting check-in record", {
          error: deleteCheckInError.message || deleteCheckInError,
          checkInId: id,
        });
        throw APIError.internal(`Failed to delete check-in: ${deleteCheckInError.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      log.error("Error deleting guest check-in", { 
        error: error.message || error, 
        errorType: error.constructor.name,
        checkInId: id 
      });
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Failed to delete check-in: ${error.message || 'Unknown error'}`);
    }
  }

// Legacy endpoint
export const deleteCheckIn = api<DeleteCheckInRequest, DeleteCheckInResponse>(
  { expose: true, method: "DELETE", path: "/guest-checkin/:id", auth: true },
  deleteCheckInHandler
);

// V1 endpoint
export const deleteCheckInV1 = api<DeleteCheckInRequest, DeleteCheckInResponse>(
  { expose: true, method: "DELETE", path: "/v1/guest-checkin/:id", auth: true },
  deleteCheckInHandler
);
