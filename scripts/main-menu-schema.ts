import type { Client } from '@libsql/client'

// Generated from the installed Payload SQLite schema; only the six Main Menu tables.
const statements = [
  "CREATE TABLE IF NOT EXISTS `main_menu_items_children` (\n\t`_order` integer NOT NULL,\n\t`_parent_id` text NOT NULL,\n\t`id` text PRIMARY KEY NOT NULL,\n\t`label` text,\n\t`link_type` text DEFAULT 'page',\n\t`page_id` integer,\n\t`built_in` text,\n\t`url` text,\n\t`new_tab` integer DEFAULT false,\n\t`show_in_footer` integer DEFAULT false,\n\tFOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,\n\tFOREIGN KEY (`_parent_id`) REFERENCES `main_menu_items`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
  "CREATE INDEX IF NOT EXISTS `main_menu_items_children_order_idx` ON `main_menu_items_children` (`_order`);",
  "CREATE INDEX IF NOT EXISTS `main_menu_items_children_parent_id_idx` ON `main_menu_items_children` (`_parent_id`);",
  "CREATE INDEX IF NOT EXISTS `main_menu_items_children_page_idx` ON `main_menu_items_children` (`page_id`);",
  "CREATE TABLE IF NOT EXISTS `main_menu_items` (\n\t`_order` integer NOT NULL,\n\t`_parent_id` integer NOT NULL,\n\t`id` text PRIMARY KEY NOT NULL,\n\t`label` text,\n\t`link_type` text DEFAULT 'page',\n\t`page_id` integer,\n\t`built_in` text,\n\t`url` text,\n\t`new_tab` integer DEFAULT false,\n\t`show_in_footer` integer DEFAULT false,\n\tFOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,\n\tFOREIGN KEY (`_parent_id`) REFERENCES `main_menu`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
  "CREATE INDEX IF NOT EXISTS `main_menu_items_order_idx` ON `main_menu_items` (`_order`);",
  "CREATE INDEX IF NOT EXISTS `main_menu_items_parent_id_idx` ON `main_menu_items` (`_parent_id`);",
  "CREATE INDEX IF NOT EXISTS `main_menu_items_page_idx` ON `main_menu_items` (`page_id`);",
  "CREATE TABLE IF NOT EXISTS `main_menu` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`highlighted_button_enabled` integer DEFAULT true,\n\t`highlighted_button_label` text,\n\t`highlighted_button_link_type` text DEFAULT 'page',\n\t`highlighted_button_page_id` integer,\n\t`highlighted_button_built_in` text,\n\t`highlighted_button_url` text,\n\t`highlighted_button_new_tab` integer DEFAULT false,\n\t`highlighted_button_show_in_footer` integer DEFAULT false,\n\t`_status` text DEFAULT 'draft',\n\t`updated_at` text,\n\t`created_at` text,\n\tFOREIGN KEY (`highlighted_button_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null\n);\n",
  "CREATE INDEX IF NOT EXISTS `main_menu_highlighted_button_highlighted_button_page_idx` ON `main_menu` (`highlighted_button_page_id`);",
  "CREATE INDEX IF NOT EXISTS `main_menu__status_idx` ON `main_menu` (`_status`);",
  "CREATE TABLE IF NOT EXISTS `_main_menu_v_version_items_children` (\n\t`_order` integer NOT NULL,\n\t`_parent_id` integer NOT NULL,\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`label` text,\n\t`link_type` text DEFAULT 'page',\n\t`page_id` integer,\n\t`built_in` text,\n\t`url` text,\n\t`new_tab` integer DEFAULT false,\n\t`show_in_footer` integer DEFAULT false,\n\t`_uuid` text,\n\tFOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,\n\tFOREIGN KEY (`_parent_id`) REFERENCES `_main_menu_v_version_items`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_items_children_order_idx` ON `_main_menu_v_version_items_children` (`_order`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_items_children_parent_id_idx` ON `_main_menu_v_version_items_children` (`_parent_id`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_items_children_page_idx` ON `_main_menu_v_version_items_children` (`page_id`);",
  "CREATE TABLE IF NOT EXISTS `_main_menu_v_version_items` (\n\t`_order` integer NOT NULL,\n\t`_parent_id` integer NOT NULL,\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`label` text,\n\t`link_type` text DEFAULT 'page',\n\t`page_id` integer,\n\t`built_in` text,\n\t`url` text,\n\t`new_tab` integer DEFAULT false,\n\t`show_in_footer` integer DEFAULT false,\n\t`_uuid` text,\n\tFOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,\n\tFOREIGN KEY (`_parent_id`) REFERENCES `_main_menu_v`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_items_order_idx` ON `_main_menu_v_version_items` (`_order`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_items_parent_id_idx` ON `_main_menu_v_version_items` (`_parent_id`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_items_page_idx` ON `_main_menu_v_version_items` (`page_id`);",
  "CREATE TABLE IF NOT EXISTS `_main_menu_v` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`version_highlighted_button_enabled` integer DEFAULT true,\n\t`version_highlighted_button_label` text,\n\t`version_highlighted_button_link_type` text DEFAULT 'page',\n\t`version_highlighted_button_page_id` integer,\n\t`version_highlighted_button_built_in` text,\n\t`version_highlighted_button_url` text,\n\t`version_highlighted_button_new_tab` integer DEFAULT false,\n\t`version_highlighted_button_show_in_footer` integer DEFAULT false,\n\t`version__status` text DEFAULT 'draft',\n\t`version_updated_at` text,\n\t`version_created_at` text,\n\t`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n\t`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,\n\t`latest` integer,\n\tFOREIGN KEY (`version_highlighted_button_page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null\n);\n",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_highlighted_button_version_highligh_idx` ON `_main_menu_v` (`version_highlighted_button_page_id`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_version_version__status_idx` ON `_main_menu_v` (`version__status`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_created_at_idx` ON `_main_menu_v` (`created_at`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_updated_at_idx` ON `_main_menu_v` (`updated_at`);",
  "CREATE INDEX IF NOT EXISTS `_main_menu_v_latest_idx` ON `_main_menu_v` (`latest`);"
]

export async function prepareMainMenuSchema(client: Pick<Client, 'batch'>): Promise<void> {
  await client.batch(statements, 'write')
}
