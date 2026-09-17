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
 return configurationValues_(c,db.getSpreadsheetTimeZone());
}
function configurationValues_(c,timezone){
 if(c.schema_version!=='class-v2')fail_('NOT_CONFIGURED','กรุณาใช้โครงสร้างชีต class-v2');
 const fields=['room_name','latitude','longitude','radius_m','max_accuracy_m'];
 if(fields.some(k=>text_(c[k])===''))fail_('NOT_CONFIGURED','ยังไม่ได้กำหนดห้องเรียนและพิกัดสำหรับเช็คชื่อ');
 const cfg={room:text_(c.room_name),course:text_(c.course_name),latitude:Number(c.latitude),longitude:Number(c.longitude),radius:Number(c.radius_m),maxAccuracy:Number(c.max_accuracy_m),lateMinute:timeMinutes_(c.late_policy,'late_policy'),absenceMinute:timeMinutes_(c.absence_policy,'absence_policy')};
 if(![cfg.latitude,cfg.longitude,cfg.radius,cfg.maxAccuracy].every(Number.isFinite)||Math.abs(cfg.latitude)>90||Math.abs(cfg.longitude)>180||cfg.radius<=0||cfg.maxAccuracy<=0||cfg.maxAccuracy>cfg.radius)fail_('NOT_CONFIGURED','การตั้งค่าพิกัดหรือรัศมียังไม่ถูกต้อง');
 if(cfg.absenceMinute<=cfg.lateMinute)fail_('NOT_CONFIGURED','เวลา absence_policy ต้องอยู่หลัง late_policy');
 if(c.timezone!=='Asia/Bangkok'||timezone!=='Asia/Bangkok')fail_('NOT_CONFIGURED','กรุณาตั้งเขตเวลาชีตเป็น Asia/Bangkok');
 return cfg;
}
function date_(value){const d=value instanceof Date?value:new Date(value);return value!==''&&Number.isFinite(d.getTime())?d:null;}
function sessionPolicy_(session,c){
 const result=Object.assign({},c);
 [['latitude','latitude'],['longitude','longitude'],['radius_m','radius'],['max_accuracy_m','maxAccuracy']].forEach(pair=>{if(text_(session[pair[0]])!=='')result[pair[1]]=Number(session[pair[0]]);});
 if(text_(session.room_name))result.room=text_(session.room_name);
 if(![result.latitude,result.longitude,result.radius,result.maxAccuracy].every(Number.isFinite)||Math.abs(result.latitude)>90||Math.abs(result.longitude)>180||result.radius<=0||result.maxAccuracy<=0||result.maxAccuracy>result.radius)fail_('BAD_INPUT','พิกัดของรอบเรียนไม่ถูกต้อง');
 const w=sessionWindow_(session);if(!w)fail_('BAD_INPUT','เวลาเรียนไม่ถูกต้อง');
 result.lateAt=text_(session.late_at)?date_(session.late_at):new Date(day_(w.start)+'T'+timeText_(c.lateMinute)+':00+07:00');
 result.absenceAt=text_(session.absence_at)?date_(session.absence_at):new Date(day_(w.start)+'T'+timeText_(c.absenceMinute)+':00+07:00');
 if(!result.lateAt||!result.absenceAt||result.absenceAt<=result.lateAt)fail_('BAD_INPUT','เวลาเข้าสายและขาดของรอบเรียนไม่ถูกต้อง');
 return result;
}
function classifySession_(now,policy){return now>=policy.absenceAt?'absent':now>=policy.lateAt?'late':'present';}
function sessionWindow_(r){
 const start=date_(r.starts_at),end=date_(r.ends_at),open=date_(r.checkin_opens_at),close=date_(r.checkin_closes_at);
 return start&&end&&open&&close&&end>start&&close>open&&open<=start?{start,end,open,close}:null;
}
function sessionLevels_(session){
 const raw=text_(session.class_level);if(!raw)return [];
 const parts=raw.split(',').map(text_);
 if(raw.length>2000||parts.some(level=>!level||level.length>50))fail_('BAD_INPUT','ระดับชั้นของรอบเรียนไม่ถูกต้อง');
 const levels=[...new Set(parts)];if(levels.length>30)fail_('BAD_INPUT','เลือกระดับชั้นได้ไม่เกิน 30 ระดับ');return levels;
}
function levelsOverlap_(a,b){const left=sessionLevels_(a),right=sessionLevels_(b);return !left.length||!right.length||left.some(level=>right.includes(level));}
function eligible_(student,session){
 const w=sessionWindow_(session);if(!w||text_(student.status)!=='active')return false;
 const levels=sessionLevels_(session);if(levels.length&&!levels.includes(text_(student.class_level)))return false;
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
 const policy=sessionPolicy_(session,c),distance=location_(p,policy),lock=LockService.getScriptLock();
 if(!lock.tryLock(8000))fail_('BUSY','มีผู้เช็คชื่อพร้อมกันหลายคน กรุณารอสักครู่แล้วลองใหม่');
 try{
  const t=table_(db,'Attendance');
  if(!t.headers.includes('latitude')||!t.headers.includes('class_level'))fail_('NOT_CONFIGURED','กรุณาอัปเดตโครงสร้างชีตเป็น class-v2');
  const existing=t.rows.filter(r=>text_(r.session_id)===text_(session.session_id)&&text_(r.student_id)===text_(student.student_id));
  if(existing.length>1)fail_('DUPLICATE_DATA','พบข้อมูลซ้ำในชีต กรุณาแจ้งอาจารย์');
  if(existing.length&&(existing[0].checked_at||existing[0].method==='teacher'))return {ok:true,receipt:receipt_(existing[0],true)};
  const collision=t.rows.find(r=>text_(r.request_id)===p.requestId);
  if(collision&&(text_(collision.student_id)!==text_(student.student_id)||text_(collision.session_id)!==text_(session.session_id)))fail_('CONFLICT','คำขอนี้ถูกใช้แล้ว กรุณาเปิดหน้าเช็คชื่อใหม่');
  const previous=existing[0];
  const row={attendance_id:previous?previous.attendance_id:Utilities.getUuid(),session_id:session.session_id,student_id:student.student_id,status:previous?previous.status:classifySession_(now,policy),checked_at:now,method:'qr',recorded_by:'self-reported',request_id:p.requestId,note:previous?previous.note:'',created_at:previous?previous.created_at:now,updated_at:now,class_level:p.level,latitude:p.latitude,longitude:p.longitude,accuracy_m:p.accuracy,distance_m:distance,location_status:'inside'};
  write_(t,row,previous?previous._row:null);SpreadsheetApp.flush();
  return {ok:true,receipt:receipt_(row,false)};
 }finally{lock.releaseLock();}
}
function doPost(e){
 try{
  if(!e||!e.postData||e.postData.contents.length>32768)fail_('BAD_INPUT','คำขอไม่ถูกต้อง');
  const body=JSON.parse(e.postData.contents),secret=PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if(!secret||secret.length<32||body.secret!==secret)fail_('UNAUTHORIZED','ไม่สามารถเข้าถึงระบบได้');
  const now=new Date();
  if(body.action==='adminCapabilities')return json_({ok:true,capabilities:{multiLevelSessions:true}});
  if(body.action==='adminLoginAttempt')return json_(adminLoginAttempt_(body.payload,now));
  const db=db_();
  if(['adminRead','adminSaveStudent','adminSaveSession','adminSaveSettings','adminAttendance'].includes(body.action))return json_(adminAction_(db,body.action,body.payload||{},now));
  const c=configuration_(db);let result;
  if(body.action==='config'){
   const levels=[...new Set(table_(db,'Students').rows.filter(r=>text_(r.status)==='active').map(r=>text_(r.class_level)).filter(Boolean))].sort();
   const active=table_(db,'Sessions').rows.filter(r=>{const w=sessionWindow_(r);return r.status==='open'&&w&&day_(w.start)===day_(now)&&now>=w.open&&now<=w.close;});
   const schedules=active.map(r=>{const policy=sessionPolicy_(r,c);return {label:[text_(r.class_level)||'ทุกระดับชั้น',text_(r.group_name)].filter(Boolean).join(' · '),room:policy.room,lateTime:new Date(policy.lateAt.getTime()+7*3600000).toISOString().slice(11,16),absenceTime:new Date(policy.absenceAt.getTime()+7*3600000).toISOString().slice(11,16)};});
   const settings=settingsMap_(db);
   result={ok:true,config:{ready:!!levels.length&&!!active.length,levels,room:schedules.length===1?schedules[0].room:c.room,course:c.course,teacherName:settings.teacher_name,locationName:settings.location_name,schedules,lateTime:schedules.length===1?schedules[0].lateTime:timeText_(c.lateMinute),absenceTime:schedules.length===1?schedules[0].absenceTime:timeText_(c.absenceMinute),message:!levels.length?'ยังไม่มีรายชื่อผู้เรียนในระบบ':!active.length?'ยังไม่มีรอบเช็คชื่อที่เปิดในขณะนี้':''}};
  }else if(body.action==='checkIn')result=checkIn_(db,c,body.payload,now);
  else fail_('BAD_INPUT','คำขอไม่ถูกต้อง');
  return json_(result);
 }catch(e){return json_({ok:false,code:e.code||'ERROR',message:e.code?e.message:'เชื่อมต่อชีตไม่สำเร็จ กรุณาลองใหม่ภายหลัง'});}
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
// Admin requests are reachable only through the website server's API_SECRET.
// The website verifies the signed admin cookie on every admin data request.
function adminLoginAttempt_(p,now){
 if(!p||!/^[a-f0-9]{64}$/.test(p.key))fail_('BAD_INPUT','คำขอไม่ถูกต้อง');
 const lock=LockService.getScriptLock();if(!lock.tryLock(8000))fail_('BUSY','กรุณาลองใหม่อีกครั้ง');
 try{
  const props=PropertiesService.getScriptProperties(),key='ADMIN_LOGIN_LIMITS',raw=props.getProperty(key);
  let state=raw?JSON.parse(raw):{until:0,total:0,clients:{}};
  const timestamp=now.getTime();if(timestamp>=state.until)state={until:timestamp+15*60*1000,total:0,clients:{}};
  if(state.total>=60||(state.clients[p.key]||0)>=8)return {ok:false,code:'RATE_LIMIT',message:'พยายามเข้าสู่ระบบหลายครั้ง กรุณารอแล้วลองใหม่',retryAfter:Math.ceil((state.until-timestamp)/1000)};
  state.total++;state.clients[p.key]=(state.clients[p.key]||0)+1;props.setProperty(key,JSON.stringify(state));return {ok:true};
 }finally{lock.releaseLock();}
}
function cleanRow_(row){const value={};Object.keys(row).filter(k=>k!=='_row'&&k!=='_version').sort().forEach(k=>value[k]=row[k]);return value;}
function rowVersion_(row){return row?JSON.stringify(cleanRow_(row)):'';}
function adminRow_(row){
 const out={};Object.keys(row).filter(k=>k!=='_row').forEach(k=>{
  const value=row[k];out[k]=value instanceof Date?new Date(value.getTime()+7*3600000).toISOString().slice(0,19):text_(value);
  if(['enrolled_on','withdrawn_on'].includes(k))out[k]=out[k].slice(0,10);
 });out._version=rowVersion_(row);return out;
}
function settingsMap_(db){const result={};table_(db,'Settings').rows.forEach(r=>result[text_(r.key)]=text_(r.value));return result;}
function adminRead_(db,p,now){
 const students=table_(db,'Students').rows,sessions=table_(db,'Sessions').rows;
 const ordered=sessions.slice().sort((a,b)=>(date_(b.starts_at)||0)-(date_(a.starts_at)||0));
 const selected=p.sessionId?sessions.find(r=>text_(r.session_id)===p.sessionId):(sessions.find(r=>r.status==='open'&&date_(r.starts_at)&&day_(date_(r.starts_at))===day_(now))||ordered[0]);
 if(p.sessionId&&!selected)fail_('BAD_INPUT','ไม่พบรอบเรียนที่เลือก');
 const settings=settingsMap_(db),attendance=selected?table_(db,'Attendance').rows.filter(r=>text_(r.session_id)===text_(selected.session_id)):[];
 return {ok:true,data:{settings,settingsVersion:rowVersion_(settings),students:students.map(adminRow_),sessions:ordered.map(adminRow_),attendance:attendance.map(adminRow_),eligibleStudentIds:selected?students.filter(s=>eligible_(s,selected)).map(s=>text_(s.student_id)):[],selectedSessionId:selected?text_(selected.session_id):'',audit:table_(db,'AuditLog').rows.slice(-50).reverse().map(adminRow_)}};
}
function requiredText_(p,key,max){const v=text_(p[key]);if(!v||v.length>(max||120))fail_('BAD_INPUT','กรุณาตรวจข้อมูล '+key);return v;}
function thaiDate_(value,optional){
 const v=text_(value);if(!v&&optional)return '';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))fail_('BAD_INPUT','วันที่ไม่ถูกต้อง');
 const d=new Date(v+'T00:00:00+07:00');if(!Number.isFinite(d.getTime())||day_(d)!==v)fail_('BAD_INPUT','วันที่ไม่ถูกต้อง');return d;
}
function thaiDateTime_(value){
 const v=text_(value);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v))fail_('BAD_INPUT','วันเวลาไม่ถูกต้อง');
 const d=new Date(v+'+07:00');if(!Number.isFinite(d.getTime())||new Date(d.getTime()+7*3600000).toISOString().slice(0,v.length)!==v)fail_('BAD_INPUT','วันเวลาไม่ถูกต้อง');return d;
}
function checkVersion_(before,expected){if(rowVersion_(before)!==expected)fail_('CONFLICT','ข้อมูลนี้เปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไข');}
function audit_(db,entity,id,before,after,actor,reason,now){
 const old={},updated={};Object.keys(after).filter(k=>k!=='_row'&&k!=='_version').forEach(k=>{if(JSON.stringify(before?before[k]:'')!==JSON.stringify(after[k])){old[k]=before?before[k]:'';updated[k]=after[k];}});
 write_(table_(db,'AuditLog'),{audit_id:Utilities.getUuid(),occurred_at:now,actor_id:actor,action:entity==='Attendance'?'correct':before?'update':'create',entity_type:entity,entity_id:id,before_json:JSON.stringify(old),after_json:JSON.stringify(updated),reason:reason||''});
}
function ensureSessionColumns_(db){
 const t=table_(db,'Sessions'),extra=['late_at','absence_at','room_name','latitude','longitude','radius_m','max_accuracy_m'].filter(k=>!t.headers.includes(k));
 if(extra.length)t.sheet.getRange(1,t.headers.length+1,1,extra.length).setValues([extra]);
 return table_(db,'Sessions');
}
function geometry_(row){
 const values=['latitude','longitude','radius_m','max_accuracy_m'].map(k=>{if(text_(row[k])==='')fail_('BAD_INPUT','กรอกพิกัดและรัศมีให้ครบ');return Number(row[k]);});
 if(!values.every(Number.isFinite)||Math.abs(values[0])>90||Math.abs(values[1])>180||values[2]<=0||values[3]<=0||values[3]>values[2])fail_('BAD_INPUT','พิกัดหรือรัศมีไม่ถูกต้อง ความคลาดเคลื่อนต้องไม่เกินรัศมี');
}
function adminAction_(db,action,p,now){
 if(action==='adminRead')return adminRead_(db,p,now);
 const actor=requiredText_(p,'actor'),lock=LockService.getScriptLock();if(!lock.tryLock(8000))fail_('BUSY','มีการบันทึกพร้อมกัน กรุณาลองใหม่');
 try{
  // Require the audit sheet before making any changes.
  table_(db,'AuditLog');
  if(action==='adminSaveStudent'){
   const t=table_(db,'Students'),id=requiredText_(p,'student_id'),before=t.rows.find(r=>text_(r.student_id)===id);checkVersion_(before,p._version);
   const row=Object.assign({},before||{},{student_id:id,student_code:requiredText_(p,'student_code'),full_name:requiredText_(p,'full_name'),group_name:text_(p.group_name),class_level:requiredText_(p,'class_level'),status:p.status,enrolled_on:thaiDate_(p.enrolled_on),withdrawn_on:thaiDate_(p.withdrawn_on,true)});
   if(!['active','inactive'].includes(row.status)||row.withdrawn_on&&row.withdrawn_on<row.enrolled_on)fail_('BAD_INPUT','สถานะหรือวันที่พ้นสภาพไม่ถูกต้อง');
   if(t.rows.some(r=>text_(r.student_code)===row.student_code&&text_(r.student_id)!==id))fail_('BAD_INPUT','รหัสนักศึกษานี้มีอยู่แล้ว');
   write_(t,row,before&&before._row);audit_(db,'Students',id,before,row,actor,'',now);
  }else if(action==='adminSaveSession'){
   let t=table_(db,'Sessions');const id=requiredText_(p,'session_id'),before=t.rows.find(r=>text_(r.session_id)===id);checkVersion_(before,p._version);
   const row=Object.assign({},before||{},{session_id:id,session_number:Number(p.session_number),topic:text_(p.topic),group_name:text_(p.group_name),class_level:sessionLevels_(p).join(', '),status:p.status,room_name:requiredText_(p,'room_name')});
   ['starts_at','ends_at','checkin_opens_at','checkin_closes_at','late_at','absence_at'].forEach(k=>row[k]=thaiDateTime_(p[k]));
   ['latitude','longitude','radius_m','max_accuracy_m'].forEach(k=>{requiredText_(p,k);row[k]=Number(p[k]);});geometry_(row);
   const w=sessionWindow_(row);if(!w||!Number.isInteger(row.session_number)||row.session_number<1||!['draft','open','closed','cancelled'].includes(row.status)||row.late_at<w.start||row.absence_at<=row.late_at||row.absence_at>w.close||row.absence_at>w.end||day_(w.open)!==day_(w.start)||day_(w.close)!==day_(w.start)||day_(w.end)!==day_(w.start))fail_('BAD_INPUT','ตรวจลำดับเวลา: เปิด ≤ เริ่ม ≤ สาย < ขาด ≤ ปิดและจบเรียน โดยใช้วันเดียวกัน');
   if(row.status==='open'&&t.rows.some(r=>{const other=sessionWindow_(r);return text_(r.session_id)!==id&&r.status==='open'&&other&&levelsOverlap_(r,row)&&(!text_(r.group_name)||!row.group_name||text_(r.group_name)===row.group_name)&&w.open<=other.close&&w.close>=other.open;}))fail_('BAD_INPUT','ช่วงเปิดเช็คชื่อซ้อนกับรอบของระดับชั้น/กลุ่มเดียวกัน กรุณาปรับเวลา');
   t=ensureSessionColumns_(db);write_(t,row,before&&before._row);audit_(db,'Sessions',id,before,row,actor,'',now);
  }else if(action==='adminSaveSettings'){
   const before=settingsMap_(db);checkVersion_(before,p._version);
   const allowed=['course_name','teacher_name','term','location_name','room_name','latitude','longitude','radius_m','max_accuracy_m','late_policy','absence_policy'],after=Object.assign({},before);
   allowed.forEach(k=>after[k]=k==='term'?text_(p[k]):requiredText_(p,k));geometry_(after);configurationValues_(after,db.getSpreadsheetTimeZone());
   const t=table_(db,'Settings');allowed.forEach(k=>{const row=t.rows.find(r=>text_(r.key)===k);write_(t,{key:k,value:after[k],description:row?row.description:''},row&&row._row);});
   audit_(db,'Settings','settings',before,after,actor,'',now);
  }else if(action==='adminAttendance'){
   const sid=requiredText_(p,'session_id'),studentId=requiredText_(p,'student_id'),reason=requiredText_(p,'reason',500),session=table_(db,'Sessions').rows.find(r=>text_(r.session_id)===sid),student=table_(db,'Students').rows.find(r=>text_(r.student_id)===studentId),t=table_(db,'Attendance');
   if(!session||!student||!['present','late','absent','excused'].includes(p.status))fail_('BAD_INPUT','ไม่พบผู้เรียน/รอบเรียน หรือสถานะไม่ถูกต้อง');
   const existing=t.rows.filter(r=>text_(r.session_id)===sid&&text_(r.student_id)===studentId);if(existing.length>1)fail_('DUPLICATE_DATA','พบรายการซ้ำ กรุณาตรวจชีตก่อน');
   const before=existing[0];checkVersion_(before,p._version);if(!before&&!eligible_(student,session))fail_('BAD_INPUT','ผู้เรียนไม่อยู่ในกลุ่มของรอบนี้');
   const row=Object.assign({},before||{attendance_id:Utilities.getUuid(),session_id:sid,student_id:studentId,created_at:now,class_level:student.class_level,location_status:'not_checked'},{status:p.status,method:'teacher',recorded_by:actor,note:reason,updated_at:now});
   write_(t,row,before&&before._row);audit_(db,'Attendance',row.attendance_id,before,row,actor,reason,now);
  }else fail_('BAD_INPUT','คำขอไม่ถูกต้อง');
  SpreadsheetApp.flush();return {ok:true,message:'บันทึกเรียบร้อยแล้ว'};
 }finally{lock.releaseLock();}
}
/* Install this as a 5-minute time-driven trigger. Only fills missing records.
 * No record is created for students outside the session's class/group/dates.
 * Existing present, late, absent, or teacher-approved excused is preserved.
 */
