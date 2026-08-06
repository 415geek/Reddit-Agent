# VerifyOne — MVP 页面结构

| 路由 | 内容 | 状态 |
|---|---|---|
| `/` | Logo、一句话价值主张、大搜索框、Search 按钮、3 个示例查询、隐私说明、（Phase 2：登录入口） | ✅ Phase 1 |
| `/report/[id]` | 统一报告页：摘要头 + 7 张卡片 + 来源明细 | ✅ Phase 1 |
| `/history` | 查询历史列表 | ✅ Phase 1（内存版） |
| `/legal/privacy` | Privacy Policy（含 CCPA 入口说明） | ✅ Phase 1（草稿） |
| `/legal/terms` | Terms of Service（含 FCRA 免责） | ✅ Phase 1（草稿） |
| `/legal/aup` | Acceptable Use Policy | ✅ Phase 1（草稿） |
| `/login` `/signup` | Supabase Auth | Phase 2 |
| `/account` | 额度余额、流水、删除数据 | Phase 2 |
| `/admin` | 管理员仪表盘、Provider 开关 | Phase 4 |

## 移动端要求（已落实）

- 搜索框 h-14（56px）、按钮 ≥44px
- 无横向滚动；卡片 `<details>` 可折叠，空卡片默认收起
- 报告字段纵向堆叠，次要信息（来源明细）默认收起

## API 路由

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/search` | POST | `mode:"estimate"` 返回识别结果+费用预估；`mode:"execute"` 执行（需 AUP 同意），返回 reportId。422=无法识别，403=未同意，429=限流 |
| `/api/report/[id]` | GET | 返回完整 SearchReport JSON |
