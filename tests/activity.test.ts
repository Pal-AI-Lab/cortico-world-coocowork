import { describe, expect, it } from 'vitest';
import { Activity, EMPTY_STATE, matchAvoid, visibleTitle, type ActivityState, type Signal } from '../src/activity.ts';
import { dateKey, localToEpoch } from '../src/clock.ts';
import { COWORK_DEFAULTS } from '../src/config.ts';

const TZ = 'Asia/Shanghai';
const MIN = 60_000;
const at = (h: number, mi = 0, d = 19) => localToEpoch(TZ, 2026, 10, d, h, mi);
const cfg = COWORK_DEFAULTS.activity;

function tracker(state: ActivityState = EMPTY_STATE) {
  return new Activity({
    awayMs: () => cfg.awayMinutes * MIN,
    stretchMs: () => cfg.stretchMinutes * MIN,
    nudgeMs: () => COWORK_DEFAULTS.focus.nudgeSec * 1000,
    visibleTitle: (app, title) => visibleTitle(app, title, true, cfg.privateApps),
  }, state, (a, b) => dateKey(TZ, a) === dateKey(TZ, b));
}

/** 从 from 到 to 每 30 秒采一次;idleAt 给出某时刻的空闲毫秒数。 */
function run(a: Activity, from: number, to: number, app: (t: number) => string, idleAt: (t: number) => number = () => 0) {
  const signals: Signal[] = [];
  for (let t = from; t <= to; t += 30_000) signals.push(...a.observe({ app: app(t), title: `${app(t)} window`, idleMs: idleAt(t) }, t).signals);
  return signals;
}

describe('Activity', () => {
  it('reports the first activity of a day with the last activity seen before it', () => {
    const a = tracker({ ...EMPTY_STATE, lastActiveAt: at(23, 40, 18) });
    const [s] = a.observe({ app: 'Code.exe', title: 'x', idleMs: 0 }, at(9)).signals;
    expect(s).toEqual({ kind: 'back', since: at(23, 40, 18), at: at(9), firstToday: true });
  });

  it('times away from the last input and back from the first input after it', () => {
    const a = tracker({ ...EMPTY_STATE, lastActiveAt: at(8) });
    // 9:00 起没有输入,9:40 回来
    const idle = (t: number) => (t >= at(9) && t < at(9, 40) ? t - at(9) : 0);
    const signals = run(a, at(8, 30), at(9, 50), () => 'Code.exe', idle);
    const away = signals.find((s) => s.kind === 'away');
    const back = signals.filter((s) => s.kind === 'back');
    expect(away).toMatchObject({ since: at(9), app: 'Code.exe' });
    expect(back.at(-1)).toMatchObject({ since: at(9), at: at(9, 40), firstToday: false });
  });

  it('counts a gap between samples longer than the away time as away', () => {
    const a = tracker();
    a.observe({ app: 'Code.exe', title: 't', idleMs: 0 }, at(10));
    const { signals, records } = a.observe({ app: 'Code.exe', title: 't', idleMs: 1000 }, at(11));
    expect(signals).toContainEqual({ kind: 'back', since: at(10), at: at(11), firstToday: false });
    expect(records).toContainEqual({ k: 'away', from: at(10), to: at(11) - 1000 });
  });

  it('tells each full stretch once and restarts the count after a break', () => {
    const a = tracker({ ...EMPTY_STATE, lastActiveAt: at(8) });
    const idle = (t: number) => (t >= at(11, 50) && t < at(12, 30) ? t - at(11, 50) : 0);
    const stretches = run(a, at(9), at(14, 10), () => 'Code.exe', idle).filter((s) => s.kind === 'stretch');
    // 9:00 起满 90 分钟在 10:30;11:50 离开时还不满 180 分钟;12:30 回来后 14:00 再满 90 分钟
    expect(stretches.map((s) => s.kind === 'stretch' && s.since)).toEqual([at(9), at(12, 30)]);
  });

  it('keeps the title out for private windows and listed programs', () => {
    expect(visibleTitle('msedge.exe', '新标签页 - [InPrivate] - Microsoft Edge', true, '')).toBe('');
    expect(visibleTitle('WeChat.exe', '张三', true, cfg.privateApps)).toBe('');
    expect(visibleTitle('Code.exe', 'main.ts', false, '')).toBe('');
    expect(visibleTitle('Code.exe', 'main.ts', true, cfg.privateApps)).toBe('main.ts');
  });

  it('closes a segment when the foreground changes or the person leaves', () => {
    const a = tracker();
    a.observe({ app: 'Code.exe', title: 'a', idleMs: 0 }, at(10));
    const r1 = a.observe({ app: 'msedge.exe', title: 'b', idleMs: 0 }, at(10, 2)).records;
    expect(r1).toEqual([{ k: 'seg', from: at(10), to: at(10, 2), app: 'Code.exe', title: 'a' }]);
    a.observe({ app: 'msedge.exe', title: 'b', idleMs: 60_000 }, at(10, 4));
    const r2 = a.observe({ app: 'msedge.exe', title: 'b', idleMs: 5 * MIN }, at(10, 8)).records;
    expect(r2).toEqual([{ k: 'seg', from: at(10, 2), to: at(10, 3), app: 'msedge.exe', title: 'b' }]);
  });
});

describe('focus sessions', () => {
  it('tells drift once per stretch on an avoided program and ends with statistics', () => {
    const a = tracker({ ...EMPTY_STATE, lastActiveAt: at(9, 59) });
    a.observe({ app: 'Code.exe', title: 'x', idleMs: 0 }, at(10));
    a.startFocus('写周报', 50, ['bilibili'], at(10));
    const app = (t: number) => (t >= at(10, 20) && t < at(10, 30) ? 'msedge.exe' : 'WINWORD.EXE');
    const signals: Signal[] = [];
    for (let t = at(10) + 30_000; t <= at(10, 55); t += 30_000) {
      const title = app(t) === 'msedge.exe' ? '某视频 - 哔哩哔哩 bilibili' : '周报.docx';
      signals.push(...a.observe({ app: app(t), title, idleMs: 0 }, t).signals);
    }
    const drift = signals.filter((s) => s.kind === 'drift');
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ since: at(10, 20), matched: 'bilibili' });
    const ended = signals.find((s) => s.kind === 'focus-ended');
    expect(ended && ended.kind === 'focus-ended' && ended.stats).toMatchObject({ activeMin: 50, awayMin: 0, avoidMin: 10 });
    expect(a.focus()).toBeNull();
  });

  it('ends by time from saved state after a restart', () => {
    const a = tracker();
    a.startFocus('复习', 30, [], at(10));
    const b = tracker(a.snapshot());
    expect(b.expireFocus(at(10, 20))).toBeNull();
    expect(b.expireFocus(at(10, 31))?.signal).toMatchObject({ kind: 'focus-ended', at: at(10, 30) });
  });

  it('matches avoid words in the program name or the title, ignoring case', () => {
    expect(matchAvoid(['Steam.exe'], 'steam.exe', '')).toBe('Steam.exe');
    expect(matchAvoid(['bilibili'], 'chrome.exe', 'XX - BiliBili')).toBe('bilibili');
    expect(matchAvoid([' '], 'a', 'b')).toBeNull();
  });
});
