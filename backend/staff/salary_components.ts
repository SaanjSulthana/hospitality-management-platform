import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { staffDB } from "./db";
import { staffEvents } from "./events";
import { v4 as uuidv4 } from "uuid";

export interface CreateSalaryComponentRequest {
  staffId: number;
  baseSalaryCents: number;
  hourlyRateCents?: number;
  overtimeRateCents?: number;
  bonusCents?: number;
  allowanceCents?: number;
  deductionCents?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface SalaryComponent {
  id: number;
  staffId: number;
  staffName: string;
  staffEmail: string;
  baseSalaryCents: number;
  hourlyRateCents: number;
  overtimeRateCents: number;
  bonusCents: number;
  allowanceCents: number;
  deductionCents: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSalaryComponentResponse extends SalaryComponent {}

export interface ListSalaryComponentsRequest {
  staffId?: number;
  propertyId?: number;
  isActive?: boolean;
  effectiveDate?: Date;
  page?: number;
  limit?: number;
}

export interface ListSalaryComponentsResponse {
  components: SalaryComponent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Creates a new salary component
export const createSalaryComponent = api<CreateSalaryComponentRequest, CreateSalaryComponentResponse>(
  { auth: true, expose: true, method: "POST", path: "/staff/salary-components" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN")(authData);

    const { 
      staffId, 
      baseSalaryCents, 
      hourlyRateCents = 0, 
      overtimeRateCents = 0,
      bonusCents = 0, 
      allowanceCents = 0, 
      deductionCents = 0,
      effectiveFrom, 
      effectiveTo 
    } = req;

    // Validate effective dates
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw APIError.invalidArgument("Effective end date must be after start date");
    }

    const tx = await staffDB.begin();
    try {
      // Verify staff record exists and belongs to organization
      const staff = await tx.queryRow`
        SELECT s.id, s.user_id, s.property_id, u.display_name, u.email
        FROM staff s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ${staffId} AND s.org_id = ${authData.orgId}
      `;

      if (!staff) {
        throw APIError.notFound("Staff record not found");
      }

      // Check for overlapping active salary components
      const effectiveToDate = effectiveTo || new Date('9999-12-31');
      const overlappingComponent = await tx.queryRow`
        SELECT id FROM salary_components
        WHERE org_id = ${authData.orgId} AND staff_id = ${staffId} AND is_active = true
        AND (
          (effective_from <= ${effectiveFrom} AND (effective_to IS NULL OR effective_to >= ${effectiveFrom}))
          OR (effective_from <= ${effectiveToDate} AND (effective_to IS NULL OR effective_to >= ${effectiveToDate}))
          OR (${effectiveFrom} <= effective_from AND (${effectiveToDate} >= effective_from))
        )
      `;

      if (overlappingComponent) {
        throw APIError.alreadyExists("Active salary component already exists for this period");
      }

      // Create salary component
      const component = await tx.queryRow`
        INSERT INTO salary_components (
          org_id, staff_id, base_salary_cents, hourly_rate_cents,
          overtime_rate_cents, bonus_cents, allowance_cents, deduction_cents,
          effective_from, effective_to, is_active, created_at, updated_at
        ) VALUES (
          ${authData.orgId}, ${staffId}, ${baseSalaryCents}, ${hourlyRateCents},
          ${overtimeRateCents}, ${bonusCents}, ${allowanceCents}, ${deductionCents},
          ${effectiveFrom}, ${effectiveTo || null}, true, NOW(), NOW()
        )
        RETURNING id, staff_id, base_salary_cents, hourly_rate_cents,
                  overtime_rate_cents, bonus_cents, allowance_cents, deduction_cents,
                  effective_from, effective_to, is_active, created_at, updated_at
      `;

      if (!component) {
        throw new Error("Failed to create salary component");
      }

      await tx.commit();

      // Publish salary_component_added event
      try {
        await staffEvents.publish({
          eventId: uuidv4(),
          eventVersion: 'v1',
          eventType: 'salary_component_added',
          orgId: authData.orgId,
          propertyId: staff.property_id ?? null,
          userId: parseInt(authData.userID),
          timestamp: new Date(),
          entityId: component.id,
          entityType: 'salary_component',
          metadata: {
            staffId,
            staffName: staff.display_name,
            baseSalaryCents,
            hourlyRateCents,
            overtimeRateCents,
            bonusCents,
            allowanceCents,
            deductionCents,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
          },
        });
      } catch (e) {
        console.warn("[Staff Events] Failed to publish salary_component_added", e);
      }

      return {
        id: component.id,
        staffId: component.staff_id,
        staffName: staff.display_name,
        staffEmail: staff.email,
        baseSalaryCents: component.base_salary_cents,
        hourlyRateCents: component.hourly_rate_cents,
        overtimeRateCents: component.overtime_rate_cents,
        bonusCents: component.bonus_cents,
        allowanceCents: component.allowance_cents,
        deductionCents: component.deduction_cents,
        effectiveFrom: component.effective_from,
        effectiveTo: component.effective_to,
        isActive: component.is_active,
        createdAt: component.created_at,
        updatedAt: component.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      console.error('Create salary component error:', error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create salary component");
    }
  }
);

// Lists salary components with filtering
export const listSalaryComponents = api<ListSalaryComponentsRequest, ListSalaryComponentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/staff/salary-components" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { staffId, propertyId, isActive, effectiveDate, page = 1, limit = 20 } = req || {};

    // Validate pagination parameters
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Build base query
      let baseQuery = `
        SELECT 
          sc.id, sc.staff_id, sc.base_salary_cents, sc.hourly_rate_cents,
          sc.overtime_rate_cents, sc.bonus_cents, sc.allowance_cents, sc.deduction_cents,
          sc.effective_from, sc.effective_to, sc.is_active, sc.created_at, sc.updated_at,
          u.display_name as staff_name, u.email as staff_email,
          s.property_id, p.name as property_name
        FROM salary_components sc
        JOIN staff s ON sc.staff_id = s.id AND s.org_id = $1
        JOIN users u ON s.user_id = u.id AND u.org_id = $1
        LEFT JOIN properties p ON s.property_id = p.id AND p.org_id = $1
        WHERE sc.org_id = $1
      `;
      const params: any[] = [authData.orgId];
      let paramIndex = 2;

      // Managers can only see salary components for their assigned properties
      if (authData.role === "MANAGER") {
        baseQuery += ` AND (
          s.property_id IN (SELECT property_id FROM user_properties WHERE user_id = $${paramIndex})
          OR s.property_id IS NULL
        )`;
        params.push(parseInt(authData.userID));
        paramIndex++;
      }

      // Apply filters
      if (staffId) {
        baseQuery += ` AND sc.staff_id = $${paramIndex}`;
        params.push(staffId);
        paramIndex++;
      }

      if (propertyId) {
        baseQuery += ` AND s.property_id = $${paramIndex}`;
        params.push(propertyId);
        paramIndex++;
      }

      if (isActive !== undefined) {
        baseQuery += ` AND sc.is_active = $${paramIndex}`;
        params.push(isActive);
        paramIndex++;
      }

      if (effectiveDate) {
        baseQuery += ` AND sc.effective_from <= $${paramIndex} AND (sc.effective_to IS NULL OR sc.effective_to >= $${paramIndex})`;
        params.push(effectiveDate, effectiveDate);
        paramIndex += 2;
      }

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
      const countResult = await staffDB.rawQueryRow(countQuery, ...params);
      const total = parseInt(countResult?.total || '0') || 0;
      const totalPages = Math.ceil(total / limitNum);

      // Apply sorting and pagination
      baseQuery += ` ORDER BY sc.effective_from DESC, sc.created_at DESC`;
      baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limitNum, offset);

      const components = await staffDB.rawQueryAll(baseQuery, ...params);

      return {
        components: components.map((component) => ({
          id: component.id,
          staffId: component.staff_id,
          staffName: component.staff_name,
          staffEmail: component.staff_email,
          baseSalaryCents: component.base_salary_cents,
          hourlyRateCents: component.hourly_rate_cents,
          overtimeRateCents: component.overtime_rate_cents,
          bonusCents: component.bonus_cents,
          allowanceCents: component.allowance_cents,
          deductionCents: component.deduction_cents,
          effectiveFrom: component.effective_from,
          effectiveTo: component.effective_to,
          isActive: component.is_active,
          createdAt: component.created_at,
          updatedAt: component.updated_at,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      };
    } catch (error) {
      console.error('List salary components error:', error);
      throw APIError.internal("Failed to fetch salary components");
    }
  }
);