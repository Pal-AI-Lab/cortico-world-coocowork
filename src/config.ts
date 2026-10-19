import type { ConfigGroup } from 'cortico/core/types.ts';
import { pick, type Language } from 'cortico/core/language.ts';

export const COWORK_ID = 'cowork';

/** 订阅日历的私密地址(Google 的「iCal 格式的私密地址」、Outlook 的发布链接)放部署 `.env`。 */
export const CALENDAR_URL_SECRET = 'COWORK_CALENDAR_URL';

export type PromptLanguage = 'zh' | 'en';
/** 主动程度。`low`:回来、连续在电脑前只随下一批事件送达,不单独叫醒 Coo;环境提示词也按档位写。 */
export type Proactivity = 'low' | 'normal';

/** config.json 的 `worlds.cowork` 段。 */
export interface CoworkConfigSection {
  enabled: boolean;
  /** 环境提示词与事件正文的语言。 */
  promptLanguage: PromptLanguage;
  proactivity: Proactivity;
  activity: {
    /** 读前台窗口与键鼠空闲时长;关着时没有离开、回来、连续在电脑前这些事件,`cowork_day` 只有专注时段。 */
    enabled: boolean;
    /** 采样间隔。 */
    sampleSec: number;
    /** 键鼠静止这么久算离开。 */
    awayMinutes: number;
    /** 离开这么久以上,回来时叫醒 Coo;更短的随下一批事件送达。 */
    backWakeMinutes: number;
    /** 连续在电脑前每满这么久推一条事件;0 不推。 */
    stretchMinutes: number;
    /** 记录窗口标题;关着时只记程序名。 */
    titles: boolean;
    /** 这些程序(可执行文件名,逗号分隔,不分大小写)的窗口标题不记录。 */
    privateApps: string;
    /** 按天的活动记录保留天数。 */
    keepDays: number;
  };
  focus: {
    /** 专注时段里,前台停在要避开的程序或页面上这么久,叫醒 Coo。 */
    nudgeSec: number;
  };
  calendar: {
    /** 本机 .ics 文件;订阅地址见 `COWORK_CALENDAR_URL`。 */
    file: string;
    /** 日程开始前多少分钟叫醒 Coo;0 不提醒。 */
    remindMinutes: number;
    /** 重新读取日历的间隔。 */
    refreshMinutes: number;
  };
  /** 安静时段(HH:MM,本地时间,可跨午夜);这段时间里本会叫醒 Coo 的事件改为随下一批送达,日程提醒除外。两项都空时不设。 */
  quietHours: { from: string; to: string };
}

export const COWORK_DEFAULTS: CoworkConfigSection = {
  enabled: false,
  promptLanguage: 'zh',
  proactivity: 'normal',
  activity: {
    enabled: true,
    sampleSec: 5,
    awayMinutes: 5,
    backWakeMinutes: 20,
    stretchMinutes: 90,
    titles: true,
    privateApps: '1Password.exe, KeePass.exe, KeePassXC.exe, Bitwarden.exe, WeChat.exe, Weixin.exe, QQ.exe, Telegram.exe, WhatsApp.exe, Signal.exe',
    keepDays: 14,
  },
  focus: { nudgeSec: 120 },
  calendar: { file: '', remindMinutes: 10, refreshMinutes: 30 },
  quietHours: { from: '', to: '' },
};

const K = `worlds.${COWORK_ID}`;
export const PROMPT_LANGUAGE_OPTIONS = `${COWORK_ID}:prompt-language`;
export const PROACTIVITY_OPTIONS = `${COWORK_ID}:proactivity`;

