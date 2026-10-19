# CooCowork 方案设计

Owner: `src/world.ts`

需求见 [requirements.md](requirements.md)。

## 形态

一个 Cortico World 扩展包 `cortico-world-coocowork`,World id `cowork`,工具前缀 `cowork_`。和 GPTSovits 语音一样是给 Coopanion 写的扩展:环境提示词里直接提到 `pet_say`、`pet_quiet`、`alarm_set`。在别的 Cortico bot 里也能装,那几句就没有对应的工具。

```
probe.ts ──采样──▶ activity.ts ──Signal──▶ world.ts ──事件(flush / piggyback)──▶ Core ──▶ Coo
 (koffi,Win32)     (纯状态机)          │        ▲
                        │ LogRecord     │        └── 工具 cowork_*  ◀── Coo
                        ▼               │
                   daylog.ts            ├── calendar.ts(.ics 解析与重复规则展开)
             <dataDir>/days/*.jsonl     └── model-text.ts(中英两份事件正文与回执)
```

| 文件 | 内容 |
|---|---|
| `probe.ts` | `GetForegroundWindow`、`QueryFullProcessImageNameW`、`GetLastInputInfo`,本机实测一次采样 0.02 ms(2000 次平均);非 Windows 或 koffi 加载失败返回 null |
| `activity.ts` | 采样折成离开、回来、连续在电脑前、专注时段的信号和按天的停留段;不读时钟、不碰磁盘,测试直接喂时刻 |
| `daylog.ts` | 按本地日期分文件的 JSONL,跨午夜切开;`state.json` 存重启后接着用的状态;按天概要 |
| `calendar.ts` | .ics 解析;RRULE 的 DAILY/WEEKLY/MONTHLY/YEARLY、BYDAY(含 -1FR)、BYMONTHDAY、COUNT、UNTIL、EXDATE、RECURRENCE-ID;TZID 认 IANA 和常见 Windows 名 |
| `world.ts` | 每拍采样、推事件、日程提醒、按间隔重读日历;六个工具;WebUI 的配置组、状态灯、存储清除、环境提示词 |

## 事件

正文以本地时间 `[HH:MM]` 开头(每天第一次见面带日期和星期),再是 `[cowork]`。窗口标题和日历文字是外部内容,这些事件按 `external` 推;只有读取器自己的状态变化是 `internal`。

| type | 何时 | 投递 | 改为随下一批送达的情形 |
|---|---|---|---|
| `cowork.day-start` | 本地日期上第一次看到键鼠活动 | flush | 安静时段 |
| `cowork.back` | 离开(默认 5 分钟无输入)后回来 | 离开 ≥ 20 分钟时 flush,否则 piggyback | 少打扰档、安静时段、专注时段中、日程进行中 |
| `cowork.away` | 无输入满离开判定 | piggyback | |
| `cowork.stretch` | 连续在电脑前每满 90 分钟 | flush | 少打扰档、安静时段、专注时段中、日程进行中 |
| `cowork.drift` | 专注时段里前台停在避开项上满 120 秒,每段一次 | flush | 安静时段 |
| `cowork.focus-ended` | 专注时段到时 | flush | |
| `cowork.meeting` | 日程开始前 10 分钟,每场一次,重启不重复 | flush | |
| `cowork.sensor` | 读取器失败或恢复 | piggyback | |
| `cowork.calendar` | 日历读取失败(同一错误只报一次) | piggyback | |

数字都是配置项的默认值。离开从最后一次输入算起;两次采样之间断开超过离开判定(电脑睡眠)时,断开那段按离开算。

模拟工作日里 World 叫醒 Coo 9 次。按一次叫醒 1–2 轮模型调用估算,一天多出 10–20 次调用。

## 工具

| 工具 | 作用 |
|---|---|
| `cowork_now` | 前台程序与标题、多久没操作、这一轮在电脑前多久、今天合计、专注时段、接下来三项日程 |
| `cowork_focus_start` | `goal`、`minutes`(5–240)、`avoid`(最多 10 个,程序名或标题关键词,不分大小写) |
| `cowork_focus_stop` | 提前结束,回执带统计 |
| `cowork_day` | `date`(YYYY-MM-DD / today / yesterday):首末时刻、合计、离开时段、程序与标题分钟数、专注时段 |
| `cowork_calendar` | `days`(1–14):日程列表;读不懂的重复规则与时区写在回执里 |
| `cowork_forget` | `date`(YYYY-MM-DD / today / all):删除活动记录文件 |

## 配置

`worlds.cowork` 段,全部热改,高级模式的 World 页渲染成表单。

