import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";

export interface CreateEmergencyLeaveRequest {
  staffId: number;
  startDate: Date;
  endDate: Date;
  reason: string;
  emergencyContact: string;
  emergencyPhone: string;
  supportingDocuments?: string;
}

export interface EmergencyLeaveRequest {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  isEmergency: boolean;
  priorityLevel: string;
  emergencyContact: string;
  emergencyPhone: string;
  supportingDocuments?: string;
  requestedAt: Date;
  requestedByUserId: number;
  approvedByUserId?: number;
  approvedAt?: Date;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmergencyLeaveResponse {
  success: boolean;
  leaveRequest: EmergencyLeaveRequest;
  message: string;
}

export interface ApproveEmergencyLeaveRequest {
  leaveRequestId: number;
  action: 'approve' | 'reject';
  approvalNotes?: string;
}

export interface ApproveEmergencyLeaveResponse {
  success: boolean;
  leaveRequest: EmergencyLeaveRequest;
  message: string;
}

// Shared handler for creating emergency leave
async function createEmergencyLeaveHandler(req: CreateEmergencyLeaveRequest): Promise<CreateEmergencyLeaveResponse> {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { 
      staffId, 
      startDate, 
      endDate, 
      reason, 
      emergencyContact, 
      emergencyPhone,
      supportingDocuments 
    } = req;

    // Validate date range
    if (endDate <= startDate) {
      throw APIError.invalidArgument("End date must be after start date");
    }

    // Validate emergency contact information
    if (!emergencyContact || !emergencyPhone) {
      throw APIError.invalidArgument("Emergency contact and phone are required");
    }

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, u.display_name, u.email
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Staff can only create emergency leave requests for themselves
      if (authData.role === "MANAGER" && authData.userID) {
        if (parseInt(staff.user_id) !== parseInt(authData.userID)) {
          throw APIError.permissionDenied("You can only create emergency leave requests for yourself");
        }
      }

      // Managers can only create emergency leave requests for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM staff s
          WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to create emergency leave requests for this staff member");
        }
      }

      // Check for overlapping leave requests
      const overlappingLeave = await tx.queryRow`
        SELECT id FROM leave_requests
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId}
        AND status IN ('pending', 'approved')
        AND (
          (start_date <= ${endDate} AND end_date >= ${startDate})
        )
      `;

      if (overlappingLeave) {
        throw APIError.alreadyExists("Overlapping leave request already exists for this period");
      }

      // Create emergency leave request
      const leaveRequest = await tx.queryRow`
        INSERT INTO leave_requests (
          org_id, staff_id, leave_type, start_date, end_date,
          reason, status, requested_at, requested_by_user_id,
          emergency_contact, emergency_phone, is_emergency,
          priority_level, supporting_documents, created_at, updated_at
        ) VALUES (
          ${authData.orgId}, ${staffId}, 'emergency', ${startDate}, ${endDate},
          ${reason}, 'pending', NOW(), ${parseInt(authData.userID)},
          ${emergencyContact}, ${emergencyPhone}, true,
          'urgent', ${supportingDocuments || null}, NOW(), NOW()
        )
        RETURNING id, staff_id, leave_type, start_date, end_date,
                  reason, status, is_emergency, priority_level,
                  emergency_contact, emergency_phone, supporting_documents,
                  requested_at, requested_by_user_id, approved_by_user_id,
                  approved_at, approval_notes, created_at, updated_at
      `;

      if (!leaveRequest) {
        throw new Error("Failed to create emergency leave request");
      }

      await tx.commit();

      return {
        success: true,
        leaveRequest: {
          id: leaveRequest.id,
          staffId: leaveRequest.staff_id,
          staffName: staff.display_name,
          staffEmail: staff.email,
          leaveType: leaveRequest.leave_type,
          startDate: leaveRequest.start_date,
          endDate: leaveRequest.end_date,
          reason: leaveRequest.reason,
          status: leaveRequest.status,
          isEmergency: leaveRequest.is_emergency,
          priorityLevel: leaveRequest.priority_level,
          emergencyContact: leaveRequest.emergency_contact,
          emergencyPhone: leaveRequest.emergency_phone,
          supportingDocuments: leaveRequest.supporting_documents,
          requestedAt: leaveRequest.requested_at,
          requestedByUserId: leaveRequest.requested_by_user_id,
          approvedByUserId: leaveRequest.approved_by_user_id,
          approvedAt: leaveRequest.approved_at,
          approvalNotes: leaveRequest.approval_notes,
          createdAt: leaveRequest.created_at,
          updatedAt: leaveRequest.updated_at,
        },
        message: "Emergency leave request created successfully",
      };
    } catch (error) {
      await tx.rollback();
      console.error('Create emergency leave error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create emergency leave request");
    }
}

// LEGACY: Creates emergency leave (keep for backward compatibility)
export const createEmergencyLeave = api<CreateEmergencyLeaveRequest, CreateEmergencyLeaveResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/emergency-leave" },
  createEmergencyLeaveHandler
);

// V1: Creates emergency leave
export const createEmergencyLeaveV1 = api<CreateEmergencyLeaveRequest, CreateEmergencyLeaveResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/staff/emergency-leave" },
  createEmergencyLeaveHandler
);

