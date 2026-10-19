/**
 * iCalendar(.ics)里的日程,展开成给定时间窗里的具体场次。
 *
 * 支持:VEVENT 的 DTSTART/DTEND/DURATION、全天日程、TZID(IANA 名与常见的 Windows 时区名)、UTC、浮动时间;
 * RRULE 的 FREQ=DAILY/WEEKLY/MONTHLY/YEARLY 与 INTERVAL、COUNT、UNTIL、BYDAY(含 MONTHLY 的序号,如 -1FR)、
 * BYMONTHDAY;EXDATE;RECURRENCE-ID 改期的单场;STATUS:CANCELLED。其余 RRULE 部件只展开第一场,`unsupported` 记下规则原文。
 */
import { localToEpoch } from './clock.ts';

export interface Occurrence {
  uid: string;
  summary: string;
  location: string;
  start: number;
  end: number;
  allDay: boolean;
}

export interface Parsed {
  events: RawEvent[];
  /** 读不懂、只展开了第一场的重复规则。 */
  unsupported: string[];
  /** 不认识、按部署时区读的 TZID。 */
  unknownZones: string[];
}

interface DateValue { y: number; mo: number; d: number; h: number; mi: number; s: number; allDay: boolean; utc: boolean; tzid: string | null }

interface RawEvent {
  uid: string;
  summary: string;
  location: string;
  start: DateValue;
  end: DateValue | null;
  durationMs: number | null;
  rrule: Record<string, string> | null;
  rruleText: string;
  exdates: DateValue[];
  recurrenceId: DateValue | null;
  cancelled: boolean;
}

/** 常见的 Windows 时区名(Outlook 导出用它们)对 IANA。 */
const WINDOWS_ZONES: Record<string, string> = {
  'China Standard Time': 'Asia/Shanghai',
  'Taipei Standard Time': 'Asia/Taipei',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'Singapore Standard Time': 'Asia/Singapore',
  'India Standard Time': 'Asia/Kolkata',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Russian Standard Time': 'Europe/Moscow',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  UTC: 'UTC',
};

function zoneOf(tzid: string | null, fallback: string, unknown: Set<string>): string {
  if (!tzid) return fallback;
  const name = tzid.replace(/^"|"$/g, '');
  if (WINDOWS_ZONES[name]) return WINDOWS_ZONES[name]!;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return name;
  } catch {
    unknown.add(name);
    return fallback;
  }
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const [name, ...params] = line.slice(0, colon).split(';');
  return {
    name: name!.toUpperCase(),
    params: Object.fromEntries(params.map((p) => { const i = p.indexOf('='); return [p.slice(0, i).toUpperCase(), p.slice(i + 1)]; })),
    value: line.slice(colon + 1),
  };
}

function parseDate(value: string, params: Record<string, string>): DateValue | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const allDay = params.VALUE === 'DATE' || !m[4];
  return { y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0), allDay, utc: !!m[7], tzid: params.TZID ?? null };
}

function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const ms = (((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 + +(m[4] ?? 0)) * 60 + +(m[5] ?? 0)) * 60_000 + +(m[6] ?? 0) * 1000;
  return m[1] === '-' ? -ms : ms;
}

export function parseIcs(text: string): Parsed {
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0;
  for (const line of unfold(text)) {
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && depth === 0) {
        cur = { uid: '', summary: '', location: '', start: null as never, end: null, durationMs: null, rrule: null, rruleText: '', exdates: [], recurrenceId: null, cancelled: false };
      } else if (cur) depth++;
      continue;
    }
    if (p.name === 'END') {
      if (cur && depth > 0) { depth--; continue; }
      if (cur && p.value.toUpperCase() === 'VEVENT') { if (cur.start) events.push(cur); cur = null; }
      continue;
    }
    if (!cur || depth > 0) continue;
    switch (p.name) {
      case 'UID': cur.uid = p.value.trim(); break;
      case 'SUMMARY': cur.summary = unescape(p.value); break;
      case 'LOCATION': cur.location = unescape(p.value); break;
      case 'DTSTART': cur.start = parseDate(p.value, p.params) as DateValue; break;
      case 'DTEND': cur.end = parseDate(p.value, p.params); break;
      case 'DURATION': cur.durationMs = parseDuration(p.value); break;
      case 'RRULE':
        cur.rruleText = p.value.trim();
        cur.rrule = Object.fromEntries(p.value.split(';').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i).toUpperCase(), kv.slice(i + 1).toUpperCase()]; }));
        break;
      case 'EXDATE':
        for (const v of p.value.split(',')) { const d = parseDate(v, p.params); if (d) cur.exdates.push(d); }
        break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDate(p.value, p.params); break;
      case 'STATUS': cur.cancelled = p.value.trim().toUpperCase() === 'CANCELLED'; break;
    }
  }
  return { events, unsupported: [], unknownZones: [] };
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_STEPS = 5000;

