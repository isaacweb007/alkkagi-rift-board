CREATE TABLE `match_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`level` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`match_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_queue_user_unique` ON `match_queue` (`user_id`);--> statement-breakpoint
CREATE INDEX `match_queue_search_idx` ON `match_queue` (`mode`,`status`,`level`,`created_at`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`player_a` text NOT NULL,
	`player_b` text NOT NULL,
	`first_player` text NOT NULL,
	`turn_player` text NOT NULL,
	`phase` text DEFAULT 'placement' NOT NULL,
	`state_json` text DEFAULT '{}' NOT NULL,
	`winner` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `matches_player_a_idx` ON `matches` (`player_a`,`updated_at`);--> statement-breakpoint
CREATE INDEX `matches_player_b_idx` ON `matches` (`player_b`,`updated_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`play_points` integer DEFAULT 500 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`practice_unlocked` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
