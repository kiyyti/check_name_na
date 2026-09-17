'use client';
import {useState} from 'react';
import {BookOpen,LockKeyhole,Eye,EyeOff} from 'lucide-react';
export default function AdminLogin(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[visible,setVisible]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const form=new FormData(e.currentTarget);setBusy(true);setError('');
  try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.get('username'),password:form.get('password')})});const data=await r.json() as {ok?:boolean;message?:string};if(!r.ok||!data.ok)throw new Error(data.message||'เข้าสู่ระบบไม่ได้');window.location.assign('/admin');}
  catch(err){setError(err instanceof Error?err.message:'เชื่อมต่อไม่ได้');setBusy(false);}
 }
 return <main className="admin-login"><a className="admin-brand" href="/"><BookOpen/>check name <b>na.</b></a><section className="admin-panel"><span className="admin-icon"><LockKeyhole/></span><p className="admin-eyebrow">สำหรับอาจารย์</p><h1>จัดการชั้นเรียน</h1><p className="admin-muted">เข้าสู่ระบบเพื่อจัดการรอบเรียน รายชื่อ และผลเช็คชื่อ</p><form onSubmit={submit}><label htmlFor="admin-username">ชื่อผู้ใช้</label><input id="admin-username" name="username" autoComplete="username" required maxLength={120} disabled={busy}/><label htmlFor="admin-password">รหัสผ่าน</label><div className="admin-password"><input id="admin-password" name="password" type={visible?'text':'password'} autoComplete="current-password" required maxLength={256} disabled={busy}/><button type="button" className="admin-eye" onClick={()=>setVisible(!visible)} aria-label={visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>{error&&<p className="admin-error" role="alert">{error}</p>}<button className="admin-button primary full" disabled={busy}>{busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}</button></form></section><a href="/" className="admin-back">← กลับหน้าเช็คชื่อ</a></main>;
}
