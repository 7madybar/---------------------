CREATE TABLE `team_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`member_email`) REFERENCES `members`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_member` ON `team_sessions` (`member_email`);--> statement-breakpoint
CREATE INDEX `session_expiry` ON `team_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `members` ADD `access_code_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_access_code_hash_unique` ON `members` (`access_code_hash`);