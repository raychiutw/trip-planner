import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomPoiForm } from '../../src/components/trip/CustomPoiForm';
import { LocationPickerMap } from '../../src/components/trip/LocationPickerMap';
import { __internal } from '../../src/hooks/usePlacesAutocomplete';
const sdk = vi.hoisted(() => ({ listeners: new Map<string, () => void>(), center: { lat: 35, lng: 139 } }));
vi.mock('@googlemaps/js-api-loader', () => ({ setOptions: vi.fn(), importLibrary: async () => ({ Map: class {
  constructor(_element: unknown, opts: { center: {lat: number; lng: number} }) { sdk.center = opts.center; }
  addListener(name: string, callback: () => void) { sdk.listeners.set(name, callback); return { remove: () => sdk.listeners.delete(name) }; }
  getCenter() { return { lat: () => sdk.center.lat, lng: () => sdk.center.lng }; }
  getZoom() { return 14; }
  setZoom() {}
  panTo(coord: typeof sdk.center) { sdk.center = coord; }
  setCenter(coord: typeof sdk.center) { sdk.center = coord; }
  panBy(x: number, y: number) { sdk.center = { lat: sdk.center.lat - y / 1000, lng: sdk.center.lng + x / 1000 }; }
} }) }));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function Form() {
  const [title, setTitle] = useState('草稿'); const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null); const [hint, setHint] = useState(false);
  return <><CustomPoiForm title={title} onTitleChange={setTitle} coord={coord} onCoordChange={setCoord} hintConfirmed={hint} onHintConfirmedChange={setHint} initialCenter={{lat:35,lng:139}} testIdPrefix='custom'/><output>{coord ? `${coord.lat},${coord.lng}` : '未選位置'}</output></>;
}
let http: ReturnType<typeof vi.fn>;
beforeEach(() => {
  __internal.clearCache(); sdk.listeners.clear(); vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY', '');
  http = vi.fn(async (path: string) => reply(path.includes('autocomplete') ? {predictions:[{placeId:'A',primaryText:'台北車站',secondaryText:'台灣'}]} : {lat:25.047,lng:121.517})); vi.stubGlobal('fetch',http);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function pick(query = '台北') { fireEvent.change(screen.getByRole('combobox'), {target:{value:query}}); await screen.findByRole('option'); fireEvent.keyDown(screen.getByRole('combobox'), {key:'ArrowDown'}); fireEvent.keyDown(screen.getByRole('combobox'), {key:'Enter'}); }
it('Google 地址座標可在地圖不可用時明確選定，不捏造預設中心', async () => {
  render(<Form/>); expect(await screen.findByTestId('custom-picker-map-error')).toHaveTextContent('地址'); expect(screen.getByText('未選位置')).toBeVisible();
  await pick(); expect(await screen.findByText('25.047,121.517')).toBeVisible(); expect(screen.getByTestId('custom-title')).toHaveValue('草稿');
});
it('座標解析失敗會說明並可重試，保留原名稱和地址', async () => {
  let failed = true; http.mockImplementation(async(path:string) => path.includes('resolve') && failed ? reply({},503) : reply(path.includes('autocomplete') ? {predictions:[{placeId:'A',primaryText:'台北车站',secondaryText:'台灣'}]} : {lat:25.047,lng:121.517}));
  render(<Form/>); await pick(); expect(await screen.findByText(/無法確認地址位置/)).toBeVisible(); expect(screen.getByRole('combobox')).toHaveValue('台北'); expect(screen.getByText('未選位置')).toBeVisible();
  failed = false; fireEvent.click(screen.getByRole('button',{name:'重試地址位置'})); expect(await screen.findByText('25.047,121.517')).toBeVisible();
});
it('地址更改後舊解析不能恢復過期位置', async () => {
  let finish!: (response:Response)=>void; http.mockImplementation((path:string) => path.includes('resolve') ? new Promise<Response>(r=>{finish=r;}) : Promise.resolve(reply({predictions:[{placeId:'A',primaryText:'台北车站',secondaryText:'台灣'}]})));
  render(<Form/>); await pick(); fireEvent.change(screen.getByRole('combobox'),{target:{value:'高雄'}}); await act(async()=>finish(reply({lat:25.047,lng:121.517}))); expect(screen.getByText('未選位置')).toBeVisible();
});
it('初始 idle 只是地圖視野，方向鍵操作後才公布選定座標', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY','test'); vi.stubGlobal('google',{maps:{ControlPosition:{TOP_RIGHT:1}}}); const selected = vi.fn();
  render(<LocationPickerMap initialCenter={{lat:35,lng:139}} onCoordChange={selected}/>); await waitFor(()=>expect(sdk.listeners.has('idle')).toBe(true));
  act(()=>sdk.listeners.get('idle')!()); expect(selected).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByTestId('custom-picker-map'),{key:'ArrowRight'}); act(()=>sdk.listeners.get('idle')!()); expect(selected).toHaveBeenCalledWith({lat:35,lng:139.001});
});
it('Escape 收起候選，輸入不清空', async () => {
  render(<Form/>); fireEvent.change(screen.getByRole('combobox'),{target:{value:'台北'}}); await screen.findByRole('option'); fireEvent.keyDown(screen.getByRole('combobox'),{key:'Escape'}); expect(screen.queryByRole('option')).toBeNull(); expect(screen.getByRole('combobox')).toHaveValue('台北');
});
it('拖曳位置比尚未完成的地址解析新，晚到地址不能移回舊選擇', async () => {
 vi.stubEnv('VITE_GOOGLE_MAPS_BROWSER_KEY','test');vi.stubGlobal('google',{maps:{ControlPosition:{TOP_RIGHT:1}}});
 let finish!:(response:Response)=>void;http.mockImplementation((path:string)=>path.includes('resolve')?new Promise<Response>(r=>{finish=r;}):Promise.resolve(reply({predictions:[{placeId:'A',primaryText:'台北車站',secondaryText:'台灣'}]})));
 render(<Form/>);await waitFor(()=>expect(sdk.listeners.has('dragstart')).toBe(true));await pick();
 act(()=>{sdk.listeners.get('dragstart')!();sdk.center={lat:22,lng:120};sdk.listeners.get('idle')!();});
 expect(screen.getByText('22,120')).toBeVisible();await act(async()=>finish(reply({lat:25.047,lng:121.517})));expect(screen.getByText('22,120')).toBeVisible();
});
it.each([{}, {lat:91,lng:121}])('Google 回傳無效座標 %j 不得轉成可用位置', async (body) => {
 http.mockImplementation(async(path:string)=>reply(path.includes('autocomplete')?{predictions:[{placeId:'A',primaryText:'台北車站',secondaryText:'台灣'}]}:body));
 render(<Form/>);await pick();expect(await screen.findByText(/無法確認地址位置/)).toBeVisible();expect(screen.getByText('未選位置')).toBeVisible();
});
