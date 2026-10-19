/** 给 Coo 读的事件正文与工具回执,中英两份。工具描述只写英文,在 tools.ts。 */
import type { FocusStats } from './activity.ts';
import { duration } from './clock.ts';

export interface AppLine { app: string; title: string }

const zhApp = (a: AppLine) => (a.app ? `${a.app}${a.title ? `「${a.title}」` : ''}` : '(读不到程序)');
const enApp = (a: AppLine) => (a.app ? `${a.app}${a.title ? ` "${a.title}"` : ''}` : '(program unknown)');

const zh = {
  dow: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  app: zhApp,
  quote: (s: string) => `「${s}」`,
  dur: (min: number) => duration(min, 'zh'),

  dayStart: (last: string | null, gapMin: number | null) => `[cowork] 今天第一次看到使用者在电脑前。${last ? `上次看到活动是 ${last}${gapMin !== null ? `,隔了 ${duration(gapMin, 'zh')}` : ''}。` : '这是第一次记录。'}`,
  yesterday: (date: string, span: string, activeMin: number, apps: string, focus: string) => `前一个有记录的日子(${date}):${span},在电脑前共 ${duration(activeMin, 'zh')}${apps ? `,用得最多:${apps}` : ''}${focus ? `;专注时段:${focus}` : ''}。`,
  todayCalendar: (lines: string) => `今天日历上:${lines}。`,
  todayCalendarNone: '今天日历上没有日程。',
  back: (since: string, min: number) => `[cowork] 使用者回到电脑前,离开了 ${duration(min, 'zh')}(${since} 起没有键鼠操作)。`,
  away: (since: string, a: AppLine) => `[cowork] 使用者 ${since} 起没有动键盘和鼠标,离开时前台是 ${zhApp(a)}。`,
  stretch: (since: string, min: number, awayMin: number) => `[cowork] 使用者已经连续在电脑前 ${duration(min, 'zh')}(${since} 起,中间没有离开超过 ${awayMin} 分钟)。`,
  drift: (goal: string, elapsedMin: number, sec: number, a: AppLine, matched: string) => `[cowork] 专注时段「${goal}」进行到第 ${elapsedMin} 分钟,前台在 ${zhApp(a)} 上停了 ${Math.round(sec / 60) || 1} 分钟,匹配开始时说好要避开的「${matched}」。`,
  focusEnded: (goal: string, plannedMin: number, s: FocusStats, wasClosed: string | null) => `[cowork] 专注时段「${goal}」到时间了(计划 ${plannedMin} 分钟)。${focusFacts(s)}${wasClosed ? ` 应用在 ${wasClosed} 前后没开着,这段只统计到应用开着的时间。` : ''}`,
  meetingSoon: (inMin: number, range: string, summary: string, location: string) => `[cowork] 日历:${inMin <= 0 ? '现在' : `${inMin} 分钟后`}(${range})「${summary || '无标题'}」${location ? `,地点 ${location}` : ''}。`,
  sensorDown: (why: string) => `[cowork] 读不到前台窗口和键鼠活动了(${why})。离开、回来、连续在电脑前这些事件暂停,专注时段只按时间结束。`,
  sensorUp: '[cowork] 又能读到前台窗口和键鼠活动了。',
  busyMeeting: (summary: string, range: string) => `日历上此刻是「${summary || '无标题'}」(${range})。`,
  busyFocus: (goal: string) => `专注时段「${goal}」进行中。`,
  calendarFailed: (why: string) => `[cowork] 日历没读成(${why}),日程提醒暂停,修好后自动恢复。`,

  // 回执
  nowLine: (a: AppLine, idleSec: number) => `前台:${zhApp(a)};${idleSec < 60 ? '刚刚还在操作' : `已经 ${duration(idleSec / 60, 'zh')}没有键鼠操作`}。`,
  nowAway: (since: string) => `使用者 ${since} 起不在电脑前。`,
  nowPresent: (since: string, min: number) => `这一轮从 ${since} 起在电脑前,已 ${duration(min, 'zh')}。`,
  nowToday: (min: number) => `今天在电脑前共 ${duration(min, 'zh')}。`,
  nowFocus: (goal: string, elapsed: number, left: number, avoid: string) => `专注时段「${goal}」进行中:第 ${elapsed} 分钟,还剩 ${left} 分钟${avoid ? `,要避开:${avoid}` : ''}。`,
  nowNoFocus: '没有进行中的专注时段。',
  nowNext: (lines: string) => `接下来的日程:${lines}`,
  activityOff: '活动读取关着(设置里的「读取前台窗口与键鼠活动」)。',
  sensorMissing: '这台电脑上读不到前台窗口和键鼠活动。',

  focusStarted: (goal: string, until: string, avoid: string) => `专注时段「${goal}」开始了,到 ${until} 结束${avoid ? `;前台停在 ${avoid} 上超过设定时长会告诉你` : ''}。结束时你会收到一条事件。`,
  focusBusy: (goal: string, until: string) => `[cowork_focus_start 没执行] 已经有一个专注时段「${goal}」进行中(到 ${until})。先结束它再开新的。`,
  focusBad: (why: string) => `[cowork_focus_start 没执行] ${why}`,
  minutesRange: 'minutes 要在 5 到 240 之间。',
  goalEmpty: 'goal 不能为空。',
  focusStopped: (goal: string, elapsed: number, s: FocusStats) => `专注时段「${goal}」提前结束,进行了 ${elapsed} 分钟。${focusFacts(s)}`,
  focusNone: '[cowork_focus_stop 没执行] 没有进行中的专注时段。',

  dayNone: (date: string) => `${date} 没有记录。`,
  dayBad: (got: string) => `[cowork_day 没执行] date 应为 YYYY-MM-DD、today 或 yesterday,收到 ${got}。`,
  dayHead: (date: string, dow: string, span: string, min: number) => `${date} ${dow}:${span},在电脑前共 ${duration(min, 'zh')}。`,
  dayAways: (lines: string) => `离开:${lines}`,
  dayApps: '程序(分钟):',
  dayFocus: '专注时段:',
  dayDates: (dates: string) => `有记录的日期:${dates}`,
  focusLine: (from: string, to: string, goal: string, planned: number, endedBy: 'time' | 'stopped', s: FocusStats) => `${from}–${to}「${goal}」计划 ${planned} 分钟,${endedBy === 'time' ? '到时结束' : '提前结束'};${focusFacts(s)}`,

  calNone: (days: number) => `接下来 ${days} 天日历上没有日程。`,
  calNoSource: '没有配置日历:设置里填 .ics 文件,或在部署 .env 写 COWORK_CALENDAR_URL。',
  calError: (why: string) => `日历上次读取失败:${why}`,
  calStale: (when: string) => `(日历内容是 ${when} 读到的)`,
  calUnsupported: (rules: string) => `这些重复规则读不懂,只列了第一场:${rules}`,
  calZones: (zones: string) => `这些时区不认识,按本机时区读:${zones}`,
  allDay: '全天',

  forgot: (n: number, what: string) => `已删除 ${what}的活动记录(${n} 天的文件)。`,
  forgotNone: (what: string) => `${what}没有活动记录,什么都没删。`,
  forgetBad: (got: string) => `[cowork_forget 没执行] date 应为 YYYY-MM-DD、today 或 all,收到 ${got}。`,
  forgetAll: '全部',
};

