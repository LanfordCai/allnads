CREATE TABLE "address_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"privy_user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"privy_user_id" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"has_claimed_nft" boolean DEFAULT false NOT NULL,
	"nft_claim_tx_id" varchar(255),
	"nft_claim_date" timestamp,
	"has_claimed_mon" boolean DEFAULT false NOT NULL,
	"mon_claim_tx_id" varchar(255),
	"mon_claim_date" timestamp,
	"mon_claim_amount" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address_book" ADD CONSTRAINT "address_book_privy_user_id_user_references_privy_user_id_fk" FOREIGN KEY ("privy_user_id") REFERENCES "public"."user_references"("privy_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_claims" ADD CONSTRAINT "user_claims_privy_user_id_user_references_privy_user_id_fk" FOREIGN KEY ("privy_user_id") REFERENCES "public"."user_references"("privy_user_id") ON DELETE cascade ON UPDATE no action;