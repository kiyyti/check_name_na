/* check name na. Bind to the imported class-v2 Google Sheet.
 * Script properties: SPREADSHEET_ID, API_SECRET (32+ random characters).
 * The secret is shared only with the website server, never with a browser.
 */
function fail_(code,message){const error=new Error(message);error.code=code;throw error;}
function text_(v){return String(v==null?'':v).trim();}
function normalized_(v){return text_(v).normalize('NFC').replace(/\s+/g,' ').toLocaleLowerCase();}
function day_(date){return new Date(date.getTime()+7*3600000).toISOString().slice(0,10);}
function timeMinutes_(value,key){const match=text_(value).match(/(?:^|\D)(\d{1,2}):(\d{2})(?:\D|$)/);if(!match)fail_('NOT_CONFIGURED','กรุณากำหนด '+key+' เป็นเวลา HH:MM');const h=Number(match[1]),m=Number(match[2]);if(h>23||m>59)fail_('NOT_CONFIGURED','เวลา '+key+' ไม่ถูกต้อง');return h*60+m;}
function timeText_(minutes){return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
function classify_(date,c){const t=new Date(date.getTime()+7*3600000),m=t.getUTCHours()*60+t.getUTCMinutes();return m>=c.absenceMinute?'absent':m>=c.lateMinute?'late':'present';}
function distance_(a,b,c,d){const rad=x=>x*Math.PI/180;const x=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
function location_(p,c){
 if(!['latitude','longitude','accuracy'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||p.accuracy<=0)fail_('BAD_LOCATION','ข้อมูลพิกัดไม่ถูกต้อง กรุณาลองระบุตำแหน่งใหม่');
 const distance=distance_(p.latitude,p.longitude,c.latitude,c.longitude);
 if(p.accuracy>c.maxAccuracy)fail_('LOW_ACCURACY','พิกัดยังคลาดเคลื่อนมาก กรุณาย้ายไปจุดที่รับตำแหน่งได้ชัดขึ้นแล้วลองใหม่');
 if(distance>c.radius)fail_('OUTSIDE','คุณอยู่นอกพื้นที่เช็คชื่อ กรุณาเข้ามาในบริเวณห้องเรียน');
 if(distance+p.accuracy>c.radius)fail_('UNCERTAIN','พิกัดอยู่ใกล้ขอบพื้นที่และยังไม่ชัดเจน กรุณาขยับเข้ามาในพื้นที่แล้วลองใหม่');
 return Math.round(distance*10)/10;
}
function db_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)fail_('NOT_CONFIGURED','ยังไม่ได้เชื่อม Google Sheets');return SpreadsheetApp.openById(id);}
function table_(db,name){
 const sheet=db.getSheetByName(name);if(!sheet)fail_('NOT_CONFIGURED','โครงสร้าง Google Sheets ยังไม่ครบ');
 const values=sheet.getDataRange().getValues(),headers=values.shift().map(text_);
 if(!headers.length||!headers[0])fail_('NOT_CONFIGURED','หัวคอลัมน์ชีตไม่ถูกต้อง');
 return {sheet,headers,rows:values.map((v,i)=>{const r={_row:i+2};headers.forEach((h,j)=>r[h]=v[j]);return r;}).filter(r=>text_(r[headers[0]])!=='')};
}
function configuration_(db){
 const c={};table_(db,'Settings').rows.forEach(r=>c[text_(r.key)]=r.value);
 if(c.schema_version!=='class-v2')fail_('NOT_CONFIGURED','กรุณาใช้โครงสร้างชีต class-v2');
 const fields=['room_name','latitude','longitude','radius_m','max_accuracy_m'];
 if(fields.some(k=>text_(c[k])===''))fail_('NOT_CONFIGURED','ยังไม่ได้กำหนดห้องเรียนและพิกัดสำหรับเช็คชื่อ');
 const cfg={room:text_(c.room_name),course:text_(c.course_name),latitude:Number(c.latitude),longitude:Number(c.longitude),radius:Number(c.radius_m),maxAccuracy:Number(c.max_accuracy_m),lateMinute:timeMinutes_(c.late_policy,'late_policy'),absenceMinute:timeMinutes_(c.absence_policy,'absence_policy')};
 if(![cfg.latitude,cfg.longitude,cfg.radius,cfg.maxAccuracy].every(Number.isFinite)||Math.abs(cfg.latitude)>90||Math.abs(cfg.longitude)>180||cfg.radius<=0||cfg.maxAccuracy<=0||cfg.maxAccuracy>cfg.radius)fail_('NOT_CONFIGURED','การตั้งค่าพิกัดหรือรัศมียังไม่ถูกต้อง');
 if(cfg.absenceMinute<=cfg.lateMinute)fail_('NOT_CONFIGURED','เวลา absence_policy ต้องอยู่หลัง late_policy');
 if(c.timezone!=='Asia/Bangkok'||db.getSpreadsheetTimeZone()!=='Asia/Bangkok')fail_('NOT_CONFIGURED','กรุณาตั้งเขตเวลาชีตเป็น Asia/Bangkok');
 return cfg;
}
function date_(value){const d=value instanceof Date?value:new Date(value);return value!==''&&Number.isFinite(d.getTime())?d:null;}
function sessionWindow_(r){
 const start=date_(r.starts_at),end=date_(r.ends_at),open=date_(r.checkin_opens_at),close=date_(r.checkin_closes_at);
 return start&&end&&open&&close&&end>start&&close>open&&open<=start?{start,end,open,close}:null;
}
function eligible_(student,session){
 const w=sessionWindow_(session);if(!w||text_(student.status)!=='active')return false;
 if(text_(session.class_level)&&text_(student.class_level)!==text_(session.class_level))return false;
 if(text_(session.group_name)&&text_(student.group_name)!==text_(session.group_name))return false;
 const enroll=date_(student.enrolled_on),withdraw=date_(student.withdrawn_on),day=day_(w.start);
 return (!enroll||day_(enroll)<=day)&&(!withdraw||day_(withdraw)>day);
}
function sessionFor_(rows,student,now){
 const sessions=rows.filter(r=>{const w=sessionWindow_(r);return text_(r.status)==='open'&&w&&day_(w.start)===day_(now)&&now>=w.open&&now<=w.close&&eligible_(student,r);});
 if(sessions.length!==1)fail_('NO_SESSION',sessions.length?'มีรอบเรียนซ้อนกัน กรุณาแจ้งอาจารย์':'ยังไม่มีรอบเช็คชื่อที่เปิดสำหรับระดับชั้นนี้');return sessions[0];
}
function safeCell_(v){return typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v;}
function write_(table,row,at){const values=table.headers.map(h=>safeCell_(row[h]===undefined?'':row[h]));table.sheet.getRange(at||table.sheet.getLastRow()+1,1,1,values.length).setValues([values]);}
function receipt_(row,duplicate){return {status:row.status,recordedAt:date_(row.checked_at||row.created_at).toISOString(),duplicate:!!duplicate};}
function checkIn_(db,c,p,now){
 if(!p||typeof p.identity!=='string'||!p.identity.trim()||p.identity.length>120||typeof p.level!=='string'||!p.level.trim()||p.level.length>50||typeof p.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(p.requestId))fail_('BAD_INPUT','กรุณาตรวจชื่อหรือรหัสนักศึกษาและระดับชั้น');
 const students=table_(db,'Students').rows;
 // A code match takes priority over a name match. Full names only, never fuzzy search.
 const pool=students.filter(r=>text_(r.class_level)===p.level&&text_(r.status)==='active');
 const codes=pool.filter(r=>text_(r.student_code)===text_(p.identity));
 const matches=codes.length?codes:pool.filter(r=>normalized_(r.full_name)===normalized_(p.identity));
 if(matches.length!==1)fail_('IDENTITY',matches.length?'มีชื่อซ้ำ กรุณาใช้รหัสนักศึกษา':'ข้อมูลไม่ตรงกับรายชื่อและระดับชั้น กรุณาตรวจสอบอีกครั้ง');
 const student=matches[0],session=sessionFor_(table_(db,'Sessions').rows,student,now);
 const distance=location_(p,c),lock=LockService.getScriptLock();
 if(!lock.tryLock(8000))fail_('BUSY','มีผู้เช็คชื่อพร้อมกันหลายคน กรุณารอสักครู่แล้วลองใหม่');
 try{
  const t=table_(db,'Attendance');
  if(!t.headers.includes('latitude')||!t.headers.includes('class_level'))fail_('NOT_CONFIGURED','กรุณาอัปเดตโครงสร้างชีตเป็น class-v2');
  const existing=t.rows.filter(r=>text_(r.session_id)===text_(session.session_id)&&text_(r.student_id)===text_(student.student_id));
  if(existing.length>1)fail_('DUPLICATE_DATA','พบข้อมูลซ้ำในชีต กรุณาแจ้งอาจารย์');
  if(existing.length&&existing[0].checked_at)return {ok:true,receipt:receipt_(existing[0],true)};
  const collision=t.rows.find(r=>text_(r.request_id)===p.requestId);
  if(collision&&(text_(collision.student_id)!==text_(student.student_id)||text_(collision.session_id)!==text_(session.session_id)))fail_('CONFLICT','คำขอนี้ถูกใช้แล้ว กรุณาเปิดหน้าเช็คชื่อใหม่');
  const previous=existing[0];
  const row={attendance_id:previous?previous.attendance_id:Utilities.getUuid(),session_id:session.session_id,student_id:student.student_id,status:previous?previous.status:classify_(now,c),checked_at:now,method:'qr',recorded_by:'self-reported',request_id:p.requestId,note:previous?previous.note:'',created_at:previous?previous.created_at:now,updated_at:now,class_level:p.level,latitude:p.latitude,longitude:p.longitude,accuracy_m:p.accuracy,distance_m:distance,location_status:'inside'};
  write_(t,row,previous?previous._row:null);SpreadsheetApp.flush();
  return {ok:true,receipt:receipt_(row,false)};
 }finally{lock.releaseLock();}
}
function doPost(e){
 try{
  if(!e||!e.postData||e.postData.contents.length>8192)fail_('BAD_INPUT','คำขอไม่ถูกต้อง');
  const body=JSON.parse(e.postData.contents),secret=PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if(!secret||secret.length<32||body.secret!==secret)fail_('UNAUTHORIZED','ไม่สามารถเข้าถึงระบบได้');
  const now=new Date(),db=db_(),c=configuration_(db);let result;
  if(body.action==='config'){
   const levels=[...new Set(table_(db,'Students').rows.filter(r=>text_(r.status)==='active').map(r=>text_(r.class_level)).filter(Boolean))].sort();
   const active=table_(db,'Sessions').rows.some(r=>{const w=sessionWindow_(r);return r.status==='open'&&w&&day_(w.start)===day_(now)&&now>=w.open&&now<=w.close;});
   result={ok:true,config:{ready:!!levels.length&&active,levels,room:c.room,course:c.course,lateTime:timeText_(c.lateMinute),absenceTime:timeText_(c.absenceMinute),message:levels.length?'ยังไม่มีรอบเช็คชื่อที่เปิดในขณะนี้':'ยังไม่มีรายชื่อผู้เรียนในระบบ'}};
  }else if(body.action==='checkIn')result=checkIn_(db,c,body.payload,now);
  else fail_('BAD_INPUT','คำขอไม่ถูกต้อง');
  return json_(result);
 }catch(e){return json_({ok:false,code:e.code||'ERROR',message:e.code?e.message:'เชื่อมต่อชีตไม่สำเร็จ กรุณาลองใหม่ภายหลัง'});}
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
/* Install this as a 5-minute time-driven trigger. Only fills missing records.
 * No record is created for students outside the session's class/group/dates.
 * Existing present, late, absent, or teacher-approved excused is preserved.
 */
function finalizeAbsences(){
 const now=new Date(),db=db_(),c=configuration_(db);if(classify_(now,c)!=='absent')return;
 const sessions=table_(db,'Sessions').rows.filter(r=>{const w=sessionWindow_(r);return ['open','closed'].includes(r.status)&&w&&day_(w.start)===day_(now)&&now>=w.start;});
 const students=table_(db,'Students').rows,lock=LockService.getScriptLock();if(!lock.tryLock(8000))return;
 try{const t=table_(db,'Attendance'),keys=new Set(t.rows.map(r=>text_(r.session_id)+'|'+text_(r.student_id))),rows=[];
  sessions.forEach(session=>students.filter(s=>eligible_(s,session)).forEach(s=>{const key=text_(session.session_id)+'|'+text_(s.student_id);if(keys.has(key))return;keys.add(key);const row={attendance_id:Utilities.getUuid(),session_id:session.session_id,student_id:s.student_id,status:'absent',method:'system',recorded_by:'SYSTEM',note:'ไม่พบการเช็คชื่อก่อน 09:00',created_at:now,updated_at:now,class_level:s.class_level,location_status:'not_checked'};rows.push(t.headers.map(h=>safeCell_(row[h]===undefined?'':row[h])));}));
  if(rows.length)t.sheet.getRange(t.sheet.getLastRow()+1,1,rows.length,t.headers.length).setValues(rows);SpreadsheetApp.flush();
 }finally{lock.releaseLock();}
}
