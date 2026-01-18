-- Migration: Complete Infrastructure Setup (Fixed)
-- Add missing fields to users table (only if they don't exist)
-- Note: SQLite doesn't have IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We'll handle this with error handling in the application

-- Add missing fields to locations table
-- ALTER TABLE locations ADD COLUMN manager_id TEXT REFERENCES users(id);
-- ALTER TABLE locations ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE locations ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Create categories table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS categories (
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

-- Create indexes for categories (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS category_tenant_idx ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS category_tenant_name_idx ON categories(tenant_id, name);
CREATE INDEX IF NOT EXISTS category_parent_idx ON categories(parent_id);
CREATE INDEX IF NOT EXISTS category_sort_order_idx ON categories(sort_order);
CREATE INDEX IF NOT EXISTS category_active_idx ON categories(active);
CREATE UNIQUE INDEX IF NOT EXISTS categories_tenant_id_name_unique ON categories(tenant_id, name);

-- Create new indexes for products (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS product_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS product_active_idx ON products(active);
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_sku_unique ON products(tenant_id, sku);

-- Create inventory_items table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS inventory_items (
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

-- Create indexes for inventory_items (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS inventory_item_tenant_idx ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS inventory_item_product_idx ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS inventory_item_location_idx ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS inventory_item_tenant_location_idx ON inventory_items(tenant_id, location_id);
CREATE INDEX IF NOT EXISTS inventory_item_tenant_product_idx ON inventory_items(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS inventory_item_location_product_idx ON inventory_items(location_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_product_id_location_id_unique ON inventory_items(product_id, location_id);

-- Create additional indexes for users (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS user_active_idx ON users(active);
CREATE INDEX IF NOT EXISTS user_last_login_idx ON users(last_login_at);

-- Create additional indexes for locations (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS location_manager_idx ON locations(manager_id);
CREATE INDEX IF NOT EXISTS location_active_idx ON locations(active);
CREATE INDEX IF NOT EXISTS location_updated_at_idx ON locations(updated_at);