CREATE TABLE "tg_subscribers" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"username" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_sent_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
