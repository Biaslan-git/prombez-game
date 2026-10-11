CREATE TABLE "answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"exam_questions_count" integer DEFAULT 20 NOT NULL,
	"exam_time_limit_min" integer DEFAULT 20 NOT NULL,
	"exam_pass_threshold" integer DEFAULT 18 NOT NULL,
	"bank_version" text DEFAULT '' NOT NULL,
	"bank_updated_at" date,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "areas_code_unique" UNIQUE("code"),
	CONSTRAINT "areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"number" integer NOT NULL,
	"text" text NOT NULL,
	"slug" text NOT NULL,
	"explanation" text,
	"norm_ref" text,
	"explanation_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('russian', "text")) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_question_idx" ON "answers" USING btree ("question_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_area_number_uq" ON "questions" USING btree ("area_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_area_slug_uq" ON "questions" USING btree ("area_id","slug");--> statement-breakpoint
CREATE INDEX "questions_search_idx" ON "questions" USING gin ("search_vector");