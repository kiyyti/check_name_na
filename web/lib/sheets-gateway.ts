import 'server-only';
import {gatewaySchema} from './contracts';
import {adminGatewaySchema} from './admin-contracts';
export async function sheets(action:'config'|'checkIn',payload:unknown={}){
 return gatewaySchema.parse(await callSheets(action,payload));
}
export async function adminSheets(action:'adminRead'|'adminSaveStudent'|'adminSaveSession'|'adminSaveSettings'|'adminAttendance'|'adminLoginAttempt',payload:unknown={}){
 return adminGatewaySchema.parse(await callSheets(action,payload));
}
async function callSheets(action:string,payload:unknown){
 const url=process.env.GOOGLE_APPS_SCRIPT_URL,secret=process.env.GOOGLE_APPS_SCRIPT_SECRET;
 if(!url||!secret)return {ok:false,code:'NOT_CONFIGURED',message:'กำลังเตรียมระบบเช็คชื่อ กรุณารออาจารย์เปิดใช้งาน'};
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new Error('Invalid Apps Script endpoint');
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,secret,payload}),redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Sheets gateway unavailable');
 return response.json();
}
