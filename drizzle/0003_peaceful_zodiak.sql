CREATE TABLE "question_images" (
	"question_id" integer PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "course_slug" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "section_title" text;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "authority" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "kind" text DEFAULT 'choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_id" integer;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "image_hash" text;--> statement-breakpoint
ALTER TABLE "question_images" ADD CONSTRAINT "question_images_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_area_source_idx" ON "questions" USING btree ("area_id","source_id");--> statement-breakpoint
-- Области, загруженные до появления сфер, — банки Ростехнадзора.
UPDATE "areas" SET "course_slug" = 'prombez', "authority" = 'Ростехнадзора' WHERE "course_slug" = '';
