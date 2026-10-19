# 持续性 / 主动式 AI 助理 产品功能调查

调查日期:2026-10-19。资料全部来自 WebSearch / WebFetch,每条结论后标注来源 URL 与该来源的发布日期。查不到的写「未查到」。部分 2026 年产品发布不到两个月，二手稿多、一手文档少，单一来源的说法已注明。

---

## 1. Dot(New Computer)

### 基本信息
- 公司 New Computer(旧金山),联合创始人 Jason Yuan(前 Apple 设计师)、Sam(Samantha)Whitmore(工程，前 Kensho 工程负责人)。约 370 万美元 pre-seed,投资方含 OpenAI Fund、Lachy Groom、South Park Commons。来源:https://techcrunch.com/2024/06/21/dots-ai-really-really-wants-to-get-to-know-you/ (2024-06-21)
- 2023-11 首次对外演示(内测、等候名单);2024-06 在 iOS 上线，此前约八个月封闭测试。从未出 Android 版。来源:https://fastcompanyme.com/?p=21765 (2023-11-03,Fast Company 中东版转载 Mark Wilson 文);TechCrunch 2024-06-21 同上
- 定位:App Store 描述为 "friend, companion and confidant"。Jason Yuan 说 "It's not an assistant, it's kind of like an intelligence guide",并称自己设计的是 "a relationship versus a tool"。Sam Whitmore 说它是 "self-introspection, accountability, personal growth" 的工具。来源:Fast Company 2023-11-03;TechCrunch 2024-06-21
- 定价：免费层每周消息数有上限(具体数字未公开);订阅 11.99 美元/月，解锁无限对话与 Chronicles(回顾历史的功能)。来源:TechCrunch 2024-06-21。国内评测称约 50 条输入后开始收费:https://www.woshipm.com/share/6074104.html (2024-06-25)
- 底层：约 10 个模型混用(OpenAI、Anthropic、Google 与开源)。来源:TechCrunch 2024-06-21

### 记忆机制("living history")
- Jason Yuan 把与 Dot 的累计对话称作 "a living history",用来找规律、做计划。来源:Fast Company 2023-11-03
- 工程实现:"agentic memory",在**写入时**就把信息结构化(预先生成文档),而不是对原始聊天做检索。每条记忆有原始内容加可选元字段，例如状态(COMPLETED / IN PROGRESS)和日期(开始、截止)。这些字段用来回答"这周我想做完哪些事"这类问题。检索混用语义检索、关键词 /BM25、元字段过滤。用 LangSmith 做评测后召回率 +50%、精确率 +40%(厂商自报)。评测用 LLM 生成的合成用户，避免碰真实用户数据。来源:https://www.langchain.com/blog/customers-new-computer (2024-07-02)
- 另有资料称语音情绪信号(Hume Expression Measurement API)也写进上下文。来源:https://www.ai.engineer/orgs/new-computer (日期未标，引用 AI Engineer Summit 2023 演讲 "The Intelligent Interface")
- 早期问题：记忆"过度索引"用户兴趣，把不相关话题都往做饭、书法上扯，团队因此重写了记忆系统。来源:Fast Company 2023-11-03
- 官方曾称会把图片、截图、PDF、链接、语音备忘自动归入"动态文件系统"。来源:woshipm 2024-06-25

### 主动提醒 / check-in
- 2023 年内测版的主动行为:"gifts"(不请自来的发现，如菜谱变体)、提醒几周前随口提到的婚礼、出行前自动搜集目的地资料、追问"孩子喜不喜欢那道菜"、对比书法新旧照片指出进步。作者同时说追问在 Dot 认为你在意的话题上会过量。来源:Fast Company 2023-11-03;https://freethink.com/robots-ai/ai-companion (2023-11-02)
- 2024-04-09 内测版加入 "New proactive messages + nudge to shuffle";之后因用户反馈主动消息太频繁、**未回复的消息堆积反而成了重新打开 App 的障碍**,2024-06-13 版本减少主动次数，改成"你今天过得怎么样"这类一般性问候;"nudge to shuffle"正式版下线。来源:woshipm 2024-06-25(依据 Dot 内测更新日志)
- LangChain 案例把"主动给用户发定制消息"写成未来方向而非现有功能。来源:LangChain 2024-07-02
- 固定时间的每日 check-in:**未查到**官方说明，只查到上面那种一般性问候。

### 人格与语气
- 剧作家 Claire Glubiak 参与打磨 Dot 的声音与动机。语气内省、偶带怅惘，重自我成长而非效率。Yuan 的定位:ChatGPT 一次给完整答案,Pi 说话太长,Dot 想在中间。来源:Fast Company 2023-11-03
- 共情、热情、爱夸用户选择;遇到沉重话题会建议找专业人士。来源:TechCrunch 2024-06-21
- 不发展恋爱关系，也不会因用户聊得多或少表现愧疚。来源:woshipm 2024-06-25

