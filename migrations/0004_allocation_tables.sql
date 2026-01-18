CREATE TABLE `allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`po_item_id` text NOT NULL,
	`target_location_id` text NOT NULL,
	`quantity_allocated` integer NOT NULL,
	`quantity_received` integer DEFAULT 0,
	`status` text NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_item_id`) REFERENCES `po_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `allocation_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`template_data` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `allocation_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`allocation_id` text NOT NULL,
	`action` text NOT NULL,
	`old_values` text,
	`new_values` text,
	`performed_by` text NOT NULL,
	`performed_at` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`allocation_id`) REFERENCES `allocations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `allocation_tenant_idx` ON `allocations` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `allocation_po_item_idx` ON `allocations` (`po_item_id`);--> statement-breakpoint
CREATE INDEX `allocation_location_idx` ON `allocations` (`target_location_id`);--> statement-breakpoint
CREATE INDEX `allocation_status_idx` ON `allocations` (`status`);--> statement-breakpoint
CREATE INDEX `allocation_tenant_status_idx` ON `allocations` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `allocation_tenant_location_idx` ON `allocations` (`tenant_id`,`target_location_id`);--> statement-breakpoint
CREATE INDEX `allocation_created_by_idx` ON `allocations` (`created_by`);--> statement-breakpoint
CREATE INDEX `allocation_template_tenant_idx` ON `allocation_templates` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `allocation_template_tenant_name_idx` ON `allocation_templates` (`tenant_id`,`name`);--> statement-breakpoint
CREATE INDEX `allocation_template_created_by_idx` ON `allocation_templates` (`created_by`);--> statement-breakpoint
CREATE INDEX `allocation_audit_tenant_idx` ON `allocation_audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `allocation_audit_allocation_idx` ON `allocation_audit_log` (`allocation_id`);--> statement-breakpoint
CREATE INDEX `allocation_audit_tenant_allocation_idx` ON `allocation_audit_log` (`tenant_id`,`allocation_id`);--> statement-breakpoint
CREATE INDEX `allocation_audit_action_idx` ON `allocation_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `allocation_audit_performed_by_idx` ON `allocation_audit_log` (`performed_by`);--> statement-breakpoint
CREATE INDEX `allocation_audit_performed_at_idx` ON `allocation_audit_log` (`performed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `allocations_po_item_id_target_location_id_unique` ON `allocations` (`po_item_id`,`target_location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `allocation_templates_tenant_id_name_unique` ON `allocation_templates` (`tenant_id`,`name`);