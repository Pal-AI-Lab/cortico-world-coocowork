/**
 * 把一次次采样折成事实:前台窗口的停留段、离开与回来、连续在电脑前的时长、专注时段的进展。
 * 不读时钟也不碰磁盘:调用方传入采样时刻,取走 `Signal` 与 `LogRecord`,自己决定怎么推事件、怎么落盘。
 *
 * 离开从最后一次键鼠输入算起(采样时刻减空闲时长)。两次采样相隔超过离开判定(电脑睡眠、进程卡住)时,
 * 中间那段按离开算,起点是上一次看到活动的时刻。
 */
import type { Sample } from './probe.ts';

export interface ActivityOptions {
  awayMs: () => number;
  stretchMs: () => number;
  nudgeMs: () => number;
  /** 记录与事件里用的标题;返回空串表示不记录标题。 */
  visibleTitle: (app: string, title: string) => string;
}

/** 按天落盘的记录。时间都是 epoch 毫秒。 */
export type LogRecord =
  | { k: 'seg'; from: number; to: number; app: string; title: string }
  | { k: 'away'; from: number; to: number }
  | { k: 'focus'; from: number; to: number; goal: string; plannedMin: number; endedBy: 'time' | 'stopped'; stats: FocusStats };

export interface FocusStats {
  activeMin: number;
  awayMin: number;
  /** 前台停在要避开的程序或页面上的分钟数。 */
  avoidMin: number;
  /** 前台用得最多的程序,分钟数降序,最多 5 个。 */
  apps: Array<{ app: string; min: number }>;
}

export interface Focus {
  goal: string;
  startedAt: number;
  endsAt: number;
  /** 要避开的程序名或标题关键词,不分大小写。 */
  avoid: string[];
  /** 按程序累计的毫秒数,以及离开、停在避开项上的毫秒数。 */
  appMs: Record<string, number>;
  awayMs: number;
  avoidMs: number;
}

export type Signal =
  | { kind: 'away'; since: number; app: string; title: string }
  /** `lastActive`:离开前最后一次看到活动;`firstToday`:这是本地日期上今天第一次看到活动。 */
  | { kind: 'back'; since: number; at: number; firstToday: boolean }
  | { kind: 'stretch'; since: number; minutes: number }
  | { kind: 'drift'; focus: Focus; since: number; app: string; title: string; matched: string }
  | { kind: 'focus-ended'; focus: Focus; at: number; stats: FocusStats };

/** 重启后接着用的状态。 */
export interface ActivityState {
  lastActiveAt: number | null;
  presentSince: number | null;
  stretchesTold: number;
  focus: Focus | null;
}

export const EMPTY_STATE: ActivityState = { lastActiveAt: null, presentSince: null, stretchesTold: 0, focus: null };

interface Current { app: string; title: string; from: number }

export class Activity {
  private state: ActivityState;
  private lastSampleAt: number | null = null;
  private away: { since: number } | null = null;
  private seg: Current | null = null;
  private drift: { since: number; told: boolean; key: string } | null = null;
  private latest: { app: string; title: string; idleMs: number; at: number } | null = null;

  constructor(
    private readonly opts: ActivityOptions,
    state: ActivityState,
    /** 两个时刻是否在同一个本地日期。 */
    private readonly sameDay: (a: number, b: number) => boolean,
  ) {
    this.state = structuredClone(state);
  }

  snapshot(): ActivityState {
    return structuredClone(this.state);
  }

  /** 最近一次采样;`app`/`title` 已按记录规则处理过。 */
  now(): { app: string; title: string; idleMs: number; at: number; away: boolean; presentSince: number | null } | null {
    return this.latest && { ...this.latest, away: this.away !== null, presentSince: this.away ? null : this.state.presentSince };
  }

  focus(): Focus | null {
    return this.state.focus;
  }