function finalizeAbsences(){
 const now=new Date(),db=db_(),c=configuration_(db);
 const sessions=table_(db,'Sessions').rows.filter(r=>{const w=sessionWindow_(r);return ['open','closed'].includes(r.status)&&w&&day_(w.start)===day_(now)&&now>=w.start&&now>=sessionPolicy_(r,c).absenceAt;});
 const students=table_(db,'Students').rows,lock=LockService.getScriptLock();if(!lock.tryLock(8000))return;
 try{const t=table_(db,'Attendance'),keys=new Set(t.rows.map(r=>text_(r.session_id)+'|'+text_(r.student_id))),rows=[];
  sessions.forEach(session=>students.filter(s=>eligible_(s,session)).forEach(s=>{const key=text_(session.session_id)+'|'+text_(s.student_id);if(keys.has(key))return;keys.add(key);const row={attendance_id:Utilities.getUuid(),session_id:session.session_id,student_id:s.student_id,status:'absent',method:'system',recorded_by:'SYSTEM',note:'ไม่พบการเช็คชื่อก่อนเวลาขาดของรอบเรียน',created_at:now,updated_at:now,class_level:s.class_level,location_status:'not_checked'};rows.push(t.headers.map(h=>safeCell_(row[h]===undefined?'':row[h])));}));
  if(rows.length)t.sheet.getRange(t.sheet.getLastRow()+1,1,rows.length,t.headers.length).setValues(rows);SpreadsheetApp.flush();
 }finally{lock.releaseLock();}
}
