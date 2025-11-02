import {
	boolean,
	timestamp,
	pgTable,
	text,
	unique,
	primaryKey,
	integer,
	json,
	index,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "@auth/core/adapters"
import { randomUUID } from 'crypto';

// Note: db is exported from index.ts to avoid SvelteKit env issues with drizzle-kit

export const users = pgTable("user", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	name: text("name"),
	email: text("email").unique(),
	emailVerified: timestamp("emailVerified", { mode: "date" }),
	password: text('password'),
	image: text("image"),
	isAdmin: boolean("isAdmin").notNull().default(false),
	stripeCustomerId: text("stripeCustomerId"),
	subscriptionStatus: text("subscriptionStatus", { 
		enum: ["active", "canceled", "incomplete", "incomplete_expired", "past_due", "trialing", "unpaid"] 
	}).default("incomplete"),
	planTier: text("planTier", { 
		enum: ["free", "starter", "pro", "advanced"] 
	}).default("free"),
	marketingConsent: boolean("marketingConsent").notNull().default(false),
	memoryMode: text("memoryMode", {
		enum: ["persistent", "humanized"]
	}).default("humanized"),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

export const accounts = pgTable(
	"account",
	{
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").$type<AdapterAccountType>().notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("providerAccountId").notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type"),
		scope: text("scope"),
		id_token: text("id_token"),
		session_state: text("session_state"),
	},
	(account) => [
		{
			compoundKey: primaryKey({
				columns: [account.provider, account.providerAccountId],
			}),
		},
	]
)

export const sessions = pgTable("session", {
	sessionToken: text("sessionToken").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
	"verificationToken",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { mode: "date" }).notNull(),
	},
	(verificationToken) => [
		{
			compositePk: primaryKey({
				columns: [verificationToken.identifier, verificationToken.token],
			}),
		},
	]
)

export const passwordResetTokens = pgTable(
	"passwordResetToken",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { mode: "date" }).notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	},
	(passwordResetToken) => [
		{
			compositePk: primaryKey({
				columns: [passwordResetToken.identifier, passwordResetToken.token],
			}),
		},
	]
)

export const authenticators = pgTable(
	"authenticator",
	{
		credentialID: text("credentialID").notNull().unique(),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		providerAccountId: text("providerAccountId").notNull(),
		credentialPublicKey: text("credentialPublicKey").notNull(),
		counter: integer("counter").notNull(),
		credentialDeviceType: text("credentialDeviceType").notNull(),
		credentialBackedUp: boolean("credentialBackedUp").notNull(),
		transports: text("transports"),
	},
	(authenticator) => [
		{
			compositePK: primaryKey({
				columns: [authenticator.userId, authenticator.credentialID],
			}),
		},
	]
)

