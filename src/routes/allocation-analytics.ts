/**
 * Allocation Analytics API Routes
 * 
 * Provides REST endpoints for allocation analytics and reporting functionality.
 * Implements requirements 3.5 for allocation analytics and reporting.
 */

import { Hono } from 'hono';
import { createAllocationAnalyticsService, AllocationAnalyticsFilters } from '../services/allocation-analytics';
import { 
  authenticate, 
  injectTenantContext, 
  injectAuditService,
  ensureTenantIsolation,
  requireRole,
  getAuthContext,
  getDatabase
} from '../middleware/auth';

const app = new Hono<{ Bindings: { DB: D1Database } }>();

// Apply authentication and tenant context middleware
app.use('*', authenticate());
app.use('*', injectTenantContext());
app.use('*', injectAuditService());
app.use('*', ensureTenantIsolation());

/**
 * GET /efficiency-metrics
 * Get allocation efficiency metrics for the tenant
 * Requirements: 3.5
 */
app.get('/efficiency-metrics', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters for filters
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const locationIds = c.req.query('location_ids');
    const status = c.req.query('status');
    const minValue = c.req.query('min_value');
    const maxValue = c.req.query('max_value');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (locationIds) filters.locationIds = locationIds.split(',');
    if (status) filters.status = status.split(',') as any[];
    if (minValue) filters.minValue = parseFloat(minValue);
    if (maxValue) filters.maxValue = parseFloat(maxValue);

    const metrics = await analyticsService.getEfficiencyMetrics(authContext.tenant_id, filters);

    return c.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting efficiency metrics:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve efficiency metrics'
    }, 500);
  }
});

/**
 * GET /location-patterns
 * Get location allocation patterns analysis
 * Requirements: 3.5
 */
app.get('/location-patterns', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters for filters
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const locationIds = c.req.query('location_ids');
    const productCategories = c.req.query('product_categories');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (locationIds) filters.locationIds = locationIds.split(',');
    if (productCategories) filters.productCategories = productCategories.split(',');

    const patterns = await analyticsService.getLocationPatterns(authContext.tenant_id, filters);

    return c.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    console.error('Error getting location patterns:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve location patterns'
    }, 500);
  }
});

/**
 * GET /variance-report
 * Get allocation variance report
 * Requirements: 3.5
 */
app.get('/variance-report', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters
    const poId = c.req.query('po_id');
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const supplierIds = c.req.query('supplier_ids');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (supplierIds) filters.supplierIds = supplierIds.split(',');

    const report = await analyticsService.getVarianceReport(authContext.tenant_id, poId, filters);

    return c.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error getting variance report:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve variance report'
    }, 500);
  }
});

/**
 * GET /trend-data
 * Get allocation trend data over time
 * Requirements: 3.5
 */
app.get('/trend-data', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters
    const period = c.req.query('period') as 'daily' | 'weekly' | 'monthly' || 'monthly';
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const locationIds = c.req.query('location_ids');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (locationIds) filters.locationIds = locationIds.split(',');

    const trendData = await analyticsService.getTrendData(authContext.tenant_id, period, filters);

    return c.json({
      success: true,
      data: trendData
    });
  } catch (error) {
    console.error('Error getting trend data:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve trend data'
    }, 500);
  }
});

/**
 * GET /top-performing-locations
 * Get top performing locations by efficiency
 * Requirements: 3.5
 */
app.get('/top-performing-locations', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters
    const limit = parseInt(c.req.query('limit') || '10');
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    const topLocations = await analyticsService.getTopPerformingLocations(
      authContext.tenant_id, 
      limit, 
      filters
    );

    return c.json({
      success: true,
      data: topLocations
    });
  } catch (error) {
    console.error('Error getting top performing locations:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve top performing locations'
    }, 500);
  }
});

/**
 * GET /distribution-analysis
 * Get allocation distribution analysis
 * Requirements: 3.5
 */
app.get('/distribution-analysis', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters for filters
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const locationIds = c.req.query('location_ids');
    const productCategories = c.req.query('product_categories');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);
    if (locationIds) filters.locationIds = locationIds.split(',');
    if (productCategories) filters.productCategories = productCategories.split(',');

    const analysis = await analyticsService.getAllocationDistributionAnalysis(
      authContext.tenant_id, 
      filters
    );

    return c.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error getting distribution analysis:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve distribution analysis'
    }, 500);
  }
});

/**
 * GET /dashboard-summary
 * Get comprehensive dashboard summary for allocation analytics
 * Requirements: 3.5
 */
app.get('/dashboard-summary', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const analyticsService = createAllocationAnalyticsService(db);

    // Parse query parameters for filters
    const filters: AllocationAnalyticsFilters = {};
    
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    // Get multiple analytics in parallel for dashboard
    const [
      efficiencyMetrics,
      topLocations,
      distributionAnalysis,
      trendData
    ] = await Promise.all([
      analyticsService.getEfficiencyMetrics(authContext.tenant_id, filters),
      analyticsService.getTopPerformingLocations(authContext.tenant_id, 5, filters),
      analyticsService.getAllocationDistributionAnalysis(authContext.tenant_id, filters),
      analyticsService.getTrendData(authContext.tenant_id, 'monthly', filters)
    ]);

    return c.json({
      success: true,
      data: {
        efficiencyMetrics,
        topLocations,
        distributionAnalysis,
        trendData: trendData.slice(-6) // Last 6 months
      }
    });
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve dashboard summary'
    }, 500);
  }
});

export default app;