  /** 一次采样。返回这一刻成立的信号与该落盘的记录。 */
  observe(sample: Sample, at: number): { signals: Signal[]; records: LogRecord[] } {
    const signals: Signal[] = [];
    const records: LogRecord[] = [];
    const awayMs = this.opts.awayMs();
    const title = this.opts.visibleTitle(sample.app, sample.title);
    const lastInput = at - sample.idleMs;
    const gap = this.lastSampleAt === null ? 0 : at - this.lastSampleAt;
    this.latest = { app: sample.app, title, idleMs: sample.idleMs, at };

    // 采样之间断了一大截:断开那段算离开
    if (this.lastSampleAt !== null && !this.away && gap > awayMs) {
      const since = this.state.lastActiveAt ?? this.lastSampleAt;
      this.closeSeg(since, records);
      this.away = { since };
    }

    const idle = sample.idleMs >= awayMs;
    if (idle) {
      if (!this.away) {
        const since = Math.max(lastInput, this.lastSampleAt === null ? lastInput : Math.min(lastInput, at));
        if (this.lastSampleAt !== null) {
          const prev = this.seg;
          this.closeSeg(since, records);
          signals.push({ kind: 'away', since, app: prev?.app ?? sample.app, title: prev?.title ?? title });
        }
        this.away = { since };
        this.drift = null;
      }
    } else {
      const firstSample = this.lastSampleAt === null;
      const last = this.state.lastActiveAt;
      if (this.away || firstSample) {
        const since = this.away?.since ?? last;
        const firstToday = last === null || !this.sameDay(last, at);
        const longEnough = since !== null && at - since >= awayMs;
        if (this.away && this.lastSampleAt !== null) records.push({ k: 'away', from: this.away.since, to: lastInput });
        if (firstToday || longEnough) {
          signals.push({ kind: 'back', since: since ?? at, at, firstToday });
          this.state.presentSince = lastInput;
          this.state.stretchesTold = 0;
        } else if (this.state.presentSince === null) {
          this.state.presentSince = lastInput;
        }
        this.away = null;
      }
      this.state.lastActiveAt = Math.max(lastInput, this.state.lastActiveAt ?? 0);
      this.trackSeg(sample.app, title, at, records);
      const stretch = this.opts.stretchMs();
      if (stretch > 0 && this.state.presentSince !== null) {
        const n = Math.floor((at - this.state.presentSince) / stretch);
        if (n > this.state.stretchesTold) {
          this.state.stretchesTold = n;
          signals.push({ kind: 'stretch', since: this.state.presentSince, minutes: Math.round((at - this.state.presentSince) / 60_000) });
        }
      }
    }

    this.trackFocus(sample, title, at, gap, idle, signals, records);
    this.lastSampleAt = at;
    return { signals, records };
  }

  /** 还开着的停留段,到 `at` 为止;不关闭它。 */
  openSegment(at: number): LogRecord | null {
    return this.seg && !this.away && at > this.seg.from ? { k: 'seg', from: this.seg.from, to: at, app: this.seg.app, title: this.seg.title } : null;
  }

  /** 关闭当前停留段(退出或停止时)。 */
  flush(at: number): LogRecord[] {
    const records: LogRecord[] = [];
    if (!this.away) this.closeSeg(at, records);
    return records;
  }

  /** 没有采样可用时(读不到活动、或活动读取关着)按时间结束专注时段;不到时间返回 null。 */
  expireFocus(at: number): { signal: Signal; record: LogRecord } | null {
    const focus = this.state.focus;
    if (!focus || at < focus.endsAt) return null;
    this.state.focus = null;
    this.drift = null;
    const stats = focusStats(focus);
    return {
      signal: { kind: 'focus-ended', focus, at: focus.endsAt, stats },
      record: { k: 'focus', from: focus.startedAt, to: focus.endsAt, goal: focus.goal, plannedMin: Math.round((focus.endsAt - focus.startedAt) / 60_000), endedBy: 'time', stats },
    };
  }

  startFocus(goal: string, minutes: number, avoid: string[], at: number): Focus {
    this.state.focus = { goal, startedAt: at, endsAt: at + minutes * 60_000, avoid, appMs: {}, awayMs: 0, avoidMs: 0 };
    this.drift = null;
    return this.state.focus;
  }

