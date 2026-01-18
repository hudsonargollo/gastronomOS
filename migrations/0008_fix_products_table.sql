-- Migration: Fix Products Table Structure
-- Add missing columns to products table

-- Add category_id column
ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories(id);

-- Add price column (renamed from price_cents for consistency)
ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;

-- Add SKU column
ALTER TABLE products ADD COLUMN sku TEXT;

-- Add barcode column
ALTER TABLE products ADD COLUMN barcode TEXT;

-- Add image URL column
ALTER TABLE products ADD COLUMN image_url TEXT;

-- Add status column
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add stock management columns
ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN max_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN reorder_point INTEGER DEFAULT 0;

-- Add cost and margin columns
ALTER TABLE products ADD COLUMN cost_cents INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN margin_percent REAL DEFAULT 0;

-- Add physical properties
ALTER TABLE products ADD COLUMN weight REAL;
ALTER TABLE products ADD COLUMN dimensions TEXT;

-- Add tags column
ALTER TABLE products ADD COLUMN tags TEXT;

-- Add active column
ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Add created_by and updated_by columns
ALTER TABLE products ADD COLUMN created_by TEXT;
ALTER TABLE products ADD COLUMN updated_by TEXT;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS product_category_id_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS product_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS product_barcode_idx ON products(barcode);
CREATE INDEX IF NOT EXISTS product_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS product_active_idx ON products(active);
CREATE INDEX IF NOT EXISTS product_tenant_status_idx ON products(tenant_id, status);
CREATE INDEX IF NOT EXISTS product_tenant_active_idx ON products(tenant_id, active);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_sku_unique ON products(tenant_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_barcode_unique ON products(tenant_id, barcode) WHERE barcode IS NOT NULL;