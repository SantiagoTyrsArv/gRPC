CREATE TABLE "race_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"nickname" varchar(40) NOT NULL,
	"position" integer NOT NULL,
	"wpm" double precision NOT NULL,
	"accuracy" double precision NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"finished" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_code" varchar(6) NOT NULL,
	"text_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "texts_content_unique" UNIQUE("content")
);
--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "race_results_race_id_idx" ON "race_results" USING btree ("race_id");--> statement-breakpoint
CREATE INDEX "race_results_leaderboard_idx" ON "race_results" USING btree ("finished","wpm" DESC NULLS LAST);