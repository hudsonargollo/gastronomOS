import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { createDemoSessionManager } from '../services/demo-session-manager';

/**
 * Cron Handler for Automatic Demo Data Reset
 * 
 * This handler is triggered by Cloudflare Cron Triggers to automatically
 * reset demo data at scheduled intervals.
 * 
 * Requirements: 8.5 - Implement automatic demo data reset scheduling
 * 
 * Configuration in wrangler.toml:
 * [triggers]
 * crons = ["0 2 * * *"]  # Reset demo data daily at 2 AM UTC
 */

export interface CronEnv {
  DB: D1Database;
}

/**
 * Scheduled event handler for demo data reset
 * This function is called by Cloudflare Workers Cron Triggers
 */
export async function handleDemoResetCron(event: ScheduledEvent, env: CronEnv): Promise<void> {
  console.log('Demo reset cron triggered at:', new Date(event.scheduledTime).toISOString());
  
  try {
    const db = drizzle(env.DB, { schema });
    const demoSessionManager = createDemoSessionManager(db as any);
    
    // Execute scheduled demo reset
    await demoSessionManager.scheduleDemoReset();
    
    console.log('Demo reset cron completed successfully');
  } catch (error) {
    console.error('Demo reset cron failed:', error);
    // Don't throw - we don't want to fail the cron job
    // The error is logged and can be monitored
  }
}

/**
 * Manual trigger for demo reset (can be called from admin endpoints)
 */
export async function triggerManualDemoReset(env: CronEnv): Promise<{ success: boolean; message: string }> {
  try {
    const db = drizzle(env.DB, { schema });
    const demoSessionManager = createDemoSessionManager(db as any);
    
    await demoSessionManager.scheduleDemoReset();
    
    return {
      success: true,
      message: 'Demo data reset completed successfully'
    };
  } catch (error) {
    console.error('Manual demo reset failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during demo reset'
    };
  }
}
