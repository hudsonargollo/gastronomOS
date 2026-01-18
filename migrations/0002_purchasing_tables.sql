CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`unit` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_email` text,
	`contact_phone` text,
	`address` text,
	`payment_terms` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`po_number` text,
	`status` text NOT NULL,
	`total_cost_cents` integer,
	`created_by` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`received_by` text,
	`received_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `po_items` (
	`id` text PRIMARY KEY NOT NULL,
	`po_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity_received` integer DEFAULT 0,
	`line_total_cents` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`product_id` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`po_id` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `po_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`po_id` text NOT NULL,
	`action` text NOT NULL,
	`old_values` text,
	`new_values` text,
	`performed_by` text NOT NULL,
	`performed_at` integer NOT NULL,
	`notes` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_tenant_idx` ON `products` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `product_tenant_name_idx` ON `products` (`tenant_id`,`name`);--> statement-breakpoint
CREATE INDEX `product_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `supplier_tenant_idx` ON `suppliers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `supplier_tenant_name_idx` ON `suppliers` (`tenant_id`,`name`);--> statement-breakpoint
CREATE INDEX `po_tenant_idx` ON `purchase_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `po_tenant_status_idx` ON `purchase_orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `po_tenant_supplier_idx` ON `purchase_orders` (`tenant_id`,`supplier_id`);--> statement-breakpoint
CREATE INDEX `po_status_idx` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `po_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `po_created_by_idx` ON `purchase_orders` (`created_by`);--> statement-breakpoint
CREATE INDEX `po_approved_at_idx` ON `purchase_orders` (`approved_at`);--> statement-breakpoint
CREATE INDEX `po_item_po_idx` ON `po_items` (`po_id`);--> statement-breakpoint
CREATE INDEX `po_item_product_idx` ON `po_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `po_item_po_product_idx` ON `po_items` (`po_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `price_history_lookup_idx` ON `price_history` (`tenant_id`,`supplier_id`,`product_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `price_history_tenant_idx` ON `price_history` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `price_history_supplier_product_idx` ON `price_history` (`supplier_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `price_history_recorded_at_idx` ON `price_history` (`recorded_at`);--> statement-breakpoint
CREATE INDEX `po_audit_tenant_idx` ON `po_audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `po_audit_tenant_po_idx` ON `po_audit_log` (`tenant_id`,`po_id`);--> statement-breakpoint
CREATE INDEX `po_audit_po_idx` ON `po_audit_log` (`po_id`);--> statement-breakpoint
CREATE INDEX `po_audit_action_idx` ON `po_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `po_audit_performed_by_idx` ON `po_audit_log` (`performed_by`);--> statement-breakpoint
CREATE INDEX `po_audit_performed_at_idx` ON `po_audit_log` (`performed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_tenant_id_name_unique` ON `suppliers` (`tenant_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_tenant_id_po_number_unique` ON `purchase_orders` (`tenant_id`,`po_number`);