// Shared handler for approving or rejecting an emergency leave request
async function approveEmergencyLeaveHandler(req: ApproveEmergencyLeaveRequest): Promise<ApproveEmergencyLeaveResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

    const { leaveRequestId, action, approvalNotes } = req;

    const tx = await staffDB.begin();
    try {
      // Get existing leave request
      const existingRequest = await tx.queryRow`
        SELECT lr.id, lr.staff_id, lr.leave_type, lr.start_date, lr.end_date,
               lr.reason, lr.status, lr.is_emergency, lr.priority_level,
               lr.emergency_contact, lr.emergency_phone, lr.supporting_documents,
               lr.requested_at, lr.requested_by_user_id, lr.approved_by_user_id,
               lr.approved_at, lr.approval_notes, lr.created_at, lr.updated_at,
               u.display_name as staff_name, u.email as staff_email
        FROM leave_requests lr
        JOIN staff s ON lr.staff_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE lr.id = ${leaveRequestId} AND lr.org_id = ${authData.orgId}
      `;

      if (!existingRequest) {
        throw APIError.notFound("Emergency leave request not found");
      }

      // Check if request is still pending
      if (existingRequest.status !== 'pending') {
        throw APIError.invalidArgument("Leave request is no longer pending");
      }

      // Check if it's actually an emergency request
      if (!existingRequest.is_emergency) {
        throw APIError.invalidArgument("This is not an emergency leave request");
      }

      // Managers can only approve emergency leave requests for their assigned properties
      if (authData.role === "MANAGER") {
        const accessCheck = await tx.queryRow`
          SELECT 1 FROM leave_requests lr
          JOIN staff s ON lr.staff_id = s.id
          WHERE lr.id = ${leaveRequestId} AND lr.org_id = ${authData.orgId}
          AND (
            s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = ${parseInt(authData.userID)})
            OR s.property_id IS NULL
          )
        `;

        if (!accessCheck) {
          throw APIError.permissionDenied("No access to approve this emergency leave request");
        }
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const approvedAt = new Date();

      // Update leave request
      const updatedRequest = await tx.queryRow`
        UPDATE leave_requests 
        SET 
          status = ${newStatus},
          approved_by_user_id = ${parseInt(authData.userID)},
          approved_at = ${approvedAt},
          approval_notes = ${approvalNotes || null},
          updated_at = NOW()
        WHERE id = ${leaveRequestId} AND org_id = ${authData.orgId}
        RETURNING id, staff_id, leave_type, start_date, end_date,
                  reason, status, is_emergency, priority_level,
                  emergency_contact, emergency_phone, supporting_documents,
                  requested_at, requested_by_user_id, approved_by_user_id,
                  approved_at, approval_notes, created_at, updated_at
      `;

      if (!updatedRequest) {
        throw APIError.notFound("Leave request not found or could not be updated");
      }

      // If approved, update leave balance
      if (action === 'approve') {
        const leaveDays = Math.ceil((updatedRequest.end_date.getTime() - updatedRequest.start_date.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        await tx.query`
          UPDATE staff 
          SET 
            leave_balance = leave_balance - ${leaveDays},
            updated_at = NOW()
          WHERE id = ${updatedRequest.staff_id} AND org_id = ${authData.orgId}
        `;
      }

      await tx.commit();

      return {
        success: true,
        leaveRequest: {
          id: updatedRequest.id,
          staffId: updatedRequest.staff_id,
          staffName: existingRequest.staff_name,
          staffEmail: existingRequest.staff_email,
          leaveType: updatedRequest.leave_type,
          startDate: updatedRequest.start_date,
          endDate: updatedRequest.end_date,
          reason: updatedRequest.reason,
          status: updatedRequest.status,
          isEmergency: updatedRequest.is_emergency,
          priorityLevel: updatedRequest.priority_level,
          emergencyContact: updatedRequest.emergency_contact,
          emergencyPhone: updatedRequest.emergency_phone,
          supportingDocuments: updatedRequest.supporting_documents,
          requestedAt: updatedRequest.requested_at,
          requestedByUserId: updatedRequest.requested_by_user_id,
          approvedByUserId: updatedRequest.approved_by_user_id,
          approvedAt: updatedRequest.approved_at,
          approvalNotes: updatedRequest.approval_notes,
          createdAt: updatedRequest.created_at,
          updatedAt: updatedRequest.updated_at,
        },
        message: `Emergency leave request ${action}d successfully`,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Approve emergency leave error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to approve emergency leave request");
    }
}

// LEGACY: Approves or rejects emergency leave request (keep for backward compatibility)
export const approveEmergencyLeave = api<ApproveEmergencyLeaveRequest, ApproveEmergencyLeaveResponse>(
  { auth: true, expose: true, method: "PUT", path: "/staff/emergency-leave/:leaveRequestId/approve" },
  approveEmergencyLeaveHandler
);

// V1: Approves emergency leave
export const approveEmergencyLeaveV1 = api<ApproveEmergencyLeaveRequest, ApproveEmergencyLeaveResponse>(
  { auth: true, expose: true, method: "PUT", path: "/v1/staff/emergency-leave/:leaveRequestId/approve" },
  approveEmergencyLeaveHandler
);
