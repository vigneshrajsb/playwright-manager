#!/usr/bin/env node
/**
 * Database migration script for production deployments.
 * Uses drizzle-orm's programmatic migrator (no drizzle-kit needed).
 *
 * Usage: node scripts/migrate.mjs
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}

async function runMigrations() {
  console.log("Starting database migrations...");

  // Create a dedicated connection for migrations
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Run migrations from the drizzle folder
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    // Close the connection
    await migrationClient.end();
  }
}

runMigrations();
