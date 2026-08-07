-- 反转点镜头下标。合成时在这一刻把 BGM 压到近乎无声再重回,并落一记低频撞击——
-- 这是参考视频里最明显的节奏手法(实测:静默约3秒后 100ms 内跳升 35dB)。
ALTER TABLE "bb_storyboards" ADD COLUMN "turnShotIdx" INTEGER;
