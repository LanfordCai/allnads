ALTER TABLE "messages" ADD COLUMN "tool_call_id" varchar(255);--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "tool_name" varchar(255);--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tool_call_id_unique" UNIQUE("tool_call_id");