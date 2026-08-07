# VerifyOne — MVP 开发任务清单

## Phase 1 — 项目基础 ✅（本次交付）

- [x] Next.js 14 + TypeScript strict + Tailwind 初始化（`verifyone/` 独立子项目）
- [x] 首页 + 通用搜索框 + 示例查询
- [x] 输入类型自动识别与标准化（phone E.164 / email / US address；拒绝姓名搜索并解释）
- [x] Provider Adapter 统一接口 + 注册表（mock/live 模式切换，live 缺 Key fail fast）
- [x] Mock Providers：Trestle / PDL / RentCast / OpenSanctions / CA SOS
- [x] **DataSF 真实 API 适配器**（免费 Socrata，SF 地址自动触发）
- [x] 查询编排（并行、超时、失败隔离、失败不扣费）
- [x] Entity Resolution + 置信度 + 冲突标记
- [x] 报告页（7 卡片、字段级来源、“Why am I seeing this?”）
- [x] 费用预估 → 确认 → 执行流程（AUP 同意强制）
- [x] 响应缓存 + IP 限流（内存版）
- [x] 查询历史页（内存版）
- [x] 法律页面草稿（Privacy / Terms / AUP，FCRA 免责全站页脚）
- [x] Supabase schema 迁移 SQL（RLS + 注册赠额触发器）
- [x] 单元测试（parser / entity resolution）

## Phase 2 — 第一个真实数据源

- [ ] Supabase 项目创建 + 应用 `0001_init.sql`
- [ ] Supabase Auth（注册/登录/登出，60 秒注册流程）
- [ ] store/cache/限流迁移到 Supabase（RLS 验证：用户看不到他人查询）
- [ ] Trestle live 适配器（Phone Validation / Reverse Phone / Reverse Address）
- [ ] credit_transactions 扣费 + 失败退款落库
- [ ] AUP 同意落库（时间戳 + 版本）
- [ ] 错误监控（Sentry）

## Phase 3 — 多数据源

- [ ] PDL / RentCast / OpenSanctions live 适配器
- [ ] CA SOS：选型持牌供应商（Middesk / Cobalt Intelligence）或 SOS 批量数据订阅
- [ ] 二跳编排（电话→地址→房产；地址→业主→身份）
- [ ] 置信度模型引入真实来源权重

## Phase 4 — 商业化

- [ ] Stripe 测试模式 + 套餐（Free Trial / Basic / Pro / Business）
- [ ] PDF 导出、收藏、备注、标签
- [ ] 管理员后台（成本仪表盘、Provider 开关、用户额度管理、删除请求处理）

## Phase 5 — 安全与上线

- [ ] 分布式限流（Upstash）+ CAPTCHA + 异常行为冻结
- [ ] 平台日成本熔断（DAILY_PLATFORM_BUDGET_USD）
- [ ] 律师审阅法律页面；CCPA 请求流程上线
- [ ] Lighthouse 移动端性能 + 无障碍检查
- [ ] 原始数据保留期清理任务（provider_responses.expires_at）