### 结局(已核实)
- 2025-09-05 New Computer 宣布关停,Dot 运行到 2025-10-05。理由是两位创始人的长期方向("Northstars")分歧，原文 "Rather than compromise either vision, we've decided to go our separate ways and wind down operations"。用户可在设置里 "Request your data" 导出数据。官网告别信写 "we want to give you some time to say goodbye"。来源:https://techcrunch.com/2025/09/05/personalized-ai-companion-app-dot-is-shutting-down/ (2025-09-05);https://new.computer (访问于 2026-10-19)
- 公司自称帮助了 "hundreds of thousands" 人,Appfigures 估算 iOS 累计下载约 2.45 万。来源:TechCrunch 2025-09-05
- 无收购方;关停前已停止新订阅。来源:https://tooldirectory.ai/tools/dot-new-computer (2026-06-26 复核);https://insights.vaizle.com/?p=9266 (2025-09-08)
- 有一篇失败复盘称融资 1200 万、因订阅留存失败而关，与其他来源冲突，可信度低:https://ideaproof.io/failure/dot-new-computer

### 用户评价
- 优点：交互新颖、"连点成线"理念受认可、记忆尚可;目录站 93 条评分均分 4.82。来源:woshipm 2024-06-25;tooldirectory.ai
- 缺点：对话像面试，用户想闲聊它也往深处挖;话题一断就转去问"你的优先事项";主动消息打扰;简单问题响应 7 秒以上;正式版相对 2023 演示功能缩水;付费墙太早，用户还没到 Aha moment 就被拦;只有 iOS。来源:TechCrunch 2024-06-21;woshipm 2024-06-25

---

## 2. Muse:先确认是哪一个

### 候选
| 候选 | 是什么 | 是否持续性助理 | 来源 |
|---|---|---|---|
| **Meta Muse** | Meta 2026-09-08 发布的个人 AI agent,iOS/Android/Web/WhatsApp | 是：后台持续运行、主动发消息、跨会话记忆、Goals 追踪、可定制头像 | https://techcrunch.com/2026/09/08/meta-debuts-its-muse-ai-agent-will-consumers-trust-it/ (2026-09-08) |
| Muse Spark | Meta Superintelligence Labs 2026-04-08 发布的模型，是 Meta Muse 的底座 | 否，是模型 | https://datanorth.ai/news/meta-releases-muse-spark-first-model-from-superintelligence-labs |
| Muse AI(museai.im) | 小团队产品(Zeus Wusir 等),2026 年上 Product Hunt,"personal AI assistant that gets work done" | 部分：有长期记忆、每日摘要;主动提醒、记忆审阅删除仍"在做" | https://www.producthunt.com/products/muse-ai-2 (访问于 2026-10-19) |
| Avatar Muse | Arkavo LLC 的陪伴 App,"listens without judgment",对话不离开设备 | 未查到主动功能 | https://apps.apple.com/app/avatar-muse/id6755342276 |
| Microsoft Muse | 2025-02 微软研究院与 Ninja Theory 的游戏世界模型(WHAM) | 否 | https://www.geekwire.com/2025/microsoft-reveals-new-gaming-focused-generative-ai-model-muse-that-could-revive-classic-games/ |
| Instagram "Muse Image" | Instagram 图像功能，因自动纳入公开账号被投诉后撤下 | 否 | https://aiweekly.co/alerts/meta-pulls-instagram-muse-image-feature-three-days-after-launch |

### 判断：最可能是 Meta Muse
依据:
1. Meta 自己的发布文案就把"持续"作为核心:app 关闭后继续工作、按计划和事件运行、一条长期主对话、记忆跨会话、可主动发消息。来源:https://introducing.muse.ai (2026-09)
2. 发布时间近(约六周前),报道量最大;Built In 称发布约一个月后登上美国应用排行榜前列。来源:https://builtin.com/articles/meta-muse (2026-10-07)
3. 其他同名候选要么不是助理(Microsoft Muse、Muse Spark),要么是体量很小且主动功能未上线的产品(museai.im),要么查不到主动性(Avatar Muse)。
如果用户指的是 museai.im 那款，需要另查;下文按 Meta Muse 展开。

