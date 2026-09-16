"use client";
import {useEffect,useRef,useState} from 'react';
import {BookOpen,MapPin,ArrowRight,Clock3,CheckCircle2,AlertCircle,LoaderCircle,GraduationCap} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {configSchema,gatewaySchema} from '@/lib/contracts';
type Config={ready:boolean;message?:string;levels:string[];room?:string;course?:string};
type Receipt={status:'present'|'late'|'absent'|'excused';recordedAt:string;duplicate?:boolean};
const labels={present:'มาเรียน',late:'มาสาย',absent:'ขาดเรียน',excused:'ลา (อาจารย์อนุมัติแล้ว)'};
export default function CheckIn(){
 const [config,setConfig]=useState<Config|null>(null),[identity,setIdentity]=useState(''),[level,setLevel]=useState(''),[phase,setPhase]=useState(''),[error,setError]=useState(''),[receipt,setReceipt]=useState<Receipt|null>(null);
 const requestId=useRef(''),busy=useRef(false);
 useEffect(()=>{fetch('/api/config').then(r=>r.json()).then(value=>setConfig(configSchema.parse(value))).catch(()=>setConfig({ready:false,levels:[],message:'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่ภายหลัง'}));},[]);
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;const lifecycle=new AbortController();
  try{void Promise.resolve(context.registerTool({name:'prepare_checkin',description:'กรอกชื่อหรือรหัสและระดับชั้นในฟอร์ม ยังไม่ขอตำแหน่งและยังไม่บันทึกเช็คชื่อ',inputSchema:{type:'object',properties:{identity:{type:'string',minLength:1,maxLength:120},level:{type:'string'}},required:['identity','level'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input:unknown){const v=input as {identity?:unknown;level?:unknown};if(busy.current||!v||typeof v.identity!=='string'||!v.identity.trim()||v.identity.length>120||typeof v.level!=='string'||!config?.levels.includes(v.level))throw new Error('ชื่อหรือระดับชั้นไม่ถูกต้อง หรือกำลังบันทึก');setIdentity(v.identity.trim());setLevel(v.level);setReceipt(null);setError('');requestId.current='';return {prepared:true,saved:false};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return()=>lifecycle.abort();
 },[config]);
 function resetResult(){setReceipt(null);setError('');requestId.current='';}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy.current||!config?.ready)return;
  if(!identity.trim()||!level){setError('กรอกชื่อหรือรหัสนักศึกษา และเลือกระดับชั้น');return;}
  busy.current=true;setError('');setReceipt(null);setPhase('กำลังตรวจพิกัด');
  try{
   if(!navigator.geolocation)throw new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
   const p=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,()=>reject(new Error('ยังระบุตำแหน่งไม่ได้ กรุณาอนุญาตตำแหน่งให้เว็บไซต์ แล้วลองอีกครั้ง')),{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
   requestId.current ||= crypto.randomUUID();setPhase('กำลังบันทึกการเช็คชื่อ');
   const response=await fetch('/api/check-in',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:identity.trim(),level,requestId:requestId.current,latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy})});
   const data=gatewaySchema.parse(await response.json());if(!response.ok||!data.ok||!data.receipt)throw new Error(data.message||'ยังบันทึกไม่ได้ กรุณาลองใหม่');setReceipt(data.receipt);
  }catch(err){setError(err instanceof Error?err.message:'เชื่อมต่อไม่ได้ กรุณาลองใหม่โดยใช้ข้อมูลเดิม');}finally{busy.current=false;setPhase('');}
 }
 return <main className="check-shell">
  <header className="topbar"><a className="brand" href="/"><span className="brand-symbol"><BookOpen size={23}/></span>check name <b>na</b><span className="brand-period">.</span></a><span className="top-label">เช็คชื่อเข้าเรียน</span></header>
  <div className="check-layout"><section className="intro"><p className="eyebrow">วิทยาลัยการอาชีพเถิน · ลำปาง</p><h1>พร้อมเรียนแล้ว<br/><span>เช็คชื่อกันนะ</span></h1><p className="teacher"><GraduationCap size={22}/>อาจารย์ปภังกร บุตรศรี</p><p className="intro-copy">กรอกข้อมูลของตัวเอง แล้วอนุญาตตำแหน่ง<br className="desktop-break"/>เพื่อยืนยันว่าคุณอยู่ในพื้นที่เรียน</p>
  <div className="schedule"><div className="schedule-title"><Clock3 size={19}/><h2>เวลาเช็คชื่อ</h2><span>เวลาไทย</span></div><div className="time-row"><span className="status-tag present">มาเรียน</span><strong>ก่อน 08:30</strong></div><div className="time-row"><span className="status-tag late">มาสาย</span><strong>08:30 – 08:59</strong></div><div className="time-row"><span className="status-tag absent">ขาดเรียน</span><strong>ตั้งแต่ 09:00</strong></div></div>
  <div className="location-note"><MapPin size={21}/><div><b>{config?.room||'ห้องเรียนอาจารย์ปภังกร บุตรศรี'}</b><p>{config?.room?'เช็คชื่อได้ภายในรัศมีพื้นที่เรียนที่กำหนด':'รอระบุชื่อห้องและขอบเขตพื้นที่เช็คชื่อ'}</p></div></div></section>
  <section className="form-card" aria-labelledby="form-title"><div className="card-heading"><span className="step-number">01</span><span>ข้อมูลผู้เรียน</span><BookOpen size={21}/></div><h2 id="form-title">วันนี้มาเรียนแล้ว</h2><p className="card-description">{config?.course||'เช็คชื่อสำหรับการเรียนครั้งนี้'}</p>
   {!config?.ready&&<div className="setup-note" role="status"><AlertCircle size={19}/><span>{config?.message||'กำลังตรวจสอบรอบเรียน…'}</span></div>}
   <form onSubmit={submit}><label htmlFor="identity">ชื่อ–นามสกุล หรือรหัสนักศึกษา</label><input id="identity" name="identity" autoComplete="off" maxLength={120} required placeholder="เช่น รหัสนักศึกษาของคุณ" value={identity} disabled={!!phase} onChange={e=>{setIdentity(e.target.value);resetResult();}}/><p className="field-hint">กรอกให้ตรงกับรายชื่อที่ลงทะเบียนในวิชา</p><label htmlFor="level">ระดับชั้นเรียน</label><Select value={level} onValueChange={v=>{setLevel(v);resetResult();}} disabled={!!phase||!config?.levels.length}><SelectTrigger id="level" className="level-select" aria-label="ระดับชั้นเรียน"><SelectValue placeholder="เลือกระดับชั้นของคุณ"/></SelectTrigger><SelectContent>{config?.levels.map(x=><SelectItem value={x} key={x}>{x}</SelectItem>)}</SelectContent></Select>
   <div className="gps-explainer"><MapPin size={19}/><p>ระบบจะขอตำแหน่งเมื่อกดเช็คชื่อ<br/><span>ใช้เวลาเซิร์ฟเวอร์เป็นเวลาบันทึก</span></p></div>
   <button className="submit-button" disabled={!config?.ready||!!phase||!level||!identity.trim()} type="submit">{phase?<><LoaderCircle className="spin" size={20}/>{phase}</>:<>ตรวจพิกัดและเช็คชื่อ<ArrowRight size={21}/></>}</button>
   {error&&<div className="result error" role="alert"><AlertCircle/><div><b>ยังไม่ได้บันทึก</b><p>{error}</p></div></div>}
   {receipt&&<div className={`result ${receipt.status}`} role="status"><CheckCircle2/><div><b>{labels[receipt.status]}</b><p>{receipt.duplicate?'เคยบันทึกรอบนี้แล้ว · ใช้ผลเดิม':'บันทึกเรียบร้อยแล้ว'}</p><time>{new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(receipt.recordedAt))}</time></div></div>}
   </form><p className="card-footer">หากข้อมูลหรือพิกัดไม่ถูกต้อง โปรดแจ้งอาจารย์ผู้สอน</p></section></div>
  <footer className="page-footer"><span>check name na</span><span>หนึ่งวิชา · ทุกครั้งที่มาเรียน</span><a href="/qr">QR สำหรับเข้าเว็บไซต์</a></footer>
 </main>;
}
