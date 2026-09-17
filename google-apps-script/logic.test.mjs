import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const schema=JSON.parse(fs.readFileSync(new URL('../spreadsheet/schema.json',import.meta.url),'utf8'));
const when=t=>new Date('2026-09-16T'+t+'+07:00');
function setup(){
 const data={};
 for(const [name,fields] of Object.entries(schema))data[name]=[fields.map(f=>f.split('|')[0])];
 const put=(name,row)=>data[name].push(data[name][0].map(h=>row[h]??''));
 put('Students',{student_id:'s1',student_code:'0001',full_name:'นักเรียน ทดสอบ',class_level:'ปวช.1',status:'active'});
 put('Sessions',{session_id:'class1',starts_at:when('08:00:00'),ends_at:when('12:00:00'),checkin_opens_at:when('07:30:00'),checkin_closes_at:when('12:00:00'),status:'open',class_level:'ปวช.1'});
 const db={getSpreadsheetTimeZone:()=> 'Asia/Bangkok',getSheetByName(name){if(!data[name])return null;return {getDataRange:()=>({getValues:()=>data[name].map(r=>Array.from({length:data[name][0].length},(_,i)=>r[i]??''))}),getLastRow:()=>data[name].length,getRange:(row,col,rows,cols)=>({setValues(values){for(let i=0;i<rows;i++){data[name][row-1+i]??=[];for(let j=0;j<cols;j++)data[name][row-1+i][col-1+j]=values[i][j];}}})};}};
 let locked=false;
 const properties={SPREADSHEET_ID:'test-sheet',API_SECRET:'secret'.repeat(10)};
 const ctx=vm.createContext({Date,Math,Number,JSON,Set,Error,String,PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k]||null,setProperty(k,v){properties[k]=v;}})},SpreadsheetApp:{openById:()=>db,flush(){}},LockService:{getScriptLock:()=>({tryLock(){if(locked)return false;locked=true;return true;},releaseLock(){locked=false;}})},Utilities:{getUuid:randomUUID},ContentService:{MimeType:{JSON:'application/json'},createTextOutput:s=>({setMimeType:()=>s})}});
 vm.runInContext(source,ctx);
 return {ctx,db,data,put,config:{latitude:18,longitude:99,radius:100,maxAccuracy:30,lateMinute:510,absenceMinute:540},payload:{identity:'0001',level:'ปวช.1',latitude:18,longitude:99,accuracy:5,requestId:randomUUID()}};
}
test('inclusive Bangkok cutoffs and seconds',()=>{const {ctx,config}=setup();for(const [t,result] of [['08:29:59','present'],['08:30:00','late'],['08:59:59','late'],['09:00:00','absent']])assert.equal(ctx.classify_(when(t),config),result);});
test('test cutoffs can be configured to 08:10 and 08:15',()=>{const {ctx}=setup(),c={lateMinute:490,absenceMinute:495};for(const [t,result] of [['08:09:59','present'],['08:10:00','late'],['08:14:59','late'],['08:15:00','absent']])assert.equal(ctx.classify_(when(t),c),result);});
test('geofence rejects outside, uncertain and malformed coordinates',()=>{const {ctx,config,payload}=setup();assert.equal(ctx.location_(payload,config),0);assert.throws(()=>ctx.location_({...payload,latitude:19},config),e=>e.code==='OUTSIDE');assert.throws(()=>ctx.location_({...payload,accuracy:31},config),e=>e.code==='LOW_ACCURACY');assert.throws(()=>ctx.location_({...payload,latitude:18.0008,accuracy:20},config),e=>e.code==='UNCERTAIN');assert.throws(()=>ctx.location_({...payload,latitude:NaN},config),e=>e.code==='BAD_LOCATION');});
test('first accepted arrival is preserved through repeated submissions',()=>{const {ctx,db,data,config,payload}=setup();assert.equal(ctx.checkIn_(db,config,payload,when('08:29:59')).receipt.status,'present');const repeated=ctx.checkIn_(db,config,payload,when('09:10:00'));assert.equal(repeated.receipt.status,'present');assert.equal(repeated.receipt.duplicate,true);assert.equal(data.Attendance.length,2);});
test('first arrival at 09:00 records absent plus coordinates',()=>{const {ctx,db,data,config,payload}=setup();const r=ctx.checkIn_(db,config,payload,when('09:00:00'));assert.equal(r.receipt.status,'absent');assert.equal(data.Attendance[1][data.Attendance[0].indexOf('latitude')],18);});
test('wrong class and ambiguous names cannot write attendance',()=>{const {ctx,db,data,put,config,payload}=setup();assert.throws(()=>ctx.checkIn_(db,config,{...payload,level:'ปวช.2'},when('08:00:00')),e=>e.code==='IDENTITY');put('Students',{student_id:'s2',student_code:'0002',full_name:'นักเรียน ทดสอบ',class_level:'ปวช.1',status:'active'});assert.throws(()=>ctx.checkIn_(db,config,{...payload,identity:'นักเรียน ทดสอบ'},when('08:00:00')),e=>e.code==='IDENTITY');assert.equal(data.Attendance.length,1);});
test('before opening, closed and cancelled sessions cannot write',()=>{for(const state of ['closed','cancelled','open']){const {ctx,db,data,config,payload}=setup();data.Sessions[1][data.Sessions[0].indexOf('status')]=state;assert.throws(()=>ctx.checkIn_(db,config,payload,when(state==='open'?'07:29:59':'08:00:00')),e=>e.code==='NO_SESSION');assert.equal(data.Attendance.length,1);}});
test('outside location never becomes accepted attendance',()=>{const {ctx,db,data,config,payload}=setup();assert.throws(()=>ctx.checkIn_(db,config,{...payload,latitude:19},when('08:00:00')));assert.equal(data.Attendance.length,1);});
test('automatic absence later gains real check-in coordinates, stays absent',()=>{const {ctx,db,put,data,config,payload}=setup();put('Attendance',{attendance_id:'auto1',session_id:'class1',student_id:'s1',status:'absent',method:'system',created_at:when('09:01:00'),note:'ไม่พบการเช็คชื่อก่อน 09:00'});const result=ctx.checkIn_(db,config,payload,when('09:05:00'));assert.equal(result.receipt.status,'absent');assert.equal(result.receipt.recordedAt,when('09:05:00').toISOString());assert.equal(data.Attendance.length,2);});
test('missing coordinates fail closed; empty values are not treated as zero',()=>{const {ctx,db,put}=setup();put('Settings',{key:'schema_version',value:'class-v2'});assert.throws(()=>ctx.configuration_(db),e=>e.code==='NOT_CONFIGURED');});
test('unauthorized endpoint cannot expose student data',()=>{const {ctx}=setup();const r=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({action:'config',secret:'wrong'})}}));assert.equal(r.code,'UNAUTHORIZED');assert.equal(r.config,undefined);});
test('absence sweep batches missing eligible students and is idempotent',()=>{
 const {ctx,db,data,put}=setup();
 for(const [key,value] of Object.entries({schema_version:'class-v2',timezone:'Asia/Bangkok',room_name:'test room',latitude:'18',longitude:'99',radius_m:'100',max_accuracy_m:'30',late_policy:'08:30',absence_policy:'09:00'}))put('Settings',{key,value});
 for(let i=2;i<=300;i++)put('Students',{student_id:'s'+i,student_code:String(i).padStart(4,'0'),full_name:'test '+i,class_level:'ปวช.1',status:'active'});
 put('Students',{student_id:'other',class_level:'ปวช.2',status:'active'});
 put('Attendance',{attendance_id:'first',session_id:'class1',student_id:'s1',status:'present',checked_at:when('08:00:00'),created_at:when('08:00:00')});
 ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[when('09:00:00').getTime()]));}};
 ctx.finalizeAbsences();ctx.finalizeAbsences();
 assert.equal(data.Attendance.length,301);
 const rows=ctx.table_(db,'Attendance').rows;assert.equal(rows.filter(x=>x.status==='present').length,1);assert.equal(rows.filter(x=>x.status==='absent').length,299);assert.ok(rows.every(x=>x.student_id!=='other'));
});

