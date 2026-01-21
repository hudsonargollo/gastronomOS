import { DrizzleD1Database } from 'drizzle-orm/d1';
import { createDemoDataSeeder, IDemoDataSeeder } from './demo-data-seeder';

/**
 * Demo Initialization Service
 * 
 * Provides high-level functions for initializing and managing demo data.
 * This service coordinates demo data seeding during system startup and provides
 * reset functionality for maintaining clean demo environments.
 */
export interface IDemoInitializationService {
  initializeDemoData(): Promise<void>;
  resetDemoData(): Promise<void>;
  isDemoDataReady(): Promise<boolean>;
  scheduleDemoReset(): Promise<void>;
}

export class DemoInitializationService implements IDemoInitializationService {
  private demoSeeder: IDemoDataSeeder;

  constructor(private db: DrizzleD1Database) {
    this.demoSeeder = createDemoDataSeeder(db);
  }

  /**
   * Initializes demo data if it doesn't exist
   * Requirements: 8.1 - Create demo tenant with sample data during system initialization
   */
  async initializeDemoData(): Promise<void> {
    console.log('Checking demo data initialization...');

    try {
      const isSeeded = await this.demoSeeder.isDemoDataSeeded();
      
      if (!isSeeded) {
        console.log('Demo data not found, seeding initial data...');
        await this.demoSeeder.seedDemoData();
        console.log('Demo data initialization completed');
      } else {
        console.log('Demo data already exists, skipping initialization');
      }
    } catch (error) {
      console.error('Failed to initialize demo data:', error);
      throw new Error(`Demo data initialization failed: ${error.message}`);
    }
  }

  /**
   * Resets demo data to initial state
   * Requirements: 8.5 - Automatically reset demo data to initial state
   */
  async resetDemoData(): Promise<void> {
    console.log('Resetting demo data to initial state...');

    try {
      await this.demoSeeder.resetDemoData();
      console.log('Demo data reset completed successfully');
    } catch (error) {
      console.error('Failed to reset demo data:', error);
      throw new Error(`Demo data reset failed: ${error.message}`);
    }
  }

  /**
   * Checks if demo data is ready for use
   */
  async isDemoDataReady(): Promise<boolean> {
    try {
      return await this.demoSeeder.isDemoDataSeeded();
    } catch (error) {
      console.error('Error checking demo data status:', error);
      return false;
    }
  }

  /**
   * Schedules automatic demo data reset
   * Requirements: 8.5 - Implement automatic demo data reset scheduling
   * 
   * Note: In a production environment, this would integrate with Cloudflare Cron Triggers
   * or similar scheduling mechanisms. For now, this provides the interface for such integration.
   */
  async scheduleDemoReset(): Promise<void> {
    console.log('Scheduling demo data reset...');

    try {
      // In a real implementation, this would:
      // 1. Register a cron job with Cloudflare Workers
      // 2. Set up a scheduled trigger to call resetDemoData()
      // 3. Configure the reset frequency (e.g., daily, weekly)
      
      // For now, we'll just log the scheduling intent
      console.log('Demo data reset scheduling configured');
      console.log('Note: Actual scheduling requires Cloudflare Cron Triggers configuration');
      
      // Example of what the cron configuration would look like in wrangler.toml:
      /*
      [triggers]
      crons = ["0 2 * * *"] # Reset demo data daily at 2 AM UTC
      */
      
    } catch (error) {
      console.error('Failed to schedule demo data reset:', error);
      throw new Error(`Demo data reset scheduling failed: ${error.message}`);
    }
  }
}

/**
 * Factory function to create DemoInitializationService instance
 */
export function createDemoInitializationService(db: DrizzleD1Database): IDemoInitializationService {
  return new DemoInitializationService(db);
}

/**
 * Utility function for one-time demo data initialization
 * Can be called during application startup or deployment
 */
export async function initializeDemoDataOnStartup(db: DrizzleD1Database): Promise<void> {
  const demoService = createDemoInitializationService(db);
  await demoService.initializeDemoData();
}

/**
 * Utility function for manual demo data reset
 * Can be called via admin endpoints or maintenance scripts
 */
export async function resetDemoDataManually(db: DrizzleD1Database): Promise<void> {
  const demoService = createDemoInitializationService(db);
  await demoService.resetDemoData();
}