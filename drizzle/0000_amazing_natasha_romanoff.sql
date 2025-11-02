CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "admin_files" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"originalName" text NOT NULL,
	"mimeType" text NOT NULL,
	"size" integer NOT NULL,
	"category" text NOT NULL,
	"path" text NOT NULL,
	"url" text,
	"storage_location" text DEFAULT 'local' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"category" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"model" text NOT NULL,
	"messages" json DEFAULT '[]'::json NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"clientProfileId" text NOT NULL,
	"meetingId" text,
	"projectId" text,
	"interactionType" text NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"outcome" text,
	"sentiment" text,
	"keyPoints" json DEFAULT '[]'::json NOT NULL,
	"actionItems" json DEFAULT '[]'::json NOT NULL,
	"interactionDate" timestamp NOT NULL,
	"isPineconeStored" boolean DEFAULT false NOT NULL,
	"pineconeId" text,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"projectId" text,
	"clientName" text NOT NULL,
	"clientEmail" text,
	"companyName" text,
	"role" text,
	"communicationStyle" text,
	"priorities" json DEFAULT '[]'::json NOT NULL,
	"concerns" json DEFAULT '[]'::json NOT NULL,
	"preferences" json DEFAULT '{}'::json NOT NULL,
	"totalMeetings" integer DEFAULT 0 NOT NULL,
	"lastMeetingDate" timestamp,
	"totalInteractions" integer DEFAULT 0 NOT NULL,
	"sentimentScore" integer DEFAULT 0 NOT NULL,
	"keyTopics" json DEFAULT '[]'::json NOT NULL,
	"sharedGoals" json DEFAULT '[]'::json NOT NULL,
	"pastFeedback" json DEFAULT '[]'::json NOT NULL,
	"isPineconeStored" boolean DEFAULT false NOT NULL,
	"pineconeId" text,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fathom_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"apiKey" text NOT NULL,
	"teamIds" json DEFAULT '[]'::json NOT NULL,
	"lastSyncAt" timestamp,
	"syncEnabled" boolean DEFAULT true NOT NULL,
	"autoImportEnabled" boolean DEFAULT false NOT NULL,
	"importHistoricalEnabled" boolean DEFAULT false NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"categories" json NOT NULL,
	"boostFactor" integer DEFAULT 200 NOT NULL,
	"durationHours" integer DEFAULT 4 NOT NULL,
	"memoriesAccessed" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"userId" text NOT NULL,
	"chatId" text,
	"mimeType" text NOT NULL,
	"fileSize" integer NOT NULL,
	"storageLocation" text DEFAULT 'local' NOT NULL,
	"cloudPath" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"projectId" text,
	"clientProfileId" text,
	"interactionType" text NOT NULL,
	"sourceId" text NOT NULL,
	"sourceUrl" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"participants" json DEFAULT '[]'::json NOT NULL,
	"sentiment" text,
	"priority" text DEFAULT 'none',
	"tags" json DEFAULT '[]'::json NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"pineconeStored" boolean DEFAULT false NOT NULL,
	"pineconeId" text,
	"interactionDate" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linear_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"teamId" text NOT NULL,
	"teamName" text NOT NULL,
	"expiresAt" timestamp,
	"lastSyncAt" timestamp,
	"webhookSecret" text,
	"webhookUrl" text,
	"syncMode" text DEFAULT 'manual',
	"autoSyncEnabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linear_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"linearProjectId" text NOT NULL,
	"linearIssueId" text NOT NULL,
	"identifier" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"priorityLabel" text DEFAULT 'No priority' NOT NULL,
	"status" text NOT NULL,
	"statusType" text NOT NULL,
	"assignee" text,
	"assigneeEmail" text,
	"estimate" integer,
	"dueDate" timestamp,
	"completedAt" timestamp,
	"url" text NOT NULL,
	"labels" json DEFAULT '[]'::json NOT NULL,
	"pineconeId" text,
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "linear_issue_linearIssueId_unique" UNIQUE("linearIssueId")
);
--> statement-breakpoint
CREATE TABLE "linear_project" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"linearTeamId" text NOT NULL,
	"linearProjectId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"state" text NOT NULL,
	"lead" text,
	"leadEmail" text,
	"startDate" timestamp,
	"targetDate" timestamp,
	"pineconeId" text,
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "linear_project_linearProjectId_unique" UNIQUE("linearProjectId")
);
--> statement-breakpoint
CREATE TABLE "linear_team_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"linearTeamId" text NOT NULL,
	"linearTeamName" text NOT NULL,
	"projectId" text,
	"autoCreated" boolean DEFAULT true NOT NULL,
	"syncEnabled" boolean DEFAULT true NOT NULL,
	"webhookConfigured" boolean DEFAULT false NOT NULL,
	"pineconeIndexName" text,
	"lastSyncAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_insights" (
	"id" text PRIMARY KEY NOT NULL,
	"meetingId" text NOT NULL,
	"insightType" text NOT NULL,
	"content" text NOT NULL,
	"speaker" text,
	"timestamp" integer,
	"importance" integer DEFAULT 5 NOT NULL,
	"category" text,
	"relatedClientId" text,
	"relatedProjectId" text,
	"isPineconeStored" boolean DEFAULT false NOT NULL,
	"pineconeId" text,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_transcripts" (
	"id" text PRIMARY KEY NOT NULL,
	"meetingId" text NOT NULL,
	"fullTranscript" text NOT NULL,
	"segments" json DEFAULT '[]'::json NOT NULL,
	"summary" text,
	"actionItems" json DEFAULT '[]'::json NOT NULL,
	"keywords" json DEFAULT '[]'::json NOT NULL,
	"isChunked" boolean DEFAULT false NOT NULL,
	"chunksStored" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"fathomMeetingId" text NOT NULL,
	"projectId" text,
	"title" text NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"recordedBy" text,
	"meetingUrl" text,
	"videoUrl" text,
	"attendees" json DEFAULT '[]'::json NOT NULL,
	"hasTranscript" boolean DEFAULT false NOT NULL,
	"hasInsights" boolean DEFAULT false NOT NULL,
	"isProcessed" boolean DEFAULT false NOT NULL,
	"isInMemory" boolean DEFAULT false NOT NULL,
	"processingStatus" text DEFAULT 'pending' NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_fathomMeetingId_unique" UNIQUE("fathomMeetingId")
);
--> statement-breakpoint
CREATE TABLE "memory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"chatId" text,
	"content" text NOT NULL,
	"contentHash" text NOT NULL,
	"pineconeId" text NOT NULL,
	"memoryType" text DEFAULT 'working' NOT NULL,
	"privacyLevel" text DEFAULT 'contextual' NOT NULL,
	"category" text,
	"tags" json DEFAULT '[]'::json NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"accessCount" integer DEFAULT 0 NOT NULL,
	"lastAccessedAt" timestamp,
	"strength" integer DEFAULT 10 NOT NULL,
	"decayRate" integer DEFAULT 0 NOT NULL,
	"isPermanent" boolean DEFAULT false NOT NULL,
	"requiresAuth" boolean DEFAULT false NOT NULL,
	"expiresAt" timestamp,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passwordResetToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_history" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"stripePaymentIntentId" text,
	"stripeInvoiceId" text,
	"subscriptionId" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text NOT NULL,
	"description" text,
	"paymentMethodType" text,
	"last4" text,
	"brand" text,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"stripePriceId" text NOT NULL,
	"priceAmount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"billingInterval" text DEFAULT 'month' NOT NULL,
	"textGenerationLimit" integer,
	"imageGenerationLimit" integer,
	"videoGenerationLimit" integer,
	"features" json DEFAULT '[]'::json NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_plan_stripePriceId_unique" UNIQUE("stripePriceId")
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"userId" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"isGuest" boolean DEFAULT false NOT NULL,
	"canComment" boolean DEFAULT true NOT NULL,
	"canViewAll" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_task" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"linearIssueId" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'no_priority' NOT NULL,
	"assigneeId" text,
	"estimate" integer,
	"dueDate" timestamp,
	"completedAt" timestamp,
	"visibleToClient" boolean DEFAULT true NOT NULL,
	"clientFeedbackCount" integer DEFAULT 0 NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_task_linearIssueId_unique" UNIQUE("linearIssueId")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"linearProjectId" text,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"clientName" text NOT NULL,
	"clientEmail" text NOT NULL,
	"startDate" timestamp,
	"targetDate" timestamp,
	"completedAt" timestamp,
	"guestAccessEnabled" boolean DEFAULT true NOT NULL,
	"guestAccessToken" text,
	"metadata" json DEFAULT '{}'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_linearProjectId_unique" UNIQUE("linearProjectId"),
	CONSTRAINT "project_guestAccessToken_unique" UNIQUE("guestAccessToken")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"stripeSubscriptionId" text NOT NULL,
	"stripePriceId" text NOT NULL,
	"planTier" text NOT NULL,
	"previousPlanTier" text,
	"status" text NOT NULL,
	"currentPeriodStart" timestamp NOT NULL,
	"currentPeriodEnd" timestamp NOT NULL,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"canceledAt" timestamp,
	"endedAt" timestamp,
	"planChangedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
);
--> statement-breakpoint
CREATE TABLE "task_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"taskId" text NOT NULL,
	"authorId" text,
	"authorName" text NOT NULL,
	"authorEmail" text NOT NULL,
	"content" text NOT NULL,
	"isFromClient" boolean DEFAULT false NOT NULL,
	"isInternal" boolean DEFAULT false NOT NULL,
	"attachments" json DEFAULT '[]'::json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"textGenerationCount" integer DEFAULT 0 NOT NULL,
	"imageGenerationCount" integer DEFAULT 0 NOT NULL,
	"videoGenerationCount" integer DEFAULT 0 NOT NULL,
	"lastResetAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_month_year_unique" UNIQUE("userId","month","year")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"password" text,
	"image" text,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"stripeCustomerId" text,
	"subscriptionStatus" text DEFAULT 'incomplete',
	"planTier" text DEFAULT 'free',
	"marketingConsent" boolean DEFAULT false NOT NULL,
	"memoryMode" text DEFAULT 'humanized',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"userId" text NOT NULL,
	"chatId" text,
	"mimeType" text NOT NULL,
	"fileSize" integer NOT NULL,
	"duration" integer,
	"resolution" text,
	"fps" integer,
	"hasAudio" boolean DEFAULT true NOT NULL,
	"storageLocation" text DEFAULT 'local' NOT NULL,
	"cloudPath" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_clientProfileId_client_profiles_id_fk" FOREIGN KEY ("clientProfileId") REFERENCES "public"."client_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_meetingId_meetings_id_fk" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom_integration" ADD CONSTRAINT "fathom_integration_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_clientProfileId_client_profiles_id_fk" FOREIGN KEY ("clientProfileId") REFERENCES "public"."client_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_integration" ADD CONSTRAINT "linear_integration_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_issue" ADD CONSTRAINT "linear_issue_linearProjectId_linear_project_id_fk" FOREIGN KEY ("linearProjectId") REFERENCES "public"."linear_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_project" ADD CONSTRAINT "linear_project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_team_mapping" ADD CONSTRAINT "linear_team_mapping_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_team_mapping" ADD CONSTRAINT "linear_team_mapping_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_insights" ADD CONSTRAINT "meeting_insights_meetingId_meetings_id_fk" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_insights" ADD CONSTRAINT "meeting_insights_relatedClientId_client_profiles_id_fk" FOREIGN KEY ("relatedClientId") REFERENCES "public"."client_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_insights" ADD CONSTRAINT "meeting_insights_relatedProjectId_project_id_fk" FOREIGN KEY ("relatedProjectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_transcripts" ADD CONSTRAINT "meeting_transcripts_meetingId_meetings_id_fk" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory" ADD CONSTRAINT "memory_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory" ADD CONSTRAINT "memory_chatId_chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_subscriptionId_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task" ADD CONSTRAINT "project_task_projectId_project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_taskId_project_task_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."project_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video" ADD CONSTRAINT "video_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_files_category_idx" ON "admin_files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "admin_settings_category_idx" ON "admin_settings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "client_interaction_client_id_idx" ON "client_interactions" USING btree ("clientProfileId");--> statement-breakpoint
