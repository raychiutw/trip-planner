import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import TripSharePage from '../../src/pages/TripSharePage';
import TripPrintPage from '../../src/pages/TripPrintPage';
const renderer=vi.hoisted(()=>({run:vi.fn(),save:vi.fn()}));
vi.mock('html2pdf.js',()=>({default:()=>({set(){return this;},from(){return this;},toContainer:async()=>{},get:async(key:string)=>key==='container'?{scrollHeight:100}:key==='pageSize'?{inner:{px:{height:100}}}:undefined,toPdf:()=>renderer.run(),save:()=>renderer.save()})}));
let notesFail=false;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{
 notesFail=false;renderer.run.mockReset().mockResolvedValue(undefined);renderer.save.mockReset().mockResolvedValue(undefined);
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const path=String(input);
  if(path.includes('/oauth/userinfo'))return json({id:'u1',email:'u@test.com'});
  if(path.includes('/share/'))return json({meta:{name:'完整行程'},days:[],notes:{}});
  if(path.endsWith('/notes'))return json({},notesFail?500:200);
  if(path.includes('/days'))return json([]);
  return json({name:'完整行程'});
 }));
 vi.stubGlobal('print',vi.fn());
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function open(share=true){render(<MemoryRouter initialEntries={[share?'/s/tok':'/trip/t1/print']}><Routes><Route path="/s/:token" element={<TripSharePage/>}/><Route path="/trip/:tripId/print" element={<TripPrintPage/>}/></Routes></MemoryRouter>);}
it('分享 PDF 失敗可見且可重試成功',async()=>{
 renderer.run.mockRejectedValueOnce(new Error('繪製失敗'));open();
 fireEvent.click(await screen.findByTestId('share-pdf'));
 expect(await screen.findByRole('alert')).toHaveTextContent('繪製失敗');
 fireEvent.click(screen.getByTestId('share-pdf'));
 expect(await screen.findByText('PDF 已產生')).toBeInTheDocument();
 expect(renderer.save).toHaveBeenCalledTimes(1);
});
it('PDF 產生期間禁止重複啟動，顯示目前階段',async()=>{
 let finish!:()=>void;renderer.run.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));open();
 const button=await screen.findByTestId('share-pdf');fireEvent.click(button);fireEvent.click(button);
 expect(button).toBeDisabled();
 expect(await screen.findByText('PDF 輸出中…')).toBeInTheDocument();
 await waitFor(()=>expect(renderer.run).toHaveBeenCalledTimes(1));
 await act(async()=>finish());
 expect(await screen.findByText('PDF 已產生')).toBeInTheDocument();
 expect(button).toBeEnabled();
});
it('筆記失敗阻擋列印，重試取得完整資料才開放',async()=>{
 notesFail=true;open(false);
 const retry=await screen.findByRole('button',{name:'重新載入列印資料'});
 expect(screen.getByTestId('trip-print-do')).toBeDisabled();
 expect(screen.queryByTestId('trip-print-document')).not.toBeInTheDocument();
 notesFail=false;fireEvent.click(retry);
 expect(await screen.findByTestId('trip-print-document')).toBeInTheDocument();
 expect(screen.getByTestId('trip-print-do')).toBeEnabled();
});
it.each([true,false])('原生列印 throw 可恢復，afterprint 不誤稱已印出（分享=%s）',async(share)=>{
 vi.mocked(window.print).mockImplementationOnce(()=>{throw new Error('printer');});open(share);
 const button=await screen.findByTestId(share?'share-print':'trip-print-do');
 await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);
 expect(await screen.findByRole('alert')).toHaveTextContent('無法開啟列印');
 fireEvent.click(button);expect(button).toBeDisabled();
 act(()=>window.dispatchEvent(new Event('afterprint')));
 expect(await screen.findByText('列印視窗已關閉')).toBeInTheDocument();expect(button).toBeEnabled();
});
it('列印沒有 afterprint 回應時可恢復，卸載會清理等待',async()=>{
 open(false);const button=await screen.findByTestId('trip-print-do');await waitFor(()=>expect(button).toBeEnabled());
 vi.useFakeTimers();
 try {
  fireEvent.click(button);expect(button).toBeDisabled();
  act(()=>vi.advanceTimersByTime(60001));
  expect(screen.getByRole('alert')).toHaveTextContent('列印回應逾時');expect(button).toBeEnabled();
  fireEvent.click(button);cleanup();expect(vi.getTimerCount()).toBe(0);
 } finally {vi.useRealTimers();}
});
