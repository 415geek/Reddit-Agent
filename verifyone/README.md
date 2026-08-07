# VerifyOne

面向美国市场的个人/企业公开信息核验与聚合工具（Phase 1 MVP）。

**一句话体验**：输入电话 / Email / 地址 → 确认额度 → 获得带来源与置信度的统一报告。

## 快速开始（无需任何 API Key）

```bash
cd verifyone
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

默认 `PROVIDER_MODE=mock`：付费数据源（Trestle / People Data Labs / RentCast /
OpenSanctions / CA SOS）由明确标注的 Mock 适配器代替；**DataSF（旧金山商户注册，
免费开放 API）始终真实调用** —— 用示例地址 `548 Market St, San Francisco, CA 94104`
即可看到真实开放数据出现在 Business Connections 卡片。

## 命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run typecheck` | TypeScript 严格检查 |
| `npm run test` | 单元测试（vitest） |

## 文档

- [精简 PRD](docs/PRD.md)
- [用户流程](docs/USER_FLOWS.md)
- [页面结构](docs/PAGES.md)
- [系统架构与 API](docs/ARCHITECTURE.md)
- [开发任务清单](docs/TASKS.md)
- [部署说明（Vercel + Supabase）](docs/DEPLOYMENT.md)
- 数据库 schema：[supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)

## 合规红线（产品内已落实）

- 全站页脚 FCRA 免责声明；执行搜索前强制勾选 Acceptable Use 同意
- V1 不支持姓名搜索（避免误匹配），UI 明确解释
- 风险信号只使用 “Potential public-record match requiring manual verification.” 措辞
- 来源冲突时显示 “Multiple sources returned different information.”，绝不强行合并
- 第三方 Key 仅存在于服务端；Mock 与生产数据严格隔离（live 模式缺 Key 直接启动失败）