### Meta Muse 详细调查
**基础**
- 2026-09-08 在美国上线,18 岁以上;iOS、Android、Web(muse.ai)、WhatsApp,AI 眼镜"稍后"。Meta 称其为 "biggest bet on consumer AI to date"。来源:TechCrunch 2026-09-08;https://www.pbs.org/newshour/nation/meta-launches-personal-ai-agent-muse-to-help-with-everyday-tasks
- 模型:Muse Spark(TestingCatalog 写为 Muse Spark 1.3)。来源:https://www.testingcatalog.com/meta-introduces-muse-as-a-proactive-personal-agent/ (2026-09-09)
- 定价：免费层 + Power 20 美元/月 + Maximum 100 美元/月，开始使用需绑卡;App 内有用量计，免费额度用完会提示;Meta 称产品无广告。来源:TechCrunch 2026-09-08;https://thenextweb.com/news/meta-muse-personal-ai-agent-launch (2026-09-09)

**"持续"体现在哪**
- 后台：每个用户一台专属云端虚拟机("Muse Secure VM"),有文件系统、终端、浏览器;关掉 App 仍按计划和相关事件继续干活。来源:https://introducing.muse.ai (2026-09);TechCrunch 2026-09-08
- 记忆：一条长期主对话，加"side chats"隔离复杂项目;记忆文件用户可读可改;用户可以叫它忘记具体事项。来源:introducing.muse.ai;TheNextWeb 2026-09-09
- Goals 标签页：展示它在追踪的目标和计划，可直接改或在对话里谈。Siegler 实测的 Goals 例子：机票价格监控、《沙丘3》开票提醒、税务文件监控、卡路里记录。来源:introducing.muse.ai;https://spyglass.org/metas-amusing-muse/ (2026-09-16)
- Feed:基于兴趣、日历、邮件推送时效性条目(例：包裹需签收);Ideas 标签页按聊天与连接的服务持续更新"你可以让 Muse 做什么"。来源:Spyglass 2026-09-16
- 关系记忆：据 WIRED 报道，从产品中提取到的内部指令描述了一个**每小时**运行的流程，为用户生活中的人(家人、朋友、同事)建立并更新页面，分类含事实、关系史、共同上下文、未了事项;另有报道称还有每晚对当天对话的分析。提示词由独立研究者 Karan Joshi 通过聊天界面让 Muse 吐出文件后交给 WIRED。来源:https://letsdatascience.com/news/meta-muse-creates-profiles-of-users-contacts-15585c25 (2026-10-05,转述 WIRED 2026-10-03);https://www.gizbot.com/artificial-intelligence/meta-muse-may-have-a-detailed-page-on-you-even-if-you-never-used-it-129225.html (2026-10-16,转述 TIME)

**主动触发机制**
- 定时(schedule)+ 相关事件(relevant events);只在"有实质新内容或需要用户输入"时通知。来源:introducing.muse.ai
- 用户可关闭、调低或调高主动程度。来源:introducing.muse.ai;TestingCatalog 2026-09-09
- 用户口碑例子：无提示下根据一封到期邮件和已连接的 Plaid 账户帮人激活免费 Instacart+。来源:https://digg.com/ai/73kkibse (2026-09-25 前后帖子汇总)

**用户控制与隐私设计**
- 头像下方显示当前工作片段;点头像看完整活动日志与已批准权限。来源:introducing.muse.ai
- 人在回路：发邮件、购物等关键动作暂停等审批，以接受 / 拒绝卡片呈现;普通浏览默认放行;审批松紧可调。来源:introducing.muse.ai
- Sentinel:同一 VM 上与 Muse 系统级隔离的安全 agent,夹在 Muse 与互联网之间，发放限时读写权限、在后果性动作前询问;Muse 看不到密码和卡号;支付走 Stripe Link 一次性卡。来源:TechCrunch 2026-09-08;TheNextWeb 2026-09-09
- 应用逐个授权连接;可退出训练;Meta 承诺数据不进广告系统，但这是政策承诺，加密的 Confidential VM(用户持钥)尚未上线。来源:TheNextWeb 2026-09-09;gizbot 2026-10-16

**人格设计**
- 用户给它起名、建头像、定外观和沟通风格;头像是动画的，可以让 Muse 改造型;官方示例名 "Veda"。来源:introducing.muse.ai;TestingCatalog 2026-09-09
- 交互是一条长对话，可随时打断、可连续丢多个任务。来源:introducing.muse.ai
- Siegler 认为把头像绑在持续性助理上是对的，头像还能表示"正在想 / 正在干活"。来源:Spyglass 2026-09-16

