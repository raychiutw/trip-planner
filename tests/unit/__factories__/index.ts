/**
 * tests/unit/__factories__/index.ts — shared mock factory exports
 *
 * v2.33.70 round 20: 集中 makeTrip / makeEntry / makeUser / makePoiFavorite
 * 等 fixture builder。**Canonical shape 對齊 backend response (deepCamel'd)**，
 * 避免重蹈 v2.31.14/15/27 family drift bug (test mock 寫 snake_case 但 backend
 * 回 camelCase → false-green test mask real production bug)。
 *
 * 使用方式:
 *
 *   import { makeTrip, makeEntry, makeUser } from '../__factories__';
 *
 *   const trip = makeTrip({ name: 'Okinawa 7/26' });
 *   const entry = makeEntry({ title: '那霸機場' });
 *
 * 每個 factory 接 `Partial<T>` override，未指定的欄位用合理 default。
 */

export { makeTrip, makeTripListItem, type MakeTripInput } from './makeTrip';
export { makeEntry, makeStopPoi, type MakeEntryInput } from './makeEntry';
export { makeDay, type MakeDayInput } from './makeDay';
export { makeUser, makeAuthData, type MakeUserInput } from './makeUser';
export { makePoiFavorite, type MakePoiFavoriteInput } from './makePoiFavorite';
export { makeSegment, type MakeSegmentInput } from './makeSegment';
