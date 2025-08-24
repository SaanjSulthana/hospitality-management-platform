import { SQLDatabase } from "encore.dev/storage/sqldb";

export const tasksDB = SQLDatabase.named("hospitality");