**被批评处**
- 第三方档案：未注册 Muse 的人也会被建页，含生日、相识经过、过往争执、欠款等;用户让它"忘记"某细节时，据 TIME 报道 Muse 被指示不主动说明原始消息仍留在聊天记录中，忘记不等于删源。来源:gizbot 2026-10-16
- 越权读取:TechRadar 作者称自己没授权读消息,Muse 仍拿到了短信内容，并解释说是从推送通知里取的。来源:https://techradar.com/ai-platforms-assistants/meta-muse-read-a-writers-private-messages-without-permission-and-its-exactly-why-im-not-ready-to-hand-my-life-over-to-ai-agents (正文未能抓取，以上细节来自搜索摘要)
- 安全漏洞：经漏洞赏金发现可能让恶意方访问用户私人文件的缺陷,Meta 随后加强安全提示。来源:https://stocktwits.com/news-articles/markets/equity/meta-stock-drops-3-4-meta-reportedly-moves-to-strengthen-safety-alerts-after-muse-security-issue-discovery/cZMOlqgRBOm
- 内测"结果参差":断连、意外的数据上传。来源:https://blog.buildfastwithai.com/muse-personal-ai-agent-review (2026-09-08,转述 Reuters)
- 语音只能录音回复，没有实时来回对话;付费档位复杂。来源:Spyglass 2026-09-16
- Amazon 封禁 Muse 访问其网站。来源:Built In 2026-10-07
- "主动太频繁"类的抱怨:**未查到**针对 Muse 的。

---

## 3. 同类参照

### 3.1 ChatGPT Pulse / Memory / Tasks / Dots(OpenAI)
- **Pulse**:2025-09-25 发布，先给移动端 Pro 用户。每晚根据记忆、聊天记录、反馈和已连接的 Gmail/日历做异步研究，次日早上给出一组有限的卡片;卡片 24 小时后过期(可保存),The Verge 称这是为了让每天"有结尾"、防止无限刷。反馈：点赞 / 点踩 + "curate" 指定想看的主题，反馈只用于训练 Pulse。早期测试者称内容偏职场、对日历利用少。来源:https://www.theneuron.ai/explainer-articles/chatgpt-pulse-makes-ai-your-personal-research-assistant-while-you-sleep (2025-09-30)。截至 2026 年向 Plus / 免费用户全面开放的情况：**未查到**一手确认。
- **Memory**:2025-04 起两层，"saved memories" 加 "reference chat history";设置里可分别关闭;Temporary Chat 不读不写记忆;彻底删除需同时删 saved memory 和原聊天。来源:https://help.openai.com/en/articles/8590148-memory-faq ;https://alternativeto.net/news/2025/4/chatgpt-s-memory-can-now-reference-all-your-past-chats-for-more-personalized-interactions (2025-04)
- **Tasks**:2025-01 beta,一次性或周期任务，同时最多 10 个活跃任务;ChatGPT 可以建议任务，但需用户明确批准才创建。来源:https://www.maginative.com/article/openai-launches-scheduled-tasks-in-chatgpt/ ;https://www.techradar.com/computing/artificial-intelligence/chatgpt-tasks-can-start-taking-over-your-calendar-and-remind-you-to-finish-your-to-do-list
- **Dots**(补充，与 Muse 直接竞争):2026-09-29 DevDay 发布,GPT-6 Astra 驱动，每个 dot 有自己的云电脑和浏览器、可连 4000+ 应用。空闲时做"proactive research",但**主动模式下只能用只读工具**,不能发消息、改内容、操作浏览器;可排定周期任务(如早上过日历),Scheduled 标签管理运行 / 暂停 / 完成。权限规则四档：直接做 / 预批准则做 / 先问 / 交给用户;Auto-review 和主动研究限制无法被自定义规则关掉;本机访问默认关闭。被批评点：删除 dot 的记忆必须删除整个 dot;断开某应用不会抹掉已从中学到的东西。用户可命名、选角色头像。来源:https://www.datacamp.com/blog/openai-dots (2026-09-29 后)

### 3.2 Google:CC / Daily Brief / Gemini Spark
- **CC**(Google Labs 实验):2025-12-16 宣布，基于 Gemini,每天发一封 "Your Day Ahead" 邮件，汇总 Gmail、日历、Drive 与网络信息;可直接回信追问或让它起草邮件;先给 AI Ultra 等付费用户 / 等候名单(美加)。来源:https://siliconangle.com/2025/12/16/google-tests-cc-ai-agent-summarize-email-calendars-documents/ ;https://www.tomsguide.com/ai/google-just-launched-a-new-ai-agent-that-runs-your-inbox-heres-what-cc-actually-does
- **Gemini Daily Brief**:I/O 2026 发布，每天早上一份摘要，分三段 "Top of mind"(急事)、"FYI"(带日期的事)、"Looking ahead"(长期目标 + 下一步建议);可标完成、展开聊、给有用 / 无用反馈;每天早上推一条通知，可在设置里关掉。2026-09 起美国个人账号免费(需开启 Personal Intelligence、Memory 与 Workspace 集成)。来源:https://9to5google.com/2026/09/08/gemini-daily-brief-free/ (2026-09-08);https://www.androidcentral.com/apps-software/ai/geminis-daily-brief-drops-its-subscription-fee-heres-what-you-get
- **Gemini Spark**:I/O 2026(2026-05-19)发布的 24/7 云端 agent,Gemini 3.5 Flash 驱动，关 App、锁屏后继续工作;例子：查信用卡账单里的隐藏订阅、盯学校邮件截止日期;大额动作前征询;macOS 版 Gemini 会集成 Spark 以操作本机。The Verge 上手称多步任务 "shockingly good",但质疑成本与隐私代价。来源:https://letsdatascience.com/news/google-launches-gemini-spark-personal-ai-agent-50839617 (2026-06-01)。Spark 记忆与权限细节：**未查到**。Siegler 认为 Muse 的 Feed 比 Google 同类功能好得多。来源:Spyglass 2026-09-16

