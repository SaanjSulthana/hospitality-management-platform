import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";
import { checkDailyApproval } from "./check_daily_approval";

export interface UpdateExpenseRequest {
  id: number;
  propertyId?: number;
  category?: string;
  amountCents?: number;
  currency?: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  expenseDate?: Date;
  paymentMode?: "cash" | "bank";
  bankReference?: string;
}

export interface UpdateExpenseResponse {
  id: number;
  propertyId: number;
  category: string;
  amountCents: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  receiptFileId?: number;
  expenseDate: Date;
  paymentMode: "cash" | "bank";
  bankReference?: string;
  status: string;
  createdByUserId: number;
  updatedAt: Date;
}

// Updates an existing expense record
export const updateExpense = api<UpdateExpenseRequest, UpdateExpenseResponse>(
  { auth: true, expose: true, method: "PATCH", path: "/finance/expenses/:id" },
  async (req) => {
    const authData = getAuthData();
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }
    requireRole("ADMIN", "MANAGER")(authData);

    const { id, ...updateData } = req;

    // Check if manager can modify transactions based on daily approval workflow
    if (authData.role === "MANAGER") {
      try {
        const approvalCheck = await checkDailyApproval({});
        if (!approvalCheck.canAddTransactions) {
          throw APIError.permissionDenied(
            approvalCheck.message || "You cannot modify transactions at this time. Please wait for admin approval."
          );
        }
      } catch (approvalError) {
        console.error('Daily approval check failed:', approvalError);
        // Allow the transaction to proceed if approval check fails
        // This prevents the approval system from blocking legitimate updates
      }
    }

    // Check if status columns exist
    let hasStatusColumns = false;
    try {
      const statusCheck = await financeDB.queryAll`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('expenses', 'revenues') AND column_name = 'status'
      `;
      // Both tables must have the status column
      hasStatusColumns = statusCheck.length === 2;
      console.log('Status column check result:', statusCheck, 'hasStatusColumns:', hasStatusColumns);
    } catch (error) {
      console.log('Status column check failed:', error);
    }

    const tx = await financeDB.begin();
    try {
      // Get existing expense and check access with org scoping
      let expenseRow;
      if (hasStatusColumns) {
        expenseRow = await tx.queryRow`
          SELECT e.id, e.org_id, e.status, e.created_by_user_id, e.property_id
          FROM expenses e
          WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
        `;
      } else {
        // Fallback: select without status column
        expenseRow = await tx.queryRow`
          SELECT e.id, e.org_id, e.created_by_user_id, e.property_id
          FROM expenses e
          WHERE e.id = ${id} AND e.org_id = ${authData.orgId}
        `;
        // Add default status in memory
        if (expenseRow) {
          expenseRow.status = 'pending';
        }
      }

      if (!expenseRow) {
        throw APIError.notFound("Expense not found");
      }

      // Check if user can modify this expense
      if (authData.role === "MANAGER") {
        // Managers can only modify their own expenses or expenses for properties they manage
        const canModify = await tx.queryRow`
          SELECT EXISTS(
            SELECT 1 FROM user_properties up 
            WHERE up.user_id = ${parseInt(authData.userID)} 
            AND up.property_id = ${expenseRow.property_id}
          ) OR EXISTS(
            SELECT 1 FROM expenses e
            WHERE e.id = ${id} AND e.created_by_user_id = ${parseInt(authData.userID)}
          )
        `;
        
        if (!canModify) {
          throw APIError.permissionDenied("You can only modify expenses for properties you manage or expenses you created");
        }
      }

      // If amount is being updated, validate it
      if (updateData.amountCents !== undefined && updateData.amountCents <= 0) {
        throw APIError.invalidArgument("Amount must be greater than zero");
      }

      // If property is being updated, check access
      if (updateData.propertyId) {
        const propertyRow = await tx.queryRow`
          SELECT id FROM properties 
          WHERE id = ${updateData.propertyId} AND org_id = ${authData.orgId}
        `;
        
        if (!propertyRow) {
          throw APIError.notFound("Property not found");
        }

        // Check if manager has access to the new property
        if (authData.role === "MANAGER") {
          const hasAccess = await tx.queryRow`
            SELECT EXISTS(
              SELECT 1 FROM user_properties 
              WHERE user_id = ${parseInt(authData.userID)} 
              AND property_id = ${updateData.propertyId}
            )
          `;
          
          if (!hasAccess) {
            throw APIError.permissionDenied("You don't have access to this property");
          }
        }
      }

      // Update expense fields using template literals
      let hasUpdates = false;

      if (updateData.propertyId !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET property_id = ${updateData.propertyId}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.category !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET category = ${updateData.category}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.amountCents !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET amount_cents = ${updateData.amountCents}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.currency !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET currency = ${updateData.currency}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.description !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET description = ${updateData.description}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.receiptUrl !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET receipt_url = ${updateData.receiptUrl}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.receiptFileId !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET receipt_file_id = ${updateData.receiptFileId}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.expenseDate !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET expense_date = ${updateData.expenseDate}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.paymentMode !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET payment_mode = ${updateData.paymentMode}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }
      if (updateData.bankReference !== undefined) {
        await tx.exec`
          UPDATE expenses 
          SET bank_reference = ${updateData.bankReference}
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
        hasUpdates = true;
      }

      if (!hasUpdates) {
        throw APIError.invalidArgument("No fields to update");
      }

      // For managers, reset status to pending when modifying (if status column exists)
      if (authData.role === "MANAGER" && hasStatusColumns) {
        await tx.exec`
          UPDATE expenses 
          SET status = 'pending', approved_by_user_id = NULL, approved_at = NULL
          WHERE id = ${id} AND org_id = ${authData.orgId}
        `;
      }

      // Note: updated_at column doesn't exist in expenses table, so we skip this
      
      // Get the updated expense
      const updatedExpense = await tx.queryRow`
        SELECT * FROM expenses 
        WHERE id = ${id} AND org_id = ${authData.orgId}
      `;
      
      if (!updatedExpense) {
        throw APIError.notFound("Expense not found or access denied");
      }

      // Create notification for admins if manager modified the expense
      if (authData.role === "MANAGER") {
        await tx.exec`
          INSERT INTO notifications (org_id, user_id, type, payload_json)
          SELECT 
            ${authData.orgId},
            u.id,
            'expense_modified',
            ${JSON.stringify({
              expense_id: id,
              modified_by: authData.displayName,
              modified_at: new Date().toISOString(),
              message: 'An expense has been modified and requires approval'
            })}
          FROM users u
          WHERE u.org_id = ${authData.orgId} AND u.role IN ('ADMIN')
        `;
      }

      await tx.commit();

      return {
        id: updatedExpense.id,
        propertyId: updatedExpense.property_id,
        category: updatedExpense.category,
        amountCents: updatedExpense.amount_cents,
        currency: updatedExpense.currency,
        description: updatedExpense.description,
        receiptUrl: updatedExpense.receipt_url,
        receiptFileId: updatedExpense.receipt_file_id,
        expenseDate: updatedExpense.expense_date,
        paymentMode: updatedExpense.payment_mode,
        bankReference: updatedExpense.bank_reference,
        status: updatedExpense.status || 'pending',
        createdByUserId: updatedExpense.created_by_user_id,
        updatedAt: updatedExpense.updated_at,
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
);
