# VerifyOne — 部署说明

## 本地运行（demo 模式，无需任何 Key）

```bash
cd verifyone
npm install
cp .env.example .env.local      # 默认 PROVIDER_MODE=mock，开箱即用
npm run dev                     # http://localhost:3000
```

验证：`npm run typecheck && npm run test && npm run build`

## Vercel 部署

1. Vercel → New Project → 选择本仓库，**Root Directory 设为 `verifyone`**
2. Framework 自动识别 Next.js；无需自定义构建命令
3. 环境变量（Production/Preview 均需）：
   - `PROVIDER_MODE=mock`（拿到真实 Key 并实现 live 适配器前保持 mock）
   - `DATASF_APP_TOKEN`（可选，提升 Socrata 限流）
   - Phase 2+：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、各供应商 Key、Stripe Key
4. Deploy。demo 模式下功能完整（DataSF 为真实数据，其余为标注 Mock）

## Supabase 接入（Phase 2）

1. 创建 Supabase 项目 → SQL Editor 执行 `supabase/migrations/0001_init.sql`
2. 确认 RLS 已启用（迁移已包含）；Auth → 启用 Email 登录
3. 把三个 Supabase 环境变量填入 Vercel
4. `provider_responses` / `provider_cache` / `audit_logs` 无用户策略，仅 service role 可读——服务端专用

## 安全检查清单（每次上线前）

- [ ] `git grep -i "api_key\|secret"` 确认无硬编码密钥
- [ ] 浏览器 Network 面板确认无第三方供应商请求（全部走 /api/*）
- [ ] `PROVIDER_MODE=live` 时启动日志确认所有 live 适配器 Key 就绪（缺失会 fail fast）
- [ ] 限流生效（连续请求返回 429）
- [ ] 未勾选 AUP 的 execute 返回 403
