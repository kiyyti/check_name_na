// Test-process preload only. Prevents every outbound fetch from reaching Google.
const data={settings:{course_name:'Test course'},settingsVersion:'test',students:[],sessions:[],attendance:[],eligibleStudentIds:[],selectedSessionId:'',audit:[]};
let capabilityRequests=0;
globalThis.fetch=async function(input,init){
 if(String(input)!=='https://script.google.com/macros/s/TEST-ADMIN-ONLY/exec')throw new Error('External fetch is disabled in the admin HTTP test');
 const body=JSON.parse(init.body);
 if(body.secret!=='test-gateway-secret-'.repeat(3))return Response.json({ok:false,code:'UNAUTHORIZED'});
 if(body.action==='adminLoginAttempt')return Response.json({ok:true});
 if(body.action==='adminRead')return Response.json({ok:true,data});
 // First probe simulates an outdated deployed script; the next simulates its update.
 if(body.action==='adminCapabilities')return Response.json(++capabilityRequests===1?{ok:false,code:'BAD_INPUT'}:{ok:true,capabilities:{multiLevelSessions:true}});
 if(body.action==='adminSaveSession'&&body.payload.actor==='test_admin'){data.sessions.push({...body.payload});return Response.json({ok:true});}
 if(body.action==='adminSaveStudent'&&body.payload.actor==='test_admin'){data.students.push({...body.payload});return Response.json({ok:true});}
 return Response.json({ok:false,code:'BAD_INPUT',message:'Test action rejected'});
};
