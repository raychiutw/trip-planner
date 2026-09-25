import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from '@testing-library/react';
import {renderTripPrintPdf} from '../../src/components/print/renderTripPrintPdf';
import {loadTripPrintData,type TripPrintData} from '../../src/lib/tripPrintData';
const renderer=vi.hoisted(()=>({run:vi.fn(),save:vi.fn()}));
vi.mock('html2pdf.js',()=>({default:()=>{
 const overlay=document.createElement('div');overlay.className='html2pdf__overlay';
 return {set(){return this;},from(){return this;},toContainer:async()=>{document.body.appendChild(overlay);},get:async()=>overlay,toPdf:()=>renderer.run(),save:()=>renderer.save()};
}}));
const data:TripPrintData={name:'完整行程',days:[],notes:{flights:[],lodgings:[],reservations:[],pretripNotes:[],emergencyContacts:[]}};
beforeEach(()=>{vi.useFakeTimers();renderer.run.mockReset().mockResolvedValue(undefined);renderer.save.mockReset().mockResolvedValue(undefined);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('筆記讀取失敗不能當成空筆記成功輸出',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).endsWith('/notes')?{}:String(input).includes('/days')?[]:{name:'行程'}),{status:String(input).endsWith('/notes')?500:200,headers:{'Content-Type':'application/json'}})));
 await expect(loadTripPrintData('t1')).rejects.toThrow();
});
it('renderer failure cleans temporary nodes and allows a successful retry',async()=>{
 renderer.run.mockRejectedValueOnce(new Error('renderer failed'));
 let failed!:Promise<void>;
 await act(async()=>{failed=renderTripPrintPdf({data});const check=expect(failed).rejects.toThrow('renderer failed');await vi.advanceTimersByTimeAsync(60);await check;});
 expect(document.querySelector('[data-trip-pdf]')).toBeNull();
 expect(document.querySelector('.html2pdf__overlay')).toBeNull();
 expect(document.querySelector('.tp-print-doc')).toBeNull();
 await act(async()=>{const retry=renderTripPrintPdf({data});await vi.advanceTimersByTimeAsync(60);await retry;});
 expect(renderer.save).toHaveBeenCalledTimes(1);
 expect(vi.getTimerCount()).toBe(0);
});
it('timeout cleans up and a late renderer cannot download after retry',async()=>{
 let finish!:()=>void;renderer.run.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 await act(async()=>{const first=renderTripPrintPdf({data});const check=expect(first).rejects.toThrow('逾時');await vi.advanceTimersByTimeAsync(30001);await check;});
 expect(document.querySelector('[data-trip-pdf]')).toBeNull();
 expect(document.querySelector('.html2pdf__overlay')).toBeNull();expect(document.querySelector('.tp-print-doc')).toBeNull();
 await act(async()=>{const retry=renderTripPrintPdf({data});await vi.advanceTimersByTimeAsync(60);await retry;finish();await Promise.resolve();});
 expect(renderer.save).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('concurrent start explicitly reports busy instead of false success',async()=>{
 let finish!:()=>void;renderer.run.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 await act(async()=>{
  const first=renderTripPrintPdf({data});
  await expect(renderTripPrintPdf({data})).rejects.toThrow('正在');
  await vi.advanceTimersByTimeAsync(60);finish();await first;
 });
 expect(renderer.save).toHaveBeenCalledTimes(1);
});

it('timeout also covers data preparation and never renders late data',async()=>{
 const pending:Array<{path:string;finish:(value:Response)=>void}>=[];
 vi.stubGlobal('fetch',vi.fn((input:RequestInfo|URL)=>new Promise<Response>(finish=>{pending.push({path:String(input),finish});})));
 await act(async()=>{const first=renderTripPrintPdf({tripId:'t1'});const check=expect(first).rejects.toThrow('逾時');await vi.advanceTimersByTimeAsync(30001);await check;});
 expect(document.querySelector('[data-trip-pdf]')).toBeNull();
 await act(async()=>{
   const retry=renderTripPrintPdf({data});await vi.advanceTimersByTimeAsync(60);await retry;
   for(const request of pending)request.finish(new Response(JSON.stringify(request.path.includes('/days')?[]:{})));
 });
 expect(renderer.save).toHaveBeenCalledTimes(1);
 expect(document.querySelector('[data-trip-pdf]')).toBeNull();
});
