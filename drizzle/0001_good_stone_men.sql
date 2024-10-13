CREATE TABLE `place_visit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lat` integer NOT NULL,
	`lng` integer NOT NULL,
	`address` text NOT NULL,
	`name` text NOT NULL,
	`placeId` text NOT NULL,
	`location_confidence` real NOT NULL,
	`start_timestamp` integer NOT NULL,
	`end_timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `place_visit_timestamp_idx` ON `place_visit` (`start_timestamp`,`end_timestamp`);