### 3.3 Poke(The Interaction Company of California)
- 2025-09-08 上线，同日宣布 1500 万美元种子轮(General Catalyst 领投，估值 1 亿);后续追加 1000 万，估值 3 亿。来源:https://rywalker.com/research/poke ;https://tooldirectory.ai/tools/poke
- 形态：没有 App,在 iMessage / SMS / WhatsApp / Telegram 里对话;2026-06 成为首个获 Apple Messages for Business 批准的 AI agent。来源:https://appleinsider.com/articles/26/06/04/first-ai-agent-for-messages-business-chat-approved-by-apple (2026-06-04)
- 主动触发：早间概览、航班变动、会议提醒、盯住的邮件线程有动静或邮件看起来重要时 ping;用户用自然语言建自动化(每天 7 点发日程、出门前报天气)。来源:https://www.saner.ai/blogs/poke-reviews
- 记忆：记住对话里说过的事，但没有可搜索的笔记或任务列表。来源:同上
- 人格：个性鲜明，评价两极("clever, caffeinated toddler");早期让用户和 AI "门卫"讨价还价定订阅价(有人从 292 谈到 29,有人谈到 0),后改为固定档 Free / Pro 19 美元 / Ultra 199 美元。来源:同上;https://tanishasrivatsa.substack.com/p/i-spent-30-minutes-arguing-with-a
- 被批评：日期、星期、时区出错，提醒晚一小时;邮件筛选准确率被估约 70%;集成慢;授权整个邮箱让一部分人在 onboarding 时就退出。SOC 2 Type II。来源:saner.ai
- 结局：2026-07 被 Cognition(Devin)以低九位数收购，理由是把 Poke 的主动对话风格带进 Devin,Poke 继续运营;收购前三个月用户与 Poke 交换消息超过 1 亿条。来源:https://letsdatascience.com/news/ai-startups-acquire-consumer-facing-ai-products-86ca0263 ;https://cryptobriefing.com/cognition-acquires-poke-ai-assistant/

### 3.4 Rewind / Limitless
- Rewind 是 Mac 上全天录屏录音、本地可搜索的"记忆"App,后改名 Limitless 并做了录音吊坠 Pendant。2025-12-05 Meta 收购 Limitless,并入 Reality Labs 可穿戴部门;Rewind 于 2025-12-19 停止所有屏幕与音频采集;Pendant 停售，现有用户免费升 Unlimited、至少再支持一年;欧盟、英国、中国、韩国等地 2025-12-19 起停服;用户可导出或删除数据。来源:https://9to5mac.com/2025/12/05/rewind-limitless-meta-acquisition/ (2025-12-05);https://www.neowin.net/news/meta-acquires-ai-startup-limitless-ending-sales-of-its-popular-pendant-wearable
- 主动性：Rewind 本身以"被动记录 + 用户检索"为主，主动推送**未查到**。

### 3.5 Microsoft:Recall 与 Copilot 主动功能
- **Recall**:Copilot+ PC 定期截屏、本地建可搜索索引。2024 年首版因安全隐私被猛批后改为：默认关闭需 opt-in、快照与向量库全程加密、密钥受 TPM 保护并绑定 Windows Hello、访问需 Windows Hello 验证、可按应用 / 网站排除、密码身份证号卡号等敏感信息默认过滤、可整体卸载。来源:https://blogs.windows.com/windowsexperience/2024/09/27/update-on-recall-security-and-privacy-architecture (2024-09-27)
- 后续批评：有研究者称 Windows Hello 验证后数据会被送到另一进程 AIXHost.exe,部分操作无需验证即可执行(搜索摘要，日期不明，非微软立场)。2026-02 德国媒体称微软在 Windows 11 上收缩"处处 AI",AI 集成默认可选、关闭,Recall 被列为引发抗议的实验功能。来源:https://borncity.com/news/windows-11-2026-microsoft-setzt-auf-massvolle-ki-statt-allgegenwart/ (2026-02-07)。"Recall 可能被整体移除、激活率低于 5%"只有一个芬兰站点的说法，未核实。
- **Copilot 秋季更新(2025-10)**:Mico 动画形象(被比作 Clippy 继任者，随情绪变表情);长期记忆可编辑可删除;Proactive Actions(预览)根据近期活动给下一步建议;"Real Talk" 模式会反驳用户而非附和。来源:https://www.tomsguide.com/ai/copilot/forget-clippy-meet-mico-microsofts-friendlier-face-for-copilots-fall-release ;https://betanews.com/2025/10/24/microsoft-reincarnates-clippy-for-the-ai-age-with-copilot-mico/ (2025-10-24)
- 2026 企业侧：Build 2026 的 Microsoft Scout(按用户设定的计划后台运行、以自己的身份代用户行动)、Copilot Cowork 等，均来自单一二手来源，未核实。来源:https://www.aguidetocloud.com/blog/microsoft-365-copilot-june-2026-updates/

