/**
 * 读这台电脑此刻的前台窗口和距上次键鼠输入的时长。Windows 上经 koffi 调 user32/kernel32;
 * 别的系统或 koffi 加载失败时 `createProbe` 返回 null,World 报「看不到」。
 */

/** 一次采样。`app` 是前台窗口所属进程的可执行文件名(如 `Code.exe`),读不到为空串。 */
export interface Sample {
  app: string;
  title: string;
  /** 距上次键盘或鼠标输入的毫秒数。 */
  idleMs: number;
}

export interface Probe {
  sample(): Sample;
}

export async function createProbe(): Promise<Probe | null> {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = (await import('koffi')).default;
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    const LASTINPUTINFO = koffi.struct('CoworkLastInput', { cbSize: 'uint32_t', dwTime: 'uint32_t' });
    const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()');
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void *hwnd, _Out_ uint16_t *buf, int max)');
    const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)');
    const GetLastInputInfo = user32.func('bool __stdcall GetLastInputInfo(_Inout_ CoworkLastInput *info)');
    const GetTickCount = kernel32.func('uint32_t __stdcall GetTickCount()');
    const OpenProcess = kernel32.func('void * __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)');
    const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *h)');
    const QueryFullProcessImageNameW = kernel32.func('bool __stdcall QueryFullProcessImageNameW(void *h, uint32_t flags, _Out_ uint16_t *buf, _Inout_ uint32_t *size)');
    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    const text = (buf: Uint16Array, n: number) => String.fromCharCode(...buf.subarray(0, Math.max(0, n)));
    const appOf = (hwnd: unknown): string => {
      const pid = [0];
      GetWindowThreadProcessId(hwnd, pid);
      if (!pid[0]) return '';
      const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid[0]);
      if (!h) return '';
      try {
        const buf = new Uint16Array(1024);
        const size = [buf.length];
        if (!QueryFullProcessImageNameW(h, 0, buf, size)) return '';
        const path = text(buf, size[0]!);
        return path.slice(path.lastIndexOf('\\') + 1);
      } finally {
        CloseHandle(h);
      }
    };

    return {
      sample(): Sample {
        const info = { cbSize: koffi.sizeof(LASTINPUTINFO), dwTime: 0 };
        const idleMs = GetLastInputInfo(info) ? (GetTickCount() - info.dwTime) >>> 0 : 0;
        const hwnd = GetForegroundWindow();
        if (!hwnd) return { app: '', title: '', idleMs };
        const buf = new Uint16Array(512);
        const n = GetWindowTextW(hwnd, buf, buf.length);
        return { app: appOf(hwnd), title: text(buf, n), idleMs };
      },
    };
  } catch {
    return null;
  }
}
