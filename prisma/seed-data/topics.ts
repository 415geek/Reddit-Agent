// 永久选题库种子数据
// category: behavioral_econ 行为经济学 | marketing_psych 消费营销心理 | ai_money AI时代赚钱逻辑 | business_case 餐饮小生意案例
// region: north_america | china | global

export interface SeriesSeed {
  slug: string
  name: string
  description: string
}

export interface TopicSeed {
  title: string
  hook: string
  category: 'behavioral_econ' | 'marketing_psych' | 'ai_money' | 'business_case'
  region: 'north_america' | 'china' | 'global'
  seriesSlug?: string
}

export const SERIES: SeriesSeed[] = [
  { slug: 'free-cost', name: '免费的代价', description: '免费、补贴、试用背后的真实商业逻辑' },
  { slug: 'na-business', name: '北美商业解剖', description: 'Costco、星巴克、麦当劳……北美商业巨头的隐藏玩法' },
  { slug: 'restaurant-secrets', name: '餐厅老板不会说', description: '菜单、定价、排队背后的餐饮生意经' },
  { slug: 'money-mind', name: '金钱心理学', description: '你和钱之间那些看不见的心理开关' },
  { slug: 'ai-era', name: 'AI时代生存指南', description: 'AI如何改变工作、赚钱和判断力的价值' },
  { slug: 'pricing-games', name: '定价的游戏', description: '每一个价格标签都是精心设计的心理实验' },
  { slug: 'sales-brain', name: '销售脑回路', description: '高手成交靠的不是话术,而是对人性的理解' },
  { slug: 'daily-econ', name: '日常经济学速成', description: '90秒讲透你每天都会遇到的经济学' },
]

