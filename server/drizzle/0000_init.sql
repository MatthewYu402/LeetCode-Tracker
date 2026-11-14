CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`problem_id` integer NOT NULL,
	`filename` text NOT NULL,
	`stored_name` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_problem_idx` ON `attachments` (`problem_id`);--> statement-breakpoint
CREATE TABLE `problem_tags` (
	`problem_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`problem_id`, `tag_id`),
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `problem_tags_tag_idx` ON `problem_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `problems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`source` text DEFAULT 'leetcode' NOT NULL,
	`leetcode_number` integer,
	`official_difficulty` text NOT NULL,
	`personal_difficulty` integer,
	`summary` text DEFAULT '' NOT NULL,
	`approach_notes` text DEFAULT '' NOT NULL,
	`why_it_works` text DEFAULT '' NOT NULL,
	`time_complexity` text DEFAULT '' NOT NULL,
	`space_complexity` text DEFAULT '' NOT NULL,
	`solved_at` text,
	`needs_revisit` integer DEFAULT false NOT NULL,
	`last_reviewed_at` text,
	`review_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `problems_difficulty_idx` ON `problems` (`official_difficulty`);--> statement-breakpoint
CREATE TABLE `solutions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`problem_id` integer NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'python' NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `solutions_problem_idx` ON `solutions` (`problem_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);