CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'for_review', 'approved', 'rejected', 'expired', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."row_label_style" AS ENUM('alpha', 'numeric');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('valid', 'already_used', 'wrong_event', 'void', 'not_found');--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('available', 'held', 'sold', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."seating_mode" AS ENUM('ga', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('active', 'used', 'void');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"lineup" text,
	"venue" text,
	"starts_at" timestamp with time zone,
	"doors_open_at" timestamp with time zone,
	"poster_url" text,
	"description" text,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"seating_mode" "seating_mode" DEFAULT 'ga' NOT NULL,
	"max_per_order" integer DEFAULT 4 NOT NULL,
	"refund_cutoff_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"total_amount" integer NOT NULL,
	"payment_method_id" text,
	"reference_number" text,
	"proof_image_key" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"resubmit_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"tier_id" text,
	"seat_id" text,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_tier_xor_seat_check" CHECK (("order_item"."tier_id" is not null)::int + ("order_item"."seat_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "payment_method" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"account_name" text,
	"account_number" text,
	"qr_image_url" text,
	"instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_request" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"payout_method" text NOT NULL,
	"payout_account_name" text NOT NULL,
	"payout_account_number" text NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"payout_reference" text,
	"payout_proof_key" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scan_log" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text,
	"event_id" text NOT NULL,
	"scanned_by_id" text NOT NULL,
	"raw_value" text NOT NULL,
	"result" "scan_result" NOT NULL,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"event_id" text NOT NULL,
	"row_label" text NOT NULL,
	"number" integer NOT NULL,
	"label" text NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"held_by_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seat_section_row_number_unique" UNIQUE("section_id","row_label","number")
);
--> statement-breakpoint
CREATE TABLE "seat_section" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"rows" integer NOT NULL,
	"seats_per_row" integer NOT NULL,
	"row_label_style" "row_label_style" DEFAULT 'alpha' NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"event_id" text NOT NULL,
	"tier_id" text,
	"seat_id" text,
	"holder_name" text,
	"token" text NOT NULL,
	"status" "ticket_status" DEFAULT 'active' NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_token_unique" UNIQUE("token"),
	CONSTRAINT "ticket_tier_xor_seat_check" CHECK (("ticket"."tier_id" is not null)::int + ("ticket"."seat_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "ticket_tier" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"capacity" integer NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"sales_start_at" timestamp with time zone,
	"sales_end_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_tier_inventory_check" CHECK ("ticket_tier"."reserved" >= 0),
	CONSTRAINT "ticket_tier_sold_check" CHECK ("ticket_tier"."sold" >= 0),
	CONSTRAINT "ticket_tier_capacity_check" CHECK ("ticket_tier"."reserved" + "ticket_tier"."sold" <= "ticket_tier"."capacity")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"phone" text,
	"role_id" text,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_payment_method_id_payment_method_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_method"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_tier_id_ticket_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_seat_id_seat_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_log" ADD CONSTRAINT "scan_log_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_log" ADD CONSTRAINT "scan_log_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_log" ADD CONSTRAINT "scan_log_scanned_by_id_user_id_fk" FOREIGN KEY ("scanned_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat" ADD CONSTRAINT "seat_section_id_seat_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."seat_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat" ADD CONSTRAINT "seat_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_section" ADD CONSTRAINT "seat_section_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_tier_id_ticket_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_seat_id_seat_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seat"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_used_by_id_user_id_fk" FOREIGN KEY ("used_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tier" ADD CONSTRAINT "ticket_tier_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_idx" ON "audit_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_log_entity_id_idx" ON "audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "event_status_idx" ON "event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_starts_at_idx" ON "event" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "order_user_id_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_event_id_idx" ON "order" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_payment_method_id_idx" ON "order" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX "order_reviewed_by_id_idx" ON "order" USING btree ("reviewed_by_id");--> statement-breakpoint
CREATE INDEX "order_created_at_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payment_reference_unique" ON "order" USING btree ("payment_method_id","reference_number") WHERE "order"."payment_method_id" is not null and "order"."reference_number" is not null;--> statement-breakpoint
CREATE INDEX "order_item_order_id_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_tier_id_idx" ON "order_item" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "order_item_seat_id_idx" ON "order_item" USING btree ("seat_id");--> statement-breakpoint
CREATE INDEX "refund_request_order_id_idx" ON "refund_request" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_request_user_id_idx" ON "refund_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refund_request_status_idx" ON "refund_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_request_reviewed_by_id_idx" ON "refund_request" USING btree ("reviewed_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_request_open_order_unique" ON "refund_request" USING btree ("order_id") WHERE "refund_request"."status" in ('requested', 'approved');--> statement-breakpoint
CREATE INDEX "scan_log_ticket_id_idx" ON "scan_log" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "scan_log_event_id_idx" ON "scan_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "scan_log_scanned_by_id_idx" ON "scan_log" USING btree ("scanned_by_id");--> statement-breakpoint
CREATE INDEX "scan_log_result_idx" ON "scan_log" USING btree ("result");--> statement-breakpoint
CREATE INDEX "scan_log_created_at_idx" ON "scan_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "seat_section_id_idx" ON "seat" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "seat_event_status_idx" ON "seat" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "seat_held_by_order_id_idx" ON "seat" USING btree ("held_by_order_id");--> statement-breakpoint
CREATE INDEX "seat_section_event_id_idx" ON "seat_section" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_order_id_idx" ON "ticket" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_event_id_idx" ON "ticket" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_tier_id_idx" ON "ticket" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "ticket_status_idx" ON "ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_used_by_id_idx" ON "ticket" USING btree ("used_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_seat_id_active_unique" ON "ticket" USING btree ("seat_id") WHERE "ticket"."status" <> 'void' and "ticket"."seat_id" is not null;--> statement-breakpoint
CREATE INDEX "ticket_tier_event_id_idx" ON "ticket_tier" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "user_role_id_idx" ON "user" USING btree ("role_id");