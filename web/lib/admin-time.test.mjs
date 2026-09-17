import test from 'node:test';
import assert from 'node:assert/strict';
import {clock} from './admin-time.mjs';

test('legacy session without cutoff columns falls back to Settings without crashing',()=>{
 const legacy={session_id:'CAL2-20260917-TEST',ends_at:'2026-09-17T23:59:00'};
 const settings={late_policy:'ตั้งแต่ 08:10',absence_policy:'ตั้งแต่ 08:15'};
 assert.equal(clock(legacy.late_at)||clock(settings.late_policy),'08:10');
 assert.equal(clock(legacy.absence_at)||clock(settings.absence_policy),'08:15');
 assert.equal(clock(legacy.ends_at),'23:59');
});
test('an explicit session cutoff takes priority over the default',()=>{
 assert.equal(clock('2026-09-17T13:10:00')||clock('08:30'),'13:10');
});
test('empty or missing sheet cells have no time value',()=>{
 for(const value of [undefined,null,'',123])assert.equal(clock(value),'');
});