export const TOPICS: TopicSeed[] = [
  // ── 用户首批30个选题(全收) ──────────────────────────────────────────────
  { title: '免费为什么让人失去理智?', hook: '你以为免费是优惠,其实"免费"本身就是最强的消费武器', category: 'behavioral_econ', region: 'global', seriesSlug: 'free-cost' },
  { title: '菜单越多,顾客为什么越难下单?', hook: '你以为选择多是好事,其实选择过载正在赶走你的顾客', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '为什么第二杯半价比直接打折更有效?', hook: '同样是让利,第二杯半价能让你多买一杯你本不想要的', category: 'marketing_psych', region: 'china', seriesSlug: 'pricing-games' },
  { title: '顾客不是嫌贵,而是害怕买错', hook: '你以为降价能促单,其实顾客怕的从来不是价格', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '会员积分为什么让你舍不得离开?', hook: '积分不是奖励,是给你的离开成本标价', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '商家为什么总把最贵的放在最前面?', hook: '第一眼看到的价格,决定了你觉得后面的都"便宜"', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '大杯只贵一元,真的是优惠吗?', hook: '中杯的存在,只是为了让你选大杯', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '为什么忙碌的人更容易冲动消费?', hook: '你以为累了想犒劳自己,其实是意志力被商家算准了', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '沉没成本如何困住一家公司?', hook: '已经投进去的钱,正在替你做错误的决定', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '"限时优惠"真正卖的是什么?', hook: '倒计时卖的不是商品,是你怕错过的恐惧', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '为什么收入增加,焦虑却没有减少?', hook: '你以为赚得多就安心,其实欲望的通胀比工资涨得快', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '销售高手为什么不急着介绍产品?', hook: '开口就讲产品的,是新手;高手先卖的是问题', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '顾客说"考虑一下"到底在考虑什么?', hook: '"考虑一下"不是拒绝,是你没给他下单的理由', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '为什么利润看起来很高,公司还是会倒闭?', hook: '账上赚钱和活得下去,是两回事', category: 'business_case', region: 'global', seriesSlug: 'daily-econ' },
  { title: '现金流为什么比利润更重要?', hook: '压垮公司的从来不是亏损,而是发不出下个月的工资', category: 'business_case', region: 'global', seriesSlug: 'daily-econ' },
  { title: 'SaaS免费试用如何改变你的判断?', hook: '免费试用14天,买走的是你的迁移成本', category: 'ai_money', region: 'north_america', seriesSlug: 'free-cost' },
  { title: 'AI会先淘汰努力的人,还是不思考的人?', hook: '你以为AI淘汰懒人,其实它先替代的是不动脑的勤奋', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: '知识越来越便宜,什么会越来越贵?', hook: '当答案免费的时候,提对问题的人开始收费', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: '为什么普通人总在高点跟风?', hook: '等你从新闻里知道机会的时候,机会已经在找接盘的人', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '选择越多,为什么幸福感越低?', hook: '你以为自由是想要什么有什么,其实是不用再选', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '为什么人们更害怕损失100元?', hook: '丢100块的痛,要赚200块才能抵消——商家早就算好了', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '一个差评为什么比十个好评更有影响?', hook: '大脑对坏消息的权重,是好消息的五倍', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '餐厅为什么故意放一道没人点的菜?', hook: '菜单上最贵的那道菜,存在的意义就是没人点', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '"网红排队"如何改变消费者判断?', hook: '排队本身就是广告,而且是你免费帮它排的', category: 'marketing_psych', region: 'china', seriesSlug: 'restaurant-secrets' },
  { title: '为什么越强调便宜,顾客反而越怀疑?', hook: '低价不是卖点,是风险信号', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '忙碌为什么经常被误认为成功?', hook: '你以为忙是价值,其实忙可能只是没有定价权', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '公司为什么奖励错误的员工?', hook: '考核什么,就会得到什么——哪怕考核的是错的', category: 'business_case', region: 'global', seriesSlug: 'daily-econ' },
  { title: '为什么越缺钱越容易买错东西?', hook: '稀缺感会占用大脑带宽,穷人税就是这么来的', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '情绪价值为什么越来越贵?', hook: '当商品过剩的时候,感受成了最稀缺的货', category: 'marketing_psych', region: 'global', seriesSlug: 'money-mind' },
  { title: 'AI时代,真正值钱的是判断还是知识?', hook: '知识免费之后,替你拍板的人开始按小时收费', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },

  // ── 北美商业案例(加重) ─────────────────────────────────────────────────
  { title: 'Costco为什么敢只赚会员费?', hook: '你以为Costco靠卖货赚钱,其实商品毛利几乎全部还给了你', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Costco的热狗为什么40年不涨价?', hook: '1.5美元的热狗套餐,是Costco最贵的广告', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '麦当劳其实是一家地产公司?', hook: '你以为麦当劳靠汉堡赚钱,其实它最值钱的资产是地皮', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '星巴克卖的从来不是咖啡', hook: '30块的咖啡里,豆子只值3块,剩下的是"第三空间"', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '星巴克储值卡为什么像一家银行?', hook: '全球星巴克卡里躺着的预存款,超过很多银行的存款规模', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '亚马逊Prime如何让你"不好意思"去别家?', hook: '年费不是收入,是把你锁进来的心理合同', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国小费文化是怎么变成"道德绑架"的?', hook: '小费本来是感谢,现在是商家把工资转嫁给了你', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'na-business' },
  { title: '黑五大促,美国人真的省到钱了吗?', hook: '黑五的"原价",很多是为打折专门标出来的', category: 'marketing_psych', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Trader Joe\'s为什么故意只开小店?', hook: '别人拼命扩SKU,它靠"只给你选4种花生酱"赢了', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'In-N-Out菜单只有4样,为什么排队最长?', hook: '菜单越短,信任越高——这家汉堡店把极简做成了护城河', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Chick-fil-A每周少卖一天,为什么还是第一?', hook: '周日不营业,反而成了它最强的品牌资产', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Drive-through为什么是美国餐饮的印钞机?', hook: '不用停车位、不用服务员,车窗就是最高效的收银台', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国信用卡积分,是奖励还是圈套?', hook: '积分是拿商家的返佣,补贴愿意负债消费的你', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Dollar Store为什么在美国越开越多?', hook: '一元店不是卖便宜,是卖"不用动脑的价格"', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国超市的"免费试吃"藏着什么算计?', hook: '一口免费香肠,换来的是你的愧疚感和购物车', category: 'marketing_psych', region: 'north_america', seriesSlug: 'free-cost' },
  { title: '美国餐厅的"无限续杯"为什么不亏?', hook: '一杯可乐成本3毛钱,续杯续走的是你点大餐的心理防线', category: 'business_case', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: 'Netflix为什么允许你随时取消?', hook: '"随时可取消"降低的不是它的收入,是你的决策压力', category: 'marketing_psych', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Apple为什么从不参加双十一式大促?', hook: '不打折不是傲慢,是在保护你手里那台手机的价格', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国药店为什么把药房放在最里面?', hook: '取个药要穿过整个超市,这条路线是设计好的', category: 'marketing_psych', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Whole Foods被亚马逊收购后,谁在补贴你的有机菜?', hook: '菜价降了,但你付出的是购物数据', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国快餐的"套餐"是怎么让你多花钱的?', hook: '单点更便宜?套餐的意义是让你不做算术', category: 'marketing_psych', region: 'north_america', seriesSlug: 'pricing-games' },
  { title: 'Shrinkflation:为什么美国的薯片袋越来越空?', hook: '不涨价,但少给你20%——这是通胀最隐蔽的形态', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国房东为什么宁愿空置也不降租?', hook: '降租影响的不是这套房,是整栋楼的估值', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'daily-econ' },
  { title: 'Uber的动态定价,是效率还是收割?', hook: '下雨天涨价不是趁火打劫,但它确实算准了你没得选', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'DoorDash上的餐厅为什么越送越亏?', hook: '30%的抽成,让外卖平台成了餐厅最贵的房东', category: 'business_case', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: '美国的"9.99定价"为什么100年不过时?', hook: '大脑读价格是从左往右的,那1分钱买走了你的第一印象', category: 'marketing_psych', region: 'north_america', seriesSlug: 'pricing-games' },
  { title: 'Sam\'s Club和Costco,谁的会员模式更狠?', hook: '同样是仓储会员店,锁客的方式完全是两套心理学', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国健身房的商业模式:赌你不来', hook: '月费19.9的健身房,最怕的就是会员天天来', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: 'Chipotle为什么敢让你看着他做饭?', hook: '开放式操作台不是透明,是把"新鲜"演给你看', category: 'business_case', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: '美国车行的"月供思维"如何掏空钱包?', hook: '销售从不谈总价,只问你"每个月能付多少"', category: 'marketing_psych', region: 'north_america', seriesSlug: 'sales-brain' },
  { title: 'Buy Now Pay Later:分期为什么让人花得更多?', hook: '把100美元拆成4个25,痛感就消失了', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'money-mind' },
  { title: '美国机场的水为什么敢卖5美元?', hook: '安检没收了你的水,然后把定价权留给了里面的商店', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'pricing-games' },
  { title: 'Trader Joe\'s没有会员、不打折,凭什么火?', hook: '它把省下的营销费,全部变成了"你自己发现的宝藏"', category: 'marketing_psych', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国订阅制陷阱:你到底订了多少服务?', hook: '平均每个美国家庭为忘记取消的订阅,一年多付200美元', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'free-cost' },
  { title: 'Panera的"无限咖啡"订阅,亏本生意为什么赚了?', hook: '9.99美元无限喝,买的是你每天进店的那双脚', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国二手车为什么比新车还难砍价?', hook: '信息差在哪里,利润就在哪里', category: 'marketing_psych', region: 'north_america', seriesSlug: 'sales-brain' },
  { title: 'Krispy Kreme的"热灯"营销:一盏灯救活一家店', hook: '灯一亮就排队——它把"刚出炉"做成了可视化的钩子', category: 'marketing_psych', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国餐厅菜单为什么去掉了美元符号?', hook: '去掉一个$符号,客单价平均涨8%', category: 'marketing_psych', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: 'Five Guys为什么免费给你一大袋薯条?', hook: '"多给的"薯条不是成本,是让你原谅15美元汉堡的理由', category: 'business_case', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: '美国的Happy Hour为什么定在下午4点?', hook: '半价酒水填的不是你的胃,是餐厅最亏钱的时段', category: 'business_case', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: 'REI每年黑五关店,为什么股东不反对?', hook: '一天不卖货,换来一年的品牌好感——这笔账它算得很清楚', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国牛排馆的"市场价"是什么套路?', hook: '不标价的龙虾,让你不好意思问,也不好意思不点', category: 'marketing_psych', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: 'Waffle House为什么24小时不关门?', hook: '深夜不赚钱的时段,买下的是"永远开着"的信任', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国大学学费为什么涨得比通胀快?', hook: '助学贷款越容易拿,学费就涨得越理直气壮', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'daily-econ' },
  { title: 'Tesla不打广告,广告费去哪了?', hook: '它把广告预算变成了车主的谈资', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国的Outlet村,卖的真是打折的正品吗?', hook: '很多奥莱货是专门为奥莱生产的"打折专供款"', category: 'marketing_psych', region: 'north_america', seriesSlug: 'pricing-games' },
  { title: 'Subway的5美元长堡,是怎么把自己搞垮的?', hook: '爆款促销救得了流量,救不了加盟商的利润表', category: 'business_case', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国餐厅小费15%变22%,谁改的规矩?', hook: 'iPad收银界面上的三个按钮,替你重新定义了"应该"', category: 'behavioral_econ', region: 'north_america', seriesSlug: 'na-business' },
  { title: '好市多为什么故意不放购物指示牌?', hook: '让你迷路,是让你多逛;寻宝感,是最贵的设计', category: 'marketing_psych', region: 'north_america', seriesSlug: 'na-business' },
  { title: '美国的"农夫市集"为什么越贵越有人买?', hook: '你买的不是菜,是"我认识种菜的人"的故事', category: 'marketing_psych', region: 'north_america', seriesSlug: 'daily-econ' },

  // ── 行为经济学补充 ─────────────────────────────────────────────────────
  { title: '锚定效应:第一个数字如何绑架你的判断?', hook: '谈判桌上先开价的人,已经赢了一半', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '禀赋效应:为什么你的旧手机总觉得能卖高价?', hook: '东西一旦是"你的",大脑就自动给它加价30%', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '心理账户:为什么年终奖花得比工资快?', hook: '同样是钱,大脑给它们开了不同的账户', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '棘轮效应:消费升级容易,降级为什么那么痛?', hook: '由俭入奢易,由奢入俭难——这不是修养问题,是神经科学', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '默认选项的力量:你的钱正在被"懒"决定', hook: '不选,也是一种选——而且往往是最贵的那种', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '概率盲区:为什么彩票和保险你都买?', hook: '一边高估中奖概率,一边低估风险概率,大脑就是这么双标', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '峰终定律:宜家的1元冰淇淋为什么是天才设计?', hook: '你记住的不是逛了3小时,是出口那支1块钱的甜筒', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '社会证明:为什么"销量第一"四个字那么好用?', hook: '不知道选什么的时候,大脑会自动抄别人的作业', category: 'behavioral_econ', region: 'global', seriesSlug: 'sales-brain' },
  { title: '为什么"分期免息"比"打九折"更让人心动?', hook: '商家宁愿借钱给你,也不愿意直接便宜你', category: 'behavioral_econ', region: 'china', seriesSlug: 'pricing-games' },
  { title: '通货膨胀是怎么"偷"走你的存款的?', hook: '钱没少,但能买的东西每年都在变少', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },
  { title: '复利为什么被叫作世界第八大奇迹?', hook: '前十年看不出差距,后十年追不上差距', category: 'behavioral_econ', region: 'global', seriesSlug: 'money-mind' },
  { title: '机会成本:免费的周末其实最贵', hook: '你以为躺平不花钱,其实时间的账单最后才寄到', category: 'behavioral_econ', region: 'global', seriesSlug: 'daily-econ' },

  // ── 消费营销心理补充 ────────────────────────────────────────────────────
  { title: '为什么直播间总在喊"最后三单"?', hook: '稀缺是可以表演的,而且演一次有效一次', category: 'marketing_psych', region: 'china', seriesSlug: 'pricing-games' },
  { title: '盲盒为什么让人上瘾?', hook: '不确定的奖励,比确定的奖励让大脑分泌更多多巴胺', category: 'marketing_psych', region: 'china', seriesSlug: 'money-mind' },
  { title: '奶茶店的"隐藏菜单"是谁设计的?', hook: '所谓隐藏菜单,是官方安排好让你"发现"的社交货币', category: 'marketing_psych', region: 'china', seriesSlug: 'restaurant-secrets' },
  { title: '为什么试衣间的镜子会"骗人"?', hook: '灯光角度和镜面弧度,都在帮你说服你自己', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '"买一送一"和"五折",哪个更暴利?', hook: '数学上一样的两句话,清库存的效率差三倍', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '超市为什么把牛奶放在最里面?', hook: '你为一瓶牛奶走的每一步,都路过了设计好的诱惑', category: 'marketing_psych', region: 'global', seriesSlug: 'daily-econ' },
  { title: '为什么高端品牌的门店总是冷冷清清?', hook: '空旷不是没生意,空旷本身就是定价的一部分', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '"第二件0元"的账,商家是怎么算的?', hook: '看起来亏一半,其实毛利率一分没少', category: 'marketing_psych', region: 'china', seriesSlug: 'pricing-games' },
  { title: '包装上的"限量款"三个字值多少钱?', hook: '同样的东西,加上编号就能贵40%', category: 'marketing_psych', region: 'global', seriesSlug: 'pricing-games' },
  { title: '为什么外卖平台的红包越发越多,你花的钱也越来越多?', hook: '满减不是省钱工具,是凑单指挥棒', category: 'marketing_psych', region: 'china', seriesSlug: 'free-cost' },
  { title: '"仅退款"政策背后,平台在算什么账?', hook: '让你占的小便宜,是平台管理商家的鞭子', category: 'marketing_psych', region: 'china', seriesSlug: 'free-cost' },
  { title: '为什么宜家要你自己动手组装家具?', hook: '你拧的每一颗螺丝,都在提高你对这件家具的估值', category: 'marketing_psych', region: 'global', seriesSlug: 'daily-econ' },

  // ── AI时代赚钱逻辑补充 ─────────────────────────────────────────────────
  { title: 'AI让写作免费之后,谁在赚钱?', hook: '内容不值钱了,但注意力的价格翻了倍', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: '一人公司:AI时代最小的商业单位', hook: '过去要10个人的活,现在是1个人加10个工具', category: 'ai_money', region: 'north_america', seriesSlug: 'ai-era' },
  { title: 'Prompt写得好,真的能当饭吃吗?', hook: '会提问的溢价窗口很短,会验证的溢价才长久', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: 'AI客服省下的钱,去哪儿了?', hook: '效率红利从来不会平均分配', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: '为什么AI越强,"信任"越值钱?', hook: '当内容可以无限生成,真实成了最稀缺的资源', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: 'AI时代的第一批失业者,不是流水线工人', hook: '最先被替代的,是坐在办公室里做重复脑力劳动的人', category: 'ai_money', region: 'north_america', seriesSlug: 'ai-era' },
  { title: '订阅制AI工具:新时代的"数字房租"', hook: '你的生产力工具,正在变成每月必交的房租', category: 'ai_money', region: 'north_america', seriesSlug: 'ai-era' },
  { title: '为什么说AI是杠杆,不是对手?', hook: '担心被AI替代的人,和用AI替代别人的人,差的只是一个动作', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },
  { title: 'AI生成内容满天飞,平台为什么开始标注"AI制作"?', hook: '标识不是限制创作,是给信任定价', category: 'ai_money', region: 'china', seriesSlug: 'ai-era' },
  { title: '小生意用AI,最容易踩的三个坑', hook: '不是工具不行,是你把工具当成了策略', category: 'ai_money', region: 'global', seriesSlug: 'ai-era' },

  // ── 餐饮/小生意/销售案例补充 ────────────────────────────────────────────
  { title: '小吃车凭什么能活过第三年?', hook: '房租是餐饮的第一杀手,轮子是最好的防御', category: 'business_case', region: 'china', seriesSlug: 'restaurant-secrets' },
  { title: '餐厅翻台率的生死线在哪里?', hook: '一张桌子一天翻几次,决定这家店是赚是赔', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '为什么火锅店是餐饮里最好的生意模型?', hook: '不需要大厨的餐厅,才是可以复制的餐厅', category: 'business_case', region: 'china', seriesSlug: 'restaurant-secrets' },
  { title: '奶茶店的加盟费,赚的到底是谁的钱?', hook: '很多品牌的主营业务不是卖奶茶,是卖开店的梦想', category: 'business_case', region: 'china', seriesSlug: 'restaurant-secrets' },
  { title: '餐厅的"招牌菜"为什么往往不赚钱?', hook: '招牌菜是获客成本,利润藏在你顺手点的那几样里', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '预制菜争议背后,餐饮的真实账本', hook: '你反对的是预制菜,餐厅算的是后厨每平米的产出', category: 'business_case', region: 'china', seriesSlug: 'restaurant-secrets' },
  { title: '为什么有的店越排队越不扩张?', hook: '排队是资产,扩张是负债——聪明的老板分得清', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '销售的最高境界:让客户觉得是自己做的决定', hook: '人不会拒绝自己的主意', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '报价单上为什么永远要放三个选项?', hook: '中间那个,才是你真正想卖的', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '客户嫌贵的时候,高手在想什么?', hook: '嫌贵不是价格问题,是价值还没讲到他心里', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '为什么老客户介绍的单子最好成交?', hook: '信任是可以转账的,而且不收手续费', category: 'marketing_psych', region: 'global', seriesSlug: 'sales-brain' },
  { title: '小店做私域,第一步不是拉群', hook: '没有理由的群,三天就变成死群', category: 'business_case', region: 'china', seriesSlug: 'sales-brain' },
  { title: '一家店的选址,到底在选什么?', hook: '选址不是选人流,是选"顺路"', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '为什么说开店最贵的成本是"试错"?', hook: '装修可以省,但选错模式的学费没有上限', category: 'business_case', region: 'global', seriesSlug: 'restaurant-secrets' },
  { title: '餐厅数字化,老板最该先看哪个数字?', hook: '不是营业额,是每个时段的人效和坪效', category: 'business_case', region: 'north_america', seriesSlug: 'restaurant-secrets' },
  { title: '海底捞的服务,是成本还是投资?', hook: '免费美甲不是福利,是让你心甘情愿等位两小时的理由', category: 'business_case', region: 'china', seriesSlug: 'restaurant-secrets' },
]
