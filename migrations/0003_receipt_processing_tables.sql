-- Receipt processing jobs table
CREATE TABLE `receipt_processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`status` text NOT NULL,
	`processing_options` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`retry_count` integer DEFAULT 0,
	`error_message` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Processed receipt data table
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`processing_job_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`vendor_name` text,
	`transaction_date` integer,
	`total_amount_cents` integer,
	`subtotal_cents` integer,
	`tax_cents` integer,
	`currency` text DEFAULT 'USD',
	`confidence_score` real,
	`requires_manual_review` integer DEFAULT false,
	`linked_po_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processing_job_id`) REFERENCES `receipt_processing_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Receipt line items table
CREATE TABLE `receipt_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real,
	`unit_price_cents` integer,
	`total_price_cents` integer,
	`matched_product_id` text,
	`match_confidence` real,
	`requires_manual_review` integer DEFAULT false,
	`raw_text` text,
	`coordinates` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`matched_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Product matching results for manual review
CREATE TABLE `product_match_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_line_item_id` text NOT NULL,
	`product_id` text NOT NULL,
	`similarity_score` real NOT NULL,
	`match_type` text NOT NULL,
	`confidence` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`receipt_line_item_id`) REFERENCES `receipt_line_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Receipt processing statistics table
CREATE TABLE `receipt_processing_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`date_bucket` text NOT NULL,
	`total_processed` integer DEFAULT 0,
	`successful_processed` integer DEFAULT 0,
	`failed_processed` integer DEFAULT 0,
	`manual_review_required` integer DEFAULT 0,
	`avg_processing_time_ms` integer DEFAULT 0,
	`avg_confidence_score` real DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Indexes for receipt processing jobs
CREATE INDEX `receipt_jobs_tenant_status_idx` ON `receipt_processing_jobs` (`tenant_id`,`status`);
--> statement-breakpoint
CREATE INDEX `receipt_jobs_user_idx` ON `receipt_processing_jobs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `receipt_jobs_status_idx` ON `receipt_processing_jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `receipt_jobs_created_at_idx` ON `receipt_processing_jobs` (`created_at`);
--> statement-breakpoint

-- Indexes for receipts
CREATE INDEX `receipts_tenant_date_idx` ON `receipts` (`tenant_id`,`transaction_date`);
--> statement-breakpoint
CREATE INDEX `receipts_job_idx` ON `receipts` (`processing_job_id`);
--> statement-breakpoint
CREATE INDEX `receipts_tenant_vendor_idx` ON `receipts` (`tenant_id`,`vendor_name`);
--> statement-breakpoint
CREATE INDEX `receipts_linked_po_idx` ON `receipts` (`linked_po_id`);
--> statement-breakpoint
CREATE INDEX `receipts_review_idx` ON `receipts` (`requires_manual_review`);
--> statement-breakpoint

-- Indexes for receipt line items
CREATE INDEX `receipt_line_items_receipt_idx` ON `receipt_line_items` (`receipt_id`);
--> statement-breakpoint
CREATE INDEX `receipt_line_items_product_idx` ON `receipt_line_items` (`matched_product_id`);
--> statement-breakpoint
CREATE INDEX `receipt_line_items_review_idx` ON `receipt_line_items` (`requires_manual_review`);
--> statement-breakpoint

-- Indexes for product match candidates
CREATE INDEX `product_matches_line_item_idx` ON `product_match_candidates` (`receipt_line_item_id`);
--> statement-breakpoint
CREATE INDEX `product_matches_product_idx` ON `product_match_candidates` (`product_id`);
--> statement-breakpoint
CREATE INDEX `product_matches_similarity_idx` ON `product_match_candidates` (`similarity_score`);
--> statement-breakpoint

-- Indexes for receipt processing stats
CREATE INDEX `receipt_stats_tenant_date_idx` ON `receipt_processing_stats` (`tenant_id`,`date_bucket`);
--> statement-breakpoint
CREATE INDEX `receipt_stats_date_bucket_idx` ON `receipt_processing_stats` (`date_bucket`);
--> statement-breakpoint

-- Unique constraints
CREATE UNIQUE INDEX `receipt_processing_stats_tenant_id_date_bucket_unique` ON `receipt_processing_stats` (`tenant_id`,`date_bucket`);