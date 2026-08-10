# VerifyOne — 精简版 PRD (v0.1)

## 一句话定位

“Verify people, contacts, properties, and businesses from one simple search.”
面向美国市场的公开信息核验与聚合工具：一个输入框 → 一次确认 → 一份可信、可追溯来源的报告。

## V1 范围决策（重要）

| 决策 | 结论 | 理由 |
|---|---|---|
| 搜索类型 | **仅电话 / Email / 地址** | 采纳建议：姓名搜索误匹配率高、成本高、法律风险大。UI 明确解释并引导用户改用其他入口 |
| 姓名/公司/社交链接搜索 | 延后到 V2 | 需要辅助条件 + 更强的实体消歧 |
| 商业注册数据 | **新增 DataSF + CA SOS 适配器**（本次补充需求） | DataSF 是免费开放 API（旧金山注册商户），零成本即可上线真实数据；CA SOS 无官方公开 API，先以 Mock 适配器占位，上线时接 Middesk / Cobalt 等持牌供应商或 SOS 批量数据订阅 |
| 订阅计费 | Phase 4 | MVP 用注册赠送额度 + 管理员手动加额 + Stripe 测试模式 |

## 目标用户

普通用户（验证陌生联系人）、小企业主、销售/BD、房东与房产投资者、营销团队、企业尽调。
**禁止用途**（产品层面阻止 + 条款约束）：雇佣/租客/信贷/保险决策（FCRA）、跟踪骚扰、非法获取敏感信息。
全站展示：“This service is not a consumer reporting agency and may not be used for purposes governed by the Fair Credit Reporting Act.”

## 核心功能（MVP）

1. **Universal Search**：单一输入框，自动识别电话（E.164 化、手机/座机/VoIP 判断）、Email（小写化、格式校验）、美国地址（标准化街道/城市/州/ZIP）。
2. **成本预览**：执行前显示“This search will use approximately X credits”与将调用的数据源清单，用户确认后才执行。
3. **Smart Orchestrator**：按输入类型并行调用支持该类型的 Provider；单个 Provider 失败不影响整体报告，失败不扣额度。
4. **Entity Resolution**：跨源标准化、去重、合并；单值字段冲突时保留竞争值并标记 “Conflicting — Multiple sources returned different information.”，绝不强行合并。
5. **Unified Report**：卡片式报告（Identity / Contact / Address / Employment / Property / Business Connections / Risk Signals），顶部为姓名、位置、综合置信度、数据时间、风险摘要。
6. **Source Transparency**：每个字段都带来源、查询时间、原始值和置信度，“Why am I seeing this?” 可展开。
7. **风险措辞红线**：只允许 “Potential public-record match requiring manual verification.”，禁止任何定性指控。
8. **Search History**：登录后查看/收藏/备注/删除历史；可永久删除账户数据。
9. **成本控制**：每次 API 调用记录 provider/endpoint/cost/cache/user/时间；缓存命中不扣费；失败自动退款；平台日预算上限与单用户日限额。

## 数据源

| Provider | 用途 | V1 状态 |
|---|---|---|
| Trestle | 反查电话/地址、电话验证、Email 关联 | Mock 适配器（接口已定型，Phase 2 接真实 API） |
| People Data Labs | 职业/教育/公司 enrichment | Mock 适配器 |
| RentCast | 房产记录、业主、估值 | Mock 适配器 |
| OpenSanctions | 制裁/PEP/watchlist | Mock 适配器（Mock 永远返回无风险，避免伪造风险数据） |
| **DataSF** | 旧金山注册商户（Registered Business Locations, Socrata `g8m3-pdis`） | **真实 API，免费，已接通**（无 token 可用，token 提升限流） |
| **CA SOS** | 加州公司注册（bizfile） | Mock 适配器 + 上线路径：持牌供应商（Middesk/Cobalt）或 SOS 批量数据 |

新增供应商 = 实现一个 `DataProvider` 适配器 + 在 registry 注册一行，其余系统不变。

## 置信度模型

- High：≥2 个独立真实来源一致
- Medium：单一真实来源
- Low：仅 Mock 或弱信号
- Conflicting：来源互相矛盾（UI 黄色标记并列出竞争值）

## 成功指标（MVP 验收）

新用户 60 秒内完成注册 → 首页输入电话 → 看到额度预估 → 确认 → 合理时间内拿到报告 → 能分辨可信/需核实字段 → 能看到每项数据来源 → 移动端单手完成全部流程。
技术验收：API Key 不出后端、Provider 失败不整页崩溃、重复查询走缓存、每次调用有成本记录、RLS 隔离用户数据、审计日志覆盖敏感操作。
