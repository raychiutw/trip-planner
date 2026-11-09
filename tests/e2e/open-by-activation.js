// Safari 點按鈕／連結不會讓它取得焦點（activeElement 變 body），「開啟前焦點」只存在於鍵盤路徑，
// 所以 webkit 用 focus + Enter 啟動；chromium／mobile-chrome 維持滑鼠點擊，保留點擊後還焦的覆蓋。
async function openByActivation(locator, page, browserName) {
  if (browserName === 'webkit') {
    await locator.focus();
    await page.keyboard.press('Enter');
  } else {
    await locator.click();
  }
}
module.exports = { openByActivation };
