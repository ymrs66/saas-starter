-- First add the column as nullable
ALTER TABLE "articles" ADD COLUMN "team_id" integer;--> statement-breakpoint

-- Update existing articles to use their author's team
UPDATE "articles"
SET "team_id" = (
  SELECT "team_id"
  FROM "team_members"
  WHERE "team_members"."user_id" = "articles"."user_id"
  LIMIT 1
);--> statement-breakpoint

-- Make the column NOT NULL after data is populated
ALTER TABLE "articles" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint

-- Add foreign key constraint
ALTER TABLE "articles" ADD CONSTRAINT "articles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;