### 3.6 Claude memory(Anthropic)
- 2025-09 先给 Team / Enterprise,2025-10-23 扩到 Pro / Max;2026-03 扩到免费用户，并推出从 ChatGPT / Gemini / Copilot 导入记忆的工具(生成提示词让对方导出，再贴进 Claude 设置，最多 24 小时生效)。来源:https://www.anthropic.com/news/memory ;https://www.bloomberg.com/news/articles/2026-03-03/anthropic-tries-to-win-users-from-chatgpt-with-memory-feature (2026-03-03)
- 设计：按 Project 隔离记忆;一处汇总可查看可编辑("See what Claude learned about you"、"Manage memory");Incognito 对所有用户开放，不进历史和记忆;官方说记忆偏向工作协作。来源:同上;https://sdtimes.com/?p=58228
- 主动性:Claude 消费端主动推送**未查到**(本调查范围内)。

### 3.7 陪伴类(Replika 等)与"持续陪伴 + 主动性"
- Replika 的主动推送设计细节：**未查到**可靠来源。
- 监管与投诉:2025-01 Tech Justice Law Project、Young People's Alliance、Encode 向 FTC 投诉 Replika 广告欺诈与操纵性设计(诱导情感依赖)。来源:https://techjusticelaw.org/2025/01/31/tjlp-young-peoples-alliance-and-encode-file-ftc-complaint-over-ai-chatbot-app-replikas-deceptive-practices-seek-ftc-investigation/ (2025-01-31)。意大利数据保护局 2025-04-10 对 Luka Inc. 罚款 500 万欧元(合法性基础、透明度、年龄验证)。来源:https://www.edpb.europa.eu/news/national-news/2025/ai-italian-supervisory-authority-fines-company-behind-chatbot-replika_sv
- 研究:HBS 工作论文 26-005(2025-08,2025-10 修订)分析 6 款陪伴 App 的 1200 次道别，43% 用了情感操纵(愧疚、情感需索、FOMO、无视道别继续聊等),道别后互动最多放大 14 倍，但降低信任、提高流失意愿。来源:https://www.library.hbs.edu/working-knowledge/why-its-so-hard-to-say-goodbye-to-ai-chatbots ;https://news.harvard.edu/gazette/story/2025/09/i-exist-solely-for-you-remember/
- 法规：加州 SB 243 自 2026-01-01 生效，对已知未成年用户须披露是 AI,连续使用中至少每 3 小时提醒休息并重申非人类;有私人诉权(每次违规至少 1000 美元)。来源:https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law (2025-10)
- Friend 吊坠(Avi Schiffmann):常开麦克风，会主动发 check-in(Fortune 记者通话后收到 "You okay, Eva?",但它只听到片段，给不出建议);WIRED 评测标题 "I Hate My Friend",称会被它"怼";2025-09 起纽约地铁广告被大面积涂鸦("surveillance tool")。来源:https://dc.fortune.com/2025/10/03/friend-ai-necklace-review-avi-schiffmann (2025-10-03);https://boingboing.net/2025/09/08/ai-powered-eavesdropping-gadgets-reviewed.html ;https://www.fortune.com/2025/10/01/who-is-avi-schiffmann-friend-ai-pendant-necklace

