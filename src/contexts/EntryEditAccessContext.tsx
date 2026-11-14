/**
 * EntryEditAccessContext — 目前使用者能不能改這個行程的 entries（#1695）。
 *
 * 後端 `hasWritePermission` 的規則是 trip_permissions 有列且 role != 'viewer'；
 * 前端用 /api/my-trips 的 `role` 同步，讓「刪除景點」的 ⋯ 選單項、右鍵與 Delete 鍵都吃同一份。
 * 預設 false（fail-closed）：沒有 TripPage Provider 包著就不提供刪除；後端仍是最後一道關。
 */
import { createContext, useContext } from 'react';

export const EntryEditAccessContext = createContext<boolean>(false);
export const useCanEditEntries = () => useContext(EntryEditAccessContext);