| 键 | 默认 | |
|---|---|---|
| `promptLanguage` | `zh` | 扩展拿不到 app 语言,同 GPTSovits 自带一项 |
| `proactivity` | `normal` | `low`:回来、连续在电脑前不叫醒 |
| `activity.enabled` / `sampleSec` | `true` / 5 | |
| `activity.awayMinutes` / `backWakeMinutes` / `stretchMinutes` | 5 / 20 / 90 | `stretchMinutes: 0` 不推 |
| `activity.titles` | `true` | 关掉只记程序名 |
| `activity.privateApps` | 密码管理器与微信、QQ、Telegram、WhatsApp、Signal | 逗号分隔的可执行文件名 |
| `activity.keepDays` | 14 | |
| `focus.nudgeSec` | 120 | |
| `calendar.file` / `remindMinutes` / `refreshMinutes` | 空 / 10 / 30 | 订阅地址是密钥 `COWORK_CALENDAR_URL`,写部署 `.env`,经 `ctx.secret()` 读 |
| `quietHours.from` / `to` | 空 | HH:MM,可跨午夜 |

## 数据

`<dataDir>/` 下(Coopanion 里是 `<userData>/home/companion/data/` 一类位置,由 Cortico 的 `ctx.dataDir` 决定):

- `days/YYYY-MM-DD.jsonl`:`{k:'seg',from,to,app,title}`、`{k:'away',from,to}`、`{k:'focus',...,stats}`,一行一条。一整天大约几百行、几十 KB。
- `days/state.json`:最后一次活动时刻、这一轮的起点、进行中的专注时段。
- `reminded.json`:提醒过的日程场次,只留一天内的。

WebUI 的 World 数据页签可以一键清除活动记录(`storage`)。

## 取舍

- **不做心跳闲聊**:Coopanion 默认关心跳,这里也不开。主动全靠有事实依据的事件,没有新事实就不叫醒。
- **不判断专注与否**:「前台在 B 站」是事实,「在摸鱼」是推断。只有对方自己说的避开项才触发提醒,环境提示词要求 Coo 相信对方的解释。
- **busy 时压低叫醒**:模拟里第一版在专注时段和评审会上各多叫醒一次「连续坐满」,Coo 只能沉默。现在这两种情形改为随下一批送达,正文写明是哪个时段或日程。
- **标题默认记录**:只记程序名时回顾只剩「Word 54 分钟」,对 Coo 接上前一天的事帮助小。代价是标题进模型上下文;用无痕窗口不记、聊天程序默认不记、一键删除来兜底,扩展声明 `sensitive-data` 标签。
- **待办不进 World**:对方说的进度和打算由 Coo 写进自己的笔记(`PARTNER.md` 与 `partner/`)。World 只给事实,避免 World 里另存一份会和 Memory 分叉的状态。
- **日历只读 .ics**:Google、Outlook、飞书、钉钉都能导出或订阅 iCalendar;不接各家 OAuth,不需要第三方账号授权。
- **不依赖 presence 等第三方 World**:同一份前台窗口读取各写一遍的代价很小,依赖反而让安装和版本耦合。

## 已知局限与后续

1. 订阅地址只能手写进 `.env`,扩展安装时 pnpm 还会把 koffi 记成待定的构建脚本(`allowBuilds: koffi`),要看 Coopanion 的扩展页怎么呈现这一项。普通使用者需要一个填写入口:高级模式的 World 面板加一个保存密钥的输入框(`ctx.storeSecret`),或由 Coopanion 提供。
2. 只在 Windows 上读前台窗口与空闲;macOS 要另写 probe。
3. 全屏视频、语音会议时键鼠不动,会被算成离开。可以加「前台是全屏窗口时不算离开」或读音频会话状态,先观察真实使用再定。
4. 装进 Coopanion 只验证了无界面的一半:打成 tgz、按扩展目录的方式 `pnpm add`(koffi 的构建脚本被跳过也能用,它走预编译包),再用 Coopanion 自带的 Cortico 装配 Cormini 加载挂载,前缀里 CooCowork 一段 1363 字,前台窗口读取为「开着」(脚本在 `Coopanion/scratch/coocowork/`)。还没在 Electron 应用里看过:事件在对话页的样子、和桌宠环境提示词放在一起时 Coo 的反应。
5. 脚本扮演的 Coo 只验证了事件与工具的契约。真实模型在这些事件下是否守住「少开口」,要用真模型跑同样的一天,比较叫醒后开口的比例。
6. 还没发 npm,仓库没有远端。拿「官方」徽标要求 npm 维护者含 phantivia、`repository` 在 Pal-AI-Lab 名下。
