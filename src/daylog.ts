/**
 * 按本地日期分文件的活动记录:`<dir>/YYYY-MM-DD.jsonl`,一行一条 `LogRecord`。跨午夜的记录在午夜切开,
 * 两半各进各的那天。另有 `state.json` 存重启后接着用的状态。
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ActivityState, LogRecord } from './activity.ts';
import { dateKey, localParts, localToEpoch } from './clock.ts';

const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

export class DayLog {
  constructor(private readonly dir: string, private readonly timezone: string) {
    mkdirSync(dir, { recursive: true });
  }

  append(records: readonly LogRecord[]): void {
    for (const r of records) {
      for (const part of splitAtMidnight(r, this.timezone)) {
        appendFileSync(join(this.dir, `${dateKey(this.timezone, part.from)}.jsonl`), `${JSON.stringify(part)}\n`, 'utf8');
      }
    }
  }

  read(date: string): LogRecord[] {
    const file = join(this.dir, `${date}.jsonl`);
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as LogRecord]; } catch { return []; }
    });
  }

  dates(): string[] {
    return readdirSync(this.dir).map((f) => DAY_FILE.exec(f)?.[1]).filter((d): d is string => !!d).sort();
  }

  /** 删掉 `keepDays` 天之前的文件(今天算第 1 天)。返回删了几个。 */
  prune(keepDays: number, now: number): number {
    const p = localParts(this.timezone, now);
    const oldest = dateKey(this.timezone, localToEpoch(this.timezone, p.y, p.mo, p.d - (keepDays - 1), 12));
    let n = 0;
    for (const d of this.dates()) if (d < oldest) { rmSync(join(this.dir, `${d}.jsonl`)); n++; }
    return n;
  }

  /** 删掉某天或全部记录。返回删了几天。 */
  forget(date: string | 'all'): number {
    const targets = date === 'all' ? this.dates() : this.dates().filter((d) => d === date);
    for (const d of targets) rmSync(join(this.dir, `${d}.jsonl`));
    return targets.length;
  }

  bytes(): number {
    return this.dates().reduce((a, d) => a + statSync(join(this.dir, `${d}.jsonl`)).size, 0);
  }

  loadState(): ActivityState | null {
    const file = join(this.dir, 'state.json');
    if (!existsSync(file)) return null;
    try { return JSON.parse(readFileSync(file, 'utf8')) as ActivityState; } catch { return null; }
  }

  saveState(state: ActivityState): void {
    writeFileSync(join(this.dir, 'state.json'), JSON.stringify(state), 'utf8');
  }
}

function splitAtMidnight(r: LogRecord, timezone: string): LogRecord[] {
  if (r.k === 'focus') return [r];
  const out: LogRecord[] = [];
  let from = r.from;
  while (dateKey(timezone, from) !== dateKey(timezone, r.to - 1)) {
    const p = localParts(timezone, from);
    const midnight = localToEpoch(timezone, p.y, p.mo, p.d + 1);
    out.push({ ...r, from, to: midnight });
    from = midnight;
  }
  if (r.to > from) out.push({ ...r, from });
  return out;
}

export interface DaySummary {
  date: string;
  firstAt: number | null;
  lastAt: number | null;
  activeMin: number;
  aways: Array<{ from: number; to: number }>;
  apps: Array<{ app: string; min: number; titles: Array<{ title: string; min: number }> }>;
  focus: Array<Extract<LogRecord, { k: 'focus' }>>;
}

/** 一天的记录折成概要:程序按分钟数降序,每个程序最多 `titlesPerApp` 个标题。 */
export function summarize(date: string, records: readonly LogRecord[], minAwayMs: number, titlesPerApp = 3): DaySummary {
  const segs = records.filter((r): r is Extract<LogRecord, { k: 'seg' }> => r.k === 'seg');
  const apps = new Map<string, { ms: number; titles: Map<string, number> }>();
  let activeMs = 0;
  for (const s of segs) {
    const ms = s.to - s.from;
    activeMs += ms;
    const a = apps.get(s.app) ?? { ms: 0, titles: new Map() };
    a.ms += ms;
    if (s.title) a.titles.set(s.title, (a.titles.get(s.title) ?? 0) + ms);
    apps.set(s.app, a);
  }
  const min = (ms: number) => Math.round(ms / 60_000);
  return {
    date,
    firstAt: segs.length ? Math.min(...segs.map((s) => s.from)) : null,
    lastAt: segs.length ? Math.max(...segs.map((s) => s.to)) : null,
    activeMin: min(activeMs),
    aways: records.filter((r): r is Extract<LogRecord, { k: 'away' }> => r.k === 'away' && r.to - r.from >= minAwayMs).map(({ from, to }) => ({ from, to })),
    apps: [...apps].sort((a, b) => b[1].ms - a[1].ms).map(([app, a]) => ({
      app: app || '?',
      min: min(a.ms),
      titles: [...a.titles].sort((x, y) => y[1] - x[1]).slice(0, titlesPerApp).map(([title, ms]) => ({ title, min: min(ms) })),
    })).filter((a) => a.min > 0),
    focus: records.filter((r): r is Extract<LogRecord, { k: 'focus' }> => r.k === 'focus'),
  };
}
