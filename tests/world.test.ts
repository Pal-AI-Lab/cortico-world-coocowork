import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dryMountWorld } from 'cortico/extensions/dry-mount.ts';
import { COWORK } from '../src/definition.ts';
import { FakeHost } from './helpers/fake-host.ts';
import { advance, at, calendarFile, config, Desk, tmp, world } from './helpers/sim.ts';

const tool = (w: ReturnType<typeof world>, name: string) => w.tools().find((t) => t.name === name)!;
const call = async (w: ReturnType<typeof world>, name: string, args: Record<string, unknown> = {}) =>
  String(await tool(w, name).handler(args, {} as never));
const pushed = (host: FakeHost) => host.events.map((e, i) => ({ type: e.type, text: e.text, trigger: host.pushOpts[i]?.trigger, origin: e.origin }));

describe('CooCowork World', () => {
  it('mounts dry with its defaults', async () => {
    const report = await dryMountWorld(COWORK, { scratchDir: tmp() });
    expect(report.failures).toEqual([]);
  });

  it('greets the day with yesterday and today, reminds once per occurrence across a restart', async () => {
    const dir = tmp();
    const cal = calendarFile(dir, 'UID:standup\r\nDTSTART;TZID=Asia/Shanghai:20261019T093000\r\nDTEND;TZID=Asia/Shanghai:20261019T094500\r\nSUMMARY:站会');
    const desk = new Desk([
      { from: at(21, 0, 18), app: 'Code.exe', title: 'main.ts - PalAIManage' },
      { from: at(23, 40, 18), app: 'Code.exe', title: 'main.ts - PalAIManage', idle: true },
      { from: at(9, 0), app: 'OUTLOOK.EXE', title: '收件箱' },
    ]);
    desk.now = at(21, 0, 18);
    const cfg = config({ calendar: { file: cal, remindMinutes: 10, refreshMinutes: 30 } });
    const yesterday = world(desk, dir, cfg);
    await yesterday.start(new FakeHost());
    await advance(yesterday, desk, at(23, 50, 18));
    await yesterday.stop();

    desk.now = at(9, 0);
    const host = new FakeHost();
    const w = world(desk, dir, cfg);
    await w.start(host);
    await advance(w, desk, at(9, 21));
    const events = pushed(host);
    expect(events[0]).toMatchObject({ type: 'cowork.day-start', trigger: 'flush' });
    expect(events[0]!.text).toContain('10-18 23:40');
    expect(events[0]!.text).toContain('Code.exe 2 小时 40 分钟');
    expect(events[0]!.text).toContain('09:30–09:45 站会');
    expect(events.filter((e) => e.type === 'cowork.meeting')).toEqual([expect.objectContaining({ trigger: 'flush', text: expect.stringContaining('10 分钟后(09:30–09:45)「站会」') })]);
    await w.stop();

    const again = new FakeHost();
    const w2 = world(desk, dir, cfg);
    await w2.start(again);
    await advance(w2, desk, at(9, 25));
    expect(again.events.filter((e) => e.type === 'cowork.meeting')).toEqual([]);
    await w2.stop();
  });

  it('wakes for a long absence, rides along for a short one, and holds back in quiet hours and on low', async () => {
    const stints = [
      { from: at(14, 0), app: 'Code.exe', title: 'a' },
      { from: at(14, 30), app: 'Code.exe', title: 'a', idle: true },
      { from: at(14, 38), app: 'Code.exe', title: 'a' },
      { from: at(15, 0), app: 'Code.exe', title: 'a', idle: true },
      { from: at(15, 40), app: 'Code.exe', title: 'a' },
    ];
    const run = async (patch: Parameters<typeof config>[0]) => {
      const desk = new Desk(stints);
      desk.now = at(14, 0);
      const host = new FakeHost();
      const w = world(desk, tmp(), config(patch));
      await w.start(host);
      await advance(w, desk, at(15, 45));
      await w.stop();
      return pushed(host).filter((e) => e.type === 'cowork.back' || e.type === 'cowork.away').map((e) => `${e.type}:${e.trigger}`);
    };
    expect(await run({})).toEqual(['cowork.away:piggyback', 'cowork.back:piggyback', 'cowork.away:piggyback', 'cowork.back:flush']);
    expect(await run({ quietHours: { from: '15:30', to: '08:00' } })).toEqual(['cowork.away:piggyback', 'cowork.back:piggyback', 'cowork.away:piggyback', 'cowork.back:piggyback']);
    expect((await run({ proactivity: 'low' })).at(-1)).toBe('cowork.back:piggyback');
  });

  it('runs a focus session through its tools and events', async () => {
    const desk = new Desk([
      { from: at(10, 0), app: 'WINWORD.EXE', title: '周报.docx' },
      { from: at(10, 20), app: 'msedge.exe', title: '某视频 - 哔哩哔哩 bilibili' },
      { from: at(10, 25), app: 'WINWORD.EXE', title: '周报.docx' },
    ]);
    desk.now = at(10, 0);
    const host = new FakeHost();
    const w = world(desk, tmp(), config());
    await w.start(host);
    expect(await call(w, 'cowork_focus_start', { goal: '写周报', minutes: 45, avoid: ['bilibili'] })).toContain('到 10:45 结束');
    expect(await call(w, 'cowork_focus_start', { goal: '别的', minutes: 30 })).toContain('没执行');
    await advance(w, desk, at(10, 23));
    expect(await call(w, 'cowork_now')).toContain('专注时段「写周报」进行中:第 23 分钟');
    await advance(w, desk, at(10, 50));
    const events = pushed(host);
    const drift = events.find((e) => e.type === 'cowork.drift')!;
    expect(drift).toMatchObject({ trigger: 'flush', origin: 'external' });
    expect(drift.text).toContain('匹配开始时说好要避开的「bilibili」');
    const ended = events.find((e) => e.type === 'cowork.focus-ended')!;
    expect(ended.trigger).toBe('flush');
    expect(ended.text).toContain('在电脑前 45 分钟,离开 0 分钟,停在要避开的内容上 5 分钟');
    const day = await call(w, 'cowork_day');
    expect(day).toContain('「写周报」计划 45 分钟,到时结束');
    expect(day).toContain('WINWORD.EXE 45');
    await w.stop();
  });

  it('records no title for messaging programs and forgets records on request', async () => {
    const dir = tmp();
    const desk = new Desk([{ from: at(11, 0), app: 'WeChat.exe', title: '张三' }, { from: at(11, 10), app: 'Code.exe', title: 'x.ts' }]);
    desk.now = at(11, 0);
    const w = world(desk, dir, config());
    await w.start(new FakeHost());
    await advance(w, desk, at(11, 20));
    const day = await call(w, 'cowork_day', { date: 'today' });
    expect(day).toContain('WeChat.exe 10');
    expect(day).not.toContain('张三');
    await w.stop();
    expect(readdirSync(join(dir, 'days')).filter((f) => f.endsWith('.jsonl'))).toEqual(['2026-10-19.jsonl']);
    const w2 = world(desk, dir, config());
    await w2.start(new FakeHost());
    expect(await call(w2, 'cowork_forget', { date: 'all' })).toContain('已删除 全部的活动记录(1 天的文件)');
    expect(existsSync(join(dir, 'days', '2026-10-19.jsonl'))).toBe(false);
    await w2.stop();
  });

  it('says once when the sensor fails and once when it recovers', async () => {
    const desk = new Desk([{ from: at(9), app: 'Code.exe', title: 'x' }]);
    const host = new FakeHost();
    const w = world(desk, tmp(), config());
    await w.start(host);
    desk.broken = true;
    await advance(w, desk, at(9, 5));
    desk.broken = false;
    await advance(w, desk, at(9, 6));
    const sensor = pushed(host).filter((e) => e.type === 'cowork.sensor');
    expect(sensor.map((e) => [e.origin, e.trigger])).toEqual([['internal', 'piggyback'], ['internal', 'piggyback']]);
    expect(sensor[0]!.text).toContain('读不到前台窗口和键鼠活动了(access denied)');
    expect(sensor[1]!.text).toContain('又能读到前台窗口和键鼠活动了');
    await w.stop();
  });

  it('writes the environment prompt in the configured language', async () => {
    const desk = new Desk();
    const w = world(desk, tmp(), config({ promptLanguage: 'en' }));
    await w.start(new FakeHost());
    expect(w.envPromptVars()).toMatchObject({ 'cowork.activity': 'on', 'cowork.calendar': 'not connected', 'cowork.proactivity': 'normal' });
    expect(w.webUi('en').promptDocs?.[0]?.path).toMatch(/ENV_PROMPT\.en\.md$/);
    expect(await call(w, 'cowork_calendar')).toContain('No calendar configured');
    await w.stop();
  });
});
