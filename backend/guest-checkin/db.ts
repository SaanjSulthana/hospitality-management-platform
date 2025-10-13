import { SQLDatabase } from "encore.dev/storage/sqldb";

export const guestCheckinDB = new SQLDatabase("guest_checkin_db", {
  migrations: "./migrations",
});
