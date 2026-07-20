/// <reference types="vite/client" />

/* vite.config.ts 的 define 注入。少了這兩行 tsc 會報 cannot find name。 */
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
