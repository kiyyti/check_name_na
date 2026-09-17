import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {ADMIN_COOKIE,adminCredentials,privateHeaders,sameOrigin} from '@/lib/admin-auth';
import {issueSession,verifyPassword,SESSION_SECONDS} from '@/lib/admin-session.mjs';
import {adminSheets} from '@/lib/sheets-gateway';
export const runtime='nodejs';
export const maxDuration=60;
const input=z.object({username:z.string().min(1).max(120),password:z.string().min(1).max(256)}).strict();
export async function POST(req:Request){
 const reply=(message:string,status:number)=>Response.json({ok:false,message},{status,headers:privateHeaders});
 if(!sameOrigin(req))return reply('คำขอไม่ถูกต้อง',403);
 if(!req.headers.get('content-type')?.includes('application/json'))return reply('รูปแบบคำขอไม่ถูกต้อง',415);
 const c=adminCredentials();if(!c)return reply('ยังไม่ได้ตั้งค่าบัญชีแอดมินบนเซิร์ฟเวอร์',503);
 try{
  const body=await req.text();if(body.length>2048)return reply('ข้อมูลยาวเกินไป',413);
  const parsed=input.safeParse(JSON.parse(body));if(!parsed.success)return reply('กรอกชื่อผู้ใช้และรหัสผ่าน',400);
  // Vercel supplies this header; never accept an IP or rate-limit key in the form.
  const ip=process.env.VERCEL?req.headers.get('x-vercel-forwarded-for')||'unknown':'local';
  const key=createHash('sha256').update(ip+':'+c.secret).digest('hex');
  const limit=await adminSheets('adminLoginAttempt',{key});
  if(!limit.ok&&limit.code==='BAD_INPUT')return reply('Apps Script ที่เชื่อมอยู่ยังไม่รองรับหน้าแอดมิน กรุณาอัปเดต Code.gs แล้ว Deploy เวอร์ชันใหม่ใน deployment เดิม',503);
  if(!limit.ok)return Response.json({ok:false,message:limit.message||'กรุณาลองอีกครั้งภายหลัง'},{status:limit.code==='RATE_LIMIT'?429:503,headers:{...privateHeaders,...(limit.retryAfter?{'Retry-After':String(limit.retryAfter)}:{})}});
  const passwordOk=verifyPassword(parsed.data.password,c.hash);
  if(parsed.data.username!==c.username||!passwordOk)return reply('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);
  (await cookies()).set(ADMIN_COOKIE,issueSession(c.username,c.hash,c.secret),{httpOnly:true,secure:!!process.env.VERCEL||new URL(req.url).protocol==='https:',sameSite:'strict',path:'/',maxAge:SESSION_SECONDS});
  return Response.json({ok:true},{headers:privateHeaders});
 }catch{return reply('เชื่อมต่อระบบแอดมินไม่ได้ กรุณาตรวจว่าอัปเดต Apps Script แล้ว',503);}
}
