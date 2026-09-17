import {cookies} from 'next/headers';
import {ADMIN_COOKIE,privateHeaders,sameOrigin} from '@/lib/admin-auth';
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({ok:false},{status:403,headers:privateHeaders});
 (await cookies()).set(ADMIN_COOKIE,'',{httpOnly:true,secure:!!process.env.VERCEL||new URL(req.url).protocol==='https:',sameSite:'strict',path:'/',maxAge:0});
 return Response.json({ok:true},{headers:privateHeaders});
}
