CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`product_id` text NOT NULL,
	`source_location_id` text NOT NULL,
	`destination_location_id` text NOT NULL,
	`quantity_requested` integer NOT NULL,
	`quantity_shipped` integer DEFAULT 0,
	`quantity_received` integer DEFAULT 0,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`requested_by` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`shipped_by` text,
	`shipped_at` integer,
	`received_by` text,
	`received_at` integer,
	`cancelled_by` text,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`variance_reason` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`destination_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shipped_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK(`source_location_id` != `destination_location_id`),
	CHECK(`quantity_requested` > 0),
	CHECK(`quantity_shipped` >= 0),
	CHECK(`quantity_received` >= 0),
	CHECK(`status` IN ('REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED')),
	CHECK(`priority` IN ('NORMAL', 'HIGH', 'EMERGENCY'))
);
--> statement-breakpoint
CREATE TABLE `transfer_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`transfer_id` text NOT NULL,
	`action` text NOT NULL,
	`old_status` text,
	`new_status` text,
	`old_values` text,
	`new_values` text,
	`performed_by` text NOT NULL,
	`performed_at` integer NOT NULL,
	`notes` text,
	`ip_address` text,
	`user_agent` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transfer_id`) REFERENCES `transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK(`action` IN ('CREATED', 'APPROVED', 'REJECTED', 'SHIPPED', 'RECEIVED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`transfer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`location_id` text NOT NULL,
	`quantity_reserved` integer NOT NULL,
	`reserved_by` text NOT NULL,
	`reserved_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`released_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transfer_id`) REFERENCES `transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reserved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK(`quantity_reserved` > 0)
);
--> statement-breakpoint
CREATE TABLE `transfer_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`transfer_id` text NOT NULL,
	`allocation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transfer_id`) REFERENCES `transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`allocation_id`) REFERENCES `allocations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transfers_tenant_status_idx` ON `transfers` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `transfers_source_location_idx` ON `transfers` (`source_location_id`,`status`);--> statement-breakpoint
CREATE INDEX `transfers_destination_location_idx` ON `transfers` (`destination_location_id`,`status`);--> statement-breakpoint
CREATE INDEX `transfers_product_idx` ON `transfers` (`product_id`,`status`);--> statement-breakpoint
CREATE INDEX `transfers_requested_by_idx` ON `transfers` (`requested_by`);--> statement-breakpoint
CREATE INDEX `transfers_status_idx` ON `transfers` (`status`);--> statement-breakpoint
CREATE INDEX `transfers_priority_idx` ON `transfers` (`priority`);--> statement-breakpoint
CREATE INDEX `transfers_created_at_idx` ON `transfers` (`created_at`);--> statement-breakpoint
CREATE INDEX `transfer_audit_tenant_idx` ON `transfer_audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `transfer_audit_transfer_idx` ON `transfer_audit_log` (`transfer_id`);--> statement-breakpoint
CREATE INDEX `transfer_audit_tenant_transfer_idx` ON `transfer_audit_log` (`tenant_id`,`transfer_id`);--> statement-breakpoint
CREATE INDEX `transfer_audit_action_idx` ON `transfer_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `transfer_audit_performed_by_idx` ON `transfer_audit_log` (`performed_by`);--> statement-breakpoint
CREATE INDEX `transfer_audit_performed_at_idx` ON `transfer_audit_log` (`performed_at`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_tenant_idx` ON `inventory_reservations` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_transfer_idx` ON `inventory_reservations` (`transfer_id`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_location_product_idx` ON `inventory_reservations` (`location_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_active_idx` ON `inventory_reservations` (`location_id`,`product_id`,`released_at`);--> statement-breakpoint
CREATE INDEX `inventory_reservations_expires_at_idx` ON `inventory_reservations` (`expires_at`);--> statement-breakpoint
CREATE INDEX `transfer_allocations_tenant_idx` ON `transfer_allocations` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `transfer_allocations_transfer_idx` ON `transfer_allocations` (`transfer_id`);--> statement-breakpoint
CREATE INDEX `transfer_allocations_allocation_idx` ON `transfer_allocations` (`allocation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_reservations_product_id_location_id_transfer_id_unique` ON `inventory_reservations` (`product_id`,`location_id`,`transfer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_allocations_transfer_id_allocation_id_unique` ON `transfer_allocations` (`transfer_id`,`allocation_id`);