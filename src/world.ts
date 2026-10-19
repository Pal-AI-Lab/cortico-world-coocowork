/**
 * CooCowork World:把使用者在电脑前的活动、专注时段和日历折成事件和工具,Coo 据此决定什么时候开口。
 *
 * 每个采样间隔读一次前台窗口和键鼠空闲时长(probe.ts),交给 `Activity` 折成离开、回来、连续在电脑前、
 * 专注时段的信号,停留段按天写进 `<dataDir>/days/`。同一拍里检查日程提醒,日历按刷新间隔重读。
 *
 * 叫醒 Coo(flush)的只有:每天第一次回到电脑前、离开够久后回来、连续在电脑前满一段、专注时段里停在
 * 要避开的内容上、专注时段结束、日程快开始;离开和状态变化随下一批事件送达(piggyback)。安静时段与
 * 「少打扰」档把前四种也改成随下一批送达。日程提醒与专注时段结束不受这两项影响。
 *
 * 窗口标题与日历文字是外部内容,事件按 external 推送;只有读取器本身的状态变化是 internal。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Language } from 'cortico/core/language.ts';
import type { Logger, ToolDef, World, WorldHost, WorldWebUiDecl } from 'cortico/core/types.ts';
import { nowIso } from 'cortico/core/util.ts';
import { Activity, EMPTY_STATE, visibleTitle, type FocusStats, type LogRecord, type Signal } from './activity.ts';
import { parseIcs, occurrences, type Occurrence, type Parsed } from './calendar.ts';
import { dateKey, hm, inQuietHours, localParts, localToEpoch, mdhm, startOfDay } from './clock.ts';
import { configGroups, COWORK_ID, type CoworkConfigSection } from './config.ts';
import { DayLog, summarize } from './daylog.ts';
import { MODEL_TEXT, type ModelText } from './model-text.ts';
import { createProbe, type Probe } from './probe.ts';
import { COWORK_TOOL_DECLS } from './tools.ts';

const ENV_PROMPT_FILES = {
  zh: fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url)),
  en: fileURLToPath(new URL('./ENV_PROMPT.en.md', import.meta.url)),
};

const MIN = 60_000;
const DAY = 86_400_000;
/** 状态文件最多隔这么久写一次。 */
const SAVE_EVERY_MS = 60_000;
/** 拉日历订阅地址的期限。 */
const FETCH_TIMEOUT_MS = 20_000;
/** 一次 `cowork_calendar` 或今日日程最多列几条。 */
const CALENDAR_LINES_MAX = 30;

export interface CoworkWorldOptions {
  cfg: CoworkConfigSection;
  timezone: string;
  dataDir: string;
  /** 订阅日历的地址;空串为没有。 */
  calendarUrl: () => string;
  probe?: () => Promise<Probe | null>;
  now?: () => number;
  fetchText?: (url: string) => Promise<string>;
  /** 两拍之间的真实毫秒数;缺省按 `activity.sampleSec`。 */
  tickMs?: () => number;
}

interface CalendarState {
  parsed: Parsed | null;
  readAt: number | null;
  error: string | null;
  /** 已经提醒过的场次:`uid@start`。 */
  told: Set<string>;
}

export class CoworkWorld implements World {
  readonly id = COWORK_ID;
  private host: WorldHost | null = null;
  private log: Logger | null = null;
  private days!: DayLog;
  private activity!: Activity;
  private probe: Probe | null = null;
  private sensorOk: boolean | null = null;
  private timer: NodeJS.Timeout | null = null;
  private startedAt = 0;
  private savedAt = 0;
  private stopped = false;
  private calendarLoading: Promise<void> | null = null;
  private readonly calendar: CalendarState = { parsed: null, readAt: null, error: null, told: new Set() };
  private readonly clock: () => number;

  constructor(private readonly opts: CoworkWorldOptions) {
    this.clock = opts.now ?? Date.now;
  }

  private get cfg(): CoworkConfigSection {
    return this.opts.cfg;
  }

  private get t(): ModelText {
    return MODEL_TEXT[this.cfg.promptLanguage] ?? MODEL_TEXT.zh;
  }

  private get tz(): string {
    return this.opts.timezone;
  }

  // ---------------------------------------------------------------- 生命周期

