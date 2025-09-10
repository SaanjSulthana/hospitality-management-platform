import { SQLDatabase } from "encore.dev/storage/sqldb";

export const financeDB = new SQLDatabase("hospitality", {
  migrations: "./migrations",
});
