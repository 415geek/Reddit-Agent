-- 证据链与反方审稿:核实产出主张清单,审稿产出报告和百分制质量分
ALTER TABLE "bb_research" ADD COLUMN "claims" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "bb_notes" ADD COLUMN "criticReport" JSONB;
ALTER TABLE "bb_notes" ADD COLUMN "qualityScores" JSONB;
