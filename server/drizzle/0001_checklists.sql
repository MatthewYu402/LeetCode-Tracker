CREATE TABLE `checklist_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checklist_id` integer NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`checklist_id`) REFERENCES `checklists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_categories_checklist_idx` ON `checklist_categories` (`checklist_id`);--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `checklist_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_items_category_idx` ON `checklist_items` (`category_id`);--> statement-breakpoint
CREATE TABLE `checklists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklists_name_unique` ON `checklists` (`name`);