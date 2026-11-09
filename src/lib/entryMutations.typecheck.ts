/**
 * entryMutations 的編譯期守衛（#1481）：只被 `npm run typecheck` 檢查，不執行、不進 bundle。
 * 每個 `@ts-expect-error` 都是「誤傳會讓後端 400／恆 409」的呼叫，必須編譯失敗；
 * 哪天不再報錯（參數型別被放寬）就會出 TS2578 讓 typecheck 轉紅。
 */
import { addFavoriteToTrip, createEntry, moveEntriesBatch, reorderAlternates, reorderEntries, removeAlternate, setMaster } from './entryMutations';

export async function entryMutationsUsage(): Promise<void> {
  // ---- 對的用法：必須通過 ----
  await reorderEntries('t', 1, [3, 1, 2]);
  await moveEntriesBatch('t', [{ id: 1, day_id: 2, sort_order: 0 }], { fromDayNum: 1, toDayNum: 2 });
  await setMaster('t', 1, 1, 9, '7');
  await setMaster('t', 1, 1, 9, null);
  await setMaster('t', 1, 1, 9);
  await removeAlternate('t', 1, 1, 9, '7');
  await reorderAlternates('t', 1, 1, [1, 2], '7');
  await createEntry('t', 1, { name: 'X', source: 'custom', poi_type: 'hotel' });
  await addFavoriteToTrip(1, 't', 1, { startTime: '09:00', endTime: '10:00' });

  // ---- 錯的用法：全部必須是型別錯誤 ----
  // @ts-expect-error 後端 batch 只收 number id，字串 id 會 400
  await reorderEntries('t', 1, ['1']);
  // @ts-expect-error updates[].id 必須是 number
  await moveEntriesBatch('t', [{ id: 'x' }], { fromDayNum: 1, toDayNum: 2 });
  // @ts-expect-error entryPoisVersion 是 string（送 number 會因嚴格比對恆 409）
  await setMaster('t', 1, 1, 9, 7);
  // @ts-expect-error 同上（query 版）
  await removeAlternate('t', 1, 1, 9, 7);
  // @ts-expect-error 同上（body 版）
  await reorderAlternates('t', 1, 1, [1], 7);
  // @ts-expect-error source 是契約列舉，打錯字編譯期就擋
  await createEntry('t', 1, { name: 'X', source: 'bogus' });
  // @ts-expect-error poi_type 是契約列舉
  await createEntry('t', 1, { name: 'X', poi_type: 'bogus' });
  // @ts-expect-error startTime／endTime 契約必填（後端缺了回 400）
  await addFavoriteToTrip(1, 't', 1, {});
}
