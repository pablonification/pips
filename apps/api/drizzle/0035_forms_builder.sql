CREATE TABLE IF NOT EXISTS "form_collaborators" (
	"form_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_collaborators_form_id_user_id_pk" PRIMARY KEY("form_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_details" (
	"user_id" text PRIMARY KEY NOT NULL,
	"whatsapp" text,
	"line" text,
	"instagram" text,
	"address" text,
	"hometown" text,
	"emergency_name" text,
	"emergency_relation" text,
	"emergency_phone" text,
	"health" text,
	"birth_date" date,
	"student_card_photo" text,
	"photo" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "opens_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "profile" json DEFAULT '{}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "requested_fields" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "allow_edit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "thanks" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "slug_custom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_details" ADD CONSTRAINT "member_details_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_collaborators_user_id_index" ON "form_collaborators" USING btree ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forms" ADD CONSTRAINT "forms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Every form made before the builder was published when it was made; only a form with no publishing time is a draft.
UPDATE "forms" SET "published_at" = "created_at" WHERE "published_at" IS NULL;