  /** 提前结束;没有进行中的专注时段时返回 null。 */
  stopFocus(at: number): { focus: Focus; stats: FocusStats; record: LogRecord } | null {
    const focus = this.state.focus;
    if (!focus) return null;
    this.state.focus = null;
    this.drift = null;
    const stats = focusStats(focus);
    return { focus, stats, record: { k: 'focus', from: focus.startedAt, to: at, goal: focus.goal, plannedMin: Math.round((focus.endsAt - focus.startedAt) / 60_000), endedBy: 'stopped', stats } };
  }

  private trackSeg(app: string, title: string, at: number, records: LogRecord[]): void {
    if (this.seg && this.seg.app === app && this.seg.title === title) return;
    this.closeSeg(at, records);
    this.seg = { app, title, from: at };
  }

  private closeSeg(at: number, records: LogRecord[]): void {
    if (this.seg && at > this.seg.from) records.push({ k: 'seg', from: this.seg.from, to: at, app: this.seg.app, title: this.seg.title });
    this.seg = null;
  }

  private trackFocus(sample: Sample, title: string, at: number, gap: number, idle: boolean, signals: Signal[], records: LogRecord[]): void {
    const focus = this.state.focus;
    if (!focus) return;
    if (this.lastSampleAt !== null && gap > 0) {
      const from = Math.max(this.lastSampleAt, focus.startedAt);
      const span = Math.max(0, Math.min(at, focus.endsAt) - from);
      if (idle || this.away || gap > this.opts.awayMs()) focus.awayMs += span;
      else {
        focus.appMs[sample.app || '?'] = (focus.appMs[sample.app || '?'] ?? 0) + span;
        if (this.drift) focus.avoidMs += span;
      }
    }
    if (at >= focus.endsAt) {
      this.state.focus = null;
      this.drift = null;
      const stats = focusStats(focus);
      signals.push({ kind: 'focus-ended', focus, at: focus.endsAt, stats });
      records.push({ k: 'focus', from: focus.startedAt, to: focus.endsAt, goal: focus.goal, plannedMin: Math.round((focus.endsAt - focus.startedAt) / 60_000), endedBy: 'time', stats });
      return;
    }
    const matched = idle ? null : matchAvoid(focus.avoid, sample.app, title);
    if (!matched) { this.drift = null; return; }
    const key = `${sample.app}\n${matched}`;
    if (!this.drift || this.drift.key !== key) this.drift = { since: at, told: false, key };
    if (!this.drift.told && at - this.drift.since >= this.opts.nudgeMs()) {
      this.drift.told = true;
      signals.push({ kind: 'drift', focus, since: this.drift.since, app: sample.app, title, matched });
    }
  }
}

/** 第一个出现在程序名或标题里的避开项(不分大小写)。 */
export function matchAvoid(avoid: readonly string[], app: string, title: string): string | null {
  const hay = `${app}\n${title}`.toLowerCase();
  return avoid.find((a) => a.trim() && hay.includes(a.trim().toLowerCase())) ?? null;
}

export function focusStats(f: Focus): FocusStats {
  const min = (ms: number) => Math.round(ms / 60_000);
  const activeMs = Object.values(f.appMs).reduce((a, b) => a + b, 0);
  return {
    activeMin: min(activeMs),
    awayMin: min(f.awayMs),
    avoidMin: min(f.avoidMs),
    apps: Object.entries(f.appMs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([app, ms]) => ({ app, min: min(ms) })).filter((x) => x.min > 0),
  };
}

const PRIVATE_TITLE = /InPrivate|Incognito|Private Browsing|隐身|無痕|无痕|隐私浏览|私密浏览/i;

/** 按配置给出可记录的标题:关了标题、隐私程序、无痕窗口都返回空串。 */
export function visibleTitle(app: string, title: string, recordTitles: boolean, privateApps: string): string {
  if (!recordTitles || PRIVATE_TITLE.test(title)) return '';
  const lower = app.toLowerCase();
  if (privateApps.split(',').some((p) => p.trim() && p.trim().toLowerCase() === lower)) return '';
  return title.trim().slice(0, 200);
}
