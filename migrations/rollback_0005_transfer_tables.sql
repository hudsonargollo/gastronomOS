-- Rollback migration for transfer tables
-- This file can be used to rollback the transfer system tables if needed

-- Drop indexes first
DROP INDEX IF EXISTS `transfer_allocations_transfer_id_allocation_id_unique`;
DROP INDEX IF EXISTS `inventory_reservations_product_id_location_id_transfer_id_unique`;
DROP INDEX IF EXISTS `transfer_allocations_allocation_idx`;
DROP INDEX IF EXISTS `transfer_allocations_transfer_idx`;
DROP INDEX IF EXISTS `transfer_allocations_tenant_idx`;
DROP INDEX IF EXISTS `inventory_reservations_expires_at_idx`;
DROP INDEX IF EXISTS `inventory_reservations_active_idx`;
DROP INDEX IF EXISTS `inventory_reservations_location_product_idx`;
DROP INDEX IF EXISTS `inventory_reservations_transfer_idx`;
DROP INDEX IF EXISTS `inventory_reservations_tenant_idx`;
DROP INDEX IF EXISTS `transfer_audit_performed_at_idx`;
DROP INDEX IF EXISTS `transfer_audit_performed_by_idx`;
DROP INDEX IF EXISTS `transfer_audit_action_idx`;
DROP INDEX IF EXISTS `transfer_audit_tenant_transfer_idx`;
DROP INDEX IF EXISTS `transfer_audit_transfer_idx`;
DROP INDEX IF EXISTS `transfer_audit_tenant_idx`;
DROP INDEX IF EXISTS `transfers_created_at_idx`;
DROP INDEX IF EXISTS `transfers_priority_idx`;
DROP INDEX IF EXISTS `transfers_status_idx`;
DROP INDEX IF EXISTS `transfers_requested_by_idx`;
DROP INDEX IF EXISTS `transfers_product_idx`;
DROP INDEX IF EXISTS `transfers_destination_location_idx`;
DROP INDEX IF EXISTS `transfers_source_location_idx`;
DROP INDEX IF EXISTS `transfers_tenant_status_idx`;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS `transfer_allocations`;
DROP TABLE IF EXISTS `inventory_reservations`;
DROP TABLE IF EXISTS `transfer_audit_log`;
DROP TABLE IF EXISTS `transfers`;