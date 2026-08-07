# VerifyOne — 系统架构与 API 设计

## 模块图

```
Browser (Next.js App Router, RSC + 少量 client 组件)
  │  仅调用自家 API，永不接触第三方 Key
  ▼
/api/search ──► Universal Parser (lib/search/parser.ts)
  │                 识别 phone/email/address，标准化，拒绝姓名搜索
  ▼
Orchestrator (lib/search/orchestrator.ts)
  │  按输入类型选择 Provider，并行调用，单源超时 10s，失败隔离+不扣费
  ├──► Provider Registry (lib/providers/registry.ts)
  │       PROVIDER_MODE=mock → Mock 适配器；live → 真实适配器（缺 Key 直接启动失败）
  │       ├─ Trestle adapter        （Phase 2 live）
  │       ├─ People Data Labs       （Phase 3 live）
  │       ├─ RentCast               （Phase 3 live）
  │       ├─ OpenSanctions          （Phase 3 live）
  │       ├─ DataSF  ★真实免费 API，两种模式下都 live
  │       └─ CA SOS  （Mock；上线接持牌供应商）
  ├──► Response Cache (lib/search/cache.ts)  命中不扣费；Phase 2 换 Supabase/Redis
  ▼
Entity Resolution (lib/search/entity-resolution.ts)
  │  标准化→合并→冲突标记→字段级来源与置信度
  ▼
Report Store (lib/store.ts)  Phase 1 内存；Phase 2 Supabase(searches/entities, RLS)
  ▼
/report/[id]  卡片式报告
```

## Provider 接口（新增供应商只写一个文件）

```ts
interface DataProvider {
  name: string;
  costCredits: number;
  supports(inputType: SearchInputType): boolean;
  search(input: NormalizedSearchInput): Promise<NormalizedProviderResult>;
}
```

统一产出 `NormalizedProviderResult`（person / properties / businesses / risks + status + lastUpdated），
Entity Resolution 只消费这个类型，不感知任何供应商细节。

## 编排规则（V1）

| 输入 | 调用 |
|---|---|
| phone | Trestle(反查+验证) → PDL → OpenSanctions → CA SOS |
| email | Trestle(Email 关联) → PDL → OpenSanctions → CA SOS |
| address | Trestle(反查地址) → RentCast → OpenSanctions → CA SOS → **DataSF（仅 SF 地址触发）** |

Phase 3 加二跳编排：反查电话得到地址→自动追加 RentCast；得到姓名→追加 PDL/OpenSanctions（每一跳都重新计费并展示）。

## 安全与成本控制

- 第三方 Key 全部在服务端环境变量，`NEXT_PUBLIC_` 前缀严格限制在 Supabase URL/anon key
- 每 Provider 调用：10s 超时、错误隔离、错误不扣费；结果缓存（成功 7 天 / miss 6 小时）
- IP 限流（Phase 1 内存固定窗口 20 次/小时；Phase 5 换 Upstash/Vercel Firewall）
- 执行搜索强制 AUP 同意（403 拦截），Supabase 落库同意时间与版本
- 输入用 zod 校验；报告输出不含任何原始供应商 payload（原始数据 admin-only + 30 天保留期）

## 已知 Phase 1 限制（刻意取舍）

- 内存 store/cache/限流：单实例、重启即失；Supabase 接入后替换，接口已按可替换设计
- 无登录：demo 模式免登录体验完整流程；Phase 2 接 Supabase Auth 后 execute 要求会话
- Mock 数据由输入哈希生成，确定性、明确标注，绝不与生产数据混用（live 模式缺 Key 会 fail fast）
