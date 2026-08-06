CREATE TABLE `match_replays` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`count` integer NOT NULL,
	`arena` text NOT NULL,
	`winner` text,
	`shot_count` integer NOT NULL,
	`data_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `match_replays_user_created_idx` ON `match_replays` (`user_id`,`created_at`);