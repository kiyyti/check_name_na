import {readFileSync} from 'node:fs';
const env=Object.fromEntries(readFileSync(new URL('../web/.env',import.meta.url),'utf8').split('\n').filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1).trim()];}));
const url=env.GOOGLE_APPS_SCRIPT_URL,secret=env.GOOGLE_APPS_SCRIPT_SECRET;
if(!url||!secret)throw new Error('Missing local Google Sheets connection settings');
const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'adminRead',secret,payload:{}}),redirect:'follow',signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Apps Script returned HTTP '+response.status);
const result=await response.json();
// Never print roster, sheet settings, secrets, or deployment URL.
console.log(JSON.stringify({ok:result.ok,code:result.code,message:result.message,adminSupported:result.ok===true&&!!result.data}));