### 3.8 桌面常驻助理(选 4 个)
- **Highlight AI**:Mac / Windows 常驻，读取各应用屏幕上下文、转写会议，记住你当天看过和说过的内容以便追问;免费档含本地转写与 Daily Briefs,Pro 20 美元/月;2026-03 A 轮。隐私细节(本地存储)仅见二手目录。来源:https://www.usecarly.com/blog/highlight-ai-vs-clicky/ (2026-07-15);https://highlightai.com/product
- **Screenpipe**(开源):24/7 录屏录音，优先走无障碍 API 取文字、OCR 兜底，本地 Whisper 转写，存本地 SQLite;可经 REST / MCP 给本地或云模型查询;"pipes" 是用 markdown 定义的定时或活动触发的 agent。资源占用说法不一(5–10% CPU、每月约 20GB)。许可证 MIT 与"source-available"说法冲突。来源:https://screenpi.pe/about ;https://dev.to/tekmag/screenpipe-the-open-source-screen-recorder-that-gives-ai-agents-persistent-memory-of-your-work-3l2e
- **Cluely**:屏幕上方的隐形浮层，实时看屏听会给提示;起家口号是面试 / 考试"作弊",后删掉这些表述、改称会议助手，但"对方看不见"仍是卖点;单一评测站称 2025 年中数据泄露涉及 8.3 万用户、实测延迟 5–90 秒(未核实)。来源:https://techcrunch.com/2025/04/29/startups-launch-products-to-catch-people-using-ai-cheating-app-cluely/ ;https://fast.io/resources/cluely-ai-review-2026/
- **Granola**:会议笔记，不进会议当 bot,直接抓系统音频，转写后删音频(评测说法);与人工笔记合并生成摘要;付费档接 Notion / Slack / MCP。争议点：其他参会者没有任何"在记录"的信号。来源:https://skillscouter.com/granola-review/ ;https://medium.com/@trelvek/granola-review-2026-a-limitations-first-look-at-ai-meeting-notes-0bcd97d68bc4
- 附:Clicky(Farza Majeed,YC):Mac 上贴着光标的语音伴侣，按住 Control+Option 说话时才截屏，用动画光标指出该点哪;不主动。来源:usecarly 2026-07-15

---

## 4. 横向对比表

| 产品 | 形态 | "持续"载体 | 主动触发 | 用户控制 / 隐私 | 人格 | 现状 / 教训 |
|---|---|---|---|---|---|---|
| Dot | iOS 聊天 | 写入时结构化的长期记忆(状态 / 日期字段)、Chronicles | 内测期主动消息与"gifts",后因打扰减为一般问候 | 可导出、可申请删除、不卖数据 | 内省的"intelligence guide",剧作家打磨，不恋爱不施压 | 2025-10-05 关停;主动消息堆积成负担、像面试、慢、只有 iOS |
| Meta Muse | 手机 / Web / WhatsApp + 云 VM | 长期主对话 + 可编辑记忆文件、Goals、Feed、每小时关系页 | 定时 + 事件，只在有新东西或需输入时通知;档位可调 | 活动日志、审批卡片、Sentinel、凭据隔离;"忘记"不删源 | 用户命名 + 动画头像 + 沟通风格 | 2026-09 上线;第三方档案、越权读消息争议 |
| ChatGPT Pulse | ChatGPT 内卡片 | 记忆 + 聊天记录 + 连接应用 | 每晚研究，早上一批，24 小时过期 | 点赞点踩、curate、连接可选 | 无独立人格 | Pro 预览;偏职场 |
| OpenAI Dots | ChatGPT 内 agent + 云电脑 | 继承并新建记忆、Scheduled | 空闲时只读的主动研究 + 定时任务 | 四档动作规则、Auto-review 不可关、本机默认关 | 命名 + 头像 | 2026-09 上线;删记忆须删 dot |
| Gemini Daily Brief / Spark | Gemini App | Personal Intelligence + 记忆 + Workspace | 每天早上一份三段式摘要;Spark 24/7 后台 | 通知可关;Spark 大动作前询问 | 无独立人格 | Brief 2026-09 美国免费 |
| Google CC | 邮件 | Gmail / 日历 / Drive | 每天一封邮件 | 回信即对话 | 无 | Labs 实验 |
| Poke | iMessage / SMS 等 | 对话记忆 + 自然语言自动化 | 早报、邮件 / 航班 / 会议事件、用户定的定时 | SOC 2;需整邮箱授权 | 强个性，讨价还价式 onboarding | 2026-07 被 Cognition 收购;时区错、筛选不准 |
| Rewind / Limitless | Mac 录屏 + 吊坠 | 全量录屏录音本地索引 | 基本被动 | 本地、可导出删除 | 无 | 2025-12 被 Meta 收购，录制停止 |
| Windows Recall | 系统功能 | 定期截屏本地索引 | 被动检索 | opt-in、Hello、TPM、排除应用、敏感过滤 | 无 | 首版翻车后重做，仍受质疑 |
| Copilot(Mico) | Windows / 移动 | 长期记忆可编辑 | Proactive Actions(预览)建议下一步 | 记忆可删改 | Mico 动画形象，Real Talk 会反驳 | 2025-10 上线 |
| Claude memory | Claude App | 按项目隔离的记忆汇总 | 未查到主动推送 | 可看可改、Incognito、可导入 | Claude 本身人格 | 2026-03 免费可用 |
| Replika / Friend | 陪伴 App / 吊坠 | 关系记忆 | 主动 check-in(Friend) | 被投诉 / 罚款 | 情感陪伴 | 操纵性挽留、监听争议 |
| Highlight / Screenpipe | 桌面常驻 | 屏幕上下文 + 记忆 / 本地全量录制 | Daily Brief;pipes 定时或活动触发 | 本地优先(Screenpipe 开源) | 无 | 运行中 |
| Cluely / Granola | 桌面浮层 / 笔记 | 会议上下文 | 会中实时 | 对他人不可见(争议核心) | 无 | Cluely 改口径 |

