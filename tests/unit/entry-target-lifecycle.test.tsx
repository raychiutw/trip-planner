import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEntryTarget } from '../../src/hooks/useEntryTarget';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const json=(body:unknown)=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
it('換 trip 與 A-B-A 的晚到日期都不能成為新提交目標',async()=>{
 const pending:Array<(value:Response)=>void>=[];
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>pending.push(resolve))));
 const {result,rerender}=renderHook(tripId=>useEntryTarget({tripId,dayNum:1}),{initialProps:'a'});
 rerender('b');
 await act(async()=>pending[1](json([{dayNum:1,date:'B'}])));
 expect(result.current.day?.date).toBe('B');
 rerender('a');
 expect(result.current.day).toBeNull();
 await act(async()=>pending[0](json([{dayNum:1,date:'舊A'}])));
 expect(result.current.day).toBeNull();
 await act(async()=>pending[2](json([{dayNum:1,date:'新A'}])));
 expect(result.current.day?.date).toBe('新A');
});
it('網路失敗可重試，只有載入成功的有效 day 可提交',async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json([{dayNum:2}]));
 vi.stubGlobal('fetch',fetcher);
 const {result,rerender}=renderHook(dayNum=>useEntryTarget({tripId:'t1',dayNum}),{initialProps:1});
 await waitFor(()=>expect(result.current.status).toBe('error'));
 expect(result.current.days).toBeNull();expect(result.current.day).toBeNull();
 act(()=>result.current.retry());
 await waitFor(()=>expect(result.current.status).toBe('success'));
 expect(result.current.day).toBeNull();
 rerender(2);expect(result.current.day?.dayNum).toBe(2);
 expect(fetcher).toHaveBeenCalledTimes(2);
});
it('省略日期才可預選第一天，無效 deep link 不靜默換日',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>json([{dayNum:2},{dayNum:3}])));
 const {result,rerender}=renderHook((dayNum:number|null)=>useEntryTarget({tripId:'t1',dayNum}),{initialProps:null as number|null});
 await waitFor(()=>expect(result.current.day?.dayNum).toBe(2));
 rerender(9);expect(result.current.day).toBeNull();
 rerender(NaN);expect(result.current.day).toBeNull();
});
