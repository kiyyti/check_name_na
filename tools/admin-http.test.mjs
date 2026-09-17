import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hashPassword,issueSession,SESSION_SECONDS} from '../web/lib/admin-session.mjs';
const web=fileURLToPath(new URL('../web',import.meta.url));
const base='http://127.0.0.1:3197',password='only-for-admin-http-tests',hash=hashPassword(password),secret='test-session-key-'.repeat(4);
test('admin HTTP authentication, origin checks, validation and logout',async()=>{
 const child=spawn(process.execPath,['--import',fileURLToPath(new URL('./admin-http-gateway.mock.mjs',import.meta.url)),web+'/node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3197'],{cwd:web,env:{...process.env,VERCEL:'',ADMIN_USERNAME:'test_admin',ADMIN_PASSWORD_HASH:hash,ADMIN_SESSION_SECRET:secret,GOOGLE_APPS_SCRIPT_URL:'https://script.google.com/macros/s/TEST-ADMIN-ONLY/exec',GOOGLE_APPS_SCRIPT_SECRET:'test-gateway-secret-'.repeat(3)},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
 try{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Server did not start: '+logs)),20000);const poll=setInterval(()=>{if(logs.includes('Ready in')){clearTimeout(timeout);clearInterval(poll);resolve();}else if(child.exitCode!==null){clearTimeout(timeout);clearInterval(poll);reject(new Error(logs));}},100);});
  const get=(path,cookie)=>fetch(base+path,{redirect:'manual',headers:cookie?{Cookie:cookie}:{}});
  const post=(path,body,cookie,origin=base)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  assert.equal((await get('/admin')).status,307);
  assert.equal((await get('/api/admin/data')).status,401);
  assert.equal((await get('/api/admin/data','checknamena_admin=forged')).status,401);
  assert.equal((await post('/api/admin/data',{})).status,401);
  assert.equal((await post('/api/check-in',{})).status,400);
  assert.equal((await post('/api/check-in',{},null,'https://foreign.invalid')).status,403);
  assert.equal((await post('/api/admin/login',{username:'test_admin',password},null,'https://foreign.invalid')).status,403);
  assert.equal((await post('/api/admin/login',{username:'test_admin',password:'wrong'})).status,401);
  const login=await post('/api/admin/login',{username:'test_admin',password});assert.equal(login.status,200);
  const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=strict/i);assert.match(setCookie,/Max-Age=28800/i);
  const cookie=setCookie.split(';')[0];
  const read=await get('/api/admin/data',cookie);assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/no-store/);assert.equal((await read.json()).data.settings.course_name,'Test course');
  assert.equal((await post('/api/admin/data',{action:'adminSaveStudent',payload:{}},cookie)).status,400);
  const payload={student_id:'http-test',student_code:'0008',full_name:'HTTP test',class_level:'TEST',group_name:'',status:'active',enrolled_on:'2026-09-17',withdrawn_on:'',_version:''};
  assert.equal((await post('/api/admin/data',{action:'adminSaveStudent',payload:{...payload,actor:'forged-user'}},cookie)).status,400);
  assert.equal((await post('/api/admin/data',{action:'adminSaveStudent',payload},cookie,'https://foreign.invalid')).status,403);
  assert.equal((await post('/api/admin/data',{action:'adminSaveStudent',payload},cookie)).status,200);
  const saved=await (await get('/api/admin/data',cookie)).json();assert.equal(saved.data.students[0].actor,'test_admin');
  const expired=issueSession('test_admin',hash,secret,Date.now()-(SESSION_SECONDS+10)*1000);assert.equal((await get('/api/admin/data','checknamena_admin='+expired)).status,401);
  const logout=await post('/api/admin/logout',{},cookie);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/i);
  assert.equal((await get('/api/admin/data')).status,401);
 }finally{child.kill('SIGTERM');}
});
