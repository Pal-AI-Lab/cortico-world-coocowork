/**
 * 一个模拟的工作日，经真 Core 端到端跑一遍：CooCowork 读模拟的电脑与日历，事件按各自的投递方式进上下文，
 * 脚本扮演 Coo 按环境提示词的约定作答。测的是这些事件在一天里什么时候叫醒 Coo、带着什么事实到达，
 * 以及 Coo 的工具调用在 World 那头的结果。
 *
 * 设了环境变量 `COWORK_TRANSCRIPT` 时，把这一天写成一份 Markdown 记录到它指向的文件。
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { PushOptions, WorldHost } from 'cortico/core/types.ts';
import type { WorldDefinition, WorldSection } from 'cortico/world.ts';
import { readFileSync } from 'node:fs';
import { hm } from '../src/clock.ts';
import { COWORK } from '../src/definition.ts';
import { CoworkWorld } from '../src/world.ts';
import { PetStub, ScriptedModel, startBot, stubDefinition, type Step, type Turn } from './helpers/bot.ts';
import { advance, at, calendarFile, config, Desk, TZ, tmp, world } from './helpers/sim.ts';

const COO = `# 我是谁

我叫 Coo。我住在这台电脑的屏幕底边。我说话用头顶的气泡,一次一两句。`;

/** 一条上下文记录里的文字。 */
function textOf(item: Record<string, unknown>): string {
  if (typeof item.output === 'string') return item.output;
  const content = item.content as Array<{ text?: string }> | undefined;
  return Array.isArray(content) ? content.map((c) => c.text ?? '').join('\n') : '';
}

/**
 * 最新送到的一批事件，或最后一次工具调用的回执。事件批在上下文里是一次 `external_event_frame` 调用及其输出;
 * 后面跟着内部行(用户消息)时一并算进这一批。
 */
function latest(turn: Turn): { batch: string; receipt: { tool: string; text: string } | null } {
  const items = turn.records.map((r) => r.item);
  let i = items.length - 1;
  const tail: string[] = [];
  while (i >= 0 && items[i]!.type === 'message' && items[i]!.role === 'user') tail.unshift(textOf(items[i--]!));
  const out = items[i];
  if (out?.type !== 'function_call_output') return { batch: tail.join('\n'), receipt: null };
  const call = [...items].reverse().find((x) => x.type === 'function_call' && x.call_id === out.call_id);
  if (call?.name === 'external_event_frame') return { batch: [textOf(out), ...tail].join('\n'), receipt: null };
  return { batch: '', receipt: { tool: String(call?.name ?? ''), text: textOf(out) } };
}

const say = (script: string, ...more: Step['calls' & keyof Step][]): Step => ({ calls: [{ name: 'pet_say', args: { script } }, ...(more as never[])] });
const END: Step = { calls: [{ name: 'end_turn' }] };

/** 扮演 Coo:按环境提示词的约定，对每批事件做一个合理的反应。 */
function cooScript(log: string[]) {
  return (turn: Turn): Step => {
    const { batch, receipt } = latest(turn);
    if (receipt) {
      if (receipt.tool === 'cowork_focus_start') return say('好,我在旁边陪你写,库...');
      if (receipt.tool === 'cowork_day') {
        const top = /- (\S+) (\d+)/.exec(receipt.text);
        return say(`今天主要在 ${top?.[1] ?? '电脑'} 上忙了 ${top?.[2] ?? '?'} 分钟,周报那段专注也完成了,库...`);
      }
      if (receipt.tool === 'cowork_forget') return say('删好了,今天的记录我不留了。');
      return END;
    }
    log.push(batch);
    if (batch.includes('cowork.day-start') || batch.includes('今天第一次看到使用者')) {
      return say('【开心】早呀!昨晚弄到快十二点了吧。九点半有站会,库...');
    }
    if (batch.includes('[cowork] 日历')) {
      const m = /「(.+?)」/.exec(batch.slice(batch.lastIndexOf('[cowork] 日历')));
      return { calls: [{ name: 'pet_say', args: { script: `十分钟后「${m?.[1]}」,别忘啦。` } }, { name: 'pet_quiet', args: { minutes: 25 } }] };
    }
    if (batch.includes('[typed] 使用者:我要写周报')) {
      return { calls: [{ name: 'cowork_focus_start', args: { goal: '写周报', minutes: 60, avoid: ['bilibili'] } }] };
    }
    if (batch.includes('专注时段「写周报」进行到')) return say('<眨眼>周报还在等你哦。');
    if (batch.includes('专注时段「写周报」到时间了')) return { calls: [{ name: 'pet_ask', args: { question: '一小时到啦,写到哪了?', options: ['写完了', '还差一点'] } }] };
    if (batch.includes('回到电脑前')) return say('欢迎回来,吃饱了吗?');
    if (batch.includes('连续在电脑前')) return say('坐了好久了,起来伸个懒腰吧,库...');
    if (batch.includes('今天我都干了啥')) return { calls: [{ name: 'cowork_day', args: { date: 'today' } }] };
    if (batch.includes('每天六点提醒我复盘')) return { calls: [{ name: 'alarm_set', args: { at: '18:00', note: '和对方复盘今天:先 cowork_day', daily: true } }, { name: 'pet_say', args: { script: '好,每天六点叫你。' } }] };
    if (batch.includes('把今天的记录删掉')) return { calls: [{ name: 'cowork_forget', args: { date: 'today' } }] };
    return END;
  };
}

