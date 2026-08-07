// AI_MOCK=1 时各 Agent 返回的固定样例,保证全流程无 key 可跑通

function topicCandidates() {
  return [
    { title: '为什么超市小票越来越长?', hook: '小票不是账单,是下一次消费的诱饵', category: 'marketing_psych', region: 'global' },
    { title: 'Costco的烤鸡为什么永远4.99美元?', hook: '亏本的烤鸡,是把你引到店最深处的磁铁', category: 'business_case', region: 'north_america' },
    { title: '你的会员卡正在给你分层定价', hook: '会员价不是优惠,是价格歧视的温柔说法', category: 'behavioral_econ', region: 'global' },
    { title: '某只股票下周必涨的三个信号', hook: '看懂这三个信号,下周跟着买就行', category: 'ai_money', region: 'china' },
    { title: '美国餐厅的服务员为什么背菜单?', hook: '不给你纸质菜单,点单权就到了他手里', category: 'business_case', region: 'north_america' },
    { title: 'AI写简历,HR一眼就能看出来吗?', hook: '筛掉你的不是AI痕迹,是没有细节的完美', category: 'ai_money', region: 'global' },
  ]
}

function topicScores(params?: Record<string, unknown>) {
  const titles = (params?.titles as string[]) || topicCandidates().map((t) => t.title)
  return titles.map((title) => {
    const risky = /必涨|保本|稳赚|推荐.*基金|个股/.test(title)
    return {
      title,
      scores: { conflict: 82, relevance: 78, emotion: 70, freshness: 75, story: 80, credibility: risky ? 20 : 85, conversion: 60 },
      total: risky ? 45 : 77,
      riskFlags: risky ? ['stock_prediction'] : [],
    }
  })
}

function research(params?: Record<string, unknown>) {
  const title = (params?.title as string) || '免费为什么让人失去理智?'
  return {
    core_claim: `${title} 的核心答案:当价格降为零,人会跳过成本收益计算,行为由情绪而非理性驱动。`,
    supporting_facts: [
      { claim: 'Dan Ariely 在《怪诞行为学》中的巧克力实验:林特松露降到1美分仍输给免费的好时之吻,免费选项的选择率从27%跳到69%', source: 'Dan Ariely, Predictably Irrational (2008), Chapter 3', confidence: 0.95 },
      { claim: '零价格效应(Zero Price Effect)由 Shampanier, Mazar & Ariely 在2007年营销科学期刊论文中正式提出', source: 'Shampanier, K., Mazar, N., & Ariely, D. (2007). Zero as a Special Price. Marketing Science, 26(6)', confidence: 0.93 },
      { claim: '亚马逊法国站曾因1法郎运费与免运费的转化率差异巨大而全面转向免运费策略', source: 'Predictably Irrational 中引用的亚马逊案例', confidence: 0.8 },
    ],
    counterarguments: ['免费也可能降低感知价值,奢侈品牌几乎从不使用免费策略'],
    risk_notes: ['不要引申到任何投资建议', '案例数据需在片尾标注书籍来源'],
    usable_examples: ['奶茶店"第二杯免费"排队现象', '超市免费试吃后的愧疚性购买', 'App免费试用后的订阅惯性'],
  }
}

function script(params?: Record<string, unknown>) {
  const title = (params?.title as string) || '免费为什么让人失去理智?'
  const beats = {
    hook: '你以为商家免费送你东西,是为了吸引顾客。其实"免费"本身,就是最强的消费武器。',
    scene: '同样一件商品,标价1块钱没人碰;换成"免费领取",队伍排到店门口。差的不是9毛钱,是大脑里两套完全不同的算法。',
    principle: '行为经济学家把这叫"零价格效应"。只要价格大于零,你就会本能地问一句:值不值?可一旦变成免费,这道计算直接被跳过——大脑默认:不拿白不拿。风险、时间、后续的花费,全都被这两个字挡在了意识外面。',
    caseStudy: '《怪诞行为学》里有个著名实验:高级松露巧克力卖1美分,普通巧克力免费送。结果七成的人选了免费的普通货——哪怕松露的性价比高出十倍。超市的免费试吃、App的免费试用、外卖的0元购,全是同一套逻辑。',
    twist: '所以下次看到"免费"两个字,先停一秒,问自己:我究竟付出的是钱、是时间,还是未来的选择权?想清楚这个问题,你就赢过了大多数人。',
    interaction: '你最近一次被"免费"吸引,最后反而花了多少钱?评论区聊聊。',
  }
  return {
    beats,
    fullText: [beats.hook, beats.scene, beats.principle, beats.caseStudy, beats.twist, beats.interaction].join('\n\n'),
    durationEstSec: 88,
    coverTitleLines: ['免费的真相', '你付出的更多'],
    coverTemplate: 'truth',
    note: `脚本主题:${title}`,
  }
}

