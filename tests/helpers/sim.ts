/** 模拟的电脑:可拨的时钟和按时刻给出前台窗口与空闲时长的探针。 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localToEpoch } from '../../src/clock.ts';
import { COWORK_DEFAULTS, type CoworkConfigSection } from '../../src/config.ts';
import type { Probe, Sample } from '../../src/probe.ts';
import { CoworkWorld } from '../../src/world.ts';

export const TZ = 'Asia/Shanghai';
export const MIN = 60_000;
export const at = (h: number, mi = 0, d = 19) => localToEpoch(TZ, 2026, 10, d, h, mi);

/** 一段时间里使用者在做什么;`idle` 为真表示这段没有键鼠输入。 */
export interface Stint { from: number; app: string; title: string; idle?: boolean }

export class Desk implements Probe {
  now = at(9);
  broken = false;
  constructor(public stints: Stint[] = []) {}

  sample(): Sample {
    if (this.broken) throw new Error('access denied');
    const cur = [...this.stints].reverse().find((s) => s.from <= this.now);
    if (!cur) return { app: '', title: '', idleMs: 10 * 60 * MIN };
    if (!cur.idle) return { app: cur.app, title: cur.title, idleMs: 0 };
    return { app: cur.app, title: cur.title, idleMs: this.now - cur.from };
  }
}

export function tmp(prefix = 'cowork-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function calendarFile(dir: string, ...events: string[]): string {
  const file = join(dir, 'cal.ics');
  writeFileSync(file, ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.map((e) => `BEGIN:VEVENT\r\n${e}\r\nEND:VEVENT`), 'END:VCALENDAR'].join('\r\n'));
  return file;
}

export function config(patch: Partial<CoworkConfigSection> = {}): CoworkConfigSection {
  return { ...structuredClone(COWORK_DEFAULTS), enabled: true, ...patch };
}

export function world(desk: Desk, dataDir: string, cfg: CoworkConfigSection, calendarUrl = '') {
  return new CoworkWorld({
    cfg, timezone: TZ, dataDir,
    calendarUrl: () => calendarUrl,
    probe: async () => desk,
    now: () => desk.now,
    tickMs: () => 1e9,
  });
}

/** 把时钟拨到 `to`,每 `stepMs` 走一拍。 */
export async function advance(w: CoworkWorld, desk: Desk, to: number, stepMs = 30_000): Promise<void> {
  while (desk.now < to) {
    desk.now = Math.min(to, desk.now + stepMs);
    await w.tick();
  }
}
