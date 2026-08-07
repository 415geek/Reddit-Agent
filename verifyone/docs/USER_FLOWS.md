# VerifyOne — 用户流程

## 1. 核心查询流程（未登录可体验，执行需登录/额度 — Phase 1 demo 模式免登录）

```
首页
 └─ 输入框键入任意内容 → 点击 Search
     └─ POST /api/search {mode:"estimate"}
         ├─ 识别失败（人名）→ 提示“姓名搜索暂不支持” + 建议改用电话/Email/地址
         ├─ 识别失败（无法识别/无效格式）→ 具体纠错建议
         └─ 识别成功 → 确认卡片：
              · 识别出的类型与标准化值
              · 将调用的数据源清单与费用
              · “approximately X credits”
              · AUP 同意勾选框（记录时间与版本）
              └─ 点击 Run search
                  └─ POST /api/search {mode:"execute", acceptedUsePolicy:true}
                      ├─ 进度分阶段展示（Validating → Identity → Contact → … → Building report）
                      ├─ 部分 Provider 失败 → 仍出报告，失败源标注且不扣费
                      └─ 跳转 /report/[id]
```

## 2. 报告阅读流程

```
/report/[id]
 ├─ 顶部：姓名/未解析、位置、综合置信度徽章、数据获取日期、已用额度、风险摘要
 ├─ Mock 数据横幅（demo 模式下强制显示）
 ├─ 卡片（可折叠，空卡片默认收起）：
 │   Identity / Contact / Address / Employment / Property / Business / Risk
 ├─ 每个字段：值 + 置信度徽章 + 冲突提示 + “Why am I seeing this?” 展开来源明细
 └─ 底部：本次调用的全部数据源、状态、耗时、费用（含 cache hit 标记）
```

## 3. 空结果流程

无法置信匹配时显示 “We could not confidently match this information.” 并给出建议：
补充城市/州、换一个号码、补充 Email、检查拼写、用关联公司搜索。

## 4. 历史与数据删除

```
/history → 历史列表（时间、类型、额度、成功源数）→ 点击回到报告
账户设置（Phase 2+）→ 删除单条历史 / 清空历史 / 永久删除账户（deletion_requests 表跟踪）
```

## 5. 注册/登录（Phase 2，Supabase Auth）

注册 → 触发器自动建 profile + 赠送 20 credits → 首次搜索前强制勾选 AUP（记录版本与时间戳）。

## 6. 管理员流程（Phase 4）

登录（role=admin）→ 仪表盘：当日查询/成功率/成本、Provider 错误率、可疑用户 → 单独开关任一 Provider → 处理删除请求与合规投诉。
