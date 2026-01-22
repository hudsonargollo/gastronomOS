import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { createDemoInitializationService } from './demo-initialization';

/**
 * Demo Session Manager Service
 * 
 * Manages demo account sessions with enhanced security measures:
 * - Shorter expiration times for demo sessions (2 hours vs 24 hours)
 * - Automatic demo data reset scheduling
 * - Demo account security restrictions
 * 
 * Requirements: 8.5 - Configure shorter expiration times, implement automatic reset, add security measures
 */

export interface DemoSessionConfig {
  expirationSeconds: number;  // Demo session expiration (default: 2 hours)
  resetIntervalHours: number; // How often to reset demo data (default: 24 hours)
  maxConcurrentSessions: number; // Max concurrent demo sessions (default: 100)
  enableAutoReset: boolean;   // Whether to enable automatic reset
}

export interface DemoSessionInfo {
  isDemoSession: boolean;
  expiresAt: number;
  tenantId: string;
  userId: string;
  sessionStartedAt: number;
}

export interface IDemoSessionManager {
  getDemoSessionExpiration(): number;
  isDemoAccount(email: string): Promise<boolean>;
  isDemoTenant(tenantId: string): boolean;
  createDemoSessionInfo(userId: string, tenantId: string): DemoSessionInfo;
  shouldResetDemoData(): Promise<boolean>;
  scheduleDemoReset(): Promise<void>;
  getSessionSecurityRestrictions(): DemoSecurityRestrictions;
  getConfig(): Readonly<DemoSessionConfig>;
}

export interface DemoSecurityRestrictions {
  canModifyUsers: boolean;
  canDeleteData: boolean;
  canExportData: boolean;
  canAccessAdminPanel: boolean;
  maxDataRetentionHours: number;
}

export class DemoSessionManager implements IDemoSessionManager {
  private config: DemoSessionConfig;
  private lastResetTime: number;
  private readonly DEMO_TENANT_ID = 'demo-tenant';
  private readonly DEMO_EMAIL_PATTERNS = [
    '@gastronomos.com',
    '@demo-restaurant.com',
    'demo@',
  ];

  constructor(
    private db: DrizzleD1Database,
    config?: Partial<DemoSessionConfig>
  ) {
    // Default configuration with shorter expiration for demo sessions
    this.config = {
      expirationSeconds: config?.expirationSeconds || 2 * 60 * 60, // 2 hours (vs 24 hours for regular)
      resetIntervalHours: config?.resetIntervalHours || 24, // Reset daily
      maxConcurrentSessions: config?.maxConcurrentSessions || 100,
      enableAutoReset: config?.enableAutoReset ?? true,
    };
    
    this.lastResetTime = Date.now();
  }

  /**
   * Get the expiration time for demo sessions (shorter than regular sessions)
   * Requirements: 8.5 - Configure shorter expiration times for demo sessions
   */
  getDemoSessionExpiration(): number {
    return this.config.expirationSeconds;
  }

  /**
   * Check if an email belongs to a demo account
   * Requirements: 8.5 - Add demo account security measures
   */
  async isDemoAccount(email: string): Promise<boolean> {
    // Check if email matches demo patterns
    const matchesPattern = this.DEMO_EMAIL_PATTERNS.some(pattern => 
      email.toLowerCase().includes(pattern.toLowerCase())
    );

    if (matchesPattern) {
      return true;
    }

    // Also check database for demo tenant membership
    try {
      const user = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user.length > 0 && user[0].tenantId === this.DEMO_TENANT_ID) {
        return true;
      }
    } catch (error) {
      console.error('Error checking demo account status:', error);
    }

    return false;
  }

  /**
   * Check if a tenant ID is the demo tenant
   */
  isDemoTenant(tenantId: string): boolean {
    return tenantId === this.DEMO_TENANT_ID;
  }

  /**
   * Create session information for a demo account
   * Requirements: 8.5 - Configure shorter expiration times for demo sessions
   */
  createDemoSessionInfo(userId: string, tenantId: string): DemoSessionInfo {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      isDemoSession: true,
      expiresAt: now + this.config.expirationSeconds,
      tenantId,
      userId,
      sessionStartedAt: now,
    };
  }

  /**
   * Check if demo data should be reset based on time interval
   * Requirements: 8.5 - Implement automatic demo data reset scheduling
   */
  async shouldResetDemoData(): Promise<boolean> {
    if (!this.config.enableAutoReset) {
      return false;
    }

    const now = Date.now();
    const hoursSinceLastReset = (now - this.lastResetTime) / (1000 * 60 * 60);

    return hoursSinceLastReset >= this.config.resetIntervalHours;
  }

  /**
   * Schedule automatic demo data reset
   * Requirements: 8.5 - Implement automatic demo data reset scheduling
   * 
   * This method provides the logic for scheduled resets. In production, this would be
   * triggered by Cloudflare Cron Triggers configured in wrangler.toml
   */
  async scheduleDemoReset(): Promise<void> {
    console.log('Checking if demo data reset is needed...');

    try {
      const shouldReset = await this.shouldResetDemoData();

      if (shouldReset) {
        console.log('Demo data reset threshold reached, initiating reset...');
        
        const demoService = createDemoInitializationService(this.db);
        await demoService.resetDemoData();
        
        this.lastResetTime = Date.now();
        console.log('Demo data reset completed successfully');
      } else {
        const hoursSinceReset = (Date.now() - this.lastResetTime) / (1000 * 60 * 60);
        console.log(`Demo data reset not needed. Hours since last reset: ${hoursSinceReset.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error during scheduled demo reset:', error);
      throw new Error(`Scheduled demo reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get security restrictions for demo accounts
   * Requirements: 8.5 - Add demo account security measures
   */
  getSessionSecurityRestrictions(): DemoSecurityRestrictions {
    return {
      canModifyUsers: false,        // Demo users cannot create/modify other users
      canDeleteData: false,         // Demo users cannot permanently delete data
      canExportData: false,         // Demo users cannot export data
      canAccessAdminPanel: false,   // Demo users cannot access admin features
      maxDataRetentionHours: this.config.resetIntervalHours, // Data resets after this time
    };
  }

  /**
   * Get configuration for display/debugging
   */
  getConfig(): Readonly<DemoSessionConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Update the last reset time (useful for manual resets)
   */
  updateLastResetTime(): void {
    this.lastResetTime = Date.now();
  }
}

/**
 * Factory function to create DemoSessionManager instance
 */
export function createDemoSessionManager(
  db: DrizzleD1Database,
  config?: Partial<DemoSessionConfig>
): IDemoSessionManager {
  return new DemoSessionManager(db, config);
}

/**
 * Utility function to check if a session should use demo expiration
 */
export function shouldUseDemoExpiration(tenantId: string, email?: string): boolean {
  const isDemoTenant = tenantId === 'demo-tenant';
  const isDemoEmail = email ? 
    ['@gastronomos.com', '@demo-restaurant.com', 'demo@'].some(pattern => 
      email.toLowerCase().includes(pattern.toLowerCase())
    ) : false;

  return isDemoTenant || isDemoEmail;
}

/**
 * Get the appropriate JWT expiration time based on whether it's a demo session
 * Requirements: 8.5 - Configure shorter expiration times for demo sessions
 */
export function getSessionExpiration(
  isDemoSession: boolean,
  regularExpiration: number = 24 * 60 * 60, // 24 hours default
  demoExpiration: number = 2 * 60 * 60      // 2 hours default
): number {
  return isDemoSession ? demoExpiration : regularExpiration;
}
