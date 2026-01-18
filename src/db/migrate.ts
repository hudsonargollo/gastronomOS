import { drizzle } from 'drizzle-orm/d1';
import { migrate } from 'drizzle-orm/d1/migrator';

/**
 * Migration runner for Cloudflare D1 database
 * This function applies pending migrations to the database
 */
export async function runMigrations(db: D1Database): Promise<void> {
  try {
    console.log('Starting database migrations...');
    
    const drizzleDb = drizzle(db);
    
    // Apply migrations from the migrations folder
    await migrate(drizzleDb, { migrationsFolder: './migrations' });
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error(`Database migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Initialize database connection with Drizzle ORM
 * This creates a Drizzle database instance for use in the application
 */
export function createDrizzleDb(d1Database: D1Database) {
  return drizzle(d1Database);
}

/**
 * Utility function to check if migrations are needed
 * This can be used in development to verify migration status
 */
export async function checkMigrationStatus(db: D1Database): Promise<boolean> {
  try {
    // Try to query the schema_migrations table (created by Drizzle)
    const result = await db.prepare(
      'SELECT name FROM sqlite_master WHERE type="table" AND name="__drizzle_migrations"'
    ).first();
    
    return result !== null;
  } catch (error) {
    console.warn('Could not check migration status:', error);
    return false;
  }
}