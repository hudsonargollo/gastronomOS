import { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';

/**
 * API Versioning Service
 * Requirements: 9.6
 */

export interface VersionConfig {
  version: string;
  deprecated?: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  supportedUntil?: Date;
  changelog?: string[];
  breakingChanges?: string[];
}

export interface ApiVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export interface VersionedResponse<T = any> {
  data: T;
  version: string;
  apiVersion: string;
  deprecationWarning?: string;
  upgradeRecommendation?: string;
}

/**
 * Version validation schema
 */
export const versionSchema = z.object({
  version: z.string().regex(/^v?\d+(\.\d+)?(\.\d+)?(-[a-zA-Z0-9-]+)?$/, 'Invalid version format'),
});

/**
 * API Version configurations
 */
export const API_VERSIONS: Record<string, VersionConfig> = {
  'v1': {
    version: '1.0.0',
    deprecated: false,
    changelog: [
      'Initial API release',
      'Basic CRUD operations',
      'Authentication and authorization',
    ],
  },
  'v1.1': {
    version: '1.1.0',
    deprecated: false,
    changelog: [
      'Added bulk operations',
      'Enhanced filtering and pagination',
      'Improved error handling',
    ],
  },
  'v1.2': {
    version: '1.2.0',
    deprecated: false,
    changelog: [
      'Added data export functionality',
      'Enhanced audit logging',
      'Performance improvements',
    ],
  },
  'v2': {
    version: '2.0.0',
    deprecated: false,
    breakingChanges: [
      'Changed response format structure',
      'Updated authentication mechanism',
      'Removed deprecated endpoints',
    ],
    changelog: [
      'Major API redesign',
      'Improved performance',
      'Better error handling',
      'Enhanced security',
    ],
  },
};

/**
 * Default version if none specified
 */
export const DEFAULT_API_VERSION = 'v1';

/**
 * Supported version formats
 */
export const SUPPORTED_VERSION_HEADERS = [
  'API-Version',
  'X-API-Version',
  'Accept-Version',
];

/**
 * API Versioning Service
 */
export class ApiVersioningService {
  /**
   * Parse version string into components
   */
  static parseVersion(versionString: string): ApiVersion {
    // Remove 'v' prefix if present
    const cleanVersion = versionString.replace(/^v/, '');
    
    // Split version parts
    const parts = cleanVersion.split('-');
    const versionParts = parts[0].split('.');
    const prerelease = parts[1];

    return {
      major: parseInt(versionParts[0] || '1', 10),
      minor: parseInt(versionParts[1] || '0', 10),
      patch: parseInt(versionParts[2] || '0', 10),
      prerelease,
    };
  }

  /**
   * Compare two versions
   */
  static compareVersions(version1: string, version2: string): number {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    // Compare major version
    if (v1.major !== v2.major) {
      return v1.major - v2.major;
    }

    // Compare minor version
    if (v1.minor !== v2.minor) {
      return v1.minor - v2.minor;
    }

    // Compare patch version
    if (v1.patch !== v2.patch) {
      return v1.patch - v2.patch;
    }

    // Compare prerelease
    if (v1.prerelease && !v2.prerelease) return -1;
    if (!v1.prerelease && v2.prerelease) return 1;
    if (v1.prerelease && v2.prerelease) {
      return v1.prerelease.localeCompare(v2.prerelease);
    }

    return 0;
  }

  /**
   * Check if version is supported
   */
  static isSupportedVersion(version: string): boolean {
    return Object.keys(API_VERSIONS).includes(version);
  }

  /**
   * Get latest version
   */
  static getLatestVersion(): string {
    const versions = Object.keys(API_VERSIONS);
    return versions.sort((a, b) => this.compareVersions(b, a))[0];
  }

  /**
   * Get version configuration
   */
  static getVersionConfig(version: string): VersionConfig | null {
    return API_VERSIONS[version] || null;
  }

  /**
   * Check if version is deprecated
   */
  static isVersionDeprecated(version: string): boolean {
    const config = this.getVersionConfig(version);
    return config?.deprecated || false;
  }

  /**
   * Get deprecation warning message
   */
  static getDeprecationWarning(version: string): string | null {
    const config = this.getVersionConfig(version);
    
    if (!config?.deprecated) {
      return null;
    }

    let warning = `API version ${version} is deprecated.`;
    
    if (config.sunsetDate) {
      warning += ` It will be discontinued on ${config.sunsetDate.toDateString()}.`;
    }
    
    warning += ` Please upgrade to the latest version: ${this.getLatestVersion()}.`;
    
    return warning;
  }

  /**
   * Create versioned response wrapper
   */
  static createVersionedResponse<T>(
    data: T,
    version: string,
    apiVersion: string
  ): VersionedResponse<T> {
    const response: VersionedResponse<T> = {
      data,
      version: apiVersion,
      apiVersion: version,
    };

    // Add deprecation warning if applicable
    const deprecationWarning = this.getDeprecationWarning(version);
    if (deprecationWarning) {
      response.deprecationWarning = deprecationWarning;
      response.upgradeRecommendation = `Please upgrade to ${this.getLatestVersion()}`;
    }

    return response;
  }

  /**
   * Transform data based on version compatibility
   */
  static transformForVersion<T>(data: T, fromVersion: string, toVersion: string): T {
    // This is where you would implement version-specific transformations
    // For now, we'll return the data as-is
    // In a real implementation, you would have transformation rules
    
    if (fromVersion === toVersion) {
      return data;
    }

    // Example transformation logic (implement based on your needs)
    if (toVersion === 'v1' && fromVersion === 'v2') {
      // Transform v2 response to v1 format
      return this.transformV2ToV1(data);
    }

    if (toVersion === 'v2' && fromVersion === 'v1') {
      // Transform v1 response to v2 format
      return this.transformV1ToV2(data);
    }

    return data;
  }

  /**
   * Transform v2 response to v1 format
   */
  private static transformV2ToV1<T>(data: T): T {
    // Implement v2 to v1 transformation logic
    // This is a placeholder - implement based on your API changes
    return data;
  }

  /**
   * Transform v1 response to v2 format
   */
  private static transformV1ToV2<T>(data: T): T {
    // Implement v1 to v2 transformation logic
    // This is a placeholder - implement based on your API changes
    return data;
  }
}

/**
 * Version detection middleware
 */
export function versionDetectionMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    let requestedVersion = DEFAULT_API_VERSION;

    // Check URL path for version (e.g., /api/v1/users)
    const pathMatch = c.req.path.match(/\/api\/(v\d+(?:\.\d+)?)/);
    if (pathMatch) {
      requestedVersion = pathMatch[1];
    }

    // Check headers for version override
    for (const header of SUPPORTED_VERSION_HEADERS) {
      const headerVersion = c.req.header(header);
      if (headerVersion) {
        requestedVersion = headerVersion;
        break;
      }
    }

    // Validate version format
    try {
      versionSchema.parse({ version: requestedVersion });
    } catch (error) {
      return c.json({
        error: 'Invalid API Version',
        message: `Invalid version format: ${requestedVersion}`,
        supportedVersions: Object.keys(API_VERSIONS),
      }, 400);
    }

    // Check if version is supported
    if (!ApiVersioningService.isSupportedVersion(requestedVersion)) {
      return c.json({
        error: 'Unsupported API Version',
        message: `API version ${requestedVersion} is not supported`,
        supportedVersions: Object.keys(API_VERSIONS),
        latestVersion: ApiVersioningService.getLatestVersion(),
      }, 400);
    }

    // Store version in context
    c.set('apiVersion', requestedVersion);
    c.set('versionConfig', ApiVersioningService.getVersionConfig(requestedVersion));

    // Add version headers to response
    await next();
    
    c.header('API-Version', requestedVersion);
    c.header('X-API-Version', requestedVersion);
    c.header('X-Supported-Versions', Object.keys(API_VERSIONS).join(', '));
    c.header('X-Latest-Version', ApiVersioningService.getLatestVersion());

    // Add deprecation headers if applicable
    if (ApiVersioningService.isVersionDeprecated(requestedVersion)) {
      c.header('Deprecation', 'true');
      c.header('Sunset', ApiVersioningService.getVersionConfig(requestedVersion)?.sunsetDate?.toISOString() || '');
      c.header('Link', `</api/${ApiVersioningService.getLatestVersion()}>; rel="successor-version"`);
    }
  };
}

