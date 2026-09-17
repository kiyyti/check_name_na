import {adminUser,privateHeaders,sameOrigin} from '@/lib/admin-auth';
import {adminSheets} from '@/lib/sheets-gateway';
import {adminMutation} from '@/lib/admin-contracts';
import {classLevels} from '@/lib/class-levels.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(req:Request){
 if(!await adminUser())return Response.json({ok:false,message:'กรุณาเข้าสู่ระบบอีกครั้ง'},{status:401,headers:privateHeaders});
 const sessionId=new URL(req.url).searchParams.get('session')||'';
 if(sessionId.length>120)return Response.json({ok:false},{status:400,headers:privateHeaders});
 try{const result=await adminSheets('adminRead',{sessionId});return Response.json(result,{status:result.ok?200:503,headers:privateHeaders});}
 catch{return Response.json({ok:false,message:'โหลดข้อมูลไม่ได้ กรุณาตรวจว่าอัปเดต Apps Script และลองใหม่'},{status:503,headers:privateHeaders});}
}
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({ok:false,message:'คำขอไม่ถูกต้อง'},{status:403,headers:privateHeaders});
 const actor=await adminUser();if(!actor)return Response.json({ok:false,message:'กรุณาเข้าสู่ระบบอีกครั้ง'},{status:401,headers:privateHeaders});
 if(!req.headers.get('content-type')?.includes('application/json'))return Response.json({ok:false},{status:415,headers:privateHeaders});
 try{
  const body=await req.text();if(body.length>24000)return Response.json({ok:false},{status:413,headers:privateHeaders});
  const parsed=adminMutation.safeParse(JSON.parse(body));if(!parsed.success)return Response.json({ok:false,message:'กรอกข้อมูลให้ครบและตรวจวันเวลา/ตัวเลขให้ถูกต้อง'},{status:400,headers:privateHeaders});
  if(parsed.data.action==='adminSaveSession'){
   const levels=classLevels(parsed.data.payload.class_level);
   parsed.data.payload.class_level=levels.join(', ');
   if(levels.length>1){
    const capability=await adminSheets('adminCapabilities');
    if(!capability.ok||!capability.capabilities?.multiLevelSessions)return Response.json({ok:false,message:'กรุณาอัปเดต Code.gs และ Deploy เวอร์ชันใหม่ของ Apps Script ก่อนบันทึกรอบที่เลือกหลายระดับชั้น'},{status:503,headers:privateHeaders});
   }
  }
  const result=await adminSheets(parsed.data.action,{...parsed.data.payload,actor});
  return Response.json(result,{status:result.ok?200:result.code==='CONFLICT'?409:400,headers:privateHeaders});
 }catch{return Response.json({ok:false,message:'ยังยืนยันการบันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่'},{status:503,headers:privateHeaders});}
}
