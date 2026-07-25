# 生意脑回路(BizBrain)— AI 内容工厂

抖音知识短视频的**内容工业化流水线**:85% 自动生产 + 15% 人工审批。

> 账号定位:用90秒讲透一个普通人每天都会遇到的商业、消费和赚钱机制。
> 简介:90秒看懂商业、消费与财富背后的隐藏规则。AI辅助创作,内容仅作知识科普。

## 流水线

```
每日定时(n8n 01)
  → 选题Agent生成30个候选 → 7维加权评分 → 风险选题自动淘汰
  → 人工在看板挑选入队(或自动取评分头部)
  → 资料研究Agent(强制来源,禁止编造)           n8n 02 循环调用 advance
  → 脚本Agent(60-100秒五段结构)
  → 分镜Agent(8-12张图 + 2-3个动态镜头)
  → Seedream生图 / Seedance图生视频 / 豆包TTS配音 / 字幕时间轴
  → 合成(Phase 2 接 Remotion/FFmpeg worker)
  → AI质检(错字/合规/时长/事实出处)
  → Telegram审批卡片(n8n 03)+ 网页审批队列
  → 人工发抖音(勾选AI声明)→ 看板登记链接        Phase 3 接开放平台
  → 24h/72h/168h 数据快照(n8n 04 提醒录入)
  → 每周AI复盘(n8n 05):只和账号自身基准比,自动产出续集选题/停产建议
```

## 内容策略(写死在 `lib/prompts/index.ts` / `lib/domain.ts`)

- 内容比例:40% 行为经济学 / 25% 消费营销心理 / 20% AI时代赚钱逻辑 / 15% 餐饮小生意案例
- **北美案例加重**:选题库种子约127条,其中50+条北美商业案例(Costco、星巴克、麦当劳地产模式、亚马逊Prime、小费文化、黑五、Trader Joe's、In-N-Out、Chick-fil-A、drive-through 等),日常生成也要求北美选题占比≥35%
- 评分权重:点击冲突25% / 相关性20% / 情绪张力15% / 新鲜度15% / 故事性10% / 可信度10% / 转化5%,70分入队线
- 风险淘汰:个股预测、基金推荐、保证收益、虚构专家、无来源宏观数据、传闻包装 → 直接 rejected
- 封面:AI只生成背景,中文标题由 `/covers/[itemId]` 页程序化叠加(三套模板:真相型/反常识型/控制型;≤3行、每行2-7字、白橙红青选两色、1080×1920)

## 技术栈

| 层 | 实现 |
|---|---|
| 编排 | n8n(自托管,`n8n/` 下5个工作流) |
| 后台+API | Next.js 14(standalone)+ Prisma + PostgreSQL 16 |
| 文本模型 | Claude(`@anthropic-ai/sdk`,`ANTHROPIC_MODEL` 可配) |
| 图片/视频/配音 | 火山引擎 Seedream / Seedance / 豆包TTS(`MEDIA_PROVIDER=volcengine`) |
| Mock 模式 | `MEDIA_PROVIDER=mock` + `AI_MOCK=1`:零外部依赖跑通全链路 |
| 审批 | Telegram inline 按钮 + 网页审批队列 |
| 反代 | Traefik(compose labels,自动 HTTPS) |

## 本地跑通(无需任何 key)

```bash
npm install
# 准备一个 Postgres,把连接串写进 .env 的 DATABASE_URL
npx prisma migrate deploy && npx prisma generate
npm run db:seed                 # 127条选题 + 8个系列
AI_MOCK=1 MEDIA_PROVIDER=mock npm run demo   # 全链路端到端演示
npm run dev                     # http://localhost:3031 (登录 admin/changeme)
```

## VPS 部署

```bash
export DB_PASSWORD=... ADMIN_PASSWORD=... JWT_SECRET=... WEBHOOK_SECRET=... \
       ANTHROPIC_API_KEY=... FACTORY_DOMAIN=factory.yourdomain.com
bash scripts/deploy-vps.sh
```

之后在 n8n 里导入 `n8n/01~05`,配置环境变量 `FACTORY_APP_URL`、`N8N_WEBHOOK_SECRET`、
`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`(03 需要 Telegram 凭据)。

## 三阶段上线路线(不要跳步)

**Phase 1(前20条)**:不接自动发布。看板入队 → n8n 02 生产 → 审批 → **人工发抖音** →
登记链接、录数据。目标是验证:三套封面、两种配音语气、四个栏目里什么真正有效。

**Phase 2(21-60条)**:媒体切真实(`MEDIA_PROVIDER=volcengine` + ARK/豆包 key);
接 Remotion/FFmpeg 合成 worker(compose 里预留了 `bizbrain-worker` 位置,共享 `bizbrain-data` volume,
消费 `compose` 阶段;`lib/providers/types.ts` 的 `ComposeProvider` 是对接口)。

**Phase 3(60条后)**:申请抖音开放平台(video.create 等权限),实现
`lib/providers/volcengine.ts` 里的 `douyinPublisher`;数据快照从手工录入切到 API 自动抓取;
评论主题提取、付费合集。

## 合规底线

- 2025-09-01 起 AI 生成内容须加标识:发布时勾选平台AI声明;片尾/简介注明「AI辅助创作」;不删除工具自动添加的标识;封面模板已内置「AI辅助创作」角标
- 财经边界:定位是商业知识/行为经济学/营销心理/企业案例**科普**;不荐股、不预测买卖点、不承诺收益、不推销金融产品(选题评分阶段自动风险淘汰,QC阶段二次核查)
- 代用户发布必须让用户明确感知——**不做隐藏式无人值守发布**,这也是审批环节存在的原因

## 目录速查

```
lib/prompts/     全部中文提示词(内容策略之源)
lib/agents/      选题/流水线状态机/复盘
lib/providers/   mock + 火山引擎 + telegram + 抖音stub
prisma/seed-data 选题库种子(改这里加选题)
app/dashboard/   总览/选题库/生产中/审批/已发布/复盘/设置
app/covers/      程序化封面(三套模板)
n8n/             5个工作流 JSON
scripts/         部署/备份/封面截图/端到端演示
```