const TEXT = {
  zh: {
    title: 'CooCowork',
    promptLanguage: '提示词语言',
    proactivity: { title: '主动程度', description: '少打扰:只有日程、专注时段和每天第一次回到电脑前会马上告诉 Coo。', low: '少打扰', normal: '正常' },
    activity: '读取前台窗口与键鼠活动',
    sampleSec: '采样间隔',
    awayMinutes: { title: '离开判定', description: '键盘鼠标静止这么久算离开电脑。' },
    backWakeMinutes: { title: '回来时叫醒 Coo', description: '离开超过这么久,回来时 Coo 马上知道;更短的离开随下一批事件告诉 Coo。' },
    stretchMinutes: { title: '连续在电脑前', description: '每连续这么久告诉 Coo 一次;0 为不告诉。' },
    titles: { title: '记录窗口标题', description: '关闭后只记录程序名。' },
    privateApps: { title: '不记录标题的程序', description: '可执行文件名,逗号分隔。无痕/隐私窗口的标题始终不记录。' },
    keepDays: { title: '活动记录保留天数' },
    nudgeSec: { title: '专注时走神提醒', description: '专注时段里前台停在说好要避开的程序或页面上这么久,告诉 Coo。' },
    file: { title: '日历文件(.ics)', description: '订阅地址填在部署 .env 的 COWORK_CALENDAR_URL。' },
    remindMinutes: { title: '日程提前提醒', description: '0 为不提醒。' },
    refreshMinutes: { title: '日历刷新间隔' },
    quietFrom: { title: '安静时段开始', description: 'HH:MM。安静时段里只有日程提醒会马上告诉 Coo。' },
    quietTo: { title: '安静时段结束', description: 'HH:MM。' },
    sec: '秒', min: '分钟', day: '天',
  },
  en: {
    title: 'CooCowork',
    promptLanguage: 'Prompt language',
    proactivity: { title: 'Proactivity', description: 'Low: only calendar events, focus sessions and the first return of the day reach Coo at once.', low: 'Low', normal: 'Normal' },
    activity: 'Read the foreground window and input activity',
    sampleSec: 'Sampling interval',
    awayMinutes: { title: 'Away after', description: 'No keyboard or mouse input for this long counts as away.' },
    backWakeMinutes: { title: 'Wake Coo on return after', description: 'Returning from a longer absence tells Coo at once; shorter ones arrive with the next batch of events.' },
    stretchMinutes: { title: 'Continuous stretch', description: 'Tells Coo each time the person has been at the computer this long without a break; 0 for never.' },
    titles: { title: 'Record window titles', description: 'Off records program names only.' },
    privateApps: { title: 'Programs whose titles are not recorded', description: 'Executable names, comma-separated. Private and incognito window titles are never recorded.' },
    keepDays: { title: 'Days of activity to keep' },
    nudgeSec: { title: 'Drift during focus', description: 'Tells Coo when the foreground stays this long on a program or page the person said to avoid.' },
    file: { title: 'Calendar file (.ics)', description: 'A subscription address goes in COWORK_CALENDAR_URL in the deployment .env.' },
    remindMinutes: { title: 'Remind before events', description: '0 for no reminder.' },
    refreshMinutes: { title: 'Calendar refresh interval' },
    quietFrom: { title: 'Quiet hours from', description: 'HH:MM. During quiet hours only calendar reminders reach Coo at once.' },
    quietTo: { title: 'Quiet hours to', description: 'HH:MM.' },
    sec: 's', min: 'min', day: 'days',
  },
};

export const promptLanguageOptions = (): Array<{ value: string; label: string }> =>
  [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }];

export function proactivityOptions(language: Language): Array<{ value: string; label: string }> {
  const t = pick(language, TEXT).proactivity;
  return [{ value: 'low', label: t.low }, { value: 'normal', label: t.normal }];
}

export function configGroups(language: Language): ConfigGroup[] {
  const t = pick(language, TEXT);
  const minutes = (title: { title: string; description?: string }, min: number, max: number) =>
    ({ type: 'integer' as const, ...title, minimum: min, maximum: max, 'x-suffix': t.min, 'x-hot': true });
  return [{
    id: `world:${COWORK_ID}`,
    owner: `world:${COWORK_ID}`,
    schema: {
      type: 'object',
      title: t.title,
      properties: {
        [`${K}.promptLanguage`]: { type: 'string', title: t.promptLanguage, 'x-options': PROMPT_LANGUAGE_OPTIONS, 'x-hot': true },
        [`${K}.proactivity`]: { type: 'string', title: t.proactivity.title, description: t.proactivity.description, 'x-options': PROACTIVITY_OPTIONS, 'x-hot': true },
        [`${K}.activity.enabled`]: { type: 'boolean', title: t.activity, 'x-hot': true },
        [`${K}.activity.sampleSec`]: { type: 'integer', title: t.sampleSec, minimum: 1, maximum: 60, 'x-suffix': t.sec, 'x-hot': true },
        [`${K}.activity.awayMinutes`]: minutes(t.awayMinutes, 1, 60),
        [`${K}.activity.backWakeMinutes`]: minutes(t.backWakeMinutes, 1, 600),
        [`${K}.activity.stretchMinutes`]: minutes(t.stretchMinutes, 0, 600),
        [`${K}.activity.titles`]: { type: 'boolean', ...t.titles, 'x-hot': true },
        [`${K}.activity.privateApps`]: { type: 'string', ...t.privateApps, 'x-hot': true },
        [`${K}.activity.keepDays`]: { type: 'integer', ...t.keepDays, minimum: 1, maximum: 365, 'x-suffix': t.day, 'x-hot': true },
        [`${K}.focus.nudgeSec`]: { type: 'integer', ...t.nudgeSec, minimum: 10, maximum: 3600, 'x-suffix': t.sec, 'x-hot': true },
        [`${K}.calendar.file`]: { type: 'string', ...t.file, 'x-path': { kind: 'file', extensions: ['ics'] }, 'x-hot': true },
        [`${K}.calendar.remindMinutes`]: minutes(t.remindMinutes, 0, 240),
        [`${K}.calendar.refreshMinutes`]: minutes(t.refreshMinutes, 5, 1440),
        [`${K}.quietHours.from`]: { type: 'string', ...t.quietFrom, 'x-hot': true },
        [`${K}.quietHours.to`]: { type: 'string', ...t.quietTo, 'x-hot': true },
      },
    },
  }];
}
