
-- Rollback migration 0004_allocation_tables.sql
DROP INDEX IF EXISTS allocation_audit_performed_at_idx;
DROP INDEX IF EXISTS allocation_audit_performed_by_idx;
DROP INDEX IF EXISTS allocation_audit_action_idx;
DROP INDEX IF EXISTS allocation_audit_tenant_allocation_idx;
DROP INDEX IF EXISTS allocation_audit_allocation_idx;
DROP INDEX IF EXISTS allocation_audit_tenant_idx;
DROP INDEX IF EXISTS allocation_template_created_by_idx;
DROP INDEX IF EXISTS allocation_template_tenant_name_idx;
DROP INDEX IF EXISTS allocation_template_tenant_idx;
DROP INDEX IF EXISTS allocation_created_by_idx;
DROP INDEX IF EXISTS allocation_tenant_location_idx;
DROP INDEX IF EXISTS allocation_tenant_status_idx;
DROP INDEX IF EXISTS allocation_status_idx;
DROP INDEX IF EXISTS allocation_location_idx;
DROP INDEX IF EXISTS allocation_po_item_idx;
DROP INDEX IF EXISTS allocation_tenant_idx;

DROP TABLE IF EXISTS allocation_audit_log;
DROP TABLE IF EXISTS allocation_templates;
DROP TABLE IF EXISTS allocations;
