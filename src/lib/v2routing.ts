/**
 * V1/V2 路由切換邏輯 — Blue-Green Tailwind 遷移。
 * 在 main.tsx 和 unit test 中共用，避免邏輯 drift。
 */
export function resolveV2(search: string, lsValue: string | null): boolean {
  const params = new URLSearchParams(search);
  const forceV1 = params.get('v1') === '1';
  const forceV2 = params.get('v2') === '1';
  const storedV2 = lsValue === '1';
  return !forceV1 && (forceV2 || storedV2);
}
