CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lat` integer NOT NULL,
	`lng` integer NOT NULL,
	`accuracy` integer NOT NULL,
	`source` text NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `timestamp_idx` ON `records` (`timestamp`);