export const images = pgTable("image", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	filename: text("filename").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	chatId: text("chatId"), // Optional - images may not always be associated with a specific chat
	mimeType: text("mimeType").notNull(),
	fileSize: integer("fileSize").notNull(),
	storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
	cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

export const videos = pgTable("video", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	filename: text("filename").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	chatId: text("chatId"), // Optional - videos may not always be associated with a specific chat
	mimeType: text("mimeType").notNull(),
	fileSize: integer("fileSize").notNull(),
	duration: integer("duration"), // Video duration in seconds (8 for Veo 3)
	resolution: text("resolution"), // e.g., "720p"
	fps: integer("fps"), // Frames per second (24 for Veo 3)
	hasAudio: boolean("hasAudio").notNull().default(true), // Veo 3 generates audio natively
	storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
	cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

export const chats = pgTable("chat", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	model: text("model").notNull(),
	messages: json("messages").$type<Array<{
		role: 'user' | 'assistant' | 'system';
		content: string;
		model?: string;
		imageId?: string; // Reference to images table
		imageUrl?: string; // Deprecated, for backwards compatibility
		imageData?: string; // Deprecated, for backwards compatibility
		videoId?: string; // Reference to videos table
		mimeType?: string;
		type?: 'text' | 'image' | 'video';
	}>>().notNull().default([]),
	pinned: boolean("pinned").notNull().default(false),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const pricingPlans = pgTable("pricing_plan", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	name: text("name").notNull(),
	tier: text("tier", { 
		enum: ["free", "starter", "pro", "advanced"] 
	}).notNull(),
	stripePriceId: text("stripePriceId").notNull().unique(),
	priceAmount: integer("priceAmount").notNull(), // Price in cents
	currency: text("currency").notNull().default("usd"),
	billingInterval: text("billingInterval", { 
		enum: ["month", "year"] 
	}).notNull().default("month"),
	textGenerationLimit: integer("textGenerationLimit"), // null = unlimited
	imageGenerationLimit: integer("imageGenerationLimit"), // null = unlimited
	videoGenerationLimit: integer("videoGenerationLimit"), // null = unlimited
	features: json("features").$type<string[]>().notNull().default([]),
	isActive: boolean("isActive").notNull().default(true),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const subscriptions = pgTable("subscription", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	stripeSubscriptionId: text("stripeSubscriptionId").notNull().unique(),
	stripePriceId: text("stripePriceId").notNull(),
	planTier: text("planTier", { 
		enum: ["free", "starter", "pro", "advanced"] 
	}).notNull(),
	previousPlanTier: text("previousPlanTier", { 
		enum: ["free", "starter", "pro", "advanced"] 
	}), // Track previous plan for plan change analytics
	status: text("status", { 
		enum: ["active", "canceled", "incomplete", "incomplete_expired", "past_due", "trialing", "unpaid"] 
	}).notNull(),
	currentPeriodStart: timestamp("currentPeriodStart", { mode: "date" }).notNull(),
	currentPeriodEnd: timestamp("currentPeriodEnd", { mode: "date" }).notNull(),
	cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
	canceledAt: timestamp("canceledAt", { mode: "date" }),
	endedAt: timestamp("endedAt", { mode: "date" }),
	planChangedAt: timestamp("planChangedAt", { mode: "date" }), // Track when plan was last changed
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const usageTracking = pgTable("usage_tracking", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	month: integer("month").notNull(), // 1-12
	year: integer("year").notNull(),
	textGenerationCount: integer("textGenerationCount").notNull().default(0),
	imageGenerationCount: integer("imageGenerationCount").notNull().default(0),
	videoGenerationCount: integer("videoGenerationCount").notNull().default(0),
	lastResetAt: timestamp("lastResetAt", { mode: "date" }).notNull().defaultNow(),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userMonthYear: unique('user_month_year_unique').on(table.userId, table.month, table.year),
	}
})

export const paymentHistory = pgTable("payment_history", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.references(() => users.id, { onDelete: "set null" }), // Keep payment records for audit/legal purposes
	stripePaymentIntentId: text("stripePaymentIntentId"),
	stripeInvoiceId: text("stripeInvoiceId"),
	subscriptionId: text("subscriptionId")
		.references(() => subscriptions.id, { onDelete: "set null" }),
	amount: integer("amount").notNull(), // Amount in cents
	currency: text("currency").notNull().default("usd"),
	status: text("status", { 
		enum: ["succeeded", "pending", "failed", "canceled", "refunded"] 
	}).notNull(),
	description: text("description"),
	paymentMethodType: text("paymentMethodType"), // card, bank_transfer, etc.
	last4: text("last4"), // Last 4 digits of payment method
	brand: text("brand"), // visa, mastercard, etc.
	paidAt: timestamp("paidAt", { mode: "date" }),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

export const adminSettings = pgTable("admin_settings", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	key: text("key").notNull().unique(), // Setting key (e.g., 'site_name', 'stripe_public_key')
	value: text("value"), // Setting value (JSON for complex values)
	category: text("category").notNull(), // 'general', 'branding', 'payment', 'oauth'
	encrypted: boolean("encrypted").notNull().default(false), // Whether value is encrypted
	description: text("description"), // Human-readable description
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		categoryIdx: index('admin_settings_category_idx').on(table.category),
	}
})

export const adminFiles = pgTable("admin_files", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	filename: text("filename").notNull(),
	originalName: text("originalName").notNull(),
	mimeType: text("mimeType").notNull(),
	size: integer("size").notNull(), // File size in bytes
	category: text("category").notNull(), // 'logo', 'favicon', etc.
	path: text("path").notNull(), // File storage path
	url: text("url"), // Public URL if applicable
	storageLocation: text("storage_location").notNull().default('local'), // 'local' or 'r2'
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		categoryIdx: index('admin_files_category_idx').on(table.category),
	}
})

