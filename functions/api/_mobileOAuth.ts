import { getPublicOrigin } from './_utils';
import type { Env } from './_types';

export const MOBILE_CALLBACK_HOST = 'https://mobile-callback.trip-planner-dby.pages.dev';
export const MOBILE_PROD_REDIRECT = `${MOBILE_CALLBACK_HOST}/oauth/callback`;
export const MOBILE_UAT_REDIRECT = `${MOBILE_CALLBACK_HOST}/uat/oauth/callback`;
export const MOBILE_DEV_REDIRECT = 'http://127.0.0.1:8765';

/** Exact issuer/client/redirect tuple. No wildcard host or cross-environment fallback. */
export function mobileOAuthContract(env: Env, request: Request): { clientId: string; redirectUri: string } | null {
  const origin = new URL(request.url).origin;
  if (env.ENVIRONMENT === 'production' && origin === getPublicOrigin(env, request)) {
    return { clientId: 'tripline-mobile', redirectUri: MOBILE_PROD_REDIRECT };
  }
  if (env.ENVIRONMENT === 'preview' && origin === 'https://uat.trip-planner-dby.pages.dev') {
    return { clientId: 'tripline-mobile-uat', redirectUri: MOBILE_UAT_REDIRECT };
  }
  if (env.ENVIRONMENT === 'development' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return { clientId: 'tripline-mobile-dev', redirectUri: MOBILE_DEV_REDIRECT };
  }
  return null;
}

export function isMobileClientId(clientId: string): boolean {
  return clientId === 'tripline-mobile' || clientId === 'tripline-mobile-uat' || clientId === 'tripline-mobile-dev';
}