interface Wake { at: number; trigger: string; type: string }

describe('a simulated workday through Core', () => {
  const transcript: string[] = [];
  afterAll(() => {
    if (process.env.COWORK_TRANSCRIPT) writeFileSync(process.env.COWORK_TRANSCRIPT, transcript.join('\n'), 'utf8');
  });

  it('wakes Coo for what it should, carries the facts, and acts on its tool calls', async () => {
    const dir = tmp();
    const cal = calendarFile(dir,
      'UID:standup\r\nDTSTART;TZID=Asia/Shanghai:20261019T093000\r\nDTEND;TZID=Asia/Shanghai:20261019T094500\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\nSUMMARY:站会',
      'UID:review\r\nDTSTART;TZID=Asia/Shanghai:20261019T140000\r\nDTEND;TZID=Asia/Shanghai:20261019T150000\r\nSUMMARY:设计评审\r\nLOCATION:Teams',
    );
    const cfg = config({ calendar: { file: cal, remindMinutes: 10, refreshMinutes: 30 } });

    // 前一天晚上的记录
    const desk = new Desk([
      { from: at(21, 0, 18), app: 'Code.exe', title: 'main.ts - PalAIManage' },
      { from: at(23, 40, 18), app: 'Code.exe', title: 'main.ts - PalAIManage', idle: true },
    ]);
    desk.now = at(21, 0, 18);
    const sunday = world(desk, join(dir, 'data'), cfg);
    await sunday.start(new (await import('./helpers/fake-host.ts')).FakeHost());
    await advance(sunday, desk, at(23, 50, 18));
    await sunday.stop();

    // 周一
    desk.stints.push(
      { from: at(9, 0), app: 'OUTLOOK.EXE', title: '收件箱 - Outlook' },
      { from: at(9, 30), app: 'ms-teams.exe', title: '站会 | Microsoft Teams' },
      { from: at(9, 46), app: 'WINWORD.EXE', title: '周报.docx - Word' },
      { from: at(10, 20), app: 'msedge.exe', title: '某视频 - 哔哩哔哩 bilibili - Microsoft Edge' },
      { from: at(10, 26), app: 'WINWORD.EXE', title: '周报.docx - Word' },
      { from: at(11, 0), app: 'Code.exe', title: 'world.ts - coocowork' },
      { from: at(12, 0), app: 'Code.exe', title: 'world.ts - coocowork', idle: true },
      { from: at(13, 10), app: 'Code.exe', title: 'world.ts - coocowork' },
      { from: at(14, 0), app: 'ms-teams.exe', title: '设计评审 | Microsoft Teams' },
      { from: at(15, 0), app: 'Code.exe', title: 'calendar.ts - coocowork' },
    );
    desk.now = at(8, 59);

    const wakes: Wake[] = [];
    let cowork: CoworkWorld | null = null;
    const coworkDef: WorldDefinition<WorldSection> = {
      ...(COWORK as unknown as WorldDefinition<WorldSection>),
      create: (ctx) => {
        const w = world(desk, join(dir, 'data'), ctx.cfg as never);
        const start = w.start.bind(w);
        w.start = (host: WorldHost) => start(new Proxy(host, {
          get(target, key, recv) {
            if (key !== 'pushEvent') return Reflect.get(target, key, recv);
            return (e: Parameters<WorldHost['pushEvent']>[0], opts?: PushOptions) => {
              if (opts?.trigger !== 'piggyback') wakes.push({ at: desk.now, trigger: opts?.trigger ?? '', type: e.type });
              transcript.push(`- \`${hm(TZ, desk.now)}\` **${e.type}** (${opts?.trigger}): ${e.text.replace(/\n/g, ' / ')}`);
              return target.pushEvent(e, opts);
            };
          },
        }));
        cowork = w;
        return w;
      },
    };
    const pet = new PetStub(() => desk.now, (ms) => hm(TZ, ms));
    const batches: string[] = [];
    const model = new ScriptedModel(cooScript(batches));
    const { bot, persona } = await startBot({ worlds: [coworkDef, stubDefinition(pet)], sections: { cowork: cfg }, model, constitution: COO });

    const settle = async () => {
      let n = -1;
      for (let i = 0; i < 100 && n !== model.turns.length; i++) {
        n = model.turns.length;
        await new Promise((r) => setTimeout(r, 120));
      }
    };
    let said = 0;
    const flushLines = () => {
      for (const l of pet.lines.slice(said)) transcript.push(`  - Coo \`${l.tool}\` ${JSON.stringify(l.args)}`);
      said = pet.lines.length;
    };
    const runTo = async (h: number, mi: number) => {
      while (desk.now < at(h, mi)) {
        const before = wakes.length;
        desk.now += 30_000;
        await cowork!.tick();
        if (wakes.length > before) { await settle(); flushLines(); }
      }
    };
    const type = async (text: string) => {
      transcript.push(`- \`${hm(TZ, desk.now)}\` **使用者打字**: ${text}`);
      wakes.push({ at: desk.now, trigger: 'preempt', type: 'pet.message' });
      await pet.type(text);
      await settle();
      flushLines();
    };

    transcript.push('# CooCowork 模拟工作日(2026-10-19 周一)', '', 'Owner: `tests/e2e.test.ts`(`COWORK_TRANSCRIPT=docs/e2e-transcript.md pnpm vitest run tests/e2e.test.ts` 生成)', '', 'Coo 由脚本扮演(`cooScript`),其余是真 Core 与真 CooCowork World。事件(投递方式)与 Coo 的工具调用按模拟时间排列。', '');
    await runTo(9, 49);
    await type('我要写周报,一个小时,别让我刷b站');
    await runTo(17, 44);
    await type('今天我都干了啥');
    await type('以后每天六点提醒我复盘');
    await type('把今天的记录删掉');
    const prefix = persona().prefix;
    await bot.stop();

    transcript.push('', '## 统计', '', `- 叫醒模型的次数:${wakes.length}(${wakes.map((w) => `${hm(TZ, w.at)} ${w.type}`).join('、')})`, `- 模型轮数:${model.turns.length}`, `- Coo 的气泡与动作:${pet.lines.length} 次`);
    transcript.push('', '## 送进上下文的批次', '', ...batches.map((b, i) => `### ${i + 1}\n\n\`\`\`\n${b}\n\`\`\``));
    transcript.push('', '## 前缀里的 CooCowork 段', '', '```', prefix.slice(prefix.indexOf('## cowork')), '```');

    const types = wakes.map((w) => w.type);
    // 专注时段里(10:30)和评审会上(14:40)连续坐满不叫醒
    expect(types).toEqual([
      'cowork.day-start', 'cowork.meeting', 'pet.message', 'cowork.drift', 'cowork.focus-ended', 'cowork.stretch',
      'cowork.back', 'cowork.meeting', 'cowork.stretch', 'cowork.stretch', 'pet.message', 'pet.message', 'pet.message',
    ]);
    expect(batches.find((b) => b.includes('1 小时 30 分钟(13:10 起'))).toContain('日历上此刻是「设计评审」(14:00–15:00)');
    const dayStart = batches.find((b) => b.includes('今天第一次看到使用者'))!;
    expect(dayStart).toContain('前一个有记录的日子(2026-10-18):21:00–23:40');
    expect(dayStart).toContain('09:30–09:45 站会;14:00–15:00 设计评审');
    // 午饭前的离开随回来那批一起到
    const back = batches.find((b) => b.includes('回到电脑前'))!;
    expect(back).toContain('12:00 起没有动键盘和鼠标');
    expect(back).toContain('离开了 1 小时 10 分钟');
    // 专注时段里 Coo 对连续在电脑前保持安静，结束时有统计
    const ended = batches.find((b) => b.includes('到时间了'))!;
    expect(ended).toContain('停在要避开的内容上 6 分钟');
    expect(pet.lines.map((l) => l.tool)).toEqual([
      'pet_say', 'pet_say', 'pet_quiet', 'pet_say', 'pet_say', 'pet_ask', 'pet_say', 'pet_say', 'pet_say', 'pet_quiet',
      'pet_say', 'pet_say', 'pet_say', 'alarm_set', 'pet_say', 'pet_say',
    ]);
    expect(pet.lines.find((l) => String(l.args.script).startsWith('今天主要在'))?.args.script).toMatch(/^今天主要在 Code\.exe 上忙了 \d+ 分钟/);
    expect(existsSync(join(dir, 'data', 'days', '2026-10-19.jsonl'))).toBe(false);
    expect(readFileSync(join(dir, 'data', 'days', '2026-10-18.jsonl'), 'utf8')).toContain('Code.exe');
  }, 120_000);
});
