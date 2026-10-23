ALTER TABLE "payment_method" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "payment_method" CASCADE;--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_payment_method_id_payment_method_id_fk";
--> statement-breakpoint
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_reviewed_by_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "order_payment_method_id_idx";--> statement-breakpoint
DROP INDEX "order_reviewed_by_id_idx";--> statement-breakpoint
DROP INDEX "order_payment_reference_unique";--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "hitpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "hitpay_status" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "order_hitpay_payment_id_idx" ON "order" USING btree ("hitpay_payment_id");--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "payment_method_id";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "reference_number";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "proof_image_key";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "submitted_at";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "reviewed_by_id";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "rejection_reason";--> statement-breakpoint
ALTER TABLE "order" DROP COLUMN "resubmit_count";