CREATE TABLE `customer_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`sale_id` integer,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`payment_method` text DEFAULT 'Cash' NOT NULL,
	`reference_no` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `customer_transactions_customer_idx` ON `customer_transactions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_transactions_created_at_idx` ON `customer_transactions` (`created_at`);--> statement-breakpoint
CREATE TABLE `held_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`customer_id` integer,
	`price_mode` text DEFAULT 'retail' NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`cart_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `held_orders_created_at_idx` ON `held_orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`reference_no` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_created_at_idx` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`business_name` text DEFAULT 'SWIRL-DRY AND SARI-SARI STORE' NOT NULL,
	`address` text DEFAULT 'Buting, Pasig City' NOT NULL,
	`receipt_footer` text DEFAULT 'Maraming salamat po! Please come again.' NOT NULL,
	`auto_print` integer DEFAULT false NOT NULL,
	`sound_enabled` integer DEFAULT true NOT NULL,
	`low_stock_alerts` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplier_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`reference_no` text,
	`due_date` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_transactions_supplier_idx` ON `supplier_transactions` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `supplier_transactions_created_at_idx` ON `supplier_transactions` (`created_at`);--> statement-breakpoint
ALTER TABLE `sales` ADD `status` text DEFAULT 'Completed' NOT NULL;--> statement-breakpoint
CREATE INDEX `sales_created_at_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_payment_method_idx` ON `sales` (`payment_method`);--> statement-breakpoint
CREATE INDEX `expenses_created_at_idx` ON `expenses` (`created_at`);--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `sale_items_sale_id_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `shifts_started_at_idx` ON `shifts` (`started_at`);