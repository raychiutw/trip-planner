// eslint.config.mjs — 最小 ESLint：只開 react-hooks 的兩條規則。
//
// 動機：repo 原本完全沒有 ESLint，所以 hook 依賴陣列無人把關 —— v2.54.4 的
// customCategory bug（自訂 POI 一律存成景點）就是 useCallback / useMemo deps 漏列
// 卻無聲上線。這份 config 精準鎖定那個 bug class，**不是**全面採用 lint：
//   - react-hooks/rules-of-hooks（error）— hook 呼叫順序 / 條件式 hook
//   - react-hooks/exhaustive-deps（error）— 依賴陣列漏列 reactive 值
// 刻意不開 react-hooks v7 的 React Compiler 系列（immutability / purity /
// set-state-in-effect…）與任何 style 規則，避免一次掃出大量無關 noise。
//
// 範圍只含 src/（前端 React）。functions/ 是 Pages Functions（後端無 React）、
// tests/ 另計。CommonJS 專案故用 .mjs 以乾淨 import ESM plugin。
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2023 },
    },
    // 註冊 @typescript-eslint plugin 但**不開任何規則** — 只為了讓既有程式碼裡
    // 殘留的 `// eslint-disable @typescript-eslint/...` 註解能解析到 rule 名稱，
    // 否則 ESLint 會報 "Definition for rule ... was not found"。
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tseslint.plugin },
    // 本 config 刻意只跑 react-hooks；對「不在此最小規則集內的規則」的 disable 註解
    // （no-console / no-control-regex 等殘留）不要報 unused-directive noise。
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