export const memories = pgTable("memory", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	chatId: text("chatId")
		.references(() => chats.id, { onDelete: "set null" }), // Optional: link to specific chat
	content: text("content").notNull(), // Full text content
	contentHash: text("contentHash").notNull(), // SHA256 hash for deduplication
	pineconeId: text("pineconeId").notNull(), // Reference to Pinecone vector
	memoryType: text("memoryType", {
		enum: ["working", "consolidated", "wisdom"]
	}).notNull().default("working"), // Memory tier in the system
	privacyLevel: text("privacyLevel", {
		enum: ["public", "contextual", "private", "vault"]
	}).notNull().default("contextual"),
	category: text("category"), // e.g., 'stewart-golf', 'health', 'wealth', 'landscaping'
	tags: json("tags").$type<string[]>().notNull().default([]), // User tags for organization
	importance: integer("importance").notNull().default(5), // 0-10 scale
	accessCount: integer("accessCount").notNull().default(0), // How many times accessed
	lastAccessedAt: timestamp("lastAccessedAt", { mode: "date" }), // Last recall time
	strength: integer("strength").notNull().default(10), // Memory strength (degrades in humanized mode)
	decayRate: integer("decayRate").notNull().default(0), // 0 = no decay (persistent), >0 = decay rate
	isPermanent: boolean("isPermanent").notNull().default(false), // True in persistent mode
	requiresAuth: boolean("requiresAuth").notNull().default(false), // Vault-level memories
	expiresAt: timestamp("expiresAt", { mode: "date" }), // Optional expiration
	metadata: json("metadata").$type<{
		source?: string;
		context?: string;
		relatedMemories?: string[];
		consolidatedFrom?: string[];
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('memory_user_id_idx').on(table.userId),
		chatIdIdx: index('memory_chat_id_idx').on(table.chatId),
		privacyLevelIdx: index('memory_privacy_level_idx').on(table.privacyLevel),
		categoryIdx: index('memory_category_idx').on(table.category),
		memoryTypeIdx: index('memory_type_idx').on(table.memoryType),
		contentHashIdx: index('memory_content_hash_idx').on(table.contentHash),
	}
})

export const focusSessions = pgTable("focus_session", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	categories: json("categories").$type<string[]>().notNull(), // Focus categories
	boostFactor: integer("boostFactor").notNull().default(200), // 2.0x = 200
	durationHours: integer("durationHours").notNull().default(4),
	memoriesAccessed: integer("memoriesAccessed").notNull().default(0),
	isActive: boolean("isActive").notNull().default(true),
	startedAt: timestamp("startedAt", { mode: "date" }).notNull().defaultNow(),
	expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
}, (table) => {
	return {
		userIdIdx: index('focus_session_user_id_idx').on(table.userId),
		isActiveIdx: index('focus_session_is_active_idx').on(table.isActive),
	}
})

// ============================================================================
// CLIENT PORTAL TABLES
// ============================================================================

// Linear OAuth integrations (per user/agency)
export const linearIntegrations = pgTable("linear_integration", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("accessToken").notNull(),
	refreshToken: text("refreshToken"),
	teamId: text("teamId").notNull(), // Linear team ID
	teamName: text("teamName").notNull(),
	expiresAt: timestamp("expiresAt", { mode: "date" }),
	lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
	webhookSecret: text("webhookSecret"), // Linear webhook verification secret
	webhookUrl: text("webhookUrl"), // Registered webhook URL
	syncMode: text("syncMode", {
		enum: ["webhook", "polling", "manual"]
	}).default("manual"),
	autoSyncEnabled: boolean("autoSyncEnabled").notNull().default(true),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('linear_integration_user_id_idx').on(table.userId),
	}
})

// Linear team to project mappings (agency setup: team = client)
export const linearTeamMappings = pgTable("linear_team_mapping", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	linearTeamId: text("linearTeamId").notNull(), // Linear team ID
	linearTeamName: text("linearTeamName").notNull(),
	projectId: text("projectId")
		.references(() => projects.id, { onDelete: "set null" }), // Optional: mapped project
	autoCreated: boolean("autoCreated").notNull().default(true), // Auto-created vs manual
	syncEnabled: boolean("syncEnabled").notNull().default(true),
	webhookConfigured: boolean("webhookConfigured").notNull().default(false),
	pineconeIndexName: text("pineconeIndexName"), // e.g., "client-acme-corp"
	lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('linear_team_mapping_user_id_idx').on(table.userId),
		linearTeamIdIdx: index('linear_team_mapping_team_id_idx').on(table.linearTeamId),
	}
})

