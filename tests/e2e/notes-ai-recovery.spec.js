import {test,expect} from '@playwright/test';
const {setupApiMocks,MOCK_TRIPS_LIST}=require('./api-mocks');

test('AI state failure retains notes and keyboard retry never generates a new job',async({page})=>{
 await setupApiMocks(page);
 await page.route('**/api/permissions?*',route=>route.fulfill({json:[]}));
 await page.route('**/api/invitations?*',route=>route.fulfill({json:[]}));
 const tripId=MOCK_TRIPS_LIST[0].tripId;let failed=true;let posts=0;
 await page.route(`**/api/trips/${tripId}/notes`,route=>route.fulfill({json:{flights:[],lodgings:[],reservations:[],pretripNotes:[{id:1,sortOrder:0,title:'人工保留',content:'原有筆記仍可閱讀',origin:'human',managedBy:'human',version:0}],emergencyContacts:[]}}));
 await page.route(`**/api/trips/${tripId}/notes/ai-state`,route=>route.fulfill({status:failed?500:200,json:failed?{}:{jobs:[{docType:'tips',status:'processing',jobId:1,generation:1}]}}));
 await page.route('**/notes/*/generate',route=>{posts++;return route.fulfill({json:{}});});
 await page.goto(`/trip/${tripId}/notes`);
 const retry=page.getByRole('button',{name:'重試 AI 狀態'});await expect(retry).toBeVisible();
 await expect(page.getByText('原有筆記仍可閱讀')).toBeVisible();
 await expect(page.getByTestId('trip-notes-ai-btn-pretrip')).toBeDisabled();
 failed=false;await retry.focus();await page.keyboard.press('Enter');
 await expect(retry).toBeHidden();await expect(page.getByTestId('trip-notes-ai-status-tips')).toContainText('生成中');
 await expect(page.getByTestId('trip-notes-ai-btn-pretrip')).toBeDisabled();expect(posts).toBe(0);
});

test('generation waits for acknowledgement and retains manual notes after completion',async({page})=>{
 await setupApiMocks(page);
 await page.route('**/api/permissions?*',route=>route.fulfill({json:[]}));
 await page.route('**/api/invitations?*',route=>route.fulfill({json:[]}));
 const tripId=MOCK_TRIPS_LIST[0].tripId;let posts=0;let completed=false;let finish;
 const released=new Promise(resolve=>{finish=resolve;});
 await page.route(`**/api/trips/${tripId}/notes`,route=>route.fulfill({json:{flights:[],lodgings:[],reservations:[],pretripNotes:[{id:1,sortOrder:0,title:'人工保留',content:'我的出發提醒',origin:'human',managedBy:'human',version:0}],emergencyContacts:[]}}));
 await page.route(`**/api/trips/${tripId}/notes/ai-state`,route=>route.fulfill({json:{jobs:posts?[{docType:'tips',status:completed?'completed':'pending',jobId:1,generation:1,preservedManualCount:1}]:[]}}));
 await page.route(`**/api/trips/${tripId}/notes/tips/generate`,async route=>{posts++;await released;return route.fulfill({json:{jobId:1,requestId:1,status:'pending',generation:1}});});
 await page.goto(`/trip/${tripId}/notes`);
 const generate=page.getByTestId('trip-notes-ai-btn-pretrip');await expect(generate).toBeEnabled();await generate.click();
 await expect(generate).toBeDisabled();expect(posts).toBe(1);completed=true;finish();
 await expect(page.getByTestId('trip-notes-ai-status-tips')).toContainText('保留人工 1');
 await expect(page.getByText('我的出發提醒')).toBeVisible();expect(posts).toBe(1);
});
