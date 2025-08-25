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
        log.info("Admin user already exists, updating password to match demo");
        // Update admin password to match demo credentials
        const adminPasswordHash = await hashPassword("password123");
        await seedDB.exec`
          UPDATE users 
          SET password_hash = ${adminPasswordHash}
          WHERE email = 'admin@example.com'
        `;
      } else {
        // Create admin user with demo password
        const adminPasswordHash = await hashPassword("password123");
        await seedDB.exec`
          INSERT INTO users (org_id, email, password_hash, role, display_name)
          VALUES (${orgId}, 'admin@example.com', ${adminPasswordHash}, 'ADMIN', 'Demo Administrator')
        `;
      }

      // Create manager user with demo password
      const managerPasswordHash = await hashPassword("password123");
      
      const existingManager = await seedDB.queryRow`
        SELECT id FROM users WHERE email = 'manager@example.com'
      `;

      if (!existingManager) {
        const adminUser = await seedDB.queryRow`
          SELECT id FROM users WHERE email = 'admin@example.com'
        `;

        if (adminUser) {
          await seedDB.exec`
            INSERT INTO users (org_id, email, password_hash, role, display_name, created_by_user_id)
            VALUES (${orgId}, 'manager@example.com', ${managerPasswordHash}, 'MANAGER', 'Demo Manager', ${adminUser.id})
            ON CONFLICT (org_id, email) DO UPDATE SET
              password_hash = ${managerPasswordHash},
              display_name = 'Demo Manager'
          `;
          log.info("Created demo manager user");
        }
      } else {
        // Update existing manager password
        await seedDB.exec`
          UPDATE users 
          SET password_hash = ${managerPasswordHash}, display_name = 'Demo Manager'
          WHERE email = 'manager@example.com'
        `;
        log.info("Updated demo manager user");
      }

      // Create additional demo users
      const additionalUsers = [
        { email: 'property@example.com', name: 'Property Manager Demo', role: 'MANAGER' },
        { email: 'dept@example.com', name: 'Department Head Demo', role: 'MANAGER' },
        { email: 'staff1@example.com', name: 'Front Desk Staff Demo', role: 'MANAGER' },
        { email: 'staff2@example.com', name: 'Housekeeping Staff Demo', role: 'MANAGER' },
      ];

      const adminUser = await seedDB.queryRow`
        SELECT id FROM users WHERE email = 'admin@example.com'
      `;

      for (const user of additionalUsers) {
        const userPasswordHash = await hashPassword("password123");
        await seedDB.exec`
          INSERT INTO users (org_id, email, password_hash, role, display_name, created_by_user_id)
          VALUES (${orgId}, ${user.email}, ${userPasswordHash}, ${user.role}, ${user.name}, ${adminUser?.id})
          ON CONFLICT (org_id, email) DO UPDATE SET
            password_hash = ${userPasswordHash},
            display_name = ${user.name}
        `;
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

      // Get existing regions if they weren't just created
      const northRegion = region1 || await seedDB.queryRow`
        SELECT id FROM regions WHERE org_id = ${orgId} AND name = 'North Region'
      `;
      const southRegion = region2 || await seedDB.queryRow`
        SELECT id FROM regions WHERE org_id = ${orgId} AND name = 'South Region'
      `;

      // Create properties
      const property1 = await seedDB.queryRow`
        INSERT INTO properties (org_id, region_id, name, type, address_json, amenities_json, capacity_json)
        VALUES (
          ${orgId}, 
          ${northRegion?.id || null}, 
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
          ${southRegion?.id || null}, 
          'Beach Resort', 
          'resort',
          '{"street": "456 Ocean Ave", "city": "Beachside", "state": "CA", "country": "USA", "zipCode": "90211"}',
          '{"amenities": ["wifi", "parking", "pool", "spa", "beach_access", "restaurant", "bar"]}',
          '{"totalRooms": 100, "totalBeds": 200, "maxGuests": 400}'
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;

      // Get existing properties if they weren't just created
      const downtownHotel = property1 || await seedDB.queryRow`
        SELECT id FROM properties WHERE org_id = ${orgId} AND name = 'Downtown Hotel'
      `;
      const beachResort = property2 || await seedDB.queryRow`
        SELECT id FROM properties WHERE org_id = ${orgId} AND name = 'Beach Resort'
      `;

      // Create rooms for properties
      if (downtownHotel?.id) {
        for (let i = 1; i <= 10; i++) {
          await seedDB.exec`
            INSERT INTO rooms (org_id, property_id, name, type, capacity, attributes_json)
            VALUES (${orgId}, ${downtownHotel.id}, ${'Room ' + i}, 'standard', 2, '{"bed_type": "queen", "view": "city"}')
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Create beds/units
      if (downtownHotel?.id) {
        for (let i = 1; i <= 20; i++) {
          await seedDB.exec`
            INSERT INTO beds_or_units (org_id, property_id, label, status, meta_json)
            VALUES (${orgId}, ${downtownHotel.id}, ${'Unit ' + i}, ${i <= 5 ? 'occupied' : 'available'}, '{}')
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

      // Get existing guests if they weren't just created
      const johnDoe = guest1 || await seedDB.queryRow`
        SELECT id FROM guests WHERE org_id = ${orgId} AND primary_contact_json->>'email' = 'john@example.com'
      `;
      const janeSmith = guest2 || await seedDB.queryRow`
        SELECT id FROM guests WHERE org_id = ${orgId} AND primary_contact_json->>'email' = 'jane@example.com'
      `;

      // Create bookings
      if (johnDoe?.id && downtownHotel?.id) {
        await seedDB.exec`
          INSERT INTO bookings (org_id, guest_id, property_id, checkin_date, checkout_date, status, price_cents, currency, channel)
          VALUES (${orgId}, ${johnDoe.id}, ${downtownHotel.id}, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 days', 'checked_in', 15000, 'USD', 'direct')
          ON CONFLICT DO NOTHING
        `;
      }

      if (janeSmith?.id && downtownHotel?.id) {
        await seedDB.exec`
          INSERT INTO bookings (org_id, guest_id, property_id, checkin_date, checkout_date, status, price_cents, currency, channel)
          VALUES (${orgId}, ${janeSmith.id}, ${downtownHotel.id}, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', 'confirmed', 12000, 'USD', 'ota')
          ON CONFLICT DO NOTHING
        `;
      }

      // Create sample revenues and expenses
      if (downtownHotel?.id) {
        await seedDB.exec`
          INSERT INTO revenues (org_id, property_id, source, amount_cents, currency, occurred_at)
          VALUES (${orgId}, ${downtownHotel.id}, 'room', 15000, 'USD', CURRENT_DATE - INTERVAL '1 day')
          ON CONFLICT DO NOTHING
        `;

        if (adminUser) {
          await seedDB.exec`
            INSERT INTO expenses (org_id, property_id, category, amount_cents, currency, created_by_user_id)
            VALUES (${orgId}, ${downtownHotel.id}, 'supplies', 5000, 'USD', ${adminUser.id})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Create sample tasks
      if (downtownHotel?.id && adminUser) {
        const sampleTasks = [
          {
            title: 'Fix air conditioning in Room 101',
            description: 'Guest reported AC not working properly',
            type: 'maintenance',
            priority: 'high'
          },
          {
            title: 'Deep clean lobby area',
            description: 'Weekly deep cleaning of main lobby',
            type: 'housekeeping',
            priority: 'med'
          },
          {
            title: 'Restock minibar supplies',
            description: 'Refill minibars on floors 3-5',
            type: 'service',
            priority: 'low'
          }
        ];

        for (const task of sampleTasks) {
          await seedDB.exec`
            INSERT INTO tasks (org_id, property_id, type, title, description, priority, status, created_by_user_id)
            VALUES (${orgId}, ${downtownHotel.id}, ${task.type}, ${task.title}, ${task.description}, ${task.priority}, 'open', ${adminUser.id})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Ensure MANAGER users have property access (user_properties) so they can create/see tasks
      const managerUser = await seedDB.queryRow`SELECT id FROM users WHERE email = 'manager@example.com'`;
      const propertyManagerUser = await seedDB.queryRow`SELECT id FROM users WHERE email = 'property@example.com'`;
      const deptUser = await seedDB.queryRow`SELECT id FROM users WHERE email = 'dept@example.com'`;
      const staff1User = await seedDB.queryRow`SELECT id FROM users WHERE email = 'staff1@example.com'`;
      const staff2User = await seedDB.queryRow`SELECT id FROM users WHERE email = 'staff2@example.com'`;

      if (downtownHotel?.id) {
        for (const u of [managerUser, propertyManagerUser, deptUser, staff1User, staff2User]) {
          if (u) {
            await seedDB.exec`
              INSERT INTO user_properties (user_id, property_id)
              VALUES (${u.id}, ${downtownHotel.id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
      if (beachResort?.id) {
        for (const u of [managerUser, propertyManagerUser]) {
          if (u) {
            await seedDB.exec`
              INSERT INTO user_properties (user_id, property_id)
              VALUES (${u.id}, ${beachResort.id})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }

      // Seed Staff records for assignment UX
      // Create staff records for staff1 and staff2 (and optionally manager as staff) to allow task assignment
      if (staff1User && downtownHotel?.id) {
        await seedDB.exec`
          INSERT INTO staff (org_id, user_id, property_id, department, hourly_rate_cents, status)
          VALUES (${orgId}, ${staff1User.id}, ${downtownHotel.id}, 'frontdesk', 1800, 'active')
          ON CONFLICT DO NOTHING
        `;
      }
      if (staff2User && downtownHotel?.id) {
        await seedDB.exec`
          INSERT INTO staff (org_id, user_id, property_id, department, hourly_rate_cents, status)
          VALUES (${orgId}, ${staff2User.id}, ${downtownHotel.id}, 'housekeeping', 1600, 'active')
          ON CONFLICT DO NOTHING
        `;
      }
      // Optionally add manager as staff record for assignment
      if (managerUser && beachResort?.id) {
        await seedDB.exec`
          INSERT INTO staff (org_id, user_id, property_id, department, hourly_rate_cents, status)
          VALUES (${orgId}, ${managerUser.id}, ${beachResort.id}, 'admin', 0, 'active')
          ON CONFLICT DO NOTHING
        `;
      }

      log.info("Database seeding completed successfully");

      return {
        success: true,
        message: "Demo data seeded successfully. Login credentials: admin@example.com / password123, manager@example.com / password123",
      };
    } catch (error) {
      log.error("Database seeding failed:", error);
      throw error;
    }
  }
);
