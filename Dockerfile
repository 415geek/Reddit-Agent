FROM node:20-alpine AS base

# Dependencies stage
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Build stage
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
# --ignore-scripts:此时源码还没 COPY 进来,postinstall 的 prisma generate 会找不到 schema;
# 下面 COPY 完源码后再显式执行一次
RUN npm ci --ignore-scripts
COPY . .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/.bin/tsx ./node_modules/.bin/tsx
COPY --from=builder /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3031
ENV PORT=3031
CMD ["./entrypoint.sh"]
