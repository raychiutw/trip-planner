import {test,expect} from '@playwright/test';
test('verification requires a gesture, recovers from network error, and keeps success until login is chosen',async({page,browserName})=>{
 let calls=0;
 await page.route('**/api/**',route=>route.fulfill({json:{}}));
 await page.route('**/api/oauth/verify',route=>{calls++;return calls===1?route.abort('failed'):route.fulfill({json:{ok:true}});});
 await page.clock.install();await page.goto('/auth/verify-email?token=token-A');expect(calls).toBe(0);
 await page.getByRole('button',{name:'點此完成驗證'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('alert')).toBeFocused();await expect(page.getByRole('alert')).toContainText('網路連線錯誤');await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');await expect(page.getByRole('button',{name:'重試'})).toBeFocused();await page.keyboard.press('Enter');
 await expect(page.getByRole('status')).toContainText('Email 驗證成功');await page.clock.fastForward(5000);await expect(page).toHaveURL(/\/auth\/verify-email/);await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');await expect(page.getByRole('link',{name:'前往登入'})).toBeFocused();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/login\?verified=1$/);expect(calls).toBe(2);
});
test('resend reports server failure, permits retry and honors server cooldown without a live countdown',async({page,browserName})=>{
 let calls=0;
 await page.route('**/api/**',route=>route.fulfill({json:{}}));
 await page.route('**/api/oauth/send-verification',route=>{calls++;return route.fulfill({status:calls===1?500:429,headers:{'Retry-After':'3600'},json:{error:{code:'VERIFY_RATE_LIMITED'}}});});
 await page.clock.install();await page.goto('/signup/check-email?email=test%40example.com');const resend=page.getByTestId('verify-resend');await expect(resend).toBeDisabled();await page.clock.fastForward(61000);await expect(resend).toBeEnabled();await resend.focus();await page.keyboard.press('Enter');await expect(page.getByRole('alert')).toContainText('重寄失敗');await expect(resend).toBeEnabled();await resend.click();await expect(page.getByRole('alert')).toContainText('寄送次數過多');await expect(resend).toBeDisabled();await expect(resend).toContainText('3600 秒');await page.clock.fastForward(61000);await expect(resend).toBeDisabled();expect(calls).toBe(2);
});
