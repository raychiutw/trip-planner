/**
 * F002 — .github/workflows/lighthouse.yml 結構驗證
 * 確保 Lighthouse CI workflow 存在且包含必要的設定
 */

import fs from 'fs';
import path from 'path';

const workflowPath = path.resolve(__dirname, '../../.github/workflows/lighthouse.yml');

describe('.github/workflows/lighthouse.yml', () => {
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(workflowPath, 'utf-8');
  });

  it('檔案存在', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('使用 treosh/lighthouse-ci-action', () => {
    expect(content).toContain('treosh/lighthouse-ci-action');
  });

  it('on.push.branches 含 master', () => {
    expect(content).toMatch(/push[\s\S]*?branches[\s\S]*?master/);
  });

  it('設定 configPath 指向 lighthouserc.json', () => {
    expect(content).toContain('lighthouserc.json');
  });

  it('啟用 uploadArtifacts（保存 report）', () => {
    expect(content).toContain('uploadArtifacts');
  });

  it('支援 workflow_dispatch（手動觸發）', () => {
    expect(content).toContain('workflow_dispatch');
  });
});
