import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const out=fileURLToPath(new URL('../spreadsheet/', import.meta.url));
const wb=Workbook.create();
// Stable machine-readable field names. Thai explanations live in Dictionary.
const schema={
 Settings:['key|text|รหัสการตั้งค่า ห้ามซ้ำ','value|text|ค่าการตั้งค่า','description|text|คำอธิบาย'],
 Employees:['employee_id|id|รหัสถาวร ห้ามซ้ำ เช่น EMP0001','employee_code|text|รหัสที่บริษัทใช้ ต้องไม่ซ้ำ','full_name|text|ชื่อและนามสกุล','department_id|id|อ้างอิง Departments','job_title|text|ตำแหน่งงาน','manager_employee_id|id|หัวหน้างาน อ้างอิง Employees เว้นว่างได้','auth_subject|text|รหัสจากระบบยืนยันตัวตน ต้องไม่ซ้ำเมื่อระบุ','role|enum|employee / manager / admin','status|enum|active / inactive','start_date|date|วันที่เริ่มงาน','end_date|date|วันสิ้นสุดงาน เว้นว่างได้','created_at|datetime|เวลาสร้างโดยเซิร์ฟเวอร์','updated_at|datetime|เวลาแก้ไขล่าสุดโดยเซิร์ฟเวอร์'],
 Departments:['department_id|id|รหัสแผนก ห้ามซ้ำ','department_name|text|ชื่อแผนก','active|boolean|เปิดใช้งาน TRUE หรือ FALSE'],
 Locations:['location_id|id|รหัสสถานที่ ห้ามซ้ำ','location_name|text|ชื่อสถานที่ลงเวลา','latitude|number|ละติจูด -90 ถึง 90','longitude|number|ลองจิจูด -180 ถึง 180','radius_m|number|รัศมีอนุญาต หน่วยเมตร ต้องมากกว่า 0','max_accuracy_m|number|ค่าความคลาดเคลื่อน GPS สูงสุด หน่วยเมตร','active|boolean|เปิดใช้งาน TRUE หรือ FALSE'],
 Shifts:['shift_id|id|รหัสรุ่นกะ ห้ามซ้ำ เปลี่ยนนโยบายให้สร้างรหัสใหม่','shift_name|text|ชื่อกะ','start_time|time|เวลาเริ่มกะ','end_time|time|เวลาสิ้นสุดกะ','end_day_offset|integer|0 จบวันเดียวกัน หรือ 1 จบวันถัดไป','break_minutes|integer|เวลาพักที่หัก หน่วยนาที','late_grace_minutes|integer|เวลาผ่อนผันการมาสาย หน่วยนาที','active|boolean|เปิดใช้งาน TRUE หรือ FALSE'],
 Roster:['roster_id|id|รหัสตารางกะ ห้ามซ้ำ','employee_id|id|อ้างอิง Employees','work_date|date|วันที่เริ่มกะ แม้กะจบวันถัดไป','shift_id|id|อ้างอิง Shifts','location_id|id|อ้างอิง Locations','day_type|enum|work / off / holiday','scheduled_start_at|datetime|วันเวลาเริ่มกะที่กำหนดจริง','scheduled_end_at|datetime|วันเวลาจบกะที่กำหนดจริง','break_minutes|integer|สำเนาเวลาพักของกะในวันนั้น','late_grace_minutes|integer|สำเนาเวลาผ่อนผันในวันนั้น','updated_at|datetime|เวลาแก้ไขล่าสุด'],
 Attendance:['event_id|id|รหัสเหตุการณ์จากเซิร์ฟเวอร์ ห้ามซ้ำ','request_id|id|รหัสคำขอเดิมเมื่อส่งซ้ำ ใช้ป้องกันบันทึกซ้ำ','employee_id|id|อ้างอิง Employees จากผู้ที่เข้าสู่ระบบ','roster_id|id|อ้างอิง Roster หากไม่พบให้ส่งตรวจสอบ','work_date|date|วันที่เริ่มกะ ไม่ใช่วันที่เช็คเอาต์เสมอไป','event_type|enum|IN / OUT','recorded_at|datetime|เวลารับลงเวลาจากเซิร์ฟเวอร์','latitude|number|พิกัดที่อุปกรณ์ส่งมา','longitude|number|พิกัดที่อุปกรณ์ส่งมา','accuracy_m|number|ความคลาดเคลื่อน GPS หน่วยเมตร','location_id|id|สถานที่ที่ตรวจสอบ','distance_m|number|ระยะจากจุดลงเวลา เซิร์ฟเวอร์คำนวณ','photo_file_id|text|รหัสไฟล์รูปในพื้นที่จัดเก็บส่วนตัว เว้นว่างได้','qr_verified|boolean|ผลตรวจ QR โดยเซิร์ฟเวอร์','validation_status|enum|accepted / rejected / review','reason_code|text|เหตุผล เช่น OUTSIDE_RADIUS หรือ NO_ROSTER'],
 DailySummary:['summary_id|id|รหัสผลสรุป ห้ามซ้ำ','roster_id|id|อ้างอิง Roster ต้องไม่ซ้ำ','employee_id|id|อ้างอิง Employees','work_date|date|วันที่เริ่มกะ','first_in_at|datetime|เวลาเข้าแรกที่ยอมรับ','last_out_at|datetime|เวลาออกสุดท้ายที่ยอมรับ','worked_minutes|integer|เวลาทำงานหลังหักพัก คำนวณฝั่งระบบ','late_minutes|integer|นาทีมาสายตามนโยบายที่ตกลง','early_leave_minutes|integer|นาทีออกก่อนตามนโยบายที่ตกลง','approved_ot_minutes|integer|เฉพาะ OT ที่อนุมัติแล้ว ห้ามนับเวลาเกินกะเป็น OT อัตโนมัติ','status|enum|complete / incomplete / absent / leave / off / review','calculated_at|datetime|เวลาคำนวณล่าสุด'],
 LeaveTypes:['leave_type_id|id|รหัสประเภทลา ห้ามซ้ำ','leave_type_name|text|ชื่อประเภทลา','requires_attachment|boolean|ต้องแนบเอกสารหรือไม่','active|boolean|เปิดใช้งาน TRUE หรือ FALSE'],
 LeaveRequests:['leave_id|id|รหัสคำขอลา ห้ามซ้ำ','employee_id|id|ผู้ขอลา อ้างอิง Employees','leave_type_id|id|อ้างอิง LeaveTypes','start_at|datetime|วันเวลาเริ่มลา','end_at|datetime|วันเวลาสิ้นสุดลา','requested_minutes|integer|นาทีลาตามตารางงาน ห้ามนับวันหยุดเป็นเวลาลาโดยอัตโนมัติ','reason|text|เหตุผลที่จำเป็นต่อการอนุมัติ','attachment_file_id|text|รหัสไฟล์แนบส่วนตัว เว้นว่างได้','status|enum|pending / approved / rejected / cancelled','reviewer_employee_id|id|ผู้พิจารณา อ้างอิง Employees','reviewed_at|datetime|เวลาที่พิจารณา','review_note|text|ความเห็นผู้พิจารณา','created_at|datetime|เวลาสร้างคำขอ'],
 Holidays:['holiday_id|id|รหัสวันหยุด ห้ามซ้ำ','holiday_date|date|วันที่หยุด','holiday_name|text|ชื่อวันหยุดบริษัท','location_id|id|สถานที่ที่ใช้ เว้นว่างหมายถึงทุกสถานที่'],
 AuditLog:['audit_id|id|รหัสประวัติ ห้ามซ้ำ','occurred_at|datetime|เวลาที่ดำเนินการ','actor_employee_id|id|ผู้ดำเนินการ หรือ SYSTEM','action|enum|create / update / approve / reject / cancel / correct / archive','entity_type|text|ชื่อแท็บหรือประเภทข้อมูล','entity_id|id|รหัสรายการที่ได้รับผล','before_json|text|ค่าก่อนแก้ เฉพาะช่องที่เปลี่ยน ห้ามเก็บความลับ','after_json|text|ค่าหลังแก้ เฉพาะช่องที่เปลี่ยน','reason|text|เหตุผลการแก้ไขหรือยกเลิก'],
 ArchiveIndex:['archive_id|id|รหัสชุดเก็บประวัติ ห้ามซ้ำ','entity_type|text|Attendance / DailySummary / AuditLog / Roster','period_start|date|วันแรกของช่วงข้อมูล รวมวันนี้','period_end_exclusive|date|วันถัดจากวันสุดท้าย ไม่รวมวันนี้','spreadsheet_id|text|รหัสไฟล์ Google Sheets ปลายทาง','sheet_name|text|ชื่อแท็บปลายทาง','row_count|integer|จำนวนรายการที่ตรวจสอบแล้ว','archived_at|datetime|เวลาที่เก็บประวัติ','status|enum|pending / verified / failed']
};
const guide=wb.worksheets.add('StartHere');
for(const name of Object.keys(schema)) wb.worksheets.add(name);
const dict=wb.worksheets.add('Dictionary');
const blue='#17365D', ink='#152A43';
function style(sh,rows,cols){
 sh.showGridLines=false;
 const r=sh.getRangeByIndexes(0,0,rows,cols);
 r.format.font={name:'Arial',size:11,color:ink};r.format.rowHeight=25;r.format.columnWidth=24;r.format.verticalAlignment='center';
 sh.getRangeByIndexes(0,0,1,cols).format={fill:blue,font:{name:'Arial',size:11,color:'#FFFFFF',bold:true},rowHeight:42,wrapText:true,horizontalAlignment:'center'};
 sh.freezePanes.freezeRows(1);
}
const dictionary=[['sheet','field','type','description_th']];
for(const [name,fields] of Object.entries(schema)){
 const sh=wb.worksheets.getItem(name);const defs=fields.map(x=>x.split('|'));const headers=defs.map(x=>x[0]);
 sh.getRangeByIndexes(0,0,1,headers.length).values=[headers];
 const reserve=name==='Employees'?301:31;
 style(sh,reserve,headers.length);
 sh.freezePanes.freezeColumns(1);
 defs.forEach(([field,type,desc],i)=>{
  dictionary.push([name,field,type,desc]);const r=sh.getRangeByIndexes(1,i,reserve-1,1);
  if(['id','text','enum'].includes(type))r.setNumberFormat('@');
  if(type==='date')r.setNumberFormat('yyyy-mm-dd');
  if(type==='datetime')r.setNumberFormat('yyyy-mm-dd hh:mm:ss');
  if(type==='time')r.setNumberFormat('hh:mm');
  if(type==='integer')r.setNumberFormat('0');
  if(type==='number')r.setNumberFormat('0.000000');
  if(type==='boolean')r.dataValidation={rule:{type:'list',values:['TRUE','FALSE']}};
  if(type==='enum')r.dataValidation={rule:{type:'list',values:desc.split(' / ')}};
  if(type==='integer')sh.dataValidations.add({range:r.address?.split('!').pop()||`${String.fromCharCode(65+i)}2:${String.fromCharCode(65+i)}${reserve}`,rule:{type:'whole',operator:'greaterThanOrEqual',formula1:0}});
 });
 if(name!=='Settings') sh.getRangeByIndexes(1,0,reserve-1,1).conditionalFormats.addCustom('AND(A2<>"",COUNTIF($A$2:$A$'+reserve+',A2)>1)',{fill:'#FEE2E2',font:{color:'#991B1B'}});
}
const settings=[
 ['app_name','check name na','ชื่อเว็บตามที่กำหนด'],
 ['schema_version','1.0','รุ่นโครงสร้างข้อมูล'],
 ['company_name','','กรอกชื่อบริษัทจริงก่อนเปิดใช้'],
 ['timezone','Asia/Bangkok','ทุกวันเวลาในชีตแสดงเป็นเวลาไทย'],
 ['expected_employees','300','จำนวนเพื่อวางแผน ไม่ใช่เพดานพนักงาน'],
 ['setup_status','draft','โครงสร้างเท่านั้น ยังไม่ได้เชื่อมเว็บ'],
 ['gps_required','','กำหนด true หรือ false ก่อนเปิดใช้'],
 ['photo_required','','กำหนด true หรือ false ก่อนเปิดใช้'],
 ['qr_required','','กำหนด true หรือ false ก่อนเปิดใช้'],
 ['active_history_months','','กำหนดช่วงข้อมูลออนไลน์ก่อนตั้งงานเก็บประวัติ'],
 ['retention_months','','กำหนดระยะเก็บข้อมูลตามนโยบายบริษัท'],
 ['ot_policy','','กำหนดหลักเกณฑ์และผู้อนุมัติก่อนคำนวณ OT'],
 ['late_policy','','กำหนดวิธีใช้เวลาผ่อนผันก่อนคำนวณมาสาย']
];
const settingSheet=wb.worksheets.getItem('Settings');settingSheet.getRange('A2:C14').values=settings;
settingSheet.getRange('A1:A31').format.columnWidth=29;settingSheet.getRange('B1:B31').format.columnWidth=30;settingSheet.getRange('C1:C31').format.columnWidth=76;
for(let i=0;i<settings.length;i++)if(settings[i][1]==='')settingSheet.getRange(`B${i+2}`).format.fill='#FFF1CC';
const rows=[
 ['หัวข้อ','รายละเอียด'],
 ['check name na','โครงสร้างข้อมูลสำหรับบริษัทเดียว พนักงานประมาณ 300 คน'],
 ['สถานะ','มีเฉพาะโครงสร้าง ไม่มีรายชื่อพนักงานจริง และยังไม่ได้เชื่อมเว็บ'],
 ['เริ่มต้น 1','กรอกชื่อบริษัทและช่องสีเหลืองใน Settings'],
 ['เริ่มต้น 2','เพิ่มแผนก สถานที่พร้อมพิกัด และกะงานใน Departments, Locations, Shifts'],
 ['เริ่มต้น 3','กรอกรายชื่อใน Employees เตรียมไว้ 300 แถว เพิ่มแถวต่อได้'],
 ['เริ่มต้น 4','จัดตารางรายคนใน Roster แล้วเชื่อมระบบยืนยันตัวตนและเว็บก่อนใช้งาน'],
 ['รูปแบบฐานข้อมูล','แถว 1 คือชื่อช่องสำหรับเว็บ เริ่มข้อมูลแถว 2 ห้ามเปลี่ยนชื่อแท็บหรือหัวคอลัมน์'],
 ['คำอธิบายช่อง','ดู Dictionary สำหรับชนิดข้อมูล ความหมาย และการเชื่อมรหัส'],
 ['รหัสถาวร','รหัสหลักต้องไม่ซ้ำ ห้ามใช้เลขแถวเป็นรหัส และไม่ใช้รหัสพนักงานที่ลาออกซ้ำ'],
 ['การเข้าถึง','ชีตให้เจ้าของและ HR ที่ได้รับอนุญาต เว็บต้องตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกครั้ง'],
 ['รหัสผ่าน','ไม่เก็บรหัสผ่าน PIN หรือ API key ในชีต ใช้ auth_subject เชื่อมระบบเข้าสู่ระบบ'],
 ['กะข้ามคืน','work_date คือวันที่เริ่มกะ ใช้ scheduled_start_at และ scheduled_end_at ที่มีวันครบ'],
 ['ลงเวลาหนึ่งครั้ง','หนึ่งแถว Attendance ต่อเหตุการณ์ IN หรือ OUT ระบบสร้าง recorded_at เอง'],
 ['คำขอซ้ำ','เว็บส่ง request_id เดิมเมื่อ retry เซิร์ฟเวอร์ต้องตรวจและบันทึกภายใต้ล็อกหรือคิวเดียวกัน'],
 ['รายการลงเวลา','Attendance เก็บประวัติดิบแบบเพิ่มรายการ ไม่แก้ลบทิ้งเงียบ ๆ การแก้ต้องลง AuditLog'],
 ['สรุปรายวัน','DailySummary เป็นผลที่ระบบคำนวณ ไม่ใช่ช่องกรอก และยังไม่มีสูตรหรือข้อมูลสรุป'],
 ['ตารางงาน','ก่อนสรุปต้องมี Roster ครบ รวมวันหยุด ไม่ถือว่าไม่มีรายการเท่ากับขาดงานทันที'],
 ['OT และมาสาย','ยังไม่กำหนดนโยบายบริษัท ห้ามถือเวลาเกินกะเป็น OT ที่อนุมัติแล้ว'],
 ['การลา','LeaveRequests เก็บคำขอและผลพิจารณา ยังไม่คำนวณสิทธิลาสะสมหรือเงินเดือน'],
 ['รูปถ่ายและเอกสาร','เก็บไฟล์ในพื้นที่ส่วนตัว ชีตเก็บเฉพาะ file_id ไม่เก็บภาพหรือ Base64'],
 ['ขนาดข้อมูล','ตัวอย่างวางแผน 300 คน × 2 ครั้ง × 26 วัน = 15,600 รายการต่อเดือน ไม่ใช่ข้อมูลจริง'],
 ['การเก็บประวัติ','ArchiveIndex ระบุไฟล์เก่า เก็บเป็นรอบเวลา ตรวจจำนวนและความครบก่อนย้ายข้อมูลใช้งาน'],
 ['โหลดพร้อมกัน','300 คนไม่ใช่การรับรอง 300 คำขอพร้อมกัน ต้องทดสอบคิว retry และบันทึกซ้ำก่อนเปิดจริง'],
 ['ข้อจำกัดของชีต','validation และสีช่วยกรอกเท่านั้น ไม่บังคับรหัสอ้างอิงหรือสิทธิ์แทนเซิร์ฟเวอร์'],
 ['การเพิ่มแถว','ขยาย validation/รูปแบบเมื่อเพิ่มแถว ระบบต้องตรวจชนิดข้อมูลและรหัสอ้างอิงอีกชั้น'],
 ['ก่อนเปิดใช้จริง','ตั้งเขตเวลาชีตเป็น Asia/Bangkok ทดสอบกะข้ามคืน คำขอซ้ำ สิทธิ์ และการลงเวลาพร้อมกัน'],
 ['อ้างอิง Google Sheets API','https://developers.google.com/workspace/sheets/api/limits'],
 ['อ้างอิง Apps Script','https://developers.google.com/apps-script/guides/services/quotas']
];
guide.getRange(`A1:B${rows.length}`).values=rows;style(guide,rows.length,2);guide.getRange(`A1:A${rows.length}`).format.columnWidth=29;guide.getRange(`B1:B${rows.length}`).format.columnWidth=105;guide.getRange(`A2:B${rows.length}`).format.rowHeight=35;guide.getRange(`B2:B${rows.length}`).format.wrapText=true;guide.tabColor=blue;
dict.getRange(`A1:D${dictionary.length}`).values=dictionary;style(dict,dictionary.length,4);dict.getRange(`B1:B${dictionary.length}`).format.columnWidth=30;dict.getRange(`C1:C${dictionary.length}`).format.columnWidth=15;dict.getRange(`D1:D${dictionary.length}`).format.columnWidth=95;dict.tabColor='#8193A7';
// Structure-only templates deliberately contain no dummy employees or attendance.
wb.recalculate();
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:2500})).ndjson);
console.log((await wb.inspect({kind:'table',range:'Settings!A1:C14',include:'values,formulas',tableMaxRows:14,tableMaxCols:3,maxChars:2500})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10},summary:'error scan',maxChars:1000})).ndjson);
await fs.mkdir(out,{recursive:true});
for(const name of ['StartHere',...Object.keys(schema),'Dictionary']){
 const cols=name==='StartHere'?'B':name==='Settings'?'C':name==='Dictionary'?'D':String.fromCharCode(64+schema[name].length);
 const blob=await wb.render({sheetName:name,range:`A1:${cols}${name==='StartHere'?12:name==='Dictionary'?9:name==='Settings'?14:5}`,scale:1,format:'png'});
 await fs.writeFile(`${out}/preview-${name}.png`,new Uint8Array(await blob.arrayBuffer()));
}
await fs.writeFile(`${out}/schema.json`,JSON.stringify(schema,null,2));
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(`${out}/check-name-na-structure.xlsx`);
console.log('EXPORTED check-name-na-structure.xlsx');
