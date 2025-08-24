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

      // Create demo organization
      const orgRow = await seedDB.queryRow`
        INSERT INTO organizations (name, subdomain_prefix, theme_json)
        VALUES ('Demo Brand Hotels', 'demo', '{"primaryColor": "#3b82f6", "brandName": "Demo Brand Hotels"}')
        ON CONFLICT (subdomain_prefix) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;

      const orgId = orgRow.id;
      log.info(`Created/found organization with ID: ${orgId}`);

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

      // Create users
      const passwordHash = await hashPassword("password123");

      const corpAdmin = await seedDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgId}, 'admin@demo.com', ${passwordHash}, 'CORP_ADMIN', 'Corporate Admin')
        ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `;

      const regionalManager = await seedDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name, region_id)
        VALUES (${orgId}, 'manager@demo.com', ${passwordHash}, 'REGIONAL_MANAGER', 'Regional Manager', ${region1?.id || null})
        ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `;

      const propertyManager = await seedDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgId}, 'property@demo.com', ${passwordHash}, 'PROPERTY_MANAGER', 'Property Manager')
        ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `;

      const deptHead = await seedDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgId}, 'dept@demo.com', ${passwordHash}, 'DEPT_HEAD', 'Department Head')
        ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `;

      const staff1 = await seedDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgId}, 'staff1@demo.com', ${passwordHash}, 'STAFF', 'Front Desk Staff')
        ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
      `;

      const staff2 = await seedDB.queryRow`
        INSERT INTO users (org_id, email, password_hash, role, display_name)
        VALUES (${orgId}, 'staff2@demo.com', ${passwordHash}, 'STAFF', 'Housekeeping Staff')
        ON CONFLICT (org_id, email) DO UPDATE SET display_name = EXCLUDED.display_name
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

      const property3 = await seedDB.queryRow`
        INSERT INTO properties (org_id, region_id, name, type, address_json, amenities_json, capacity_json)
        VALUES (
          ${orgId}, 
          ${region2?.id || null}, 
          'City Hostel', 
          'hostel',
          '{"street": "789 Budget St", "city": "Metro", "state": "CA", "country": "USA", "zipCode": "90212"}',
          '{"amenities": ["wifi", "shared_kitchen", "laundry", "common_room"]}',
          '{"totalRooms": 20, "totalBeds": 80, "maxGuests": 80}'
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      // Link users to properties
      if (property1?.id) {
        await seedDB.exec`
          INSERT INTO user_properties (user_id, property_id)
          VALUES (${propertyManager.id}, ${property1.id})
          ON CONFLICT DO NOTHING
        `;
        await seedDB.exec`
          INSERT INTO user_properties (user_id, property_id)
          VALUES (${deptHead.id}, ${property1.id})
          ON CONFLICT DO NOTHING
        `;
      }

      if (property2?.id) {
        await seedDB.exec`
          INSERT INTO user_properties (user_id, property_id)
          VALUES (${propertyManager.id}, ${property2.id})
          ON CONFLICT DO NOTHING
        `;
      }

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

      // Create staff records
      if (property1?.id) {
        await seedDB.exec`
          INSERT INTO staff (org_id, user_id, property_id, department, schedule_json)
          VALUES (${orgId}, ${staff1.id}, ${property1.id}, 'frontdesk', '{"shift": "morning", "hours": "8-16"}')
          ON CONFLICT DO NOTHING
        `;

        await seedDB.exec`
          INSERT INTO staff (org_id, user_id, property_id, department, schedule_json)
          VALUES (${orgId}, ${staff2.id}, ${property1.id}, 'housekeeping', '{"shift": "day", "hours": "9-17"}')
          ON CONFLICT DO NOTHING
        `;
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

      // Create sample tasks
      if (property1?.id) {
        await seedDB.exec`
          INSERT INTO tasks (org_id, property_id, type, title, description, priority, status, due_at, created_by_user_id)
          VALUES (${orgId}, ${property1.id}, 'housekeeping', 'Clean Room 101', 'Deep cleaning required after checkout', 'high', 'open', NOW() + INTERVAL '2 hours', ${propertyManager.id})
          ON CONFLICT DO NOTHING
        `;

        await seedDB.exec`
          INSERT INTO tasks (org_id, property_id, type, title, description, priority, status, due_at, created_by_user_id)
          VALUES (${orgId}, ${property1.id}, 'maintenance', 'Fix AC in Room 205', 'Guest reported AC not working', 'med', 'in_progress', NOW() + INTERVAL '4 hours', ${deptHead.id})
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

        await seedDB.exec`
          INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, created_by_user_id)
          VALUES (${orgId}, ${property1.id}, 'supplies', 5000, 'USD', ${propertyManager.id})
          ON CONFLICT DO NOTHING
        `;
      }

      log.info("Database seeding completed successfully");

      return {
        success: true,
        message: "Demo data seeded successfully. Login credentials: admin@demo.com / password123",
      };
    } catch (error) {
      log.error("Database seeding failed:", error);
      throw error;
    }
  }
);