/** `[from, to)` 时间窗里与之有交集的场次,按开始时间排序。 */
export function occurrences(parsed: Parsed, timezone: string, from: number, to: number): { list: Occurrence[]; unsupported: string[]; unknownZones: string[] } {
  const unknown = new Set<string>();
  const unsupported = new Set<string>();
  const epoch = (v: DateValue) => (v.utc ? Date.UTC(v.y, v.mo - 1, v.d, v.h, v.mi, v.s)
    : localToEpoch(v.allDay ? timezone : zoneOf(v.tzid, timezone, unknown), v.y, v.mo, v.d, v.h, v.mi, v.s));

  const overrides = new Map<string, RawEvent>();
  for (const e of parsed.events) if (e.recurrenceId) overrides.set(`${e.uid}\n${epoch(e.recurrenceId)}`, e);

  const list: Occurrence[] = [];
  const emit = (e: RawEvent, start: number, length: number) => {
    if (e.cancelled) return;
    const end = start + length;
    if (end > from && start < to) list.push({ uid: e.uid, summary: e.summary, location: e.location, start, end, allDay: e.start.allDay });
  };
  const lengthOf = (e: RawEvent) => {
    const s = epoch(e.start);
    if (e.end) return epoch(e.end) - s;
    if (e.durationMs !== null) return e.durationMs;
    return e.start.allDay ? 86_400_000 : 0;
  };

  for (const e of parsed.events) {
    if (e.recurrenceId) { emit(e, epoch(e.start), lengthOf(e)); continue; }
    const length = lengthOf(e);
    if (!e.rrule) { emit(e, epoch(e.start), length); continue; }
    const zone = e.start.utc ? 'UTC' : e.start.allDay ? timezone : zoneOf(e.start.tzid, timezone, unknown);
    const excluded = new Set(e.exdates.map(epoch));
    const r = e.rrule;
    const freq = r.FREQ;
    const interval = Math.max(1, +(r.INTERVAL ?? 1) || 1);
    const count = r.COUNT ? +r.COUNT : Infinity;
    const until = r.UNTIL ? (() => { const u = parseDate(r.UNTIL!, {}); return u ? epoch(u) : Infinity; })() : Infinity;
    const known = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'WKST']);
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq ?? '') || Object.keys(r).some((k) => !known.has(k))) {
      unsupported.add(`${e.summary}: ${e.rruleText}`);
      emit(e, epoch(e.start), length);
      continue;
    }
    const s = e.start;
    const byDay = r.BYDAY ? r.BYDAY.split(',').map((x) => /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(x)).filter((x): x is RegExpExecArray => !!x)
      .map((x) => ({ n: x[1] ? +x[1] : 0, dow: DAYS.indexOf(x[2]!) })) : [];
    const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [];

    let emitted = 0;
    const at = (y: number, mo: number, d: number) => localToEpoch(zone, y, mo, d, s.h, s.mi, s.s);
    const consider = (t: number): boolean => {
      if (t < epoch(s)) return true;
      if (t > until || emitted >= count) return false;
      emitted++;
      if (!excluded.has(t)) {
        const o = overrides.get(`${e.uid}\n${t}`);
        if (!o) emit(e, t, length);
      }
      return t < to;
    };
    const base = Date.UTC(s.y, s.mo - 1, s.d);
    const civil = (ms: number) => { const d = new Date(ms); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay() }; };

    let go = true;
    for (let step = 0; go && step < MAX_STEPS; step++) {
      if (freq === 'DAILY') {
        const c = civil(base + step * interval * 86_400_000);
        go = consider(at(c.y, c.mo, c.d));
      } else if (freq === 'WEEKLY') {
        const weekStart = base - civil(base).dow * 86_400_000 + step * interval * 7 * 86_400_000;
        const dows = byDay.length ? byDay.map((b) => b.dow).sort((a, b) => a - b) : [civil(base).dow];
        for (const dow of dows) {
          const c = civil(weekStart + dow * 86_400_000);
          if (!(go = consider(at(c.y, c.mo, c.d)))) break;
        }
      } else if (freq === 'MONTHLY') {
        const mIndex = s.mo - 1 + step * interval;
        const y = s.y + Math.floor(mIndex / 12), mo = (mIndex % 12) + 1;
        const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
        let picks: number[];
        if (byMonthDay.length) picks = byMonthDay.map((d) => (d < 0 ? days + d + 1 : d)).filter((d) => d >= 1 && d <= days);
        else if (byDay.length) {
          picks = [];
          for (const b of byDay) {
            const matches = Array.from({ length: days }, (_, i) => i + 1).filter((d) => new Date(Date.UTC(y, mo - 1, d)).getUTCDay() === b.dow);
            if (b.n === 0) picks.push(...matches);
            else { const d = b.n > 0 ? matches[b.n - 1] : matches[matches.length + b.n]; if (d) picks.push(d); }
          }
        } else picks = s.d <= days ? [s.d] : [];
        for (const d of [...new Set(picks)].sort((a, b) => a - b)) if (!(go = consider(at(y, mo, d)))) break;
      } else {
        const y = s.y + step * interval;
        go = consider(at(y, s.mo, s.d));
      }
    }
  }
  list.sort((a, b) => a.start - b.start);
  return { list, unsupported: [...unsupported, ...parsed.unsupported], unknownZones: [...unknown] };
}
