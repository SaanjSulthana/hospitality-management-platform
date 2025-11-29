import { SQLDatabase } from "encore.dev/storage/sqldb";

export const documentsDB = SQLDatabase.named("hospitality", {
  migrations: "./migrations",
});

