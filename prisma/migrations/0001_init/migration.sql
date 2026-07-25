-- CreateTable
CREATE TABLE "bb_series" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bb_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_topics" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'global',
    "seriesId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "status" TEXT NOT NULL DEFAULT 'idea',
    "scoreTotal" DOUBLE PRECISION,
    "scores" JSONB,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bb_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_content_items" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'research',
    "coverTemplate" TEXT NOT NULL DEFAULT 'truth',
    "coverTitleLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishNote" TEXT NOT NULL DEFAULT 'AI辅助创作,内容仅作知识科普。',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "producedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bb_content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_research" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "coreClaim" TEXT NOT NULL,
    "supportingFacts" JSONB NOT NULL,
    "counterarguments" JSONB NOT NULL DEFAULT '[]',
    "riskNotes" JSONB NOT NULL DEFAULT '[]',
    "usableExamples" JSONB NOT NULL DEFAULT '[]',
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_scripts" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "beats" JSONB NOT NULL,
    "fullText" TEXT NOT NULL,
    "durationEstSec" INTEGER NOT NULL DEFAULT 90,
    "qcReport" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_storyboards" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "shots" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_storyboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_assets" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "shotIndex" INTEGER,
    "provider" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_approvals" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_publications" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'douyin',
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "shareUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_metric_snapshots" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "atHours" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION,
    "avgWatchSec" DOUBLE PRECISION,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "followersDelta" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_insights" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_pipeline_events" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bb_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "bb_series_slug_key" ON "bb_series"("slug");

-- CreateIndex
CREATE INDEX "bb_topics_status_idx" ON "bb_topics"("status");

-- CreateIndex
CREATE INDEX "bb_topics_category_region_idx" ON "bb_topics"("category", "region");

-- CreateIndex
CREATE INDEX "bb_topics_scoreTotal_idx" ON "bb_topics"("scoreTotal");

-- CreateIndex
CREATE INDEX "bb_content_items_stage_idx" ON "bb_content_items"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "bb_research_contentItemId_key" ON "bb_research"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "bb_scripts_contentItemId_version_key" ON "bb_scripts"("contentItemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "bb_storyboards_contentItemId_version_key" ON "bb_storyboards"("contentItemId", "version");

-- CreateIndex
CREATE INDEX "bb_assets_contentItemId_kind_idx" ON "bb_assets"("contentItemId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "bb_metric_snapshots_publicationId_atHours_key" ON "bb_metric_snapshots"("publicationId", "atHours");

-- CreateIndex
CREATE INDEX "bb_pipeline_events_contentItemId_idx" ON "bb_pipeline_events"("contentItemId");

-- CreateIndex
CREATE INDEX "bb_pipeline_events_createdAt_idx" ON "bb_pipeline_events"("createdAt");

-- AddForeignKey
ALTER TABLE "bb_topics" ADD CONSTRAINT "bb_topics_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "bb_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_content_items" ADD CONSTRAINT "bb_content_items_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "bb_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_research" ADD CONSTRAINT "bb_research_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_scripts" ADD CONSTRAINT "bb_scripts_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_storyboards" ADD CONSTRAINT "bb_storyboards_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_assets" ADD CONSTRAINT "bb_assets_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_approvals" ADD CONSTRAINT "bb_approvals_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_publications" ADD CONSTRAINT "bb_publications_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_metric_snapshots" ADD CONSTRAINT "bb_metric_snapshots_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "bb_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_pipeline_events" ADD CONSTRAINT "bb_pipeline_events_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

