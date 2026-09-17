import {readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {hashPassword} from '../web/lib/admin-session.mjs';

// Call from a trusted local script. Never commit a plaintext password or pass
// these values to browser code. Re-running rotates sessions and the password.
export function configureAdmin(username,password){
 if(!/^[a-zA-Z0-9_]{3,120}$/.test(username)||password.length<12||password.length>256)throw new Error('Use a valid username and a password of at least 12 characters.');
 const values={ADMIN_USERNAME:username,ADMIN_PASSWORD_HASH:hashPassword(password),ADMIN_SESSION_SECRET:randomBytes(48).toString('hex')};
 const envPath=new URL('../web/.env',import.meta.url),vercelPath=new URL('../web/.env.admin.vercel',import.meta.url);
 let env='';try{env=readFileSync(envPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 env=env.split('\n').filter(line=>!Object.keys(values).some(key=>line.startsWith(key+'='))).join('\n').trimEnd();
 const block=Object.entries(values).map(([key,value])=>key+'='+value).join('\n')+'\n';
 writeFileSync(envPath,env+'\n'+block,{mode:0o600});chmodSync(envPath,0o600);
 writeFileSync(vercelPath,block,{mode:0o600});chmodSync(vercelPath,0o600);
 console.log('Admin credentials configured locally. Import web/.env.admin.vercel into Vercel. No credentials printed.');
}
