# 北美餐饮小红书内容系统 · 架构与验收对照

本文档对照《多 Agent 智能内容系统研发总提示词》,记录本系统的实现映射、
刻意取舍和验收状态。原则照单全收,规模按实际情况裁剪:
**单人单号、跑在 Vercel serverless(60 秒函数上限)上的系统,
不引入它撑不起也不需要的基础设施。**

## 一、Agent 职责矩阵(文档 Agent → 实现)

| 文档中的 Agent | 实现 | 位置 |
|---|---|---|
| Agent 0 总编辑调度 | **程序状态机**(code-driven,非 LLM):阶段推进、失败关闭、回跳、熔断、预算 | `lib/agents/note-pipeline.ts` `tick.ts` |
| A 社交趋势侦察 | 部分:联网搜索补题覆盖英文行业面;小红书/TikTok 抓取涉平台权限,列入后续 | `lib/agents/refill.ts` |
| B 政策商业情报 | 白名单采集(联邦公报按机构、DOL、行业媒体×14,逐个实测)+ 全文抓取 | `lib/sources/*` |
| C 用户痛点挖掘 | 未建(需评论区数据回流,第三阶段) | — |
| D 竞品与空白 | 部分:选题九维里的 contentGap 维度 + 近 60 条选题去重 | 选题提示词 |
| E 来源验证与核查 | **verify 阶段**:逐条主张定级七档,产出 ClaimEvidenceMap | `runVerify` |
| F 选题策略评分 | 九维评分(痛点20/实操15/北美15/新颖10/证据15/收藏10/转发5/视觉5/空白5),门槛 75 程序侧强制 | `pickNoteTopics` `refillTopics` |
| G 深度研究 | research 阶段(挖全文所有数字/日期/机构,禁并列变因果) | `runResearch` |
| H 内容结构设计 | 并入写稿(固定卡片结构 + 内页推进顺序);单人号不需要三角度赛马 | 写稿提示词 |
| I 专业文案 | note 阶段,带证据使用纪律(七档证据各自的用法) | `runNote` |
| J 视觉策略 | 程序化版式(next/og 直出)+ 统一风格常量,比自由视觉说明更稳 | `lib/cards/*` |
| K 反方审稿 | **critic 阶段**:专职推翻,百分制打分,事实层问题退回 verify | `runCritic` |
| L 合规与品牌安全 | qc 阶段(合规终审):红线、披露、AI 标注、平台安全、抽查出处 | `runQc` |
| M 最终编辑 | 并入 critic 打回重写循环(带完整审稿意见返工) | — |
| N 发布实验 | 不做自动发布(与文档底线一致);人工发布 + 已发布页登记 | 审批页 |
| O 数据复盘 | 已有雏形(24h/72h/168h 快照 + 周复盘),待接图文指标 | `retrospective.ts` |

## 二、阶段机(程序控制,LLM 只做限定子任务)

```
选题(评分≥75 才进池,人点入队)
  → research  挖料(全文抓取,禁并列变因果)
  → verify    证据核查:每条主张定级
                verified_fact / supported_inference / expert_opinion /
                anecdotal_evidence / unverified_claim / outdated / conflicting_sources
                verdict=fail → 抛错停产(失败关闭)
                verdict=degraded → 降级口径写入,全文按降级口径
  → note      写稿(证据使用纪律:核心结论只能用前两档;unverified 一字不用)
  → critic    反方审稿:百分制,门槛 总分85/事实18/实操16
                事实层致命问题 → backTo=verify 重走
                写作层问题 → 带意见重写,留在本阶段复审
                两轮额度用完 → 条目落 rejected(halt,推进链硬停)
  → qc        合规终审(红线/披露/AI标注/一致性/抽查出处)
  → cards     出图渲卡(唯一花钱在生图的阶段,可续跑)
  → awaiting_approval  人工审批(证据链逐条可见)→ 人工发布
```

## 三、可溯源机制

- **SourceItem** = SourceEvidence(URL 指纹去重、全文、采集时间、来源分类)
- **Research.claims** = ClaimEvidenceMap(七档定级 + jurisdiction + timeLimit)
- **Note.criticReport / qualityScores** = 审稿报告与百分制分
- **PipelineEvent** = Agent trace(每阶段 started/succeeded/failed + token 用量)
- 审批界面渲染整条证据链:每条主张带定级徽章、来源、适用范围、时点

## 四、失败关闭清单(实测过的)

| 场景 | 行为 |
|---|---|
| 核心主张 unverified/conflicting | verify 抛错,停产,熔断 30 分钟冷却 |
| 审稿事实层致命问题 | 退回 verify 重走(上限内) |
| 审稿两轮仍 <85 分 | 条目落 rejected + halt,**推进链硬停**(端到端实测抓到过失败开放漏洞并修复) |
| 选题 <75 分 | 程序侧拒收,不进池 |
| 全文抓不到(付费墙) | 退回摘要,核实按"素材里没有就不写"兜底 |
| 模型输出形状漂移 | 三种包装都接住,空结果记录原始形状 |

## 五、刻意不做的(及原因)

- **Temporal/Redis/pgvector/对象存储自建**:现有 状态机+Postgres+Supabase Storage 即文档说的
  "工作流引擎+主数据库+对象存储",单人规模上这些是纯运维负担
- **自动发布**:文档底线,双方一致;小红书也没有开放 API
- **小红书/TikTok 平台内抓取**:平台权限问题,现阶段由 Claude 联网搜索补位
- **多账号/多品牌/团队权限**:第四阶段,单号阶段不做

## 六、验收状态(文档第十四节逐条)

- [x] 核心事实映射来源(ClaimEvidenceMap,审批页可见)
- [x] 法规内容带地区与时效(jurisdiction/timeLimit 必填规则)
- [x] 无来源内容不包装成事实(七档定级 + 写稿纪律 + 审稿攻击)
- [x] Agent 执行可追踪(PipelineEvent + token 用量)
- [x] 每篇内容完整来源链可查(sources + claims + 原始素材链接)
- [x] 可识别来源冲突(conflicting_sources 档)
- [x] 可阻止低质量发布(85/18/16 三重门槛,实测拦下 69 分稿)
- [x] 未经审批不发布(系统本来就只到待审批)
- [x] 单 Agent 成本可查(每阶段 token 记入事件)
- [ ] 固定测试集比较 Prompt 版本(待建评估集)
- [ ] 真实发布数据形成建议(待图文指标回流,第三阶段)