function storyboard() {
  const base = '深黑背景,青蓝色与霓虹红色高光,强烈明暗对比,电影海报构图,真实材质,体积光,浅景深,画面中央留出主体空间,竖屏9:16,不要文字,不要Logo,不要水印'
  const shots = [
    { idx: 0, type: 'motion', imagePrompt: `电影级寓言式商业场景,一名普通消费者站在巨大的发光"FREE"标志前,标志背后伸出若隐若现的细线控制人物,${base}`, motionPrompt: '镜头缓慢向前推进,人物谨慎地伸手靠近发光标志,周围的细线逐渐显现并轻微收紧,背景粒子缓慢漂浮,灯光自然闪烁,动作克制、连贯、电影感,真实物理效果,主体身份和服装保持一致,不变形,不快速旋转', durationSec: 8, cameraMove: 'push_in', narration: '你以为商家免费送你东西,是为了吸引顾客。' },
    { idx: 1, type: 'image', imagePrompt: `超市货架前排起长队,人群伸手争抢发光的"0"字形商品,${base}`, durationSec: 8, cameraMove: 'pan', narration: '免费本身,就是最强的消费武器。' },
    { idx: 2, type: 'image', imagePrompt: `一枚硬币悬浮在天平一端,另一端是空无一物却发光的托盘,${base}`, durationSec: 9, cameraMove: 'depth', narration: '标价1块钱没人碰,免费领取排到门口。' },
    { idx: 3, type: 'image', imagePrompt: `人脑轮廓中一半是精密齿轮一半是熄灭的灯,象征计算被跳过,${base}`, durationSec: 10, cameraMove: 'push_in', narration: '只要价格大于零,你会问值不值;免费直接跳过计算。' },
    { idx: 4, type: 'image', imagePrompt: `巨大的"0"字形隧道,尽头有微弱亮光,一个人影走入,${base}`, durationSec: 10, cameraMove: 'particles', narration: '风险、时间、后续的花费,都被挡在意识外。' },
    { idx: 5, type: 'motion', imagePrompt: `实验桌上两盘巧克力,一盘精致发光,一盘普通但被人群的手涌向,${base}`, motionPrompt: '镜头横移扫过实验桌,人群的手缓慢伸向普通巧克力,光影自然变化,动作克制连贯,电影感,真实物理效果,不变形', durationSec: 10, cameraMove: 'pan', narration: '七成的人选了免费的普通货。' },
    { idx: 6, type: 'image', imagePrompt: `手机屏幕上漂浮的"免费试用"按钮,按钮下方延伸出锁链,${base}`, durationSec: 9, cameraMove: 'glow', narration: '免费试吃、免费试用、0元购,同一套逻辑。' },
    { idx: 7, type: 'image', imagePrompt: `一个人站在十字路口,面前三块路牌分别发出金色、红色、青色光,${base}`, durationSec: 10, cameraMove: 'depth', narration: '问自己:付出的是钱、时间,还是选择权?' },
    { idx: 8, type: 'image', imagePrompt: `黎明城市天际线,一个背影推开发光的门,${base}`, durationSec: 8, cameraMove: 'push_in', narration: '想清楚这个问题,你就赢过了大多数人。' },
    { idx: 9, type: 'image', imagePrompt: `一个发光的问号悬浮在暗色咖啡桌上方,旁边是空杯,${base}`, durationSec: 6, cameraMove: 'glow', narration: '你最近一次被免费吸引,最后花了多少钱?' },
  ]
  return { shots }
}

function qc() {
  return {
    passed: true,
    typos: [],
    complianceIssues: [],
    durationOk: true,
    notes: '脚本无错字;无投资建议类表述;时长预估88秒在60-100秒区间;引用已标注来源;结尾为开放式互动问题,符合规范。',
  }
}

function retrospective() {
  return {
    summary: '本周期共发布2条,平均完播率高于账号基准12%。"免费的代价"系列互动率显著高于均值,北美案例题材(Costco)收藏率最高,建议加大系列化续作。',
    recommendations: [
      { type: 'sequel', topicTitle: 'Costco的烤鸡为什么永远4.99美元?', reason: '同系列上一条收藏率为账号均值2.1倍,适合追更' },
      { type: 'adjust', topicTitle: '为什么超市小票越来越长?', reason: '前3秒流失率偏高,建议钩子改为具体金额对比' },
    ],
    sequelTopics: [
      { title: 'Costco为什么不打广告?', hook: '省下的广告费,全变成了会员续费率', category: 'business_case', region: 'north_america' },
    ],
  }
}

const FIXTURES: Record<string, (params?: Record<string, unknown>) => unknown> = {
  'topics.generate': topicCandidates,
  'topics.score': topicScores,
  research,
  script,
  storyboard,
  qc,
  retrospective,
}

export function getMockFixture(key: string, params?: Record<string, unknown>) {
  const fn = FIXTURES[key]
  if (!fn) throw new Error(`未知的 mock fixture: ${key}`)
  return fn(params)
}