// Linear projects cache (synced from Linear)
export const linearProjects = pgTable("linear_project", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	linearTeamId: text("linearTeamId").notNull(), // Parent team
	linearProjectId: text("linearProjectId").notNull().unique(), // Linear's project ID
	name: text("name").notNull(),
	description: text("description"),
	state: text("state").notNull(), // planned, started, paused, completed, canceled
	lead: text("lead"), // Lead user name
	leadEmail: text("leadEmail"),
	startDate: timestamp("startDate", { mode: "date" }),
	targetDate: timestamp("targetDate", { mode: "date" }),
	pineconeId: text("pineconeId"), // Vector ID in Pinecone
	lastSyncedAt: timestamp("lastSyncedAt", { mode: "date" }),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('linear_project_user_id_idx').on(table.userId),
		linearTeamIdIdx: index('linear_project_team_id_idx').on(table.linearTeamId),
		linearProjectIdIdx: index('linear_project_linear_id_idx').on(table.linearProjectId),
	}
})

// Linear issues cache (synced from Linear)
export const linearIssues = pgTable("linear_issue", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	linearProjectId: text("linearProjectId")
		.references(() => linearProjects.id, { onDelete: "cascade" }),
	linearIssueId: text("linearIssueId").notNull().unique(), // Linear's issue ID
	identifier: text("identifier").notNull(), // e.g., "ENG-123"
	title: text("title").notNull(),
	description: text("description"),
	priority: integer("priority").notNull().default(0), // 0-4 (no priority to urgent)
	priorityLabel: text("priorityLabel").notNull().default("No priority"),
	status: text("status").notNull(), // Workflow state name
	statusType: text("statusType").notNull(), // backlog, unstarted, started, completed, canceled
	assignee: text("assignee"), // Assignee name
	assigneeEmail: text("assigneeEmail"),
	estimate: integer("estimate"), // Story points
	dueDate: timestamp("dueDate", { mode: "date" }),
	completedAt: timestamp("completedAt", { mode: "date" }),
	url: text("url").notNull(), // Linear issue URL
	labels: json("labels").$type<Array<{ id: string; name: string; color: string }>>().notNull().default([]),
	pineconeId: text("pineconeId"), // Vector ID in Pinecone
	lastSyncedAt: timestamp("lastSyncedAt", { mode: "date" }),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		linearProjectIdIdx: index('linear_issue_project_id_idx').on(table.linearProjectId),
		linearIssueIdIdx: index('linear_issue_linear_id_idx').on(table.linearIssueId),
		statusIdx: index('linear_issue_status_idx').on(table.status),
		assigneeIdx: index('linear_issue_assignee_idx').on(table.assigneeEmail),
	}
})

// Unified interactions table (Linear comments, Slack threads, emails, etc.)
export const interactions = pgTable("interaction", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	projectId: text("projectId")
		.references(() => projects.id, { onDelete: "set null" }),
	clientProfileId: text("clientProfileId")
		.references(() => clientProfiles.id, { onDelete: "set null" }),
	interactionType: text("interactionType", {
		enum: ["linear_comment", "linear_issue_update", "slack_thread", "email", "fathom_meeting", "manual_note", "google_meet", "webrtc_meeting"]
	}).notNull(),
	sourceId: text("sourceId").notNull(), // External ID (Linear comment ID, Slack thread TS, etc.)
	sourceUrl: text("sourceUrl"), // Link back to source
	title: text("title").notNull(),
	content: text("content").notNull(), // Main text content
	participants: json("participants").$type<Array<{ name: string; email?: string; role?: string }>>().notNull().default([]),
	sentiment: text("sentiment", {
		enum: ["positive", "neutral", "negative"]
	}),
	priority: text("priority", {
		enum: ["urgent", "high", "medium", "low", "none"]
	}).default("none"),
	tags: json("tags").$type<string[]>().notNull().default([]), // Auto-generated tags
	metadata: json("metadata").$type<{
		linearIssueId?: string;
		linearProjectId?: string;
		slackChannelId?: string;
		emailThreadId?: string;
		meetingId?: string;
		autoClassified?: boolean;
		[key: string]: any;
	}>().notNull().default({}),
	pineconeStored: boolean("pineconeStored").notNull().default(false),
	pineconeId: text("pineconeId"), // Vector ID in Pinecone
	interactionDate: timestamp("interactionDate", { mode: "date" }).notNull(),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('interaction_user_id_idx').on(table.userId),
		projectIdIdx: index('interaction_project_id_idx').on(table.projectId),
		clientProfileIdIdx: index('interaction_client_profile_id_idx').on(table.clientProfileId),
		interactionTypeIdx: index('interaction_type_idx').on(table.interactionType),
		interactionDateIdx: index('interaction_date_idx').on(table.interactionDate),
		sourceIdIdx: index('interaction_source_id_idx').on(table.sourceId),
	}
})

