CREATE TABLE `auth_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`user_id` text,
	`event_type` text NOT NULL,
	`resource` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`address` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`settings` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`location_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_idx` ON `auth_audit_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `auth_audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_event_type_idx` ON `auth_audit_log` (`event_type`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `auth_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `location_tenant_idx` ON `locations` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `user_tenant_idx` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_location_idx` ON `users` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_tenant_id_email_unique` ON `users` (`tenant_id`,`email`);