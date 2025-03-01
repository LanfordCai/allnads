CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"privy_user_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"privy_user_id" varchar(255) NOT NULL,
	"username" varchar(255),
	"email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"metadata" jsonb,
	CONSTRAINT "user_references_privy_user_id_unique" UNIQUE("privy_user_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;