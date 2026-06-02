-- CreateTable
CREATE TABLE "marketvoice_sources" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "rssUrl" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "region" TEXT,
    "sourceType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketvoice_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketvoice_posts" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "rawContent" TEXT,
    "matchedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRelevant" BOOLEAN NOT NULL DEFAULT false,
    "detectedCity" TEXT,
    "detectedState" TEXT,
    "locationConfidence" TEXT,
    "businessType" TEXT,
    "asianRestaurantSignal" BOOLEAN NOT NULL DEFAULT false,
    "cuisineType" TEXT,
    "topicCategory" TEXT,
    "competitorsMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyingIntent" TEXT,
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "marketScore" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "suggestedAction" TEXT,
    "salesAngle" TEXT,
    "aiRawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketvoice_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketvoice_daily_reports" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "totalPostsScanned" INTEGER NOT NULL DEFAULT 0,
    "relevantPosts" INTEGER NOT NULL DEFAULT 0,
    "highIntentLeads" INTEGER NOT NULL DEFAULT 0,
    "topCities" JSONB,
    "topCompetitors" JSONB,
    "topPainPoints" JSONB,
    "summary" TEXT,
    "recommendedActions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketvoice_daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketvoice_posts_url_key" ON "marketvoice_posts"("url");

-- CreateIndex
CREATE INDEX "marketvoice_posts_subreddit_idx" ON "marketvoice_posts"("subreddit");

-- CreateIndex
CREATE INDEX "marketvoice_posts_buyingIntent_idx" ON "marketvoice_posts"("buyingIntent");

-- CreateIndex
CREATE INDEX "marketvoice_posts_leadScore_idx" ON "marketvoice_posts"("leadScore");

-- CreateIndex
CREATE INDEX "marketvoice_posts_postedAt_idx" ON "marketvoice_posts"("postedAt");

-- CreateIndex
CREATE INDEX "marketvoice_posts_detectedCity_detectedState_idx" ON "marketvoice_posts"("detectedCity", "detectedState");

-- CreateIndex
CREATE INDEX "marketvoice_posts_isRelevant_idx" ON "marketvoice_posts"("isRelevant");

-- CreateIndex
CREATE UNIQUE INDEX "marketvoice_daily_reports_reportDate_key" ON "marketvoice_daily_reports"("reportDate");

-- AddForeignKey
ALTER TABLE "marketvoice_posts" ADD CONSTRAINT "marketvoice_posts_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "marketvoice_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
