-- AlterTable
ALTER TABLE "bb_content_items" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'note';

-- 回填:这条迁移跑之前库里的每一条内容都是短视频。
-- 新列的默认值是 'note'(以后新建的都是图文),不回填的话历史视频会被
-- 全部标成图文,看板和阶段机会按图文的阶段序列去推它们,直接推不动。
UPDATE "bb_content_items" SET "kind" = 'video';

-- AlterTable
ALTER TABLE "bb_publications" ALTER COLUMN "platform" SET DEFAULT 'xiaohongshu';

-- AlterTable
ALTER TABLE "bb_topics" ADD COLUMN     "sourceItemId" TEXT;

-- CreateTable
CREATE TABLE "bb_source_feeds" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rss',
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'north_america',
    "weight" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bb_source_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_source_items" (
    "id" TEXT NOT NULL,
    "feedId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'north_america',
    "publishedAt" TIMESTAMP(3),
    "summary" TEXT,
    "rawText" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'new',
    "skipReason" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_source_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bb_notes" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "titleTop" TEXT NOT NULL,
    "titleBottom" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "noteTitle" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources" JSONB NOT NULL DEFAULT '[]',
    "qcReport" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bb_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bb_source_feeds_slug_key" ON "bb_source_feeds"("slug");

-- CreateIndex
CREATE INDEX "bb_source_feeds_active_category_idx" ON "bb_source_feeds"("active", "category");

-- CreateIndex
CREATE UNIQUE INDEX "bb_source_items_fingerprint_key" ON "bb_source_items"("fingerprint");

-- CreateIndex
CREATE INDEX "bb_source_items_status_collectedAt_idx" ON "bb_source_items"("status", "collectedAt");

-- CreateIndex
CREATE INDEX "bb_source_items_category_publishedAt_idx" ON "bb_source_items"("category", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "bb_notes_contentItemId_version_key" ON "bb_notes"("contentItemId", "version");

-- CreateIndex
CREATE INDEX "bb_content_items_kind_stage_idx" ON "bb_content_items"("kind", "stage");

-- AddForeignKey
ALTER TABLE "bb_source_items" ADD CONSTRAINT "bb_source_items_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "bb_source_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_topics" ADD CONSTRAINT "bb_topics_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "bb_source_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bb_notes" ADD CONSTRAINT "bb_notes_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "bb_content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