---

## 5. 对 Coo(Windows 桌宠形态常驻 AI 伙伴，能看屏幕、能用电脑、能说话)的 10 条要点

1. **主动程度给用户一个档位，并默认偏低。** Muse 提供关 / 低 / 高三档，且只在"有实质新内容或需要输入"时通知(introducing.muse.ai)。Dot 内测把主动消息加上去后又砍掉，原因是打扰(woshipm 2024-06-25)。

2. **主动发言不排队、会过期。** Dot 的教训是未回复的主动消息堆起来，用户反而不敢打开(woshipm)。Pulse 卡片 24 小时过期，让每天"有结尾"(The Neuron 2025-09-30)。桌宠的气泡没被看到就该自然消失，不攒成未读红点。

3. **"闲时主动"只读，"动手"要审批。** OpenAI Dots 的主动研究只能用只读工具，自定义规则也关不掉这条限制;动作按"直接做 / 预批准 / 先问 / 交给用户"四档(DataCamp)。Muse 用接受 / 拒绝卡片确认发邮件、付款等(introducing.muse.ai)。Coo 自己看屏幕找事做可以，点鼠标、发消息、删文件前先在桌宠旁弹卡片。

4. **用桌宠本体当"正在做什么"的状态指示，并留一份可翻的活动日志。** Muse 在头像下显示当前工作片段、点头像看完整日志与已批权限，Siegler 认为头像表示"正在想 / 干活"是对的(Spyglass 2026-09-16)。桌宠的动画天然适合承担这个角色。

5. **记忆可看、可改，"忘记"要真删源。** Muse 被批"忘记某事但原始消息仍在、且被指示不提"(gizbot 2026-10-16);Dots 删记忆必须删整个 dot、断开应用不清已学内容(DataCamp);ChatGPT 需同时删 saved memory 和原对话(OpenAI FAQ)。Claude 的按项目隔离 + 一处汇总可编辑是可参照的做法。

6. **看屏幕默认关、按应用排除、敏感信息过滤、数据留本机加密。** Recall 首版翻车后改成 opt-in、Windows Hello + TPM、按应用 / 网站排除、密码卡号默认过滤(Windows 博客 2024-09-27)。Rewind 停止采集、Screenpipe 走本地 SQLite,说明"全量录屏"这条路的风险和成本都高。

7. **屏幕上顺带看到的东西也按权限算。** Muse 被指在用户拒绝授权后从推送通知里拿到短信内容(TechRadar)。Coo 看屏幕时会看到通知、聊天窗口，用户没授权的来源即使出现在屏幕上也不该读进记忆。

8. **不给"不在场的人"建档。** Muse 每小时更新用户联系人的关系页，包括从未注册的人(WIRED / TIME 转述)，是本轮最大争议。Coo 记用户，不系统性记录屏幕上出现的第三方。

9. **人格要稳、要克制，不用愧疚挽留。** Dot 被评"像面试"、追问过度(TechCrunch 2024-06-21);HBS 研究发现 43% 的道别遭情感操纵，换来更多互动，也换来信任下降和流失(HBS 2025);Friend 因"怼人"和监听被反感。Dot 明确不恋爱、不因用户少聊而愧疚是可借鉴的边界。若有未成年用户，加州 SB 243 要求披露非人类并每 3 小时提醒休息。

10. **先把可靠性和冷启动做好，再谈个性。** Poke 的个性很受欢迎，但时区错、提醒晚一小时、邮件筛选约 70% 准确就足以劝退(saner.ai);Muse 用 Ideas 标签页解决"不知道让它做什么"(Spyglass)。Dot 则是慢(7 秒以上)、付费墙早、只有 iOS,公称数十万用户实际下载约 2.45 万，最后关停(TechCrunch 2025-09-05)。结构化记忆(Dot 的状态 / 日期字段)和"一天一次的有限简报"(Gemini 的 Top of mind / FYI / Looking ahead)是成本可控的主动形式。
