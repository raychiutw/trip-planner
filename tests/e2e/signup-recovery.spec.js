import {test,expect} from '@playwright/test';
test('signup explains consent, focuses a real password error and preserves input for keyboard retry',async({page})=>{
 let posts=0;
 await page.route('**/api/**',route=>route.fulfill({json:{}}));
 await page.route('**/api/oauth/signup',route=>{posts++;return route.fulfill({status:posts===1?400:200,json:posts===1?{error:{code:'SIGNUP_PASSWORD_TOO_SHORT'}}:{ok:true,email:'user@example.com',requiresVerification:true}});});
 await page.route('**/api/oauth/send-verification',async route=>{await new Promise(resolve=>setTimeout(resolve,1500));await route.fulfill({json:{ok:true}}).catch(()=>{});});
 await page.goto('/signup');
 const email=page.getByLabel('電子郵件',{exact:true}),password=page.getByLabel('密碼',{exact:true}),consent=page.getByRole('checkbox');
 await expect(page.getByTestId('signup-submit')).toBeDisabled();await expect(consent).toHaveAccessibleDescription('需同意個資條款與隱私權政策才能建立帳號。');
 await email.fill('user@example.com');await password.fill('short');await consent.focus();await page.keyboard.press('Space');await page.getByTestId('signup-submit').click();
 await expect(password).toBeFocused();await expect(password).toHaveAttribute('aria-invalid','true');await expect(password).toHaveAccessibleDescription(/密碼至少 8 字元/);await expect(email).toHaveValue('user@example.com');
 await password.fill('password123');await password.press('Enter');await expect(page).toHaveURL(/\/signup\/check-email\?email=user%40example.com/);expect(posts).toBe(2);
});