// Client projects (synced from Linear projects or created standalone)
export const projects = pgTable("project", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }), // Agency owner
	linearProjectId: text("linearProjectId").unique(), // Optional: synced from Linear
	name: text("name").notNull(),
	description: text("description"),
	status: text("status", {
		enum: ["planning", "active", "on_hold", "completed", "archived"]
	}).notNull().default("active"),
	clientName: text("clientName").notNull(),
	clientEmail: text("clientEmail").notNull(),
	startDate: timestamp("startDate", { mode: "date" }),
	targetDate: timestamp("targetDate", { mode: "date" }),
	completedAt: timestamp("completedAt", { mode: "date" }),
	guestAccessEnabled: boolean("guestAccessEnabled").notNull().default(true),
	guestAccessToken: text("guestAccessToken").unique(), // Unique token for guest access
	metadata: json("metadata").$type<{
		budget?: number;
		deliverables?: string[];
		tags?: string[];
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('project_user_id_idx').on(table.userId),
		statusIdx: index('project_status_idx').on(table.status),
		linearProjectIdIdx: index('project_linear_id_idx').on(table.linearProjectId),
		guestTokenIdx: index('project_guest_token_idx').on(table.guestAccessToken),
	}
})

// Project team members (internal agency team + client guests)
export const projectMembers = pgTable("project_member", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	projectId: text("projectId")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	userId: text("userId").references(() => users.id, { onDelete: "cascade" }), // Optional: null for guest users
	name: text("name").notNull(),
	email: text("email").notNull(),
	role: text("role", {
		enum: ["owner", "member", "client_admin", "client_viewer"]
	}).notNull().default("member"),
	isGuest: boolean("isGuest").notNull().default(false),
	canComment: boolean("canComment").notNull().default(true),
	canViewAll: boolean("canViewAll").notNull().default(true), // Can see all tasks or just assigned
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		projectIdIdx: index('project_member_project_id_idx').on(table.projectId),
		userIdIdx: index('project_member_user_id_idx').on(table.userId),
		emailIdx: index('project_member_email_idx').on(table.email),
	}
})

// Project tasks (synced from Linear issues)
export const projectTasks = pgTable("project_task", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	projectId: text("projectId")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	linearIssueId: text("linearIssueId").unique(), // Linear issue ID
	title: text("title").notNull(),
	description: text("description"),
	status: text("status", {
		enum: ["backlog", "todo", "in_progress", "in_review", "done", "canceled"]
	}).notNull().default("todo"),
	priority: text("priority", {
		enum: ["urgent", "high", "medium", "low", "no_priority"]
	}).notNull().default("no_priority"),
	assigneeId: text("assigneeId"), // Can be userId or projectMemberId
	estimate: integer("estimate"), // Story points or hours
	dueDate: timestamp("dueDate", { mode: "date" }),
	completedAt: timestamp("completedAt", { mode: "date" }),
	visibleToClient: boolean("visibleToClient").notNull().default(true),
	clientFeedbackCount: integer("clientFeedbackCount").notNull().default(0),
	sortOrder: integer("sortOrder").notNull().default(0),
	metadata: json("metadata").$type<{
		labels?: string[];
		attachments?: string[];
		linearUrl?: string;
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		projectIdIdx: index('project_task_project_id_idx').on(table.projectId),
		statusIdx: index('project_task_status_idx').on(table.status),
		assigneeIdIdx: index('project_task_assignee_id_idx').on(table.assigneeId),
		linearIssueIdIdx: index('project_task_linear_issue_id_idx').on(table.linearIssueId),
	}
})

