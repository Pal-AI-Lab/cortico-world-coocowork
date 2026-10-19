import { describe, expect, it } from 'vitest';
import type { CalendarProbe, PanelState } from '../src/panel-state.ts';
import { CoworkWorld, maskUrl, normalizeUrl } from '../src/world.ts';
import { FakeHost } from './helpers/fake-host.ts';
import { at, config, Desk, TZ, tmp } from './helpers/sim.ts';

const ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a', 'DTSTART;TZID=Asia/Shanghai:20261019T143000', 'DTEND;TZID=Asia/Shanghai:20261019T150000', 'SUMMARY:评审', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const SECRET = 'https://calendar.example/ical/abc/private-0123456789abcdef/basic.ics';

function setup(fetched: Record<string, string>) {
  const desk = new Desk([{ from: at(9), app: 'Code.exe', title: 'x' }]);
  desk.now = at(10);
  let stored = '';
  const w = new CoworkWorld({
    cfg: config(), timezone: TZ, dataDir: tmp(),
    calendarUrl: () => stored,
    storeCalendarUrl: (url) => { stored = url; },
    probe: async () => desk,
    now: () => desk.now,
    fetchText: async (url) => { if (!(url in fetched)) throw new Error('calendar.example: ENOTFOUND'); return fetched[url]!; },
    tickMs: () => 1e9,
  });
  return { w, stored: () => stored };
}

describe('the quick settings panel', () => {
  it('tests an address without saving it, then saves it as a secret and shows it masked', async () => {
    const { w, stored } = setup({ [SECRET]: ICS });
    await w.start(new FakeHost());
    const probe = await w.invoke('setup', 'testCalendar', [SECRET.replace('https://', 'webcal://'), 'zh']) as CalendarProbe;
    expect(probe).toEqual({ ok: true, count: 1, upcoming: [{ when: '10-19 周一 14:30–15:00', summary: '评审' }] });
    expect(stored()).toBe('');

    const state = await w.invoke('setup', 'saveCalendarUrl', [`  ${SECRET} `, 'zh']) as PanelState;
    expect(stored()).toBe(SECRET);
    expect(state.calendar.url).toBe('calendar.example/…ic.ics');
    expect(JSON.stringify(state)).not.toContain('private-0123');
    expect(state.calendar.upcoming).toEqual([{ when: '10-19 周一 14:30–15:00', summary: '评审' }]);

    const removed = await w.invoke('setup', 'removeCalendarUrl', ['zh']) as PanelState;
    expect(stored()).toBe('');
    expect(removed.calendar.url).toBeNull();
    await w.stop();
  });

  it('refuses addresses that are not http(s) or webcal, and reports a failed read by host', async () => {
    const { w, stored } = setup({});
    await w.start(new FakeHost());
    await expect(w.invoke('setup', 'saveCalendarUrl', ['file:///C:/cal.ics', 'zh'])).rejects.toThrow('https://');
    expect(stored()).toBe('');
    expect(await w.invoke('setup', 'testCalendar', [SECRET, 'en'])).toEqual({ ok: false, error: 'calendar.example: ENOTFOUND' });
    await w.stop();
  });

  it('lists today\'s programs not yet hidden, and deletes records from the panel', async () => {
    const { w } = setup({});
    await w.start(new FakeHost());
    await w.tick();
    const state = await w.invoke('setup', 'state', ['zh']) as PanelState;
    expect(state.activity).toMatchObject({ enabled: true, available: true, seenApps: [] });
    expect(state.settings.privateApps).toContain('WeChat.exe');
    const after = await w.invoke('setup', 'forget', ['all', 'zh']) as PanelState;
    expect(after.records.days).toBe(0);
    await w.stop();
  });

  it('normalizes and masks addresses', () => {
    expect(normalizeUrl('webcal://p.example/a.ics')).toBe('https://p.example/a.ics');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(maskUrl(SECRET)).toBe('calendar.example/…ic.ics');
  });
});