function focusFacts(s: FocusStats): string {
  return `在电脑前 ${s.activeMin} 分钟,离开 ${s.awayMin} 分钟,停在要避开的内容上 ${s.avoidMin} 分钟${s.apps.length ? `;前台:${s.apps.map((a) => `${a.app} ${a.min} 分钟`).join('、')}` : ''}。`;
}

function focusFactsEn(s: FocusStats): string {
  return `At the computer ${s.activeMin} min, away ${s.awayMin} min, on avoided content ${s.avoidMin} min${s.apps.length ? `; foreground: ${s.apps.map((a) => `${a.app} ${a.min} min`).join(', ')}` : ''}.`;
}

const en: typeof zh = {
  dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  app: enApp,
  quote: (s) => `"${s}"`,
  dur: (min) => duration(min, 'en'),

  dayStart: (last, gapMin) => `[cowork] First time today the person is at the computer. ${last ? `Activity was last seen at ${last}${gapMin !== null ? `, ${duration(gapMin, 'en')} ago` : ''}.` : 'This is the first record.'}`,
  yesterday: (date, span, activeMin, apps, focus) => `Previous day on record (${date}): ${span}, ${duration(activeMin, 'en')} at the computer${apps ? `; most used: ${apps}` : ''}${focus ? `; focus sessions: ${focus}` : ''}.`,
  todayCalendar: (lines) => `On today's calendar: ${lines}.`,
  todayCalendarNone: 'Nothing on today\'s calendar.',
  back: (since, min) => `[cowork] The person is back at the computer after ${duration(min, 'en')} away (no input since ${since}).`,
  away: (since, a) => `[cowork] No keyboard or mouse input from the person since ${since}; the foreground was ${enApp(a)}.`,
  stretch: (since, min, awayMin) => `[cowork] The person has been at the computer for ${duration(min, 'en')} straight (since ${since}, no break longer than ${awayMin} min).`,
  drift: (goal, elapsedMin, sec, a, matched) => `[cowork] Focus session "${goal}", minute ${elapsedMin}: the foreground has stayed on ${enApp(a)} for ${Math.round(sec / 60) || 1} min, matching "${matched}", which the session said to avoid.`,
  focusEnded: (goal, plannedMin, s, wasClosed) => `[cowork] Focus session "${goal}" is over (planned ${plannedMin} min). ${focusFactsEn(s)}${wasClosed ? ` The app was not running around ${wasClosed}; only the time it ran is counted.` : ''}`,
  meetingSoon: (inMin, range, summary, location) => `[cowork] Calendar: ${inMin <= 0 ? 'now' : `in ${inMin} min`} (${range}) "${summary || 'untitled'}"${location ? `, at ${location}` : ''}.`,
  sensorDown: (why) => `[cowork] The foreground window and input activity can no longer be read (${why}). Away, back and stretch events are paused; focus sessions end by time only.`,
  sensorUp: '[cowork] The foreground window and input activity can be read again.',
  busyMeeting: (summary, range) => `On the calendar now: "${summary || 'untitled'}" (${range}).`,
  busyFocus: (goal) => `Focus session "${goal}" is running.`,
  calendarFailed: (why) => `[cowork] The calendar could not be read (${why}); calendar reminders are paused until it reads again.`,

  nowLine: (a, idleSec) => `Foreground: ${enApp(a)}; ${idleSec < 60 ? 'input just now' : `no input for ${duration(idleSec / 60, 'en')}`}.`,
  nowAway: (since) => `The person has been away since ${since}.`,
  nowPresent: (since, min) => `At the computer since ${since}, ${duration(min, 'en')} so far.`,
  nowToday: (min) => `${duration(min, 'en')} at the computer today.`,
  nowFocus: (goal, elapsed, left, avoid) => `Focus session "${goal}" running: minute ${elapsed}, ${left} min left${avoid ? `; avoiding: ${avoid}` : ''}.`,
  nowNoFocus: 'No focus session running.',
  nowNext: (lines) => `Coming up: ${lines}`,
  activityOff: 'Activity reading is off ("Read the foreground window and input activity" in the settings).',
  sensorMissing: 'The foreground window and input activity cannot be read on this computer.',

  focusStarted: (goal, until, avoid) => `Focus session "${goal}" started; it ends at ${until}${avoid ? `. You will be told when the foreground stays on ${avoid} longer than the set time` : ''}. An event arrives when it ends.`,
  focusBusy: (goal, until) => `[cowork_focus_start not run] Focus session "${goal}" is already running (until ${until}). End it first.`,
  focusBad: (why) => `[cowork_focus_start not run] ${why}`,
  minutesRange: 'minutes must be from 5 to 240.',
  goalEmpty: 'goal must not be empty.',
  focusStopped: (goal, elapsed, s) => `Focus session "${goal}" stopped early after ${elapsed} min. ${focusFactsEn(s)}`,
  focusNone: '[cowork_focus_stop not run] No focus session is running.',

  dayNone: (date) => `Nothing recorded for ${date}.`,
  dayBad: (got) => `[cowork_day not run] date must be YYYY-MM-DD, today or yesterday; got ${got}.`,
  dayHead: (date, dow, span, min) => `${date} ${dow}: ${span}, ${duration(min, 'en')} at the computer.`,
  dayAways: (lines) => `Away: ${lines}`,
  dayApps: 'Programs (minutes):',
  dayFocus: 'Focus sessions:',
  dayDates: (dates) => `Dates on record: ${dates}`,
  focusLine: (from, to, goal, planned, endedBy, s) => `${from}–${to} "${goal}", planned ${planned} min, ${endedBy === 'time' ? 'ran to time' : 'stopped early'}; ${focusFactsEn(s)}`,

  calNone: (days) => `Nothing on the calendar in the next ${days} day(s).`,
  calNoSource: 'No calendar configured: set an .ics file in the settings, or COWORK_CALENDAR_URL in the deployment .env.',
  calError: (why) => `The last calendar read failed: ${why}`,
  calStale: (when) => `(calendar as read at ${when})`,
  calUnsupported: (rules) => `These repeat rules are not understood; only the first occurrence is listed: ${rules}`,
  calZones: (zones) => `These time zones are unknown and were read as local time: ${zones}`,
  allDay: 'all day',

  forgot: (n, what) => `Deleted the activity records of ${what} (${n} day file(s)).`,
  forgotNone: (what) => `No activity records for ${what}; nothing deleted.`,
  forgetBad: (got) => `[cowork_forget not run] date must be YYYY-MM-DD, today or all; got ${got}.`,
  forgetAll: 'all days',
};

export type ModelText = typeof zh;
export const MODEL_TEXT: Record<'zh' | 'en', ModelText> = { zh, en };