// Task comments/feedback (from team and clients)
export const taskComments = pgTable("task_comment", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	taskId: text("taskId")
		.notNull()
		.references(() => projectTasks.id, { onDelete: "cascade" }),
	authorId: text("authorId"), // userId or projectMemberId
	authorName: text("authorName").notNull(),
	authorEmail: text("authorEmail").notNull(),
	content: text("content").notNull(),
	isFromClient: boolean("isFromClient").notNull().default(false),
	isInternal: boolean("isInternal").notNull().default(false), // Hidden from clients
	attachments: json("attachments").$type<Array<{
		name: string;
		url: string;
		size: number;
		type: string;
	}>>().notNull().default([]),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		taskIdIdx: index('task_comment_task_id_idx').on(table.taskId),
		authorIdIdx: index('task_comment_author_id_idx').on(table.authorId),
	}
})

// ============================================================================
// FATHOM MEETING INTELLIGENCE INTEGRATION
// ============================================================================

// Fathom OAuth integrations (per user/agency)
export const fathomIntegrations = pgTable("fathom_integration", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	apiKey: text("apiKey").notNull(), // Encrypted Fathom API key
	teamIds: json("teamIds").$type<string[]>().notNull().default([]), // Fathom team IDs
	lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
	syncEnabled: boolean("syncEnabled").notNull().default(true),
	autoImportEnabled: boolean("autoImportEnabled").notNull().default(false), // Auto-import new meetings
	importHistoricalEnabled: boolean("importHistoricalEnabled").notNull().default(false),
	metadata: json("metadata").$type<{
		totalMeetingsImported?: number;
		lastImportedMeetingId?: string;
		syncErrors?: string[];
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('fathom_integration_user_id_idx').on(table.userId),
	}
})

// Meeting records from Fathom
export const meetings = pgTable("meetings", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }), // Agency owner
	fathomMeetingId: text("fathomMeetingId").notNull().unique(), // Fathom's meeting ID
	projectId: text("projectId")
		.references(() => projects.id, { onDelete: "set null" }), // Optional: link to client project
	title: text("title").notNull(),
	startTime: timestamp("startTime", { mode: "date" }).notNull(),
	endTime: timestamp("endTime", { mode: "date" }).notNull(),
	duration: integer("duration").notNull(), // Duration in seconds
	recordedBy: text("recordedBy"), // User who recorded the meeting
	meetingUrl: text("meetingUrl"), // URL to Fathom meeting
	videoUrl: text("videoUrl"), // URL to video recording
	attendees: json("attendees").$type<Array<{
		name: string;
		email?: string;
		role?: string;
	}>>().notNull().default([]),
	hasTranscript: boolean("hasTranscript").notNull().default(false),
	hasInsights: boolean("hasInsights").notNull().default(false),
	isProcessed: boolean("isProcessed").notNull().default(false), // Transcript + insights extracted
	isInMemory: boolean("isInMemory").notNull().default(false), // Stored in Pinecone
	processingStatus: text("processingStatus", {
		enum: ["pending", "processing", "completed", "failed"]
	}).notNull().default("pending"),
	metadata: json("metadata").$type<{
		platform?: string; // zoom, google_meet, teams, etc.
		teamId?: string;
		tags?: string[];
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('meeting_user_id_idx').on(table.userId),
		projectIdIdx: index('meeting_project_id_idx').on(table.projectId),
		fathomMeetingIdIdx: index('meeting_fathom_id_idx').on(table.fathomMeetingId),
		startTimeIdx: index('meeting_start_time_idx').on(table.startTime),
		isProcessedIdx: index('meeting_is_processed_idx').on(table.isProcessed),
	}
})

// Meeting transcripts with speaker attribution
export const meetingTranscripts = pgTable("meeting_transcripts", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	meetingId: text("meetingId")
		.notNull()
		.references(() => meetings.id, { onDelete: "cascade" }),
	fullTranscript: text("fullTranscript").notNull(), // Complete transcript text
	segments: json("segments").$type<Array<{
		speaker: string;
		text: string;
		timestamp: number; // Seconds from start
		duration: number;
	}>>().notNull().default([]),
	summary: text("summary"), // Fathom AI summary
	actionItems: json("actionItems").$type<Array<{
		text: string;
		assignee?: string;
		dueDate?: string;
		completed: boolean;
	}>>().notNull().default([]),
	keywords: json("keywords").$type<string[]>().notNull().default([]), // Extracted keywords
	isChunked: boolean("isChunked").notNull().default(false), // Split into embedding chunks
	chunksStored: integer("chunksStored").notNull().default(0), // Number of chunks in Pinecone
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		meetingIdIdx: index('meeting_transcript_meeting_id_idx').on(table.meetingId),
	}
})

