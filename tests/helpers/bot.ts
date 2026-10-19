/**
 * 经 Cortico Core 端到端跑 World 的 bot:真 Core、真事件库、真工具派发，只有模型是脚本。脚本看得到
 * Core 发出的上下文，用工具调用或文字作答。写法同 Coopanion desktop-pet 测试的 harness。
 *
 * `petWorld` 是桌宠 World 的替身：只有 `pet_say`、`pet_ask`、`pet_quiet` 和 `coopanion` World 的 `alarm_set`,
 * 记下 Coo 说的话;`type()` 推一条使用者打字的事件。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBot, type Bot, type BotDefinition } from 'cortico/bot.ts';
import { CORE_DEFAULTS, type LoadedConfig } from 'cortico/core/config.ts';
import type { Generation, GenerateOptions, ProviderAttempt, ResponseClient } from 'cortico/core/generation.ts';
import type { BlobStore, CoreApi, CoreConfig, Persona, PrefixSegment, SessionDecl, SystemPrefixContext, ToolDef, World, WorldHost } from 'cortico/core/types.ts';
import { createResponse, type Request } from 'cortico/protocol/open-responses/index.ts';
import { withWorlds, type WorldDefinition, type WorldSection } from 'cortico/world.ts';

export type Step = { calls: Array<{ name: string; args?: Record<string, unknown> }> } | { text: string };

export interface Turn {
  n: number;
  records: Array<{ item: Record<string, unknown> }>;
  tools: string[];
}

let seq = 0;

export class ScriptedModel implements ResponseClient {
  readonly turns: Turn[] = [];
  constructor(private readonly script: (turn: Turn) => Step) {}

  async respond(request: Request, options: GenerateOptions = {}): Promise<Generation> {
    const turn: Turn = {
      n: this.turns.length,
      records: (options.context ?? []) as unknown as Turn['records'],
      tools: ((request.tools ?? []) as Array<{ name?: string }>).map((t) => t.name ?? ''),
    };
    this.turns.push(turn);
    const step = this.script(turn);
    const response = createResponse(`resp_${++seq}`, request);
    response.status = 'completed';
    response.output = ('text' in step
      ? [{ type: 'message', id: `msg_${seq}`, role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: step.text, annotations: [] }] }]
      : step.calls.map((c, i) => ({ type: 'function_call', id: `fc_${seq}_${i}`, call_id: `call_${seq}_${i}`, name: c.name, arguments: JSON.stringify(c.args ?? {}), status: 'completed' }))) as never;
    const origin = { instance: 'scripted', module: 'scripted', model: 'scripted', compatibilityDomain: 'scripted' };
    const attempt: ProviderAttempt = {
      id: `att_${seq}`, generationId: response.id, ordinal: 0, origin, startedAt: new Date().toISOString(), elapsedMs: 0,
      requestId: null, responseId: response.id, outcome: 'completed', status: 200, serviceTier: null, charges: [],
      meters: { input: null, output: null, total: null, cachedInput: null, uncachedInput: null, reasoning: null, native: null },
    };
    return { response, origin, attempts: [attempt] } as Generation;
  }
}

class MemoryBlobs implements BlobStore {
  private readonly map = new Map<string, { bytes: Uint8Array; mime: string }>();
  put(name: string, bytes: Uint8Array, mime: string): string {
    const handle = `mem:blobs/${name}`;
    this.map.set(handle, { bytes, mime });
    return handle;
  }
  get(handle: string) { return this.map.get(handle) ?? null; }
  list() { return [...this.map].map(([handle, b]) => ({ handle, mime: b.mime, size: b.bytes.length })); }
}

/** 单 session:前缀是自述加各 World 的环境提示词，工具是 World 工具加 end_turn。 */
class TestPersona implements Persona {
  readonly memoryDir: string;
  readonly blobs = new MemoryBlobs();
  prefix = '';
  constructor(memoryDir: string, private readonly worlds: readonly World[], private readonly constitution: string) { this.memoryDir = memoryDir; }
  attach(_core: CoreApi): void {}
  async systemSegments(ctx: SystemPrefixContext): Promise<PrefixSegment[]> {
    this.prefix = [this.constitution, ...ctx.worlds.map((w) => `## ${w.id}\n${w.envPrompt}`)].join('\n\n');
    return [{ title: 'PREFIX', text: this.prefix }];
  }
  declareSessions(): SessionDecl[] {
    const endTurn: ToolDef = {
      name: 'end_turn', description: 'End this turn.', tags: ['flow'], barrierAfter: true, endsTurn: true,
      parameters: { type: 'object', properties: {}, required: [] }, handler: async () => '[turn ended]',
    };
    return [{ id: 'main', label: 'main', rounds: () => ({ soft: 20, hard: 40 }), persistent: true, receivesEvents: true, tools: () => [...this.worlds.flatMap((w) => w.tools()), endTurn] }];
  }
  ownToolNames(): string[] { return ['end_turn']; }
}