  async start(host: WorldHost): Promise<void> {
    this.host = host;
    this.log = host.log;
    this.stopped = false;
    this.startedAt = this.clock();
    this.days = new DayLog(join(this.opts.dataDir, 'days'), this.tz);
    this.days.prune(this.cfg.activity.keepDays, this.startedAt);
    this.activity = new Activity({
      awayMs: () => this.cfg.activity.awayMinutes * MIN,
      stretchMs: () => this.cfg.activity.stretchMinutes * MIN,
      nudgeMs: () => this.cfg.focus.nudgeSec * 1000,
      visibleTitle: (app, title) => visibleTitle(app, title, this.cfg.activity.titles, this.cfg.activity.privateApps),
    }, this.days.loadState() ?? EMPTY_STATE, (a, b) => dateKey(this.tz, a) === dateKey(this.tz, b));
    this.loadTold();
    this.probe = await (this.opts.probe ?? createProbe)();
    await this.refreshCalendar();
    await this.tick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.days) return;
    this.days.append(this.activity.flush(this.clock()));
    this.days.saveState(this.activity.snapshot());
  }

  private schedule(): void {
    if (this.stopped) return;
    const ms = this.opts.tickMs?.() ?? Math.max(1, this.cfg.activity.sampleSec) * 1000;
    this.timer = setTimeout(() => { void this.tick(); }, ms);
  }

  /** 一拍:采样、日程提醒、按需重读日历、存状态,再排下一拍。 */
  async tick(): Promise<void> {
    if (this.stopped) return;
    try {
      const now = this.clock();
      const signals: Signal[] = [];
      const records: LogRecord[] = [];
      const sample = this.cfg.activity.enabled && this.probe ? this.readSample() : null;
      if (sample) {
        const out = this.activity.observe(sample, now);
        signals.push(...out.signals);
        records.push(...out.records);
      } else {
        const out = this.activity.expireFocus(now);
        if (out) { signals.push(out.signal); records.push(out.record); }
      }
      this.days.append(records);
      for (const s of signals) await this.announce(s, now);
      await this.remind(now);
      if (this.calendar.readAt === null || now - this.calendar.readAt >= this.cfg.calendar.refreshMinutes * MIN) void this.refreshCalendar();
      if (now - this.savedAt >= SAVE_EVERY_MS || signals.length) {
        this.days.saveState(this.activity.snapshot());
        this.savedAt = now;
      }
    } catch (err) {
      this.log?.warn('cowork 一拍出错', { err: String(err) });
    }
    this.schedule();
  }

  private readSample() {
    try {
      const s = this.probe!.sample();
      if (this.sensorOk === false) void this.push('sensor', this.t.sensorUp, false, this.clock(), 'internal');
      this.sensorOk = true;
      return s;
    } catch (err) {
      if (this.sensorOk !== false) void this.push('sensor', this.t.sensorDown(String((err as Error)?.message ?? err)), false, this.clock(), 'internal');
      this.sensorOk = false;
      return null;
    }
  }

  // ---------------------------------------------------------------- 事件

  private async push(noun: string, text: string, wake: boolean, at: number, origin: 'internal' | 'external' = 'external'): Promise<void> {
    if (!this.host || this.stopped) return;
    try {
      await this.host.pushEvent(
        { type: `${COWORK_ID}.${noun}`, source: COWORK_ID, senderKey: COWORK_ID, ts: nowIso(this.tz, new Date(at)), text, origin },
        { trigger: wake ? 'flush' : 'piggyback' },
      );
    } catch (err) {
      this.log?.warn('cowork 事件推送失败', { noun, err: String(err) });
    }
  }

  private stamp(at: number, withDate = false): string {
    if (!withDate) return `[${hm(this.tz, at)}] `;
    const p = localParts(this.tz, at);
    return `[${mdhm(this.tz, at).slice(0, 5)} ${this.t.dow[p.dow]} ${hm(this.tz, at)}] `;
  }

  private quiet(at: number): boolean {
    return inQuietHours(this.tz, at, this.cfg.quietHours.from, this.cfg.quietHours.to);
  }

  private async announce(s: Signal, now: number): Promise<void> {
    const t = this.t;
    const normal = this.cfg.proactivity !== 'low';
    const quiet = this.quiet(now);
    switch (s.kind) {
      case 'back': {
        const gapMin = Math.round((s.at - s.since) / MIN);
        if (s.firstToday) {
          const seen = s.since < s.at;
          const lines = [t.dayStart(seen ? mdhm(this.tz, s.since) : null, seen ? gapMin : null)];
          const prev = this.previousDay(dateKey(this.tz, now));
          if (prev) lines.push(prev);
          lines.push(this.todayCalendarLine(now));
          await this.push('day-start', this.stamp(now, true) + lines.join('\n'), !quiet, now);
        } else {
          await this.push('back', this.stamp(now) + t.back(hm(this.tz, s.since), gapMin), normal && !quiet && gapMin >= this.cfg.activity.backWakeMinutes, now);
        }
        return;
      }
      case 'away':
        await this.push('away', this.stamp(s.since) + t.away(hm(this.tz, s.since), { app: s.app, title: s.title }), false, now);
        return;
      case 'stretch':
        await this.push('stretch', this.stamp(now) + t.stretch(hm(this.tz, s.since), s.minutes, this.cfg.activity.awayMinutes), normal && !quiet, now);
        return;
      case 'drift':
        await this.push('drift', this.stamp(now) + t.drift(s.focus.goal, Math.round((now - s.focus.startedAt) / MIN), (now - s.since) / 1000, { app: s.app, title: s.title }, s.matched), !quiet, now);
        return;
      case 'focus-ended': {
        const planned = Math.round((s.focus.endsAt - s.focus.startedAt) / MIN);
        const closed = s.focus.endsAt < this.startedAt ? mdhm(this.tz, s.focus.endsAt) : null;
        await this.push('focus-ended', this.stamp(now) + t.focusEnded(s.focus.goal, planned, s.stats, closed), true, now);
        return;
      }
    }
  }

  /** 最近一个有记录、早于今天的日子的概要;没有则 null。 */
  private previousDay(today: string): string | null {
    const date = this.days.dates().filter((d) => d < today).pop();
    if (!date) return null;
    const sum = summarize(date, this.days.read(date), this.cfg.activity.awayMinutes * MIN);
    if (sum.firstAt === null && !sum.focus.length) return null;
    const span = sum.firstAt === null ? '' : `${hm(this.tz, sum.firstAt)}–${hm(this.tz, sum.lastAt!)}`;
    const apps = sum.apps.slice(0, 3).map((a) => `${a.app} ${this.t.dur(a.min)}`).join(this.cfg.promptLanguage === 'zh' ? '、' : ', ');
    const focus = sum.focus.map((f) => `${this.t.quote(f.goal)} ${f.stats.activeMin}/${f.plannedMin}`).join(' ');
    return this.t.yesterday(date, span, sum.activeMin, apps, focus);
  }

  // ---------------------------------------------------------------- 日历

  private async refreshCalendar(): Promise<void> {
    if (this.calendarLoading) return this.calendarLoading;
    this.calendarLoading = (async () => {
      const file = this.cfg.calendar.file.trim();
      const url = this.opts.calendarUrl().trim().replace(/^webcal:\/\//i, 'https://');
      if (!file && !url) { this.calendar.parsed = null; this.calendar.error = null; this.calendar.readAt = this.clock(); return; }
      const texts: string[] = [];
      const errors: string[] = [];
      if (file) {
        try { texts.push(readFileSync(file, 'utf8')); } catch (err) { errors.push(`${file}: ${(err as NodeJS.ErrnoException).code ?? String(err)}`); }
      }
      if (url) {
        try { texts.push(await (this.opts.fetchText ?? fetchText)(url)); } catch (err) { errors.push(`subscription: ${String((err as Error)?.message ?? err)}`); }
      }
      const merged: Parsed = { events: [], unsupported: [], unknownZones: [] };
      for (const text of texts) merged.events.push(...parseIcs(text).events);
      if (texts.length) this.calendar.parsed = merged;
      const error = errors.length ? errors.join('; ') : null;
      if (error && error !== this.calendar.error) await this.push('calendar', this.stamp(this.clock()) + this.t.calendarFailed(error), false, this.clock(), 'internal');
      this.calendar.error = error;
      this.calendar.readAt = this.clock();
    })().finally(() => { this.calendarLoading = null; });
    return this.calendarLoading;
  }

  private upcoming(from: number, to: number): ReturnType<typeof occurrences> | null {
    return this.calendar.parsed ? occurrences(this.calendar.parsed, this.tz, from, to) : null;
  }

  private async remind(now: number): Promise<void> {
    const ahead = this.cfg.calendar.remindMinutes * MIN;
    if (!ahead) return;
    const got = this.upcoming(now - MIN, now + ahead + MIN);
    if (!got) return;
    for (const o of got.list) {
      if (o.allDay || o.start > now + ahead || o.start < now - MIN) continue;
      const key = `${o.uid}@${o.start}`;
      if (this.calendar.told.has(key)) continue;
      this.calendar.told.add(key);
      this.saveTold(now);
      await this.push('meeting', this.stamp(now) + this.t.meetingSoon(Math.round((o.start - now) / MIN), this.range(o), o.summary, o.location), true, now);
    }
  }

  private range(o: Occurrence): string {
    return o.allDay ? this.t.allDay : `${hm(this.tz, o.start)}–${hm(this.tz, o.end)}`;
  }

  private todayCalendarLine(now: number): string {
    const from = startOfDay(this.tz, now);
    const got = this.upcoming(from, from + DAY);
    if (!got) return '';
    if (!got.list.length) return this.t.todayCalendarNone;
    return this.t.todayCalendar(got.list.slice(0, 8).map((o) => `${this.range(o)} ${o.summary}`).join(';'));
  }

  private toldFile(): string {
    return join(this.opts.dataDir, 'reminded.json');
  }

  private loadTold(): void {
    try {
      if (existsSync(this.toldFile())) for (const k of JSON.parse(readFileSync(this.toldFile(), 'utf8')) as string[]) this.calendar.told.add(k);
    } catch { /* 文件坏了就当没提醒过 */ }
  }

  private saveTold(now: number): void {
    for (const k of this.calendar.told) if (+k.slice(k.lastIndexOf('@') + 1) < now - DAY) this.calendar.told.delete(k);
    writeFileSync(this.toldFile(), JSON.stringify([...this.calendar.told]), 'utf8');
  }

  // ---------------------------------------------------------------- 提示词与工具

  envPromptVars(): Record<string, string> {
    const zh = this.cfg.promptLanguage === 'zh';
    const reading = !this.cfg.activity.enabled ? (zh ? '关着' : 'off') : this.probe ? (zh ? '开着' : 'on') : (zh ? '这台电脑上读不到' : 'unavailable on this computer');
    const calendar = this.cfg.calendar.file.trim() || this.opts.calendarUrl().trim() ? (zh ? '已连接' : 'connected') : (zh ? '没有连接' : 'not connected');
    const quiet = this.cfg.quietHours.from && this.cfg.quietHours.to ? `${this.cfg.quietHours.from}–${this.cfg.quietHours.to}` : (zh ? '没有设' : 'none');
    return {
      'cowork.activity': reading,
      'cowork.calendar': calendar,
      'cowork.quiet': quiet,
      'cowork.proactivity': this.cfg.proactivity === 'low' ? (zh ? '少打扰' : 'low') : (zh ? '正常' : 'normal'),
      'cowork.away': String(this.cfg.activity.awayMinutes),
    };
  }

  tools(): ToolDef[] {
    const handlers: Record<string, ToolDef['handler']> = {
      cowork_now: async () => this.nowText(),
      cowork_focus_start: async (args) => this.focusStart(args),
      cowork_focus_stop: async () => this.focusStop(),
      cowork_day: async (args) => this.dayText(args.date),
      cowork_calendar: async (args) => this.calendarText(args.days),
      cowork_forget: async (args) => this.forget(args.date),
    };
    return COWORK_TOOL_DECLS.map((d) => ({ ...d, handler: handlers[d.name]! }));
  }

  private nowText(): string {
    const t = this.t;
    const now = this.clock();
    const lines: string[] = [];
    const cur = this.activity.now();
    if (!this.cfg.activity.enabled) lines.push(t.activityOff);
    else if (!this.probe) lines.push(t.sensorMissing);
    else if (cur) {
      lines.push(t.nowLine({ app: cur.app, title: cur.title }, Math.round(cur.idleMs / 1000)));
      if (cur.away) lines.push(t.nowAway(hm(this.tz, cur.at - cur.idleMs)));
      else if (cur.presentSince !== null) lines.push(t.nowPresent(hm(this.tz, cur.presentSince), Math.round((now - cur.presentSince) / MIN)));
      lines.push(t.nowToday(this.todaySummary(now).activeMin));
    }
    const f = this.activity.focus();
    lines.push(f ? t.nowFocus(f.goal, Math.round((now - f.startedAt) / MIN), Math.max(0, Math.round((f.endsAt - now) / MIN)), f.avoid.join(', ')) : t.nowNoFocus);
    const next = this.upcoming(now, now + 2 * DAY)?.list.filter((o) => o.start >= now || o.allDay).slice(0, 3);
    if (next?.length) lines.push(t.nowNext(next.map((o) => `${mdhm(this.tz, o.start)} ${o.allDay ? t.allDay : ''}${o.summary}`).join(';')));
    return lines.join('\n');
  }

  private todaySummary(now: number) {
    const today = dateKey(this.tz, now);
    const open = this.activity.openSegment(now);
    return summarize(today, [...this.days.read(today), ...(open ? [open] : [])], this.cfg.activity.awayMinutes * MIN);
  }

  private focusStart(args: Record<string, unknown>): string {
    const t = this.t;
    const now = this.clock();
    const running = this.activity.focus();
    if (running) return t.focusBusy(running.goal, hm(this.tz, running.endsAt));
    const goal = String(args.goal ?? '').trim();
    const minutes = Number(args.minutes);
    if (!goal) return t.focusBad(t.goalEmpty);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) return t.focusBad(t.minutesRange);
    const avoid = Array.isArray(args.avoid) ? args.avoid.map((a) => String(a).trim()).filter(Boolean).slice(0, 10) : [];
    const f = this.activity.startFocus(goal, Math.round(minutes), avoid, now);
    this.days.saveState(this.activity.snapshot());
    return t.focusStarted(goal, hm(this.tz, f.endsAt), avoid.join(', '));
  }

  private focusStop(): string {
    const now = this.clock();
    const out = this.activity.stopFocus(now);
    if (!out) return this.t.focusNone;
    this.days.append([out.record]);
    this.days.saveState(this.activity.snapshot());
    return this.t.focusStopped(out.focus.goal, Math.round((now - out.focus.startedAt) / MIN), out.stats);
  }

  private resolveDate(raw: unknown, allowAll: boolean): string | 'all' | null {
    const now = this.clock();
    const v = raw === undefined || raw === null || raw === '' ? 'today' : String(raw).trim().toLowerCase();
    if (v === 'today') return dateKey(this.tz, now);
    if (v === 'yesterday') { const p = localParts(this.tz, now); return dateKey(this.tz, localToEpoch(this.tz, p.y, p.mo, p.d - 1, 12)); }
    if (allowAll && v === 'all') return 'all';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }

  private dayText(raw: unknown): string {
    const t = this.t;
    const date = this.resolveDate(raw, false);
    if (!date || date === 'all') return t.dayBad(JSON.stringify(raw));
    const now = this.clock();
    const sum = date === dateKey(this.tz, now) ? this.todaySummary(now) : summarize(date, this.days.read(date), this.cfg.activity.awayMinutes * MIN);
    if (sum.firstAt === null && !sum.focus.length) return [t.dayNone(date), t.dayDates(this.days.dates().join(', ') || '-')].join('\n');
    const [y, mo, d] = date.split('-').map(Number);
    const dow = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay();
    const lines = [t.dayHead(date, t.dow[dow]!, sum.firstAt === null ? '-' : `${hm(this.tz, sum.firstAt)}–${hm(this.tz, sum.lastAt!)}`, sum.activeMin)];
    if (sum.aways.length) lines.push(t.dayAways(sum.aways.map((a) => `${hm(this.tz, a.from)}–${hm(this.tz, a.to)}`).join(', ')));
    if (sum.apps.length) {
      lines.push(t.dayApps);
      for (const a of sum.apps.slice(0, 8)) lines.push(`- ${a.app} ${a.min}${a.titles.length ? `: ${a.titles.map((x) => `${t.quote(x.title)} ${x.min}`).join(', ')}` : ''}`);
    }
    if (sum.focus.length) {
      lines.push(t.dayFocus);
      for (const f of sum.focus) lines.push(`- ${t.focusLine(hm(this.tz, f.from), hm(this.tz, f.to), f.goal, f.plannedMin, f.endedBy, f.stats as FocusStats)}`);
    }
    return lines.join('\n');
  }

  private calendarText(raw: unknown): string {
    const t = this.t;
    const days = Math.min(14, Math.max(1, Math.round(Number(raw ?? 1)) || 1));
    if (!this.cfg.calendar.file.trim() && !this.opts.calendarUrl().trim()) return t.calNoSource;
    const now = this.clock();
    const from = startOfDay(this.tz, now);
    const got = this.upcoming(from, from + days * DAY);
    const lines: string[] = [];
    if (this.calendar.error) lines.push(t.calError(this.calendar.error));
    if (got) {
      if (!got.list.length) lines.push(t.calNone(days));
      for (const o of got.list.slice(0, CALENDAR_LINES_MAX)) {
        const p = localParts(this.tz, o.start);
        lines.push(`- ${mdhm(this.tz, o.start).slice(0, 5)} ${t.dow[p.dow]} ${this.range(o)} ${o.summary || '-'}${o.location ? ` @ ${o.location}` : ''}`);
      }
      if (got.unsupported.length) lines.push(t.calUnsupported(got.unsupported.join('; ')));
      if (got.unknownZones.length) lines.push(t.calZones(got.unknownZones.join(', ')));
    }
    if (this.calendar.readAt !== null) lines.push(t.calStale(mdhm(this.tz, this.calendar.readAt)));
    return lines.join('\n');
  }

  private forget(raw: unknown): string {
    const t = this.t;
    const date = this.resolveDate(raw, true);
    if (!date || raw === undefined) return t.forgetBad(JSON.stringify(raw));
    const what = date === 'all' ? t.forgetAll : date;
    const n = this.days.forget(date);
    if (date === 'all' || date === dateKey(this.tz, this.clock())) this.activity.flush(this.clock());
    return n ? t.forgot(n, what) : t.forgotNone(what);
  }

  // ---------------------------------------------------------------- WebUI

  webUi(language: Language = 'zh'): WorldWebUiDecl {
    const zh = language === 'zh' || language === 'zh-Hant';
    return {
      label: 'CooCowork',
      lamps: [{
        label: zh ? '活动读取' : 'Activity',
        state: !this.cfg.activity.enabled ? 'offline' : this.sensorOk === false || (this.days && !this.probe) ? 'error' : this.sensorOk ? 'online' : 'loading',
      }, {
        label: zh ? '日历' : 'Calendar',
        state: this.calendar.error ? 'error' : this.calendar.parsed ? 'online' : 'offline',
        hint: this.calendar.error ?? undefined,
      }],
      config: configGroups(language),
      storage: this.days ? [{
        key: 'cowork.days',
        label: zh ? '活动记录' : 'Activity records',
        kind: 'disk',
        location: join(this.opts.dataDir, 'days'),
        stat: () => `${this.days.dates().length} ${zh ? '天' : 'days'}, ${Math.round(this.days.bytes() / 1024)} KB`,
        clear: () => `${this.days.forget('all')}`,
      }] : [],
      promptDocs: [{
        key: `worlds.${COWORK_ID}.envPrompt`,
        title: `CooCowork · ${zh ? '环境提示词' : 'environment prompt'}`,
        description: zh ? '告诉 Coo 这些事件和工具是什么、什么时候开口。' : 'Tells Coo what these events and tools are and when to speak.',
        path: ENV_PROMPT_FILES[this.cfg.promptLanguage] ?? ENV_PROMPT_FILES.zh,
        role: 'envPrompt',
        vars: [
          { name: 'cowork.activity', description: zh ? '活动读取此刻的状态。' : 'Activity reading state.' },
          { name: 'cowork.calendar', description: zh ? '日历是否连接。' : 'Whether a calendar is connected.' },
          { name: 'cowork.quiet', description: zh ? '安静时段。' : 'Quiet hours.' },
          { name: 'cowork.proactivity', description: zh ? '主动程度档位。' : 'Proactivity setting.' },
          { name: 'cowork.away', description: zh ? '离开判定的分钟数。' : 'Minutes without input that count as away.' },
        ],
      }],
    };
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'text/calendar, */*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
