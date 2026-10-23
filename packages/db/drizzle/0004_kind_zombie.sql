ALTER TABLE "seat" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seat_section" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "seat" CASCADE;--> statement-breakpoint
DROP TABLE "seat_section" CASCADE;--> statement-breakpoint
ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "order_item_tier_xor_seat_check";--> statement-breakpoint
ALTER TABLE "ticket" DROP CONSTRAINT IF EXISTS "ticket_tier_xor_seat_check";--> statement-breakpoint
ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "order_item_seat_id_seat_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket" DROP CONSTRAINT IF EXISTS "ticket_seat_id_seat_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "order_item_seat_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ticket_seat_id_active_unique";--> statement-breakpoint
ALTER TABLE "order_item" ALTER COLUMN "tier_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket" ALTER COLUMN "tier_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "seating_mode";--> statement-breakpoint
ALTER TABLE "order_item" DROP COLUMN "seat_id";--> statement-breakpoint
ALTER TABLE "ticket" DROP COLUMN "seat_id";