import 'server-only';
import {cookies} from 'next/headers';
import {validPasswordHash, verifySession} from './admin-session.mjs';
export const ADMIN_COOKIE='checknamena_admin';
export function adminCredentials(){
  const username=process.env.ADMIN_USERNAME||'',hash=process.env.ADMIN_PASSWORD_HASH||'',secret=process.env.ADMIN_SESSION_SECRET||'';
  if(!username||!validPasswordHash(hash)||secret.length<32) return null;
  return {username,hash,secret};
}
export async function adminUser(){
  const c=adminCredentials();
  if(!c)return null;
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value,c.username,c.hash,c.secret)?c.username:null;
}
export const privateHeaders={'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'};
export {sameOrigin} from './request-origin';
