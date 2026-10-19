import { join } from 'node:path';
import { describeTools, type WorldDefinition } from 'cortico/world.ts';
import { CALENDAR_URL_SECRET, COWORK_DEFAULTS, COWORK_ID, PROACTIVITY_OPTIONS, PROMPT_LANGUAGE_OPTIONS, proactivityOptions, promptLanguageOptions, type CoworkConfigSection } from './config.ts';
import { COWORK_TOOL_DECLS } from './tools.ts';
import { CoworkWorld } from './world.ts';

export const COWORK: WorldDefinition<CoworkConfigSection> = {
  id: COWORK_ID,
  label: 'CooCowork',
  defaults: () => structuredClone(COWORK_DEFAULTS),
  configOptions(kind, language) {
    if (kind === PROMPT_LANGUAGE_OPTIONS) return promptLanguageOptions();
    if (kind === PROACTIVITY_OPTIONS) return proactivityOptions(language);
    return [];
  },
  // ctx.cfg 是 `worlds.cowork` 的活引用:热改的键现读即生效
  create: (ctx) => new CoworkWorld({
    cfg: ctx.cfg,
    timezone: ctx.timezone,
    // ctx.dataDir 是整个部署共用的数据目录
    dataDir: join(ctx.dataDir, COWORK_ID),
    calendarUrl: () => ctx.secret(CALENDAR_URL_SECRET),
    storeCalendarUrl: (url) => ctx.storeSecret(CALENDAR_URL_SECRET, url),
  }),
  describe: {
    tools: describeTools(COWORK_TOOL_DECLS, {
      cowork_now: { zh: '此刻的前台程序与标题、多久没操作、在电脑前多久、进行中的专注时段、接下来的日程。', en: 'The foreground program and title, time since input, time at the computer, the running focus session and the next calendar events.' },
      cowork_focus_start: { zh: '和使用者开一个专注时段:目标、时长、要避开的程序或页面。', en: 'Starts a focus session: goal, length, programs or pages to avoid.' },
      cowork_focus_stop: { zh: '提前结束专注时段,回执带这段时间的统计。', en: 'Ends the focus session early; the receipt has its statistics.' },
      cowork_day: { zh: '某一天的记录:首末时刻、在电脑前多久、离开、常用程序与标题、专注时段。', en: 'One day\'s record: first and last activity, time at the computer, breaks, programs and titles, focus sessions.' },
      cowork_calendar: { zh: '列出日历里接下来几天的日程。', en: 'Lists calendar events for the next few days.' },
      cowork_forget: { zh: '永久删除某天或全部活动记录。', en: 'Deletes one day\'s or all activity records for good.' },
    }),
    events: [
      { type: 'cowork.day-start', description: { zh: '今天第一次看到使用者在电脑前,带前一天的概要与今天的日程;叫醒 Coo(安静时段里除外)。', en: 'The person is at the computer for the first time today, with the previous day\'s summary and today\'s calendar; wakes Coo outside quiet hours.' }, trigger: 'flush' },
      { type: 'cowork.back', description: { zh: '使用者离开后回来;离开够久才叫醒 Coo。', en: 'The person is back after being away; wakes Coo after a long enough absence.' }, trigger: 'flush' },
      { type: 'cowork.away', description: { zh: '使用者离开电脑;随下一批事件送达。', en: 'The person stepped away; delivered with the next batch.' }, trigger: 'piggyback' },
      { type: 'cowork.stretch', description: { zh: '使用者连续在电脑前满一段时长。', en: 'The person has been at the computer for a set stretch without a break.' }, trigger: 'flush' },
      { type: 'cowork.drift', description: { zh: '专注时段里前台停在说好要避开的内容上。', en: 'During a focus session the foreground stays on something the person said to avoid.' }, trigger: 'flush' },
      { type: 'cowork.focus-ended', description: { zh: '专注时段到时间,带这段时间的统计。', en: 'A focus session reached its time, with its statistics.' }, trigger: 'flush' },
      { type: 'cowork.meeting', description: { zh: '日历上的日程快开始了。', en: 'A calendar event is about to start.' }, trigger: 'flush' },
      { type: 'cowork.sensor', description: { zh: '读不到或又能读到前台窗口与键鼠活动。', en: 'The foreground window and input activity became unreadable or readable again.' }, trigger: 'piggyback' },
      { type: 'cowork.calendar', description: { zh: '日历读取失败。', en: 'The calendar could not be read.' }, trigger: 'piggyback' },
    ],
  },
};