const settings={schema_version:'class-v2',timezone:'Asia/Bangkok',course_name:'Test course',teacher_name:'Teacher',term:'1/2569',location_name:'Test school',room_name:'Room A',latitude:'18',longitude:'99',radius_m:'100',max_accuracy_m:'30',late_policy:'08:30',absence_policy:'09:00'};
function adminSetup(){const s=setup();for(const [key,value] of Object.entries(settings))s.put('Settings',{key,value});return s;}
function studentDraft(){return {student_id:'new-student',student_code:'0007',full_name:'นักเรียน ใหม่',class_level:'ปวช.1',group_name:'',status:'active',enrolled_on:'2026-01-01',withdrawn_on:'',_version:'',actor:'test-admin'};}
function sessionDraft(){return {session_id:'afternoon',session_number:'2',topic:'คาบบ่าย',class_level:'ปวช.1',group_name:'',status:'open',starts_at:'2026-09-16T13:00',ends_at:'2026-09-16T15:00',checkin_opens_at:'2026-09-16T12:30',checkin_closes_at:'2026-09-16T15:00',late_at:'2026-09-16T13:10',absence_at:'2026-09-16T13:15',room_name:'Room B',latitude:'19',longitude:'100',radius_m:'100',max_accuracy_m:'30',_version:'',actor:'test-admin'};}
test('admin create and update student keep stable ID, audit and reject stale edits',()=>{
 const {ctx,db,data}=adminSetup(),p=studentDraft();
 ctx.adminAction_(db,'adminSaveStudent',p,when('08:00:00'));
 const before=ctx.table_(db,'Students').rows.find(r=>r.student_id===p.student_id);
 const edit={...p,full_name:'แก้ไข ชื่อ',_version:ctx.rowVersion_(before)};
 ctx.adminAction_(db,'adminSaveStudent',edit,when('08:01:00'));
 assert.equal(data.Students.length,3);assert.equal(data.AuditLog.length,3);
 assert.throws(()=>ctx.adminAction_(db,'adminSaveStudent',edit,when('08:02:00')),e=>e.code==='CONFLICT');
 const rows=ctx.table_(db,'AuditLog').rows;assert.equal(rows[1].actor_id,'test-admin');assert.match(rows[1].before_json,/นักเรียน ใหม่/);assert.match(rows[1].after_json,/แก้ไข ชื่อ/);
});
test('duplicate student codes and impossible dates are rejected without writes',()=>{
 const {ctx,db,data}=adminSetup();
 assert.throws(()=>ctx.adminAction_(db,'adminSaveStudent',{...studentDraft(),student_code:'0001'},when('08:00:00')));
 assert.throws(()=>ctx.adminAction_(db,'adminSaveStudent',{...studentDraft(),enrolled_on:'2026-02-30'},when('08:00:00')));
 assert.equal(data.Students.length,2);assert.equal(data.AuditLog.length,1);
});
test('session saves add extension columns without changing existing IDs or rows',()=>{
 const {ctx,db,data}=adminSetup();ctx.adminAction_(db,'adminSaveSession',sessionDraft(),when('08:00:00'));
 assert.ok(data.Sessions[0].includes('late_at'));assert.equal(data.Sessions.length,3);
 const rows=ctx.table_(db,'Sessions').rows;assert.equal(rows[0].session_id,'class1');assert.equal(rows[1].late_at.toISOString(),when('13:10:00').toISOString());
 assert.equal(data.AuditLog.length,2);
});
test('overlapping windows for matching students are rejected; other groups may coexist',()=>{
 const {ctx,db}=adminSetup();const base=sessionDraft();ctx.adminAction_(db,'adminSaveSession',{...base,group_name:'A'},when('08:00:00'));
 assert.throws(()=>ctx.adminAction_(db,'adminSaveSession',{...base,session_id:'overlap'},when('08:00:00')),e=>e.code==='BAD_INPUT');
 assert.equal(ctx.adminAction_(db,'adminSaveSession',{...base,session_id:'other-group',group_name:'B'},when('08:00:00')).ok,true);
});
test('invalid cutoff ordering and an opening on another date cannot be saved',()=>{
 const {ctx,db,data}=adminSetup();
 for(const patch of [{absence_at:'2026-09-16T13:05'},{late_at:'2026-09-16T12:59'},{checkin_opens_at:'2026-09-15T12:30'},{ends_at:'2026-09-16T13:14'}])assert.throws(()=>ctx.adminAction_(db,'adminSaveSession',{...sessionDraft(),...patch},when('08:00:00')));
 assert.equal(data.Sessions.length,2);assert.equal(data.AuditLog.length,1);
});
test('afternoon attendance uses its own location and cutoff, never morning defaults',()=>{
 for(const [time,result] of [['13:09:59','present'],['13:10:00','late'],['13:15:00','absent']]){
  const {ctx,db,config,payload}=adminSetup();ctx.adminAction_(db,'adminSaveSession',sessionDraft(),when('08:00:00'));
  assert.throws(()=>ctx.checkIn_(db,config,payload,when(time)),e=>e.code==='OUTSIDE');
  const saved=ctx.checkIn_(db,config,{...payload,latitude:19,longitude:100},when(time));assert.equal(saved.receipt.status,result);
 }
});
test('absence sweep waits for each session cutoff instead of marking afternoon absent early',()=>{
 const {ctx,db}=adminSetup();ctx.adminAction_(db,'adminSaveSession',sessionDraft(),when('08:00:00'));
 let now=when('13:00:00');ctx.Date=class extends Date{constructor(...args){super(...(args.length?args:[now.getTime()]));}};
 ctx.finalizeAbsences();assert.equal(ctx.table_(db,'Attendance').rows.filter(r=>r.session_id==='afternoon').length,0);
 now=when('13:15:00');ctx.finalizeAbsences();ctx.finalizeAbsences();assert.equal(ctx.table_(db,'Attendance').rows.filter(r=>r.session_id==='afternoon').length,1);
});
test('teacher correction keeps real arrival time and survives student retries',()=>{
 const {ctx,db,config,payload}=adminSetup();ctx.checkIn_(db,config,payload,when('08:31:00'));
 const before=ctx.table_(db,'Attendance').rows[0];
 ctx.adminAction_(db,'adminAttendance',{session_id:'class1',student_id:'s1',status:'excused',reason:'อาจารย์อนุมัติ',_version:ctx.rowVersion_(before),actor:'test-admin'},when('08:40:00'));
 assert.equal(ctx.table_(db,'Attendance').rows[0].checked_at.toISOString(),when('08:31:00').toISOString());
 assert.equal(ctx.checkIn_(db,config,payload,when('08:50:00')).receipt.status,'excused');
 assert.equal(ctx.table_(db,'AuditLog').rows[0].reason,'อาจารย์อนุมัติ');
});
test('manual attendance has no invented GPS or arrival and is not overwritten',()=>{
 const {ctx,db,config,payload}=adminSetup();
 ctx.adminAction_(db,'adminAttendance',{session_id:'class1',student_id:'s1',status:'present',reason:'ตรวจในห้องแล้ว',_version:'',actor:'test-admin'},when('08:10:00'));
 const row=ctx.table_(db,'Attendance').rows[0];assert.equal(row.checked_at,'');assert.equal(row.latitude,'');
 assert.equal(ctx.checkIn_(db,config,payload,when('08:35:00')).receipt.status,'present');assert.equal(ctx.table_(db,'Attendance').rows[0].checked_at,'');
});
test('corrections require a reason and cannot overwrite a newer check-in',()=>{
 const {ctx,db,config,payload}=adminSetup();
 const edit={session_id:'class1',student_id:'s1',status:'present',reason:'',_version:'',actor:'test-admin'};
 assert.throws(()=>ctx.adminAction_(db,'adminAttendance',edit,when('08:00:00')));
 ctx.checkIn_(db,config,payload,when('08:00:00'));
 assert.throws(()=>ctx.adminAction_(db,'adminAttendance',{...edit,reason:'test'},when('08:01:00')),e=>e.code==='CONFLICT');
});
test('settings updates preserve protected keys, validate geometry and audit changes',()=>{
 const {ctx,db,data}=adminSetup(),before=ctx.settingsMap_(db);
 const p={...settings,_version:ctx.rowVersion_(before),actor:'test-admin',course_name:'New course',schema_version:'evil'};
 assert.throws(()=>ctx.adminAction_(db,'adminSaveSettings',{...p,max_accuracy_m:'101'},when('08:00:00')));
 assert.equal(data.AuditLog.length,1);
 ctx.adminAction_(db,'adminSaveSettings',p,when('08:01:00'));
 assert.equal(ctx.settingsMap_(db).schema_version,'class-v2');assert.equal(ctx.configuration_(db).course,'New course');assert.equal(data.AuditLog.length,2);
});
test('admin read scopes attendance to one round and includes legacy row versions',()=>{
 const {ctx,db,put}=adminSetup();put('Attendance',{attendance_id:'a1',session_id:'class1',student_id:'s1',status:'present'});put('Attendance',{attendance_id:'a2',session_id:'other',student_id:'s1',status:'late'});
 const result=ctx.adminRead_(db,{sessionId:'class1'},when('08:00:00')).data;
 assert.equal(result.attendance.length,1);assert.equal(result.attendance[0].attendance_id,'a1');assert.ok(result.students[0]._version);assert.equal(result.eligibleStudentIds.length,1);
});
test('login throttling persists between requests and unlocks after the window',()=>{
 const {ctx}=adminSetup(),p={key:'a'.repeat(64)};
 for(let i=0;i<8;i++)assert.equal(ctx.adminLoginAttempt_(p,when('08:00:00')).ok,true);
 assert.equal(ctx.adminLoginAttempt_(p,when('08:01:00')).code,'RATE_LIMIT');
 assert.equal(ctx.adminLoginAttempt_({key:'b'.repeat(64)},when('08:01:00')).ok,true);
 assert.equal(ctx.adminLoginAttempt_(p,when('08:15:00')).ok,true);
});
test('invalid API secret cannot read admin data or mutate any sheets',()=>{
 const {ctx,data}=adminSetup();
 for(const action of ['adminRead','adminSaveStudent','adminSaveSession','adminSaveSettings','adminAttendance','adminLoginAttempt']){
  const result=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({action,secret:'wrong',payload:studentDraft()})}}));assert.equal(result.code,'UNAUTHORIZED');assert.equal(result.data,undefined);
 }assert.equal(data.AuditLog.length,1);assert.equal(data.Students.length,2);
});
