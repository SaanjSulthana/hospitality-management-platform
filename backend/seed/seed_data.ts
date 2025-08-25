import { api } from "encore.dev/api";
import { seedDB } from "./db";
import { hashPassword } from "../auth/utils";
import log from "encore.dev/log";

export interface SeedDataResponse {
  success: boolean;
  message: string;
}

// Seeds the database with demo data
export const seedData = api<void, SeedDataResponse>(
  { expose: true, method: "POST", path: "/seed/data" },
  async () => {
    try {
      log.info("Starting database seeding...");

      // Get the default organization (should already exist from migration)
      const orgRow = await seedDB.queryRow`
        SELECT id FROM organizations WHERE subdomain_prefix = 'example'
      `;

      if (!orgRow) {
        throw new Error("Default organization not found. Please run migrations first.");
      }

      const orgId = orgRow.id;
      log.info(`Using organization with ID: ${orgId}`);

      // Check if admin user already exists
      const existingAdmin = await seedDB.queryRow`
        SELECT id FROM users WHERE email = 'admin@example.com'
      `;

      if (existingAdmin) {
        log.info("Admin user already exists, skipping creation");
      }

      // Create manager user with hashed password for "ManagerPass123"
      const managerPasswordHash = await hashPassword("ManagerPass123");
      
      const existingManager = await seedDB.queryRow`
        SELECT id FROM users WHERE email = 'manager1@example.com'
      `;

      if (!existingManager) {
        const adminUser = await seedDB.queryRow`
          SELECT id FROM users WHERE email = 'admin@example.com'
        `;

        if (adminUser) {
          await seedDB.exec`
            INSERT INTO users (org_id, email, password_hash, role, display_name, created_by_user_id)
            VALUES (${orgId}, 'manager1@example.com', ${managerPasswordHash}, 'MANAGER', 'Demo Manager', ${adminUser.id})
            ON CONFLICT (org_id, email) DO NOTHING
          `;
          log.info("Created demo manager user");
        }
      }

      // Create regions
      const region1 = await seedDB.queryRow`
        INSERT INTO regions (org_id, name)
        VALUES (${orgId}, 'North Region')
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      const region2 = await seedDB.queryRow`
        INSERT INTO regions (org_id, name)
        VALUES (${orgId}, 'South Region')
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      // Create properties
      const property1 = await seedDB.queryRow`
        INSERT INTO properties (org_id, region_id, name, type, address_json, amenities_json, capacity_json)
        VALUES (
          ${orgId}, 
          ${region1?.id || null}, 
          'Downtown Hotel', 
          'hotel',
          '{"street": "123 Main St", "city": "Downtown", "state": "CA", "country": "USA", "zipCode": "90210"}',
          '{"amenities": ["wifi", "parking", "pool", "gym", "restaurant"]}',
          '{"totalRooms": 50, "totalBeds": 75, "maxGuests": 150}'
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      const property2 = await seedDB.queryRow`
        INSERT INTO properties (org_id, region_id, name, type, address_json, amenities_json, capacity_json)
        VALUES (
          ${orgId}, 
          ${region1?.id || null}, 
          'Beach Resort', 
          'resort',
          '{"street": "456 Ocean Ave", "city": "Beachside", "state": "CA", "country": "USA", "zipCode": "90211"}',
          '{"amenities": ["wifi", "parking", "pool", "spa", "beach_access", "restaurant", "bar"]}',
          '{"totalRooms": 100, "totalBeds": 200, "maxGuests": 400}'
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      // Create rooms for properties
      if (property1?.id) {
        for (let i = 1; i <= 10; i++) {
          await seedDB.exec`
            INSERT INTO rooms (org_id, property_id, name, type, capacity, attributes_json)
            VALUES (${orgId}, ${property1.id}, ${'Room ' + i}, 'standard', 2, '{"bed_type": "queen", "view": "city"}')
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Create beds/units
      if (property1?.id) {
        for (let i = 1; i <= 20; i++) {
          await seedDB.exec`
            INSERT INTO beds_or_units (org_id, property_id, label, status, meta_json)
            VALUES (${orgId}, ${property1.id}, ${'Unit ' + i}, ${i <= 5 ? 'occupied' : 'available'}, '{}')
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Create sample guests and bookings
      const guest1 = await seedDB.queryRow`
        INSERT INTO guests (org_id, primary_contact_json, notes_text)
        VALUES (${orgId}, '{"name": "John Doe", "email": "john@example.com", "phone": "+1234567890"}', 'VIP guest')
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      const guest2 = await seedDB.queryRow`
        INSERT INTO guests (org_id, primary_contact_json, notes_text)
        VALUES (${orgId}, '{"name": "Jane Smith", "email": "jane@example.com", "phone": "+1234567891"}', 'Business traveler')
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      // Create bookings
      if (guest1?.id && property1?.id) {
        await seedDB.exec`
          INSERT INTO bookings (org_id, guest_id, property_id, checkin_date, checkout_date, status, price_cents, currency, channel)
          VALUES (${orgId}, ${guest1.id}, ${property1.id}, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'checked_in', 15000, 'USD', 'direct')
          ON CONFLICT DO NOTHING
        `;
      }

      if (guest2?.id && property1?.id) {
        await seedDB.exec`
          INSERT INTO bookings (org_id, guest_id, property_id, checkin_date, checkout_date, status, price_cents, currency, channel)
          VALUES (${orgId}, ${guest2.id}, ${property1.id}, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', 'confirmed', 12000, 'USD', 'ota')
          ON CONFLICT DO NOTHING
        `;
      }

      // Create sample revenues and expenses
      if (property1?.id) {
        await seedDB.exec`
          INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, occurred_at)
          VALUES (${orgId}, ${property1.id}, 'room', 15000, 'USD', CURRENT_DATE - INTERVAL '1 day')
          ON CONFLICT DO NOTHING
        `;

        const adminUser = await seedDB.queryRow`
          SELECT id FROM users WHERE email = 'admin@example.com'
        `;

        if (adminUser) {
          await seedDB.exec`
            INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, created_by_user_id)
            VALUES (${orgId}, ${property1.id}, 'supplies', 5000, 'USD', ${adminUser.id})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      log.info("Database seeding completed successfully");

      return {
        success: true,
        message: "Demo data seeded successfully. Login credentials: admin@example.com / AdminPass123, manager1@example.com / ManagerPass123",
      };
    } catch (error) {
      log.error("Database seeding failed:", error);
      throw error;
    }
  }
);
