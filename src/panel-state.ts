/** 「常用设置」面板与 World 之间的数据形状;浏览器端只 `import type`。 */

export const SETUP_PANEL = 'setup';

export interface CalendarItem {
  /** `MM-DD 周X HH:MM–HH:MM` 或 `MM-DD 周X 全天`,按面板语言写好。 */
  when: string;
  summary: string;
}

export interface PanelState {
  activity: {
    enabled: boolean;
    /** 这台电脑上能读前台窗口与键鼠活动。 */
    available: boolean;
    /** 最近一次读取失败的原因。 */
    error: string | null;
    todayMin: number;
    /** 今天用过、还不在「不记录标题」名单里的程序,按分钟数降序。 */
    seenApps: string[];
  };
  focus: { goal: string; leftMin: number } | null;
  calendar: {
    /** 已保存的订阅地址,只露主机名和末尾几位。 */
    url: string | null;
    file: string;
    error: string | null;
    /** 上次读取的时刻,`MM-DD HH:MM`。 */
    readAt: string | null;
    /** 接下来 7 天的日程。 */
    upcoming: CalendarItem[];
    /** 读不懂的重复规则、不认识的时区,原样一句。 */
    notes: string[];
  };
  settings: {
    proactivity: 'low' | 'normal';
    quietFrom: string;
    quietTo: string;
    stretchMinutes: number;
    backWakeMinutes: number;
    remindMinutes: number;
    titles: boolean;
    privateApps: string[];
    keepDays: number;
  };
  records: { days: number; kb: number };
}

/** 测试一个订阅地址的结果:读到几项、接下来几项;失败时是原因。 */
export type CalendarProbe = { ok: true; count: number; upcoming: CalendarItem[] } | { ok: false; error: string };
