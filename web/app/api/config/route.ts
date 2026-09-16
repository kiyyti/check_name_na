import {sheets} from '@/lib/sheets-gateway';
export async function GET(){
 try{const r=await sheets('config');return Response.json(r.ok&&r.config?r.config:{ready:false,levels:[],message:r.message||'ยังไม่พร้อมเปิดเช็คชื่อ'},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({ready:false,levels:[],message:'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่ภายหลัง'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
