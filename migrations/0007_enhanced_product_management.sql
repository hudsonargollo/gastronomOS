-- Enhanced Product Management Migration
-- This migration adds advanced product management features including:
-- - Enhanced product fields (barcode, images, status, stock levels, etc.)
-- - Product variants
-- - Product relationships
-- - Product templates
-- - Product audit logging
-- - Product analytics

-- First, let's add new columns to the existing products table
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN image_url TEXT;
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN max_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN reorder_point INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN cost_cents INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN margin_percent REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN weight REAL;
ALTER TABLE products ADD COLUMN dimensions TEXT; -- JSON string
ALTER TABLE products ADD COLUMN allergens TEXT; -- JSON array
ALTER TABLE products ADD COLUMN certifications TEXT; -- JSON array
ALTER TABLE products ADD COLUMN seasonal_availability TEXT; -- JSON object
ALTER TABLE products ADD COLUMN tags TEXT; -- JSON array
ALTER TABLE products ADD COLUMN notes TEXT;
ALTER TABLE products ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE products ADD COLUMN updated_by TEXT REFERENCES users(id);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS product_barcode_idx ON products(barcode);
CREATE INDEX IF NOT EXISTS product_status_idx ON products(status);
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_barcode_unique ON products(tenant_id, barcode) WHERE barcode IS NOT NULL;

-- Add check constraint for status
-- Note: SQLite doesn't support adding check constraints to existing tables,
-- so we'll handle this in the application layer

-- Create product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  attributes TEXT, -- JSON object
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for product variants
CREATE INDEX IF NOT EXISTS product_variant_tenant_idx ON product_variants(tenant_id);
CREATE INDEX IF NOT EXISTS product_variant_product_idx ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS product_variant_sku_idx ON product_variants(sku);
CREATE INDEX IF NOT EXISTS product_variant_barcode_idx ON product_variants(barcode);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_tenant_id_sku_unique ON product_variants(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_tenant_id_barcode_unique ON product_variants(tenant_id, barcode) WHERE barcode IS NOT NULL;

-- Create product relationships table
CREATE TABLE IF NOT EXISTS product_relationships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  strength REAL DEFAULT 1.0,
  notes TEXT,
  created_at INTEGER NOT NULL
);

-- Indexes for product relationships
CREATE INDEX IF NOT EXISTS product_relationship_tenant_idx ON product_relationships(tenant_id);
CREATE INDEX IF NOT EXISTS product_relationship_product_idx ON product_relationships(product_id);
CREATE INDEX IF NOT EXISTS product_relationship_related_product_idx ON product_relationships(related_product_id);
CREATE INDEX IF NOT EXISTS product_relationship_type_idx ON product_relationships(relationship_type);
CREATE UNIQUE INDEX IF NOT EXISTS product_relationships_product_id_related_product_id_type_unique ON product_relationships(product_id, related_product_id, relationship_type);

-- Create product templates table
CREATE TABLE IF NOT EXISTS product_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES categories(id),
  template_data TEXT NOT NULL, -- JSON object
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for product templates
CREATE INDEX IF NOT EXISTS product_template_tenant_idx ON product_templates(tenant_id);
CREATE INDEX IF NOT EXISTS product_template_tenant_name_idx ON product_templates(tenant_id, name);
CREATE INDEX IF NOT EXISTS product_template_category_idx ON product_templates(category_id);
CREATE INDEX IF NOT EXISTS product_template_created_by_idx ON product_templates(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS product_templates_tenant_id_name_unique ON product_templates(tenant_id, name);

-- Create product audit log table
CREATE TABLE IF NOT EXISTS product_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  performed_by TEXT NOT NULL REFERENCES users(id),
  performed_at INTEGER NOT NULL,
  notes TEXT,
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for product audit log
CREATE INDEX IF NOT EXISTS product_audit_tenant_idx ON product_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS product_audit_product_idx ON product_audit_log(product_id);
CREATE INDEX IF NOT EXISTS product_audit_tenant_product_idx ON product_audit_log(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS product_audit_action_idx ON product_audit_log(action);
CREATE INDEX IF NOT EXISTS product_audit_performed_by_idx ON product_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS product_audit_performed_at_idx ON product_audit_log(performed_at);

-- Create product analytics table
CREATE TABLE IF NOT EXISTS product_analytics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  date_bucket TEXT NOT NULL, -- YYYY-MM-DD format
  total_ordered INTEGER DEFAULT 0,
  total_received INTEGER DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  avg_unit_cost_cents INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  supplier_count INTEGER DEFAULT 0,
  location_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for product analytics
CREATE INDEX IF NOT EXISTS product_analytics_tenant_idx ON product_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS product_analytics_product_idx ON product_analytics(product_id);
CREATE INDEX IF NOT EXISTS product_analytics_date_bucket_idx ON product_analytics(date_bucket);
CREATE INDEX IF NOT EXISTS product_analytics_tenant_date_idx ON product_analytics(tenant_id, date_bucket);
CREATE INDEX IF NOT EXISTS product_analytics_product_date_idx ON product_analytics(product_id, date_bucket);
CREATE UNIQUE INDEX IF NOT EXISTS product_analytics_tenant_id_product_id_date_bucket_unique ON product_analytics(tenant_id, product_id, date_bucket);

-- Update existing products to have default values for new fields
UPDATE products SET 
  status = 'ACTIVE',
  min_stock = 0,
  max_stock = 0,
  reorder_point = 0,
  cost_cents = 0,
  margin_percent = 0
WHERE status IS NULL;

-- Create a view for product inventory summary
CREATE VIEW IF NOT EXISTS product_inventory_summary AS
SELECT 
  p.id,
  p.tenant_id,
  p.name,
  p.sku,
  p.status,
  p.min_stock,
  p.max_stock,
  p.reorder_point,
  p.price,
  p.cost_cents,
  p.margin_percent,
  COALESCE(SUM(ii.quantity), 0) as total_stock,
  COUNT(DISTINCT ii.location_id) as location_count,
  CASE 
    WHEN COALESCE(SUM(ii.quantity), 0) <= p.reorder_point THEN 'LOW_STOCK'
    WHEN COALESCE(SUM(ii.quantity), 0) = 0 THEN 'OUT_OF_STOCK'
    ELSE 'IN_STOCK'
  END as stock_status
FROM products p
LEFT JOIN inventory_items ii ON p.id = ii.product_id
WHERE p.active = 1
GROUP BY p.id, p.tenant_id, p.name, p.sku, p.status, p.min_stock, p.max_stock, p.reorder_point, p.price, p.cost_cents, p.margin_percent;

-- Insert some sample data for testing (optional)
-- This would be handled by the application in production

PRAGMA foreign_keys = ON;