/**
 * EntryEditAccessContext — 目前使用者能不能改這個行程的 entries（#1695）。
 *
 * 後端 `hasWritePermission` 的規則是 trip_permissions 有列且 role != 'viewer'；
 * 前端用 /api/my-trips 的 `role` 同步，讓「刪除景點」的 ⋯ 選單項、右鍵與 Delete 鍵都吃同一份。
 * 預設 true：沒有 TripPage 包著的獨立頁與測試維持原樣（後端仍是最後一道關）。
 */
import { createContext, useContext } from 'react';

export const EntryEditAccessContext = createContext<boolean>(true);
export const useCanEditEntries = () => useContext(EntryEditAccessContext);
