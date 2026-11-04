/**
 * web 圖示與 PWA 外觀對齊 App icon（#1573，對應 App 票 trip-planner.flutter#548、父 spec #554）。
 *
 * 守門：所有圖示都是品牌棕底（#8A6038）+ 米白圖案、尺寸正確、manifest 與 index.html 的顏色欄位一致，
 * 沒有珊瑚／赤陶殘留，重複的 icon 檔不再出現。圖是用 `scripts/generate-app-icons.mjs` 產生。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const png = (p: string) => PNG.sync.read(readFileSync(path.join(root, p)));
const px = (img: PNG, x: number, y: number) => {
  const i = (img.width * y + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
};
const BROWN = { r: 0x8a, g: 0x60, b: 0x38 };
const CREAM = { r: 0xff, g: 0xfb, b: 0xf5 };
const near = (c: { r: number; g: number; b: number }, t: typeof BROWN, tol = 3) =>
  Math.abs(c.r - t.r) <= tol && Math.abs(c.g - t.g) <= tol && Math.abs(c.b - t.b) <= tol;
const hasColor = (img: PNG, t: typeof BROWN) => {
  for (let i = 0; i < img.data.length; i += 4)
    if (img.data[i + 3] === 255 && near({ r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] }, t, 2)) return true;
  return false;
};

const SIZED: Array<[string, number]> = [
  ['images/favicon-16x16.png', 16],
  ['images/favicon-32x32.png', 32],
  ['images/apple-touch-icon.png', 180],
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/icon-192-maskable.png', 192],
  ['public/icons/icon-512-maskable.png', 512],
];

describe('圖示檔是 App icon（品牌棕底 + 米白圖案）', () => {
  it.each(SIZED)('%s 為 %ipx 正方形，含品牌棕與米白兩色', (file, size) => {
    const img = png(file);
    expect([img.width, img.height]).toEqual([size, size]);
    expect(hasColor(img, BROWN), '缺品牌棕 #8A6038').toBe(true);
    expect(hasColor(img, CREAM), '缺米白 #FFFBF5 圖案').toBe(true);
  });

  it.each([
    'images/apple-touch-icon.png',
    'public/icons/icon-192.png',
    'public/icons/icon-512.png',
    'public/icons/icon-192-maskable.png',
    'public/icons/icon-512-maskable.png',
  ])('%s 滿版不透明，四角是品牌棕（OS 自行裁圓角／遮罩）', (file) => {
    const img = png(file);
    for (const [x, y] of [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]]) {
      const c = px(img, x, y);
      expect(c.a).toBe(255);
      expect(near(c, BROWN)).toBe(true);
    }
  });

  it('maskable 的圖案縮在安全圓內：距中心 > 40% 邊長的像素全是底色', () => {
    const img = png('public/icons/icon-512-maskable.png');
    const cx = (img.width - 1) / 2;
    for (let y = 0; y < img.height; y += 2)
      for (let x = 0; x < img.width; x += 2)
        if (Math.hypot(x - cx, y - cx) > img.width * 0.4) expect(near(px(img, x, y), BROWN, 8)).toBe(true);
  });

  it('favicon.svg 是品牌棕 + 米白，沒有舊的三條波紋或赤陶', () => {
    const svg = read('images/favicon.svg');
    expect(svg).toMatch(/#8A6038/i);
    expect(svg).toMatch(/#FFFBF5/i);
    expect(svg).not.toMatch(/C4704F|stroke-linecap|<circle/i);
  });

  it('16px 版是另外設計的簡化版（不是縮圖）：來源檔與 App icon 不同且指針較小', () => {
    expect(read('scripts/app-icon/favicon-16.svg')).not.toBe(read('scripts/app-icon/app-icon.svg'));
    expect(readFileSync(path.join(root, 'images/favicon-16x16.png')).equals(readFileSync(path.join(root, 'images/favicon-32x32.png')))).toBe(false);
  });
});

describe('manifest 與 index.html 顏色欄位', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  const html = read('index.html');

  it('theme_color 與 theme-color meta 都是 #8A6038', () => {
    expect(manifest.theme_color).toBe('#8A6038');
    expect(html).toMatch(/<meta name="theme-color" content="#8A6038"/);
  });

  it('background_color 與頁面底色一致（tokens.css --color-background）', () => {
    const bg = read('css/tokens.css').match(/--color-background:\s*(#[0-9A-Fa-f]{6})/)![1];
    expect(manifest.background_color.toLowerCase()).toBe(bg.toLowerCase());
  });

  it('沒有珊瑚／赤陶色碼殘留（manifest、index.html、圖示 SVG 來源）', () => {
    const files = [read('public/manifest.json'), html, read('images/favicon.svg'), ...['app-icon', 'app-icon-maskable', 'favicon-16'].map((n) => read(`scripts/app-icon/${n}.svg`))];
    for (const f of files) expect(f).not.toMatch(/F47B5E|C4704F|FBF3E8/i);
  });

  it('manifest 的每個 icon 檔存在且尺寸與宣告一致', () => {
    for (const i of manifest.icons) {
      const file = path.join('public', i.src);
      expect(existsSync(path.join(root, file)), file).toBe(true);
      const img = png(file);
      expect(`${img.width}x${img.height}`).toBe(i.sizes);
    }
  });

  it('index.html 引用的 icon 檔都存在', () => {
    const refs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(4);
    for (const r of refs) expect(existsSync(path.join(root, r)), r).toBe(true);
    expect(html).toMatch(/sizes="16x16"/);
  });

  it('重複的 images/icon-192.png、icon-512.png 已清除（只留 public/icons）', () => {
    expect(existsSync(path.join(root, 'images/icon-192.png'))).toBe(false);
    expect(existsSync(path.join(root, 'images/icon-512.png'))).toBe(false);
  });
});

describe('圖示與 App 母圖同源（#1573 驗收：引用 #548 的素材，不另畫）', () => {
  const MOTHER = 'scripts/app-icon/source/flutter-app-icon-1024.png';

  it('產生腳本以 App 母圖為輸入', () => {
    expect(existsSync(path.join(root, MOTHER))).toBe(true);
    expect(read('scripts/generate-app-icons.mjs')).toContain('flutter-app-icon-1024.png');
  });

  it('母圖底色是品牌棕 #8A6038', () => {
    expect(near(px(png(MOTHER), 8, 8), BROWN)).toBe(true);
  });

  it('PWA any 512 與母圖縮圖幾乎一致（平均每通道差 < 1/255）', async () => {
    const sharp = (await import('sharp')).default;
    const ref = await sharp(path.join(root, MOTHER)).resize(512, 512, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
    const img = png('public/icons/icon-512.png');
    let sum = 0;
    for (let i = 0; i < ref.length; i++) sum += Math.abs(ref[i] - img.data[i]);
    expect(sum / ref.length).toBeLessThan(1);
  });
});
