import {z} from 'zod';
const short=z.string().trim().max(120),id=z.string().trim().min(1).max(120);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const datetime=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/);
const optionalDate=z.union([date,z.literal('')]);
const numeric=z.string().trim().min(1).refine(v=>Number.isFinite(Number(v)),'กรุณากรอกตัวเลข');
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const version=z.string().max(12000);
export const studentInput=z.object({student_id:short,student_code:id,full_name:id,group_name:short,class_level:id,status:z.enum(['active','inactive']),enrolled_on:date,withdrawn_on:optionalDate,_version:version}).strict();
export const sessionInput=z.object({session_id:short,session_number:z.string().regex(/^[1-9]\d{0,4}$/),topic:short,group_name:short,class_level:short,starts_at:datetime,ends_at:datetime,checkin_opens_at:datetime,checkin_closes_at:datetime,late_at:datetime,absence_at:datetime,status:z.enum(['draft','open','closed','cancelled']),room_name:id,latitude:numeric,longitude:numeric,radius_m:numeric,max_accuracy_m:numeric,_version:version}).strict();
export const settingsInput=z.object({course_name:id,teacher_name:id,term:short,location_name:id,room_name:id,latitude:numeric,longitude:numeric,radius_m:numeric,max_accuracy_m:numeric,late_policy:time,absence_policy:time,_version:version}).strict();
export const adminMutation=z.discriminatedUnion('action',[
 z.object({action:z.literal('adminSaveStudent'),payload:studentInput}).strict(),
 z.object({action:z.literal('adminSaveSession'),payload:sessionInput}).strict(),
 z.object({action:z.literal('adminSaveSettings'),payload:settingsInput}).strict(),
 z.object({action:z.literal('adminAttendance'),payload:z.object({session_id:id,student_id:id,status:z.enum(['present','late','absent','excused']),reason:z.string().trim().min(1).max(500),_version:version}).strict()}).strict()
]);
const row=z.record(z.string());
export const adminDataSchema=z.object({settings:row,settingsVersion:z.string(),students:z.array(row),sessions:z.array(row),attendance:z.array(row),eligibleStudentIds:z.array(z.string()),selectedSessionId:z.string(),audit:z.array(row)});
export type AdminData=z.infer<typeof adminDataSchema>;
export type AdminRow=Record<string,string>;
export const adminGatewaySchema=z.object({ok:z.boolean(),code:z.string().optional(),message:z.string().optional(),retryAfter:z.number().optional(),data:adminDataSchema.optional()});
