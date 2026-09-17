import test from 'node:test';
import assert from 'node:assert/strict';
import {classLevels,toggleClassLevel} from './class-levels.mjs';
test('legacy, multi-select and wildcard cells can be opened by the editor',()=>{
 assert.deepEqual(classLevels('ปวช.1'),['ปวช.1']);
 assert.deepEqual(classLevels(' ปวช.1, ปวช.3, ปวช.1 '),['ปวช.1','ปวช.3']);
 assert.deepEqual(classLevels(''),[]);
});
test('toggling one level retains the others, and removing the last gives an empty selection',()=>{
 let value=toggleClassLevel('ปวช.1','ปวช.3',true);assert.equal(value,'ปวช.1, ปวช.3');
 value=toggleClassLevel(value,'ปวช.1',false);assert.equal(value,'ปวช.3');
 value=toggleClassLevel(value,'ปวช.3',false);assert.equal(value,'');
});
