# 成片合成 worker:node + ffmpeg + 中文字体。
# 不用 alpine——alpine 的 ffmpeg 编解码器裁剪过,而且中文字体包不全,
# 字幕会烧成一排方框。合成机器多几十 MB 镜像不值得省。
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-noto-cjk \
      fontconfig \
      ca-certificates \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# worker 只用 node 内置模块 + ffmpeg,没有 npm 依赖
COPY worker ./worker

ENV NODE_ENV=production
# 和 fonts-noto-cjk 里的族名对上
ENV SUBTITLE_FONT="Noto Sans CJK SC"

CMD ["node", "worker/compose-worker.mjs"]
