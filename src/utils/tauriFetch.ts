import { fetch as tauriFetchFn } from '@tauri-apps/plugin-http';

const isTauri = '__TAURI_INTERNALS__' in window;

/**
 * 跨环境 fetch：Tauri 环境使用插件（绕过 CORS/ATS），浏览器环境使用原生 fetch
 */
export const appFetch: typeof globalThis.fetch = isTauri ? tauriFetchFn : globalThis.fetch;
