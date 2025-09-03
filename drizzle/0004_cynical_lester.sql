CREATE SCHEMA "rag";
--> statement-breakpoint
CREATE TABLE "rag"."document_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_document_id" uuid,
	"child_document_id" uuid,
	"relation_type" varchar(50) NOT NULL,
	"relation_strength" integer DEFAULT 100,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rag"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(100),
	"text" text NOT NULL,
	"text_hash" varchar(64),
	"embedding" vector(1536),
	"embedding_model" varchar(50) DEFAULT 'text-embedding-3-small',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"search_vector" text,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"base_relevance" integer DEFAULT 100,
	"click_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"indexed_at" timestamp,
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar(255),
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "rag"."embedding_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"text_hash" varchar(64) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"embedding_model" varchar(50) DEFAULT 'text-embedding-3-small',
	"hit_count" integer DEFAULT 1,
	"last_accessed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	CONSTRAINT "embedding_cache_text_unique" UNIQUE("text"),
	CONSTRAINT "embedding_cache_text_hash_unique" UNIQUE("text_hash")
);
--> statement-breakpoint
CREATE TABLE "rag"."query_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"query_embedding" vector(1536),
	"query_intent" varchar(50),
	"entities" jsonb DEFAULT '{}'::jsonb,
	"returned_document_ids" jsonb DEFAULT '[]'::jsonb,
	"clicked_document_ids" jsonb DEFAULT '[]'::jsonb,
	"feedback_score" integer,
	"search_time_ms" integer,
	"total_results" integer,
	"user_id" varchar(255),
	"session_id" uuid,
	"source" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "rag"."document_relations" ADD CONSTRAINT "document_relations_parent_document_id_documents_id_fk" FOREIGN KEY ("parent_document_id") REFERENCES "rag"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."document_relations" ADD CONSTRAINT "document_relations_child_document_id_documents_id_fk" FOREIGN KEY ("child_document_id") REFERENCES "rag"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rag_rel_parent" ON "rag"."document_relations" USING btree ("parent_document_id");--> statement-breakpoint
CREATE INDEX "idx_rag_rel_child" ON "rag"."document_relations" USING btree ("child_document_id");--> statement-breakpoint
CREATE INDEX "idx_rag_rel_type" ON "rag"."document_relations" USING btree ("relation_type");--> statement-breakpoint
CREATE INDEX "idx_rag_embedding_hnsw" ON "rag"."documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_rag_source" ON "rag"."documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_rag_un_number" ON "rag"."documents" USING btree ((metadata->>'unNumber'));--> statement-breakpoint
CREATE INDEX "idx_rag_cas_number" ON "rag"."documents" USING btree ((metadata->>'casNumber'));--> statement-breakpoint
CREATE INDEX "idx_rag_hazard_class" ON "rag"."documents" USING btree ((metadata->>'hazardClass'));--> statement-breakpoint
CREATE INDEX "idx_rag_cfr_section" ON "rag"."documents" USING btree ((metadata->>'section'));--> statement-breakpoint
CREATE INDEX "idx_rag_sku" ON "rag"."documents" USING btree ((metadata->>'sku'));--> statement-breakpoint
CREATE INDEX "idx_rag_search_vector" ON "rag"."documents" USING gin (to_tsvector('english', "search_vector"));--> statement-breakpoint
CREATE INDEX "idx_rag_text_hash" ON "rag"."documents" USING btree ("text_hash");--> statement-breakpoint
CREATE INDEX "idx_rag_cache_hash" ON "rag"."embedding_cache" USING btree ("text_hash");--> statement-breakpoint
CREATE INDEX "idx_rag_cache_expires" ON "rag"."embedding_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_rag_cache_hits" ON "rag"."embedding_cache" USING btree ("hit_count");--> statement-breakpoint
CREATE INDEX "idx_rag_query_intent" ON "rag"."query_history" USING btree ("query_intent");--> statement-breakpoint
CREATE INDEX "idx_rag_query_user" ON "rag"."query_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rag_query_session" ON "rag"."query_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_rag_query_created" ON "rag"."query_history" USING btree ("created_at");