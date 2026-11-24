CREATE TABLE "short_link_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"lynx_id" text NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"nim" text,
	"password_hash" text,
	"two_factor" boolean DEFAULT false NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"claimed_via" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_link_accounts_lynx_id_unique" UNIQUE("lynx_id")
);
--> statement-breakpoint
CREATE TABLE "short_link_claim_locks" (
	"key" text PRIMARY KEY NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"last_try_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "short_link_names" (
	"name" text PRIMARY KEY NOT NULL,
	"folded" text GENERATED ALWAYS AS (lower(name)) STORED NOT NULL,
	"link_id" text NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"holds_fold" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_links" (
	"id" text PRIMARY KEY NOT NULL,
	"destination" text,
	"form_id" text,
	"owner_id" text,
	"previous_owner_id" text,
	"account_id" text,
	"lynx_id" text,
	"lynx_visits" integer,
	"lynx_modified_at" timestamp with time zone,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "short_links_form_id_unique" UNIQUE("form_id"),
	CONSTRAINT "short_links_lynx_id_unique" UNIQUE("lynx_id")
);
--> statement-breakpoint
ALTER TABLE "short_link_accounts" ADD CONSTRAINT "short_link_accounts_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_link_names" ADD CONSTRAINT "short_link_names_link_id_short_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."short_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_previous_owner_id_users_id_fk" FOREIGN KEY ("previous_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_account_id_short_link_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."short_link_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "short_link_accounts_username_idx" ON "short_link_accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "short_link_accounts_email_idx" ON "short_link_accounts" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "short_link_accounts_nim_index" ON "short_link_accounts" USING btree ("nim");--> statement-breakpoint
CREATE INDEX "short_link_accounts_claimed_by_index" ON "short_link_accounts" USING btree ("claimed_by");--> statement-breakpoint
CREATE INDEX "short_link_names_folded_index" ON "short_link_names" USING btree ("folded");--> statement-breakpoint
CREATE UNIQUE INDEX "short_link_names_fold_idx" ON "short_link_names" USING btree ("folded") WHERE holds_fold;--> statement-breakpoint
CREATE UNIQUE INDEX "short_link_names_current_idx" ON "short_link_names" USING btree ("link_id") WHERE is_current;--> statement-breakpoint
CREATE INDEX "short_link_names_link_id_index" ON "short_link_names" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "short_links_owner_id_index" ON "short_links" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "short_links_previous_owner_id_index" ON "short_links" USING btree ("previous_owner_id");--> statement-breakpoint
CREATE INDEX "short_links_account_id_index" ON "short_links" USING btree ("account_id");--> statement-breakpoint
-- Sets a link's current name. With p_keep_old, the name it had stays as one of its older names, which keep working;
-- without, it goes (a draft form's name, never shared). Going back to one of the link's own names, in any capitals,
-- makes that row current again. A name another link holds, exactly or without capitals, fails on the primary key or
-- short_link_names_fold_idx (23505), so two members can never both get it.
CREATE FUNCTION short_link_set_name(p_link text, p_name text, p_keep_old boolean) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  cur text;
BEGIN
  SELECT name INTO cur FROM short_link_names WHERE link_id = p_link AND is_current FOR UPDATE;
  IF cur = p_name THEN
    RETURN;
  END IF;
  IF cur IS NOT NULL THEN
    IF p_keep_old THEN
      UPDATE short_link_names SET is_current = false WHERE name = cur;
    ELSE
      DELETE FROM short_link_names WHERE name = cur;
    END IF;
  END IF;
  UPDATE short_link_names SET name = p_name, is_current = true
    WHERE link_id = p_link AND folded = lower(p_name) AND holds_fold;
  IF NOT FOUND THEN
    INSERT INTO short_link_names (name, link_id, is_current) VALUES (p_name, p_link, true);
  END IF;
END $$;
--> statement-breakpoint
-- Forms share the names: every form has a link, whose current name is forms.slug. These triggers keep it so for every
-- writer (the API, the seed, a hand-written insert), so the two can't drift. A published form's old names keep
-- working; a deleted published form's names stay reserved; a draft's name is let go.
CREATE FUNCTION forms_short_link_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  link text := 'form-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
BEGIN
  INSERT INTO short_links (id, form_id, created_at, updated_at) VALUES (link, NEW.id, NEW.created_at, NEW.created_at);
  PERFORM short_link_set_name(link, NEW.slug, false);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION forms_short_link_rename() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM short_link_set_name(
    (SELECT id FROM short_links WHERE form_id = NEW.id),
    NEW.slug,
    OLD.published_at IS NOT NULL
  );
  UPDATE short_links SET updated_at = now() WHERE form_id = NEW.id;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION forms_short_link_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.published_at IS NULL THEN
    DELETE FROM short_links WHERE form_id = OLD.id;
  ELSE
    UPDATE short_links SET deleted_at = now(), updated_at = now() WHERE form_id = OLD.id;
  END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
INSERT INTO short_links (id, form_id, created_at, updated_at)
  SELECT 'form-' || substr(md5(random()::text || clock_timestamp()::text || id), 1, 12), id, created_at, created_at FROM forms;
--> statement-breakpoint
INSERT INTO short_link_names (name, link_id, is_current)
  SELECT f.slug, l.id, true FROM forms f JOIN short_links l ON l.form_id = f.id;
--> statement-breakpoint
CREATE TRIGGER forms_short_link_insert AFTER INSERT ON forms FOR EACH ROW EXECUTE FUNCTION forms_short_link_insert();
--> statement-breakpoint
CREATE TRIGGER forms_short_link_rename AFTER UPDATE OF slug ON forms FOR EACH ROW
  WHEN (OLD.slug IS DISTINCT FROM NEW.slug) EXECUTE FUNCTION forms_short_link_rename();
--> statement-breakpoint
CREATE TRIGGER forms_short_link_delete BEFORE DELETE ON forms FOR EACH ROW EXECUTE FUNCTION forms_short_link_delete();
