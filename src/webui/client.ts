/**
 * 「常用设置」面板:现在的状态、日历接入(订阅地址、本机文件、提前提醒)、什么时候叫 Coo(主动程度、
 * 连续在电脑前、安静时段)、隐私(窗口标题、不记录标题的程序、保留天数、删除记录)。
 *
 * 每项改动当场经 `ctx.setConfig` 写进 `worlds.cowork`,不另设保存按钮;订阅地址是密钥,经 World 的
 * `saveCalendarUrl` 写进部署 `.env`,页面只拿得到打码后的样子。状态每 15 秒刷新一次。
 */
import type { WebUiClientBundle, WebUiPanel, WebUiPanelContext } from 'cortico/web/shared/client-panel.ts';
import type { CalendarProbe, PanelState } from '../panel-state.ts';
import { hours, panelText } from './text.ts';
import './style.css';

const GROUP = 'world:cowork';
const K = 'worlds.cowork';
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const looksLikeUrl = (s: string) => /^(https?|webcal):\/\/\S+\.\S+/i.test(s.trim());

/** 预设档位;当前值不在里面时补进去,免得显示成一颗都没选。 */
function choices(preset: number[], current: number): number[] {
  return preset.includes(current) ? preset : [...preset, current].sort((a, b) => a - b);
}