/**
 * Version compatibility middleware
 */
export function versionCompatibilityMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const requestedVersion = c.get('apiVersion') || DEFAULT_API_VERSION;
    const versionConfig = c.get('versionConfig');

    // Check if version is sunset
    if (versionConfig?.sunsetDate && new Date() > versionConfig.sunsetDate) {
      return c.json({
        error: 'API Version Sunset',
        message: `API version ${requestedVersion} has been discontinued`,
        sunsetDate: versionConfig.sunsetDate.toISOString(),
        upgradeRequired: true,
        latestVersion: ApiVersioningService.getLatestVersion(),
      }, 410); // Gone
    }

    await next();
  };
}

/**
 * Response transformation middleware
 */
export function responseTransformationMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const requestedVersion = c.get('apiVersion') || DEFAULT_API_VERSION;
    
    await next();

    // Only transform successful responses
    if (c.res.status >= 200 && c.res.status < 300) {
      try {
        const originalResponse = await c.res.json();
        
        // Create versioned response
        const versionedResponse = ApiVersioningService.createVersionedResponse(
          originalResponse,
          requestedVersion,
          API_VERSIONS[requestedVersion]?.version || '1.0.0'
        );

        // Replace response
        c.res = new Response(JSON.stringify(versionedResponse), {
          status: c.res.status,
          headers: c.res.headers,
        });
      } catch (error) {
        // If response is not JSON, leave it as-is
        console.warn('Could not transform non-JSON response for versioning');
      }
    }
  };
}

/**
 * Version utilities
 */
export const versionUtils = {
  /**
   * Get version from context
   */
  getVersionFromContext(c: Context): string {
    return c.get('apiVersion') || DEFAULT_API_VERSION;
  },

  /**
   * Get version config from context
   */
  getVersionConfigFromContext(c: Context): VersionConfig | null {
    return c.get('versionConfig') || null;
  },

  /**
   * Check if request is using deprecated version
   */
  isUsingDeprecatedVersion(c: Context): boolean {
    const version = this.getVersionFromContext(c);
    return ApiVersioningService.isVersionDeprecated(version);
  },

  /**
   * Generate version changelog
   */
  generateChangelog(): Record<string, VersionConfig> {
    return API_VERSIONS;
  },

  /**
   * Validate version compatibility for breaking changes
   */
  validateBreakingChanges(fromVersion: string, toVersion: string): {
    hasBreakingChanges: boolean;
    changes: string[];
  } {
    const toConfig = ApiVersioningService.getVersionConfig(toVersion);
    const fromParsed = ApiVersioningService.parseVersion(fromVersion);
    const toParsed = ApiVersioningService.parseVersion(toVersion);

    // Breaking changes occur when major version changes
    const hasBreakingChanges = fromParsed.major !== toParsed.major;
    const changes = toConfig?.breakingChanges || [];

    return {
      hasBreakingChanges,
      changes,
    };
  },
};