-- 分镜记下这条片子的BGM情绪(suspense|momentum|insight|warm)。
-- 可空:老数据没有,选曲时按封面模板和选题品类兜底。
ALTER TABLE "bb_storyboards" ADD COLUMN "bgmMood" TEXT;
