/** 时区里的墙上时间与 epoch 毫秒互换。 */

export interface LocalParts { y: number; mo: number; d: number; h: number; mi: number; s: number; dow: number }

const formats = new Map<string, Intl.DateTimeFormat>();

function format(timezone: string): Intl.DateTimeFormat {
  let f = formats.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formats.set(timezone, f);
  }
  return f;
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(timezone: string, ms: number): LocalParts {
  const p = Object.fromEntries(format(timezone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year!, mo: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute!, s: +p.second!, dow: DOW[p.weekday!]! };
}

/** UTC 减本地,分钟。 */
function offsetMinutes(timezone: string, ms: number): number {
  const p = localParts(timezone, ms);
  const local = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return (ms - (ms % 1000) - local) / 60_000;
}

/** 时区里某个墙上时间的 epoch 毫秒;夏令时切换处取切换后的偏移。 */
export function localToEpoch(timezone: string, y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess + offsetMinutes(timezone, guess) * 60_000;
  return guess + offsetMinutes(timezone, first) * 60_000;
}

const two = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD`。 */
export function dateKey(timezone: string, ms: number): string {
  const p = localParts(timezone, ms);
  return `${p.y}-${two(p.mo)}-${two(p.d)}`;
}

/** `HH:MM`。 */
export function hm(timezone: string, ms: number): string {
  const p = localParts(timezone, ms);
  return `${two(p.h)}:${two(p.mi)}`;
}

/** `MM-DD HH:MM`。 */
export function mdhm(timezone: string, ms: number): string {
  const p = localParts(timezone, ms);
  return `${two(p.mo)}-${two(p.d)} ${two(p.h)}:${two(p.mi)}`;
}

/** 本地当天 0 点。 */
export function startOfDay(timezone: string, ms: number): number {
  const p = localParts(timezone, ms);
  return localToEpoch(timezone, p.y, p.mo, p.d);
}

/** `HH:MM` 解析成当天的分钟数;格式不对为 null。 */
export function clockMinutes(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m || +m[1]! > 23 || +m[2]! > 59) return null;
  return +m[1]! * 60 + +m[2]!;
}

/** `ms` 是否落在安静时段 [from, to) 里;from 晚于 to 时跨午夜。两端有一个不合法就不算。 */
export function inQuietHours(timezone: string, ms: number, from: string, to: string): boolean {
  const a = clockMinutes(from), b = clockMinutes(to);
  if (a === null || b === null || a === b) return false;
  const p = localParts(timezone, ms);
  const now = p.h * 60 + p.mi;
  return a < b ? now >= a && now < b : now >= a || now < b;
}

/** 分钟数写成「1 小时 5 分」/「1 h 5 min」。 */
export function duration(minutes: number, lang: 'zh' | 'en'): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60), r = m % 60;
  if (lang === 'zh') return h ? `${h} 小时${r ? ` ${r} 分钟` : ''}` : `${r} 分钟`;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}
