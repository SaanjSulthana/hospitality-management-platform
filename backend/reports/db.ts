import { SQLDatabase } from "encore.dev/storage/sqldb";

export const reportsDB = new SQLDatabase("hospitality", {
  migrations: "./migrations",
});
