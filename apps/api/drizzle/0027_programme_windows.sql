CREATE TABLE IF NOT EXISTS "programme_windows" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"route" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone,
	"eligible_angkatan" json DEFAULT '[]'::json NOT NULL,
	"eligible_nims" json DEFAULT '[]'::json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programme_windows_slug_unique" UNIQUE("slug")
);
