CREATE INDEX `audit_tenant_user_idx` ON `auth_audit_log` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `audit_tenant_event_type_idx` ON `auth_audit_log` (`tenant_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `audit_tenant_created_at_idx` ON `auth_audit_log` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_user_event_type_idx` ON `auth_audit_log` (`user_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `audit_event_type_created_at_idx` ON `auth_audit_log` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `location_tenant_type_idx` ON `locations` (`tenant_id`,`type`);--> statement-breakpoint
CREATE INDEX `location_tenant_name_idx` ON `locations` (`tenant_id`,`name`);--> statement-breakpoint
CREATE INDEX `location_type_idx` ON `locations` (`type`);--> statement-breakpoint
CREATE INDEX `location_name_idx` ON `locations` (`name`);--> statement-breakpoint
CREATE INDEX `user_tenant_email_idx` ON `users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `user_tenant_role_idx` ON `users` (`tenant_id`,`role`);--> statement-breakpoint
CREATE INDEX `user_tenant_location_idx` ON `users` (`tenant_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `user_updated_at_idx` ON `users` (`updated_at`);