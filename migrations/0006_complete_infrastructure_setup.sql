-- Migration: Complete Infrastructure Setup
-- Add missing fields to users table
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at INTEGER;

-- Add missing fields to locations table
ALTER TABLE locations ADD COLUMN manager_id TEXT REFERENCES users(id);
ALTER TABLE locations ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE locations ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Add location type constraint
-- Note: SQLite doesn't support adding constraints to existing tables
-- This would need to be handled in application logic

-- Create categories table
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create indexes for categories
CREATE INDEX category_tenant_idx ON categories(tenant_id);
CREATE INDEX category_tenant_name_idx ON categories(tenant_id, name);
CREATE INDEX category_parent_idx ON categories(parent_id);
CREATE INDEX category_sort_order_idx ON categories(sort_order);
CREATE INDEX category_active_idx ON categories(active);
CREATE UNIQUE INDEX categories_tenant_id_name_unique ON categories(tenant_id, name);

-- Update products table structure
-- Add new columns
ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Create new indexes for products
CREATE INDEX product_category_idx ON products(category_id);
CREATE INDEX product_sku_idx ON products(sku);
CREATE INDEX product_active_idx ON products(active);
CREATE UNIQUE INDEX products_tenant_id_sku_unique ON products(tenant_id, sku);

-- Create inventory_items table
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (quantity >= 0),
  CHECK (unit_cost_cents >= 0)
);

-- Create indexes for inventory_items
CREATE INDEX inventory_item_tenant_idx ON inventory_items(tenant_id);
CREATE INDEX inventory_item_product_idx ON inventory_items(product_id);
CREATE INDEX inventory_item_location_idx ON inventory_items(location_id);
CREATE INDEX inventory_item_tenant_location_idx ON inventory_items(tenant_id, location_id);
CREATE INDEX inventory_item_tenant_product_idx ON inventory_items(tenant_id, product_id);
CREATE INDEX inventory_item_location_product_idx ON inventory_items(location_id, product_id);
CREATE UNIQUE INDEX inventory_items_product_id_location_id_unique ON inventory_items(product_id, location_id);

-- Create additional indexes for users
CREATE INDEX user_active_idx ON users(active);
CREATE INDEX user_last_login_idx ON users(last_login_at);

-- Create additional indexes for locations
CREATE INDEX location_manager_idx ON locations(manager_id);
CREATE INDEX location_active_idx ON locations(active);
CREATE INDEX location_updated_at_idx ON locations(updated_at);

-- Update existing data to set default values for new columns
UPDATE users SET first_name = 'Unknown', last_name = 'User' WHERE first_name = '' OR last_name = '';
UPDATE locations SET updated_at = created_at WHERE updated_at = 0;