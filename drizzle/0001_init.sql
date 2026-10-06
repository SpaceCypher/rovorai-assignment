CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TABLE "github_repo_cache" (
	"repo_key" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb,
	"etag" text,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_repo_cache_status" CHECK ("github_repo_cache"."status" IN ('ok', 'not_found'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"github_repo" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_not_blank" CHECK (length(btrim("projects"."name")) > 0),
	CONSTRAINT "projects_description_len" CHECK (length("projects"."description") <= 1000),
	CONSTRAINT "projects_github_repo_format" CHECK ("projects"."github_repo" ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' AND "projects"."github_repo" !~ '/[.]{1,2}$')
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "ticket_status" DEFAULT 'todo' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_title_not_blank" CHECK (length(btrim("tickets"."title")) > 0),
	CONSTRAINT "tickets_description_len" CHECK (length("tickets"."description") <= 10000)
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_lower_uq" ON "projects" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "tickets_project_updated_idx" ON "tickets" USING btree ("project_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tickets_search_trgm_idx" ON "tickets" USING gin (("title" || ' ' || "description") gin_trgm_ops);