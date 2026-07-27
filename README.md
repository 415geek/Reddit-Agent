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
  → Seedream生图 / Seedance图生视频 / MiniMax配音 / BGM选曲 / 字幕时间轴
  → 合成(worker/ FFmpeg:运镜 + 旁白与BGM闪避混音 + 烧字幕)
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

## 全自动生产:入队选题 → 到审批队列

看板上的「推进下一阶段」是给调试用的。日常不用点——起一个 worker 就行:

```bash
export FACTORY_APP_URL=https://your-app.vercel.app
export N8N_WEBHOOK_SECRET=...
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_KEY=...
bash scripts/deploy-worker.sh
```

这个 worker 一个进程干两件事,常驻在自己的服务器上:

1. **流水线心跳**——每 20 秒敲一次 `/api/pipeline/tick`,把所有在产内容各推一轮:
   研究 → 脚本 → 质检 → 分镜 → 图片/动态 → 配音 → 合成 → 待审批。
2. **成片合成**——领 `compose` 阶段的任务,用 FFmpeg 烧成片。

为什么合在一起:合成本来就必须跑在自己的服务器上(serverless 有函数时长上限、没有 FFmpeg),
既然这个进程无论如何都要常驻,顺手把心跳也担了,就不用再装 n8n 或配 cron。

跑起来之后你的操作只剩两步:**在选题库点「入队」**,过一会**到审批队列看成片**。

心跳接口本身谁都能调,不绑 worker:

```bash
curl -X POST https://your-app.vercel.app/api/pipeline/tick -H "x-webhook-secret: ..."
```

`vercel.json` 里配了每小时一次的 Cron 作为兜底——worker 挂了生产不至于完全停,
但**合成仍然只能由 worker 做**,所以 worker 不跑的话内容会堆在合成阶段。

### 出错了会怎样

- 同一阶段连续失败 3 次就熔断,不再自动重试,留在看板上等人看。
  没有这个熔断,一条注定失败的内容会每一轮都重试,一直烧 API 额度。
- 质检不过会带着意见自动返工重写,最多 2 次。
- 想全局暂停自动生产:停掉 worker 容器,或给应用设 `AUTO_PIPELINE=off`。

## 成片合成与背景音乐

合成不在应用进程里做:一条 90 秒竖屏成片要拼十几段画面、混两轨音频、烧一遍字幕,
几分钟起步。serverless 既有函数时长上限也没有 FFmpeg,所以做成 worker 去领任务。

```
应用(可在 Vercel)          worker(自己的服务器,有 FFmpeg)
  内容进入 compose 阶段   ←── GET  /api/pipeline/compose/next   领任务(带 TTL 认领锁)
                                 拉素材、合成、直传存储
  登记成片 → 进审批队列   ←── POST /api/pipeline/compose/:id/complete
```

成片直传存储(Supabase 或本地卷),不经过应用——serverless 的请求体上限只有几 MB,
一条成片轻松几十 MB。所以 worker 要和应用配同一套存储环境变量。

跑起来。**应用在 Vercel、只把合成放自己服务器**(目前的实际形态)用这个:

```bash
export FACTORY_APP_URL=https://your-app.vercel.app
export N8N_WEBHOOK_SECRET=...          # 和应用那边同一个
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_KEY=...                # 和应用同一个桶,否则应用读不到成片
bash scripts/deploy-worker.sh
```

脚本会先验票再干活:检查应用可达、密钥对得上、Supabase 真能写进去(会传一个探针
文件再删掉),都过了才拉代码、建镜像、起容器,最后确认容器里有中文字体——
字体缺了字幕会烧成一排方框,那种问题等第一条成片出来才发现太晚。

只需要 Docker,node 和 ffmpeg 都在镜像里。更新就是改完 export 再跑一遍同一条命令。

整套自托管(应用 + Postgres + worker 都在自己机器上)则用根目录那份编排:

```bash
docker compose up -d bizbrain-worker
```

不想用 Docker 也行,worker 没有任何 npm 依赖,装好 node 20+ 和 ffmpeg + 中文字体后:

```bash
FACTORY_APP_URL=... N8N_WEBHOOK_SECRET=... SUPABASE_URL=... SUPABASE_KEY=... \
node worker/compose-worker.mjs          # ONCE=1 只跑一轮,适合先试一条
```

合成做的事:静态图按分镜的 cameraMove 做推近/拉远/横移(否则整条片子是幻灯片)、
动态镜头对齐时长、**全片时长按真实配音长度重新缩放**(分镜里的秒数是模型估的,
直接用会画音不同步)、字幕按同一缩放重算后烧进画面。

### 旁白与配乐的调性

不是拍脑袋定的。用户给了一条参考视频,我把它测了一遍再对齐:

| 指标 | 参考视频 | 本项目 | 怎么做到的 |
|---|---|---|---|
| 旁白基频 | 118 Hz(成年男声) | 111 Hz | 把 MiniMax 的 7 个中文男声各念同一段话测基频,`Deep_Voice_Man` 最接近 |
| 音高起伏 | 4.70 半音 | 4.14 半音 | 同上,这一项也一起比 |
| 说话语速 | 5.51 字/秒 | 5.7 字/秒 | 保持 speed=1,实测 0.9~1.0 之间的差异是生成随机性 |
| 成片响度 | −12.6 LUFS | −13.3 LUFS | `LOUDNESS_LUFS` |
| 音乐低频占比 | 28.8% | 高切 180Hz 后接近 | 生成的曲子普遍 45~57%,压在旁白下面是闷的 |

参考视频里还有一个明显的手法:讲到揭晓前音乐先掉到 −40dB 憋住,然后 100ms 内跳升
35dB 落一记低频撞击。这个复刻了:分镜模型标出"反转点"镜头(`turnShotIdx`),
合成时在那里把 BGM 滑到近乎无声,再叠一段 90→40Hz 的下滑撞击音(`TURN_STING=false` 可关)。
参考里憋了 3.2 秒,这里默认 0.9 秒——竖屏短视频里三秒静音是拿完播率赌博。

音乐模型对"95 BPM"这类指令并不买账,实测出来 71~146 BPM 都有。所以速度没有强行对齐,
真正影响听感的高低频平衡改在合成时用高切解决。

### 背景音乐

四种情绪(悬念揭秘 / 推进紧凑 / 理性洞察 / 生活温和),由分镜模型选,
选错或没选就按封面模板和选题品类兜底。混音时 BGM 压低约 20dB 并做**侧链闪避**——
有人声时音乐自动让路,没人声时回来;固定音量做不到这点,要么盖住讲话,
要么整条听起来像忘了关的背景音。

默认用曲库(`BGM_MODE=library`),先建一次:

```bash
FAL_KEY=... SUPABASE_URL=... SUPABASE_KEY=... \
FACTORY_APP_URL=https://... N8N_WEBHOOK_SECRET=... \
node scripts/build-bgm-library.mjs 2     # 每种情绪 2 首
```

用曲库而不是每条现生成,是因为:同一个账号配乐一致才有听觉记忆;曲库里每首都能
先自己听过再用;而且零边际成本、零等待。想每条都独一无二就设 `BGM_MODE=generate`
(只适合自托管,一次要等 30-90 秒)。

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
