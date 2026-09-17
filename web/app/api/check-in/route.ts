import {sheets} from '@/lib/sheets-gateway';
import {z} from 'zod';
export const runtime='nodejs';
export const maxDuration=60;
const input=z.object({identity:z.string().trim().min(1).max(120),level:z.string().trim().min(1).max(50),requestId:z.string().uuid(),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180),accuracy:z.number().finite().positive().max(100000)}).strict();
export async function POST(req:Request){
 const headers={'Cache-Control':'no-store'};
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({ok:false,message:'กรุณาเช็คชื่อผ่านหน้าเว็บไซต์'},{status:403,headers});
 if(!req.headers.get('content-type')?.includes('application/json'))return Response.json({ok:false,message:'รูปแบบข้อมูลไม่ถูกต้อง'},{status:415,headers});
 try{
  const body=await req.text();if(body.length>4096)return Response.json({ok:false,message:'ข้อมูลยาวเกินไป'},{status:413,headers});
  const parsed=input.safeParse(JSON.parse(body));if(!parsed.success)return Response.json({ok:false,message:'กรุณาตรวจชื่อ ระดับชั้น และอนุญาตตำแหน่ง'},{status:400,headers});
  const result=await sheets('checkIn',parsed.data);
  if(result.ok&&!result.receipt)throw new Error('Missing receipt');
  return Response.json(result,{status:result.ok?200:['NOT_CONFIGURED','BUSY'].includes(result.code||'')?503:400,headers});
 }catch{return Response.json({ok:false,message:'ยังยืนยันการบันทึกไม่ได้ กรุณาลองอีกครั้งโดยใช้ข้อมูลเดิม'},{status:503,headers});}
}
