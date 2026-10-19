import { describe, expect, it } from 'vitest';
import { occurrences, parseIcs } from '../src/calendar.ts';
import { hm, localToEpoch, mdhm } from '../src/clock.ts';

const TZ = 'Asia/Shanghai';
const day = (d: number, mo = 10) => localToEpoch(TZ, 2026, mo, d);

const ics = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const ev = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

const list = (text: string, from: number, to: number) => occurrences(parseIcs(text), TZ, from, to);

describe('calendar', () => {
  it('reads a timed event in a named zone, folded lines and escapes', () => {
    const text = ics(ev('UID:a', 'DTSTART;TZID=America/New_York:20261019T090000', 'DTEND;TZID=America/New_York:20261019T093000',
      'SUMMARY:Design review\\, round 2', 'LOCATION:Room 3\r\n  east wing'));
    const [o] = list(text, day(19), day(22)).list;
    expect(mdhm(TZ, o!.start)).toBe('10-19 21:00');
    expect(o).toMatchObject({ summary: 'Design review, round 2', location: 'Room 3 east wing', allDay: false });
    expect(o!.end - o!.start).toBe(30 * 60_000);
  });

  it('maps Windows zone names and reports unknown ones', () => {
    const text = ics(
      ev('UID:w', 'DTSTART;TZID=China Standard Time:20261020T100000', 'DURATION:PT1H', 'SUMMARY:周会'),
      ev('UID:u', 'DTSTART;TZID=Mars/Olympus:20261020T110000', 'SUMMARY:x'),
    );
    const got = list(text, day(20), day(21));
    expect(got.list.map((o) => hm(TZ, o.start))).toEqual(['10:00', '11:00']);
    expect(got.unknownZones).toEqual(['Mars/Olympus']);
  });

  it('expands weekly rules with BYDAY, EXDATE and a moved occurrence', () => {
    const text = ics(
      ev('UID:s', 'DTSTART;TZID=Asia/Shanghai:20261005T093000', 'DTEND;TZID=Asia/Shanghai:20261005T100000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE', 'EXDATE;TZID=Asia/Shanghai:20261021T093000', 'SUMMARY:站会'),
      ev('UID:s', 'RECURRENCE-ID;TZID=Asia/Shanghai:20261019T093000', 'DTSTART;TZID=Asia/Shanghai:20261019T110000', 'DTEND;TZID=Asia/Shanghai:20261019T113000', 'SUMMARY:站会(改期)'),
    );
    const got = list(text, day(19), day(27));
    expect(got.list.map((o) => `${mdhm(TZ, o.start)} ${o.summary}`)).toEqual(['10-19 11:00 站会(改期)', '10-26 09:30 站会']);
  });

  it('expands monthly rules on an ordinal weekday and honours COUNT and UNTIL', () => {
    const lastFriday = ics(ev('UID:m', 'DTSTART;TZID=Asia/Shanghai:20260130T160000', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR', 'SUMMARY:月度复盘'));
    expect(list(lastFriday, day(1), day(1, 12)).list.map((o) => mdhm(TZ, o.start))).toEqual(['10-30 16:00', '11-27 16:00']);
    const counted = ics(ev('UID:c', 'DTSTART;TZID=Asia/Shanghai:20261017T080000', 'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:跑步'));
    expect(list(counted, day(17), day(25)).list).toHaveLength(3);
    const until = ics(ev('UID:d', 'DTSTART;TZID=Asia/Shanghai:20261017T080000', 'RRULE:FREQ=DAILY;UNTIL=20261018T235959Z', 'SUMMARY:跑步'));
    expect(list(until, day(17), day(25)).list).toHaveLength(2);
  });

  it('keeps all-day events, drops cancelled ones and lists only the first of an unknown rule', () => {
    const text = ics(
      ev('UID:b', 'DTSTART;VALUE=DATE:20261019', 'DTEND;VALUE=DATE:20261020', 'SUMMARY:生日'),
      ev('UID:x', 'DTSTART:20261019T020000Z', 'STATUS:CANCELLED', 'SUMMARY:取消了'),
      ev('UID:h', 'DTSTART:20261019T020000Z', 'RRULE:FREQ=HOURLY', 'SUMMARY:每小时'),
    );
    const got = list(text, day(19), day(20));
    expect(got.list.map((o) => [o.summary, o.allDay])).toEqual([['生日', true], ['每小时', false]]);
    expect(got.unsupported).toEqual(['每小时: FREQ=HOURLY']);
  });
});
