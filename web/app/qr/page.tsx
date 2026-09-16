"use client";
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
export default function QRPage(){
 const [qr,setQR]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const origin=window.location.origin;setUrl(origin);if(['localhost','127.0.0.1'].includes(window.location.hostname)){setError('QR สำหรับนักเรียนจะพร้อมเมื่อเว็บมีลิงก์ HTTPS ที่เปิดจากมือถือได้');return;}QRCode.toDataURL(origin+'/',{width:600,margin:4,errorCorrectionLevel:'M',color:{dark:'#17365D',light:'#FFFFFF'}}).then(setQR).catch(()=>setError('สร้าง QR ไม่สำเร็จ กรุณาลองใหม่'));},[]);
 return <main className="qr-page"><p className="eyebrow">check name na</p><h1>สแกนเพื่อเช็คชื่อเข้าเรียน</h1><p>วิทยาลัยการอาชีพเถิน<br/>อาจารย์ปภังกร บุตรศรี</p>{qr?<img src={qr} alt="QR สำหรับเปิดเว็บไซต์เช็คชื่อ" width={300} height={300}/>:<p role="status" className="setup-note">{error||'กำลังสร้าง QR…'}</p>}<p className="qr-url">{url}</p>{qr&&<button className="submit-button" onClick={()=>window.print()}>พิมพ์ QR</button>}<a href="/">กลับหน้าเช็คชื่อ</a></main>;
}
