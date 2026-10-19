import type { ToolDef } from 'cortico/core/types.ts';

/** 工具声明(不含 handler);`describe.tools` 与 `tools()` 都从这里取。 */
export const COWORK_TOOL_DECLS: ReadonlyArray<Omit<ToolDef, 'handler'>> = [
  {
    name: 'cowork_now',
    description: 'What is true right now: foreground program and window title, time since last input, time at the computer, active focus session, and upcoming calendar events.',
    tags: ['read'],
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'cowork_focus_start',
    description: 'Start a focus session to keep the person company while they work for a set time. Call only after the person states what they will work on. An event arrives if the foreground stays on items in avoid. Session statistics arrive in cowork.focus-ended when it finishes.',
    tags: ['write'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        goal: { type: 'string', maxLength: 120, description: 'What the person is working on, in their words.' },
        minutes: { type: 'integer', minimum: 5, maximum: 240, description: 'Length of the session in minutes.' },
        avoid: {
          type: 'array', maxItems: 10, items: { type: 'string', maxLength: 40 },
          description: 'Program names or words in window titles to stay away from, such as "bilibili" or "steam.exe". Case-insensitive.',
        },
      },
      required: ['goal', 'minutes'],
    },
  },
  {
    name: 'cowork_focus_stop',
    description: 'End the running focus session early; the receipt has what the computer showed during it.',
    tags: ['write'],
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'cowork_day',
    description: 'Activity record of one day: first and last presence at the computer, active time, breaks, top programs and window titles, and focus sessions. Use it to review a day or recall what the person worked on.',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, today, or yesterday. Default today.' } },
    },
  },
  {
    name: 'cowork_calendar',
    description: 'Events on the person\'s calendar from the start of today, in their local time.',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { days: { type: 'integer', minimum: 1, maximum: 14, description: 'How many days to look ahead from today. Default 1.' } },
    },
  },
  {
    name: 'cowork_forget',
    description: 'Permanently delete computer activity records for one day or all days. Does not modify your notes.',
    tags: ['write'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, today, or all.' } },
      required: ['date'],
    },
  },
];