// AI-extracted insights from meetings
export const meetingInsights = pgTable("meeting_insights", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	meetingId: text("meetingId")
		.notNull()
		.references(() => meetings.id, { onDelete: "cascade" }),
	insightType: text("insightType", {
		enum: ["decision", "action_item", "risk", "opportunity", "requirement", "feedback", "commitment", "question"]
	}).notNull(),
	content: text("content").notNull(),
	speaker: text("speaker"), // Who said it
	timestamp: integer("timestamp"), // Seconds from meeting start
	importance: integer("importance").notNull().default(5), // 0-10 scale
	category: text("category"), // e.g., 'budget', 'timeline', 'technical', 'business'
	relatedClientId: text("relatedClientId")
		.references(() => clientProfiles.id, { onDelete: "set null" }), // Link to client profile
	relatedProjectId: text("relatedProjectId")
		.references(() => projects.id, { onDelete: "set null" }), // Link to project
	isPineconeStored: boolean("isPineconeStored").notNull().default(false), // Stored in vector DB
	pineconeId: text("pineconeId"), // Reference to Pinecone vector
	metadata: json("metadata").$type<{
		sentiment?: string; // positive, negative, neutral
		confidence?: number; // AI extraction confidence
		tags?: string[];
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		meetingIdIdx: index('meeting_insight_meeting_id_idx').on(table.meetingId),
		insightTypeIdx: index('meeting_insight_type_idx').on(table.insightType),
		relatedClientIdIdx: index('meeting_insight_client_id_idx').on(table.relatedClientId),
		relatedProjectIdIdx: index('meeting_insight_project_id_idx').on(table.relatedProjectId),
	}
})

// Client intelligence profiles (auto-populated from meeting data)
export const clientProfiles = pgTable("client_profiles", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }), // Agency owner
	projectId: text("projectId")
		.references(() => projects.id, { onDelete: "set null" }), // Optional: link to project
	clientName: text("clientName").notNull(),
	clientEmail: text("clientEmail"), // May not always be available
	companyName: text("companyName"),
	role: text("role"), // e.g., 'CEO', 'Product Manager', 'Stakeholder'

	// Auto-populated intelligence fields
	communicationStyle: text("communicationStyle"), // e.g., 'direct', 'collaborative', 'detail-oriented'
	priorities: json("priorities").$type<string[]>().notNull().default([]), // Detected priorities
	concerns: json("concerns").$type<string[]>().notNull().default([]), // Common concerns/risks
	preferences: json("preferences").$type<{
		meetingFrequency?: string;
		communicationChannels?: string[];
		decisionMakingStyle?: string;
		[key: string]: any;
	}>().notNull().default({}),

	// Interaction stats
	totalMeetings: integer("totalMeetings").notNull().default(0),
	lastMeetingDate: timestamp("lastMeetingDate", { mode: "date" }),
	totalInteractions: integer("totalInteractions").notNull().default(0), // Meetings + emails + calls
	sentimentScore: integer("sentimentScore").notNull().default(0), // -100 to +100

	// Relationship intelligence
	keyTopics: json("keyTopics").$type<string[]>().notNull().default([]), // Topics discussed frequently
	sharedGoals: json("sharedGoals").$type<string[]>().notNull().default([]),
	pastFeedback: json("pastFeedback").$type<Array<{
		date: string;
		feedback: string;
		sentiment: string;
	}>>().notNull().default([]),

	// Vector storage
	isPineconeStored: boolean("isPineconeStored").notNull().default(false),
	pineconeId: text("pineconeId"), // Embedding of full profile

	metadata: json("metadata").$type<{
		industry?: string;
		companySize?: string;
		budget?: number;
		timezone?: string;
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('client_profile_user_id_idx').on(table.userId),
		projectIdIdx: index('client_profile_project_id_idx').on(table.projectId),
		clientEmailIdx: index('client_profile_email_idx').on(table.clientEmail),
	}
})

