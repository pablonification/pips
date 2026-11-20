CREATE TABLE IF NOT EXISTS "oauth_authorizations" (
	"id" text PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"client_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text NOT NULL,
	"state" text,
	"code_challenge" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_id" text,
	"approved_at" timestamp with time zone,
	"denied_at" timestamp with time zone,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"token_family" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorizations_request_hash_unique" UNIQUE("request_hash"),
	CONSTRAINT "oauth_authorizations_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"redirect_uris" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"family" text NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"access_hash" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_hash" text NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oauth_tokens_access_hash_unique" UNIQUE("access_hash"),
	CONSTRAINT "oauth_tokens_refresh_hash_unique" UNIQUE("refresh_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_authorizations" ADD CONSTRAINT "oauth_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_authorizations_expires_at_index" ON "oauth_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_tokens_user_id_client_id_index" ON "oauth_tokens" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_tokens_family_index" ON "oauth_tokens" USING btree ("family");