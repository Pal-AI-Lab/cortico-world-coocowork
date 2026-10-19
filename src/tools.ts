import type { ToolDef } from 'cortico/core/types.ts';

/** 工具声明(不含 handler);`describe.tools` 与 `tools()` 都从这里取。 */
export const COWORK_TOOL_DECLS: ReadonlyArray<Omit<ToolDef, 'handler'>> = [
  {
    name: 'cowork_now',
    description: 'What is true right now: the foreground program and window title, how long since the last keyboard or mouse input, how long the person has been at the computer, the running focus session, and the next calendar events.',
    tags: ['read'],
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'cowork_focus_start',
    description: 'Start a focus session with the person: they work on one thing for a set time while you keep them company. When it ends you get an event with what the computer showed during it. If they name programs or sites to stay away from, pass them as avoid; you are told when the foreground stays on one of them. Start one only when the person has said what they are about to do.',
    tags: ['write'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        goal: { type: 'string', maxLength: 120, description: 'What the person is working on, in their words.' },
        minutes: { type: 'integer', minimum: 5, maximum: 240, description: 'Length of the session.' },
        avoid: {
          type: 'array', maxItems: 10, items: { type: 'string', maxLength: 40 },
          description: 'Program names or words in window titles the person wants to stay away from, such as "bilibili" or "steam.exe". Matched case-insensitively.',
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
    description: 'The record of one day: when the person was first and last at the computer, time at it, breaks, the programs and window titles used most, and focus sessions. Use it to look back on a day with the person or to remember what they were working on.',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, today or yesterday. Default today.' } },
    },
  },
  {
    name: 'cowork_calendar',
    description: 'Calendar events from the person\'s calendar, in their local time.',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { days: { type: 'integer', minimum: 1, maximum: 14, description: 'How many days from today. Default 1.' } },
    },
  },
  {
    name: 'cowork_forget',
    description: 'Delete activity records for good: one day\'s, or all of them. Use it when the person asks you to forget what their computer showed. It does not touch your own notes.',
    tags: ['write'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { date: { type: 'string', description: 'YYYY-MM-DD, today or all.' } },
      required: ['date'],
    },
  },
];
