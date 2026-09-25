import {test,expect} from '@playwright/test';
test('password has its own name and keyboard login recovers to the original destination',async({page,browserName})=>{
 let fail=true,posts=0;
 await page.route('**/api/**',route=>route.fulfill({json:{}}));
 await page.route('**/api/public-config',route=>route.fulfill({json:{providers:{google:false}}}));
 await page.route('**/api/oauth/login',route=>{posts++;return route.fulfill({status:fail?401:200,json:fail?{error:{code:'LOGIN_INVALID'}}:{ok:true}});});
 await page.goto('/login?redirect_after=%2Fexplore');
 const email=page.getByRole('textbox',{name:'電子郵件'});const password=page.getByLabel('密碼',{exact:true});
 await expect(password).toHaveAttribute('autocomplete','current-password');await email.fill('user@example.com');await email.focus();await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');await expect(page.getByRole('link',{name:'忘記密碼？'})).toBeFocused();await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');await expect(password).toBeFocused();await password.fill('a-password');await page.keyboard.press('Enter');
 await expect(page.getByRole('alert')).toContainText('電子郵件或密碼錯誤');await expect(password).toHaveValue('a-password');fail=false;await password.press('Enter');await expect(page).toHaveURL(/\/explore$/);expect(posts).toBe(2);
});
test('lockout has an announced heading and usable reset link',async({page,browserName})=>{
 await page.route('**/api/**',route=>route.fulfill({json:{}}));
 await page.route('**/api/oauth/login',route=>route.fulfill({status:429,headers:{'Retry-After':'60'},json:{error:{code:'LOGIN_RATE_LIMITED'}}}));
 await page.goto('/login');await page.getByLabel('電子郵件').fill('user@example.com');await page.getByLabel('密碼',{exact:true}).fill('a-password');await page.getByTestId('login-submit').click();
 await expect(page.getByRole('heading',{name:'登入嘗試太多次'})).toBeFocused();await expect(page.getByRole('timer')).toBeVisible();await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');await expect(page.getByRole('link',{name:'重設密碼'})).toBeFocused();
});