const setupPanel: WebUiPanel = {
  mount(ctx: WebUiPanelContext) {
    const { ui } = ctx;
    const t = panelText(ctx.language);
    let state: PanelState | null = null;

    const load = async () => {
      try { render(await ctx.invoke<PanelState>('state')); } catch (err) { ui.toast(errText(err), 'bad'); }
    };
    const set = async (values: Record<string, string | number | boolean>) => {
      try {
        await ctx.setConfig(GROUP, values);
        ui.toast(t.saved);
        await load();
      } catch (err) {
        ui.toast(errText(err), 'bad');
        await load();
      }
    };
    const call = async (method: string, args: unknown[] = []) => {
      try { render(await ctx.invoke<PanelState>(method, args)); return true; } catch (err) { ui.toast(errText(err), 'bad'); return false; }
    };

    // ------------------------------------------------------------ 现在
    const now = ui.sheet({ title: t.nowTitle });
    const todayStat = ui.stat({ k: t.today, v: '–' });
    const focusStat = ui.stat({ k: t.focus, v: '–' });
    now.body.append(ui.statgrid([]));
    now.body.firstElementChild!.append(todayStat, focusStat);
    const reading = ui.checkbox(t.reading, { onChange: (on) => void set({ [`${K}.activity.enabled`]: on }) });
    const readingNote = ui.h('div', 'cw-note');
    now.body.append(reading.el, readingNote);

    // ------------------------------------------------------------ 日历
    const cal = ui.sheet({ title: t.calTitle, desc: t.calDesc });

    // 订阅地址:已保存时一行打码地址加更换、移除;没有或在更换时是输入框
    const urlBox = ui.h('div', 'cw-block');
    let editing = false;
    const urlInput = ui.input({ placeholder: t.urlPlaceholder, cls: 'mono cw-url', onInput: () => scheduleTest(), onCommit: () => void saveUrl() });
    const testBtn = ui.button(t.test, { size: 'sm', onClick: () => void runTest() });
    const saveBtn = ui.button(t.save, { size: 'sm', variant: 'primary', onClick: () => void saveUrl() });
    const cancelBtn = ui.button(t.cancel, { size: 'sm', onClick: () => { editing = false; urlInput.value = ''; testOut.replaceChildren(); paint(); } });
    const testOut = ui.h('div', 'cw-test');
    const savedRow = ui.h('div', 'cw-row');
    const savedText = ui.h('span', 'mono cw-masked');
    const changeBtn = ui.button(t.change, { size: 'sm', onClick: () => { editing = true; paint(); urlInput.focus(); } });
    const removeBtn = ui.button(t.remove, { size: 'sm', onClick: () => void removeUrl() });
    savedRow.append(ui.pill(t.urlSaved, 'on'), savedText, changeBtn, removeBtn);
    const editRow = ui.h('div', 'cw-row');
    editRow.append(urlInput, testBtn, saveBtn, cancelBtn);

    const help = ui.h('details', 'cw-help');
    const helpSummary = ui.h('summary', null, t.help);
    const helpList = ui.h('ul');
    for (const line of [t.helpGoogle, t.helpOutlook, t.helpICloud]) helpList.append(ui.h('li', null, line));
    help.append(helpSummary, helpList, ui.h('div', 'cw-note', t.helpSecret));
    urlBox.append(savedRow, editRow, testOut, help);
    cal.body.append(ui.field(t.urlLabel, urlBox));

    let testTimer: { dispose(): void } | null = null;
    let testSeq = 0;
    function scheduleTest() {
      testTimer?.dispose();
      testOut.replaceChildren();
      if (looksLikeUrl(urlInput.value)) testTimer = ctx.timeout(() => void runTest(), 700);
    }
    async function runTest() {
      const seq = ++testSeq;
      testOut.replaceChildren(ui.h('span', 'cw-note', t.testing));
      let res: CalendarProbe;
      try { res = await ctx.invoke<CalendarProbe>('testCalendar', [urlInput.value]); } catch (err) { res = { ok: false, error: errText(err) }; }
      if (seq !== testSeq) return;
      testOut.replaceChildren();
      if (!res.ok) { testOut.append(ui.msgline(res.error, true)); return; }
      testOut.append(ui.msgline(t.testOk(res.count)));
      testOut.append(res.upcoming.length ? upcomingList(res.upcoming, t.testNext) : ui.h('div', 'cw-note', t.testNone));
    }
    async function saveUrl() {
      if (!urlInput.value.trim()) return;
      const off = ui.disable(saveBtn, testBtn, urlInput);
      const ok = await call('saveCalendarUrl', [urlInput.value]);
      off.dispose();
      if (!ok) return;
      ui.toast(t.saved);
      editing = false;
      urlInput.value = '';
      testOut.replaceChildren();
      paint();
    }
    async function removeUrl() {
      if (!(await ui.confirm({ title: t.urlRemoveConfirm, body: t.urlRemoveBody, danger: true }))) return;
      if (await call('removeCalendarUrl')) ui.toast(t.deleted);
    }

    // 本机文件
    const fileRow = ui.h('div', 'cw-row');
    const fileText = ui.h('span', 'mono cw-path');
    const pickBtn = ui.button(t.pickFile, { size: 'sm', onClick: () => void pickFile() });
    const clearFileBtn = ui.button(t.remove, { size: 'sm', onClick: () => void set({ [`${K}.calendar.file`]: '' }) });
    fileRow.append(fileText, pickBtn, clearFileBtn);
    cal.body.append(ui.field(t.fileLabel, fileRow));
    async function pickFile() {
      const path = await ctx.pickPath({ kind: 'file', extensions: ['.ics'], currentPath: state?.calendar.file || undefined });
      if (path) await set({ [`${K}.calendar.file`]: path });
    }

    // 接下来的日程与提前提醒
    const remindHost = ui.h('div');
    cal.body.append(ui.field(t.remind, remindHost));
    const upcomingHost = ui.h('div', 'cw-block');
    const refreshRow = ui.h('div', 'cw-row');
    const readAt = ui.h('span', 'cw-note');
    refreshRow.append(ui.button(t.refresh, { size: 'sm', onClick: () => void call('refreshCalendar') }), readAt);
    cal.body.append(ui.field(t.upcoming, upcomingHost), refreshRow);

    function upcomingList(items: PanelState['calendar']['upcoming'], head?: string) {
      const box = ui.h('div', 'cw-upcoming');
      if (head) box.append(ui.h('div', 'cw-note', head));
      for (const it of items) {
        const row = ui.h('div', 'cw-event');
        row.append(ui.h('span', 'mono cw-when', it.when), ui.h('span', null, it.summary || '–'));
        box.append(row);
      }
      return box;
    }

    // ------------------------------------------------------------ 什么时候叫 Coo
    const wake = ui.sheet({ title: t.wakeTitle });
    const proDesc = ui.h('div', 'cw-note');
    const pro = ui.segmented([{ value: 'normal', label: t.normal }, { value: 'low', label: t.low }], {
      onSelect: (v) => { proDesc.textContent = v === 'low' ? t.lowDesc : t.normalDesc(state?.settings.backWakeMinutes ?? 20); void set({ [`${K}.proactivity`]: v }); },
    });
    wake.body.append(ui.field(t.proactivity, pro.el), proDesc);
    const stretchHost = ui.h('div');
    wake.body.append(ui.field(t.stretch, stretchHost));

    const quietOn = ui.checkbox(t.quietOn, {
      onChange: (on) => void set(on ? { [`${K}.quietHours.from`]: '22:30', [`${K}.quietHours.to`]: '08:00' } : { [`${K}.quietHours.from`]: '', [`${K}.quietHours.to`]: '' }),
    });
    const timeInput = (key: string) => {
      const el = ui.input({ onChange: (v) => { if (v) void set({ [key]: v }); } });
      el.type = 'time';
      el.classList.add('cw-time');
      return el;
    };
    const quietFrom = timeInput(`${K}.quietHours.from`);
    const quietTo = timeInput(`${K}.quietHours.to`);
    const quietTimes = ui.h('div', 'cw-row');
    quietTimes.append(ui.h('span', null, t.from), quietFrom, ui.h('span', null, t.to), quietTo);
    const quietBox = ui.h('div', 'cw-block');
    quietBox.append(quietOn.el, quietTimes, ui.h('div', 'cw-note', t.quietDesc));
    wake.body.append(ui.field(t.quiet, quietBox));

    // ------------------------------------------------------------ 隐私
    const priv = ui.sheet({ title: t.privacyTitle, desc: t.privacyDesc });
    const titles = ui.checkbox(t.titles, { onChange: (on) => void set({ [`${K}.activity.titles`]: on }) });
    priv.body.append(titles.el, ui.h('div', 'cw-note', t.titlesDesc));

    const appsBox = ui.h('div', 'cw-block');
    const appChips = ui.h('div', 'cw-chips');
    const appInput = ui.input({ placeholder: t.appPlaceholder, cls: 'cw-app-input', onCommit: (v) => void addApp(v) });
    const addRow = ui.h('div', 'cw-row');
    addRow.append(appInput, ui.button(t.addApp, { size: 'sm', onClick: () => void addApp(appInput.value) }));
    const seenRow = ui.h('div', 'cw-row cw-seen');
    appsBox.append(appChips, addRow, seenRow);
    priv.body.append(ui.field(t.privateApps, appsBox));
    const writeApps = (apps: string[]) => set({ [`${K}.activity.privateApps`]: apps.join(', ') });
    async function addApp(raw: string) {
      const app = raw.trim();
      if (!app || !state) return;
      const apps = state.settings.privateApps;
      if (!apps.some((a) => a.toLowerCase() === app.toLowerCase())) await writeApps([...apps, app]);
      appInput.value = '';
    }

    const keepHost = ui.h('div');
    priv.body.append(ui.field(t.keep, keepHost));
    const recordsText = ui.h('span', 'cw-note');
    const forgetRow = ui.h('div', 'cw-row');
    forgetRow.append(recordsText,
      ui.button(t.forgetToday, { size: 'sm', onClick: () => void forget('today') }),
      ui.button(t.forgetAll, { size: 'sm', variant: 'danger', onClick: () => void forget('all') }));
    priv.body.append(forgetRow);
    async function forget(which: 'today' | 'all') {
      const ok = await ui.confirm(which === 'all' ? { title: t.forgetAllConfirm, body: t.forgetAllBody, danger: true } : { title: t.forgetTodayConfirm, danger: true });
      if (ok && await call('forget', [which])) ui.toast(t.deleted);
    }

    ctx.root.append(now.el, cal.el, wake.el, priv.el);

    // ------------------------------------------------------------ 渲染
    let remindSeg: ReturnType<typeof ui.segmented> | null = null;
    let stretchSeg: ReturnType<typeof ui.segmented> | null = null;
    let keepSeg: ReturnType<typeof ui.segmented> | null = null;
    let segKeys = '';
    let listKeys = '';

    function render(next: PanelState) {
      state = next;
      paint();
    }

    function paint() {
      const s = state;
      if (!s) return;
      todayStat.querySelector('.v')!.textContent = hours(s.activity.todayMin, ctx.language);
      focusStat.querySelector('.v')!.textContent = s.focus ? t.focusLeft(s.focus.goal, s.focus.leftMin) : t.focusNone;
      reading.setChecked(s.activity.enabled);
      reading.input.disabled = !s.activity.available;
      readingNote.textContent = !s.activity.available ? t.readingMissing : s.activity.enabled ? (s.activity.error ?? '') : t.readingOff;

      const hasUrl = s.calendar.url !== null;
      savedRow.hidden = !hasUrl || editing;
      editRow.hidden = hasUrl && !editing;
      cancelBtn.hidden = !hasUrl;
      savedText.textContent = s.calendar.url ?? '';
      fileText.textContent = s.calendar.file || t.fileNone;
      clearFileBtn.hidden = !s.calendar.file;

      upcomingHost.replaceChildren();
      if (!hasUrl && !s.calendar.file) upcomingHost.append(ui.h('div', 'cw-note', t.noCalendar));
      else {
        if (s.calendar.error) upcomingHost.append(ui.msgline(s.calendar.error, true));
        upcomingHost.append(s.calendar.upcoming.length ? upcomingList(s.calendar.upcoming) : ui.h('div', 'cw-note', t.upcomingNone));
        for (const n of s.calendar.notes) upcomingHost.append(ui.h('div', 'cw-note', n));
      }
      refreshRow.hidden = !hasUrl && !s.calendar.file;
      readAt.textContent = s.calendar.readAt ? t.readAt(s.calendar.readAt) : '';

      // 档位里补进当前值后选项可能变,变了才重建
      const remind = choices([0, 5, 10, 15, 30], s.settings.remindMinutes);
      const stretch = choices([0, 60, 90, 120], s.settings.stretchMinutes);
      const keep = choices([7, 14, 30], s.settings.keepDays);
      const keys = JSON.stringify([remind, stretch, keep]);
      if (keys !== segKeys) {
        segKeys = keys;
        remindSeg = ui.segmented(remind.map((n) => ({ value: String(n), label: n ? t.minutes(n) : t.remindOff })), { onSelect: (v) => void set({ [`${K}.calendar.remindMinutes`]: Number(v) }) });
        stretchSeg = ui.segmented(stretch.map((n) => ({ value: String(n), label: n ? t.minutes(n) : t.stretchOff })), { onSelect: (v) => void set({ [`${K}.activity.stretchMinutes`]: Number(v) }) });
        keepSeg = ui.segmented(keep.map((n) => ({ value: String(n), label: t.days(n) })), { onSelect: (v) => void set({ [`${K}.activity.keepDays`]: Number(v) }) });
        remindHost.replaceChildren(remindSeg.el);
        stretchHost.replaceChildren(stretchSeg.el);
        keepHost.replaceChildren(keepSeg.el);
      }
      remindSeg!.setValue(String(s.settings.remindMinutes));
      stretchSeg!.setValue(String(s.settings.stretchMinutes));
      keepSeg!.setValue(String(s.settings.keepDays));

      pro.setValue(s.settings.proactivity);
      proDesc.textContent = s.settings.proactivity === 'low' ? t.lowDesc : t.normalDesc(s.settings.backWakeMinutes);
      const quiet = !!(s.settings.quietFrom && s.settings.quietTo);
      quietOn.setChecked(quiet);
      quietTimes.hidden = !quiet;
      if (document.activeElement !== quietFrom) quietFrom.value = s.settings.quietFrom;
      if (document.activeElement !== quietTo) quietTo.value = s.settings.quietTo;

      titles.setChecked(s.settings.titles);
      recordsText.textContent = t.records(s.records.days, s.records.kb);
      // 名单没变就不重建,免得轮询刷新时正要点的按钮被换掉
      const lists = JSON.stringify([s.settings.privateApps, s.activity.seenApps]);
      if (lists === listKeys) return;
      listKeys = lists;
      appChips.replaceChildren(...s.settings.privateApps.map((app) => {
        const chip = ui.h('span', 'cw-chip');
        const x = ui.h('button', 'cw-chip-x', '×');
        x.type = 'button';
        x.title = t.removeApp(app);
        x.addEventListener('click', () => void writeApps(s.settings.privateApps.filter((a) => a !== app)), { signal: ctx.signal });
        chip.append(ui.h('span', 'mono', app), x);
        return chip;
      }));
      seenRow.replaceChildren();
      if (s.activity.seenApps.length) {
        seenRow.append(ui.h('span', 'cw-note', t.seenApps));
        for (const app of s.activity.seenApps) {
          const b = ui.button(`+ ${app}`, { size: 'sm', onClick: () => void addApp(app) });
          seenRow.append(b);
        }
      }
    }

    void load();
    ctx.interval(() => { if (!editing) void load(); }, 15_000);
  },
};

const bundle: WebUiClientBundle = { panels: { setup: setupPanel } };
export default bundle;