// Timeline of all client touchpoints
export const clientInteractions = pgTable("client_interactions", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	clientProfileId: text("clientProfileId")
		.notNull()
		.references(() => clientProfiles.id, { onDelete: "cascade" }),
	meetingId: text("meetingId")
		.references(() => meetings.id, { onDelete: "set null" }), // Optional: link to meeting
	projectId: text("projectId")
		.references(() => projects.id, { onDelete: "set null" }), // Optional: link to project
	interactionType: text("interactionType", {
		enum: ["meeting", "email", "call", "slack", "task_comment", "feedback", "other"]
	}).notNull(),
	summary: text("summary").notNull(), // Brief summary of interaction
	details: text("details"), // Full details/notes
	outcome: text("outcome"), // Result of interaction
	sentiment: text("sentiment", {
		enum: ["positive", "neutral", "negative"]
	}),
	keyPoints: json("keyPoints").$type<string[]>().notNull().default([]),
	actionItems: json("actionItems").$type<Array<{
		text: string;
		assignee?: string;
		dueDate?: string;
		completed: boolean;
	}>>().notNull().default([]),
	interactionDate: timestamp("interactionDate", { mode: "date" }).notNull(),
	isPineconeStored: boolean("isPineconeStored").notNull().default(false),
	pineconeId: text("pineconeId"),
	metadata: json("metadata").$type<{
		duration?: number; // For meetings/calls
		participants?: string[];
		source?: string; // fathom, manual, etc.
		[key: string]: any;
	}>().notNull().default({}),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		clientProfileIdIdx: index('client_interaction_client_id_idx').on(table.clientProfileId),
		meetingIdIdx: index('client_interaction_meeting_id_idx').on(table.meetingId),
		projectIdIdx: index('client_interaction_project_id_idx').on(table.projectId),
		interactionDateIdx: index('client_interaction_date_idx').on(table.interactionDate),
		interactionTypeIdx: index('client_interaction_type_idx').on(table.interactionType),
	}
})

// ==================== SLACK INTEGRATION ====================

// Slack Integration - stores OAuth credentials
export const slackIntegrations = pgTable("slack_integration", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	userId: text("userId")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	accessToken: text("accessToken").notNull(),
	teamId: text("teamId").notNull(), // Slack workspace ID
	teamName: text("teamName").notNull(),
	botUserId: text("botUserId"), // Bot user ID
	scope: text("scope"), // Granted OAuth scopes
	lastSyncAt: timestamp("lastSyncAt", { mode: "date" }),
	autoSyncEnabled: boolean("autoSyncEnabled").notNull().default(true),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		userIdIdx: index('slack_integration_user_id_idx').on(table.userId),
	}
})

// Slack Threads - imported conversations stored as client interactions
export const slackThreads = pgTable("slack_thread", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	slackIntegrationId: text("slackIntegrationId")
		.notNull()
		.references(() => slackIntegrations.id, { onDelete: "cascade" }),
	clientInteractionId: text("clientInteractionId")
		.references(() => clientInteractions.id, { onDelete: "set null" }),
	slackThreadTs: text("slackThreadTs").notNull(), // Thread timestamp (unique identifier)
	channelId: text("channelId").notNull(),
	channelName: text("channelName").notNull(),
	messageCount: integer("messageCount").notNull().default(0),
	participantCount: integer("participantCount").notNull().default(0),
	firstMessageAt: timestamp("firstMessageAt", { mode: "date" }),
	lastMessageAt: timestamp("lastMessageAt", { mode: "date" }),
	metadata: json("metadata").$type<{
		participants?: string[];
		tags?: string[];
		[key: string]: any;
	}>().notNull().default({}),
	importedAt: timestamp("importedAt", { mode: "date" }).notNull().defaultNow(),
	createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => {
	return {
		slackIntegrationIdIdx: index('slack_thread_integration_id_idx').on(table.slackIntegrationId),
		clientInteractionIdIdx: index('slack_thread_interaction_id_idx').on(table.clientInteractionId),
		threadTsIdx: index('slack_thread_ts_idx').on(table.slackThreadTs),
		channelIdIdx: index('slack_thread_channel_id_idx').on(table.channelId),
	}
})