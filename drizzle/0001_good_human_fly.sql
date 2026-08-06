CREATE TABLE `result_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `result_receipts_user_idx` ON `result_receipts` (`user_id`,`created_at`);