CREATE INDEX "client_interaction_meeting_id_idx" ON "client_interactions" USING btree ("meetingId");--> statement-breakpoint
CREATE INDEX "client_interaction_project_id_idx" ON "client_interactions" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "client_interaction_date_idx" ON "client_interactions" USING btree ("interactionDate");--> statement-breakpoint
CREATE INDEX "client_interaction_type_idx" ON "client_interactions" USING btree ("interactionType");--> statement-breakpoint
CREATE INDEX "client_profile_user_id_idx" ON "client_profiles" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "client_profile_project_id_idx" ON "client_profiles" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "client_profile_email_idx" ON "client_profiles" USING btree ("clientEmail");--> statement-breakpoint
CREATE INDEX "fathom_integration_user_id_idx" ON "fathom_integration" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "focus_session_user_id_idx" ON "focus_session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "focus_session_is_active_idx" ON "focus_session" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "interaction_user_id_idx" ON "interaction" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "interaction_project_id_idx" ON "interaction" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "interaction_client_profile_id_idx" ON "interaction" USING btree ("clientProfileId");--> statement-breakpoint
CREATE INDEX "interaction_type_idx" ON "interaction" USING btree ("interactionType");--> statement-breakpoint
CREATE INDEX "interaction_date_idx" ON "interaction" USING btree ("interactionDate");--> statement-breakpoint
CREATE INDEX "interaction_source_id_idx" ON "interaction" USING btree ("sourceId");--> statement-breakpoint
CREATE INDEX "linear_integration_user_id_idx" ON "linear_integration" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "linear_issue_project_id_idx" ON "linear_issue" USING btree ("linearProjectId");--> statement-breakpoint
CREATE INDEX "linear_issue_linear_id_idx" ON "linear_issue" USING btree ("linearIssueId");--> statement-breakpoint
CREATE INDEX "linear_issue_status_idx" ON "linear_issue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "linear_issue_assignee_idx" ON "linear_issue" USING btree ("assigneeEmail");--> statement-breakpoint
CREATE INDEX "linear_project_user_id_idx" ON "linear_project" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "linear_project_team_id_idx" ON "linear_project" USING btree ("linearTeamId");--> statement-breakpoint
CREATE INDEX "linear_project_linear_id_idx" ON "linear_project" USING btree ("linearProjectId");--> statement-breakpoint
CREATE INDEX "linear_team_mapping_user_id_idx" ON "linear_team_mapping" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "linear_team_mapping_team_id_idx" ON "linear_team_mapping" USING btree ("linearTeamId");--> statement-breakpoint
CREATE INDEX "meeting_insight_meeting_id_idx" ON "meeting_insights" USING btree ("meetingId");--> statement-breakpoint
CREATE INDEX "meeting_insight_type_idx" ON "meeting_insights" USING btree ("insightType");--> statement-breakpoint
CREATE INDEX "meeting_insight_client_id_idx" ON "meeting_insights" USING btree ("relatedClientId");--> statement-breakpoint
CREATE INDEX "meeting_insight_project_id_idx" ON "meeting_insights" USING btree ("relatedProjectId");--> statement-breakpoint
CREATE INDEX "meeting_transcript_meeting_id_idx" ON "meeting_transcripts" USING btree ("meetingId");--> statement-breakpoint
CREATE INDEX "meeting_user_id_idx" ON "meetings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "meeting_project_id_idx" ON "meetings" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "meeting_fathom_id_idx" ON "meetings" USING btree ("fathomMeetingId");--> statement-breakpoint
CREATE INDEX "meeting_start_time_idx" ON "meetings" USING btree ("startTime");--> statement-breakpoint
CREATE INDEX "meeting_is_processed_idx" ON "meetings" USING btree ("isProcessed");--> statement-breakpoint
CREATE INDEX "memory_user_id_idx" ON "memory" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "memory_chat_id_idx" ON "memory" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX "memory_privacy_level_idx" ON "memory" USING btree ("privacyLevel");--> statement-breakpoint
CREATE INDEX "memory_category_idx" ON "memory" USING btree ("category");--> statement-breakpoint
CREATE INDEX "memory_type_idx" ON "memory" USING btree ("memoryType");--> statement-breakpoint
CREATE INDEX "memory_content_hash_idx" ON "memory" USING btree ("contentHash");--> statement-breakpoint
CREATE INDEX "project_member_project_id_idx" ON "project_member" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "project_member_user_id_idx" ON "project_member" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "project_member_email_idx" ON "project_member" USING btree ("email");--> statement-breakpoint
CREATE INDEX "project_task_project_id_idx" ON "project_task" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "project_task_status_idx" ON "project_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_task_assignee_id_idx" ON "project_task" USING btree ("assigneeId");--> statement-breakpoint
CREATE INDEX "project_task_linear_issue_id_idx" ON "project_task" USING btree ("linearIssueId");--> statement-breakpoint
CREATE INDEX "project_user_id_idx" ON "project" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_linear_id_idx" ON "project" USING btree ("linearProjectId");--> statement-breakpoint
CREATE INDEX "project_guest_token_idx" ON "project" USING btree ("guestAccessToken");--> statement-breakpoint
CREATE INDEX "task_comment_task_id_idx" ON "task_comment" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "task_comment_author_id_idx" ON "task_comment" USING btree ("authorId");