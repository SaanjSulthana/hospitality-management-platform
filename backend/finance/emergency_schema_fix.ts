import { api } from "encore.dev/api";
import { financeDB } from "./db";

interface SchemaFixResponse {
    success: boolean;
    message: string;
    details: string[];
}

// Emergency schema fix endpoint - run this once to fix production
export const emergencySchemaFix = api<void, SchemaFixResponse>(
    { expose: true, method: "POST", path: "/finance/emergency-schema-fix", auth: false },
    async (): Promise<SchemaFixResponse> => {
        const details: string[] = [];

        try {
            details.push("Starting schema fix...");

            // Fix expenses table
            details.push("Fixing expenses table...");
            await financeDB.exec`
        DO $$
        BEGIN
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';
            ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);
        END $$;
      `;
            details.push("✅ Expenses table fixed");

            // Fix revenues table
            details.push("Fixing revenues table...");
            await financeDB.exec`
        DO $$
        BEGIN
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS source TEXT;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_url TEXT;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'cash';
            ALTER TABLE revenues ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(100);
        END $$;
      `;
            details.push("✅ Revenues table fixed");

            // Update existing records
            details.push("Updating existing records...");
            await financeDB.exec`UPDATE expenses SET status = 'pending' WHERE status IS NULL`;
            await financeDB.exec`UPDATE revenues SET status = 'pending' WHERE status IS NULL`;
            details.push("✅ Existing records updated");

            return {
                success: true,
                message: "Schema fix completed successfully!",
                details
            };
        } catch (error) {
            details.push(`❌ Error: ${error}`);
            return {
                success: false,
                message: "Schema fix failed",
                details
            };
        }
    }
);
