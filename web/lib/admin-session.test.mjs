import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,issueSession,verifySession,SESSION_SECONDS} from './admin-session.mjs';
const username='test_admin',password='test-password-only-1234',secret='test-session-key-'.repeat(4),hash=hashPassword(password),now=1800000000000;
test('password hash verifies the password but never stores plaintext',()=>{
 assert.ok(!hash.includes(password));assert.ok(verifyPassword(password,hash));assert.equal(verifyPassword('wrong',hash),false);assert.equal(verifyPassword(password,'invalid'),false);
});
test('a valid signed session expires after eight hours',()=>{
 const token=issueSession(username,hash,secret,now);
 assert.ok(verifySession(token,username,hash,secret,now));
 assert.equal(verifySession(token,username,hash,secret,now+SESSION_SECONDS*1000),false);
});
test('tampering with the user, signature or key cannot authenticate',()=>{
 const token=issueSession(username,hash,secret,now),[payload,sig]=token.split('.');
 const parsed=JSON.parse(Buffer.from(payload,'base64url'));parsed.user='other';
 assert.equal(verifySession(Buffer.from(JSON.stringify(parsed)).toString('base64url')+'.'+sig,username,hash,secret,now),false);
 assert.equal(verifySession(token+'x',username,hash,secret,now),false);
 assert.equal(verifySession(token,username,hash,'different-key-'.repeat(4),now),false);
 assert.equal(verifySession(token,username,hash,'',now),false);
});
test('changing the password or username invalidates existing sessions',()=>{
 const token=issueSession(username,hash,secret,now);
 assert.equal(verifySession(token,username,hashPassword('a-new-test-password'),secret,now),false);
 assert.equal(verifySession(token,'different',hash,secret,now),false);
});
