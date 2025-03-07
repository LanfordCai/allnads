ALTER TABLE "user_references" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "address_book" DROP CONSTRAINT "address_book_privy_user_id_user_references_privy_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_claims" DROP CONSTRAINT "user_claims_privy_user_id_user_references_privy_user_id_fk";
DROP TABLE "user_references" CASCADE;--> statement-breakpoint