export interface PetLine { tool: string; args: Record<string, unknown> }

export class PetStub implements World {
  readonly id = 'pet';
  readonly lines: PetLine[] = [];
  private host: WorldHost | null = null;
  constructor(private readonly clock: () => number, private readonly hm: (ms: number) => string) {}
  envPromptVars() { return {}; }
  tools(): ToolDef[] {
    const record = (tool: string, receipt: string): ToolDef['handler'] => async (args) => { this.lines.push({ tool, args }); return receipt; };
    const obj = (props: Record<string, unknown>) => ({ type: 'object' as const, properties: props });
    return [
      { name: 'pet_say', description: 'Say a line in the bubble.', tags: ['speak'], parameters: obj({ script: { type: 'string' } }), handler: record('pet_say', 'Shown.') },
      { name: 'pet_ask', description: 'Ask with options.', tags: ['speak'], parameters: obj({ question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }), handler: record('pet_ask', 'Asked.') },
      { name: 'pet_quiet', description: 'Be quiet for a while.', tags: ['act'], parameters: obj({ minutes: { type: 'number' } }), handler: record('pet_quiet', 'Quiet.') },
      { name: 'alarm_set', description: 'Set an alarm.', tags: ['write'], parameters: obj({ at: { type: 'string' }, note: { type: 'string' }, daily: { type: 'boolean' } }), handler: record('alarm_set', 'Set a1.') },
    ];
  }
  async start(host: WorldHost) { this.host = host; }
  async stop() {}
  /** 使用者在桌宠上打字。 */
  async type(text: string): Promise<void> {
    const now = this.clock();
    await this.host!.pushEvent({ type: 'pet.message', source: 'pet', senderKey: 'pet', ts: new Date(now).toISOString(), text: `[${this.hm(now)}] [typed] 使用者:${text}` }, { trigger: 'preempt' });
  }
}

export function stubDefinition(stub: PetStub): WorldDefinition<WorldSection> {
  return { id: 'pet', label: 'pet', defaults: () => ({ enabled: false }), create: () => stub };
}

export async function startBot(opts: {
  worlds: WorldDefinition<WorldSection>[];
  sections?: Record<string, unknown>;
  model: ScriptedModel;
  constitution: string;
}): Promise<{ bot: Bot<CoreConfig>; persona: () => TestPersona }> {
  const root = mkdtempSync(join(tmpdir(), 'cowork-e2e-'));
  let persona: TestPersona | null = null;
  const base: BotDefinition<CoreConfig> = {
    id: 'e2e',
    declares: opts.worlds.map((w) => w.id),
    defaults: () => ({
      ...CORE_DEFAULTS,
      displayName: 'e2e',
      providers: { scripted: { kind: 'openai-responses-compat', baseUrl: 'https://model.test', spec: { model: 'scripted', thinking: false }, multimodal: true } },
      activeProvider: 'scripted',
      paths: { memory: 'memory', data: 'data' },
      web: { port: 0, theme: 'mint' },
    } as CoreConfig),
    build: (loaded, worlds) => {
      persona = new TestPersona(loaded.memoryDir, worlds, opts.constitution);
      return { persona, llm: opts.model, console: { enabled: false } };
    },
  };
  const definition = withWorlds(base, opts.worlds);
  const config = definition.defaults() as CoreConfig & { worlds: Record<string, Record<string, unknown>> };
  for (const [id, patch] of Object.entries(opts.sections ?? {})) Object.assign(config.worlds[id]!, patch);
  const loaded: LoadedConfig<CoreConfig> = {
    config,
    secret: (name) => (name === 'CORTICO_WEB_PASSWORD' ? '' : 'fake-key'),
    rootDir: root,
    memoryDir: join(root, 'memory'),
    dataDir: join(root, 'data'),
  };
  const bot = createBot(loaded, definition);
  await bot.start();
  return { bot, persona: () => persona! };
}
