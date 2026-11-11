import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultTimerDraft,timerConfig,timerText,draftFromTimer} from '../src/timer-model.ts';
import {menuChoices} from '../src/menu-model.ts';
test('Timer is a Lock In action before Back',()=>{const c=menuChoices('lock_in',null);assert.deepEqual(c.map(c=>c.label),['Habit Tracker','Motivation','To-Do List','Timer','Back']);assert.deepEqual(c.at(-2).action,{type:'timer'});});
test('normal countdown reads hours/minutes/seconds and rejects empty or invalid durations',()=>{
  const d=defaultTimerDraft();assert.equal(timerConfig('normal',{...d,hours:'1',minutes:'2',seconds:'3'}).normal_seconds,3723);
  assert.equal(timerConfig('normal',{...d,hours:'24',minutes:'0',seconds:'0'}).normal_seconds,86400);
  for(const changes of [{hours:'0',minutes:'0',seconds:'0'},{seconds:'60'},{hours:'24',seconds:'1'},{minutes:''},{hours:'1.5'}])assert.throws(()=>timerConfig('normal',{...d,...changes}));
});
test('pomodoro keeps breaks fixed and rejects work periods reduced to zero',()=>{
  const d={...defaultTimerDraft(),work:'25',break:'5',decrease:'2',rounds:'4'};const c=timerConfig('pomodoro',d);
  assert.equal(c.work_seconds,1500);assert.equal(c.break_seconds,300);assert.equal(c.decrease_seconds,120);assert.equal(c.rounds,4);
  assert.throws(()=>timerConfig('pomodoro',{...d,work:'6'}));assert.throws(()=>timerConfig('pomodoro',{...d,rounds:'0'}));assert.throws(()=>timerConfig('pomodoro',{...d,break:'0'}));
  assert.equal(timerConfig('pomodoro',{...d,rounds:'1',decrease:'25'}).rounds,1);
});
test('countdowns round up, stopwatch rounds down, long durations keep hours',()=>{
  assert.equal(timerText(1,true),'00:00:01');assert.equal(timerText(999),'00:00:00');assert.equal(timerText(3600000+62000),'01:01:02');assert.equal(timerText(100*3600000),'100:00:00');assert.equal(timerText(-1,true),'00:00:00');
  const c=timerConfig('normal',{...defaultTimerDraft(),hours:'1',minutes:'2',seconds:'3'});assert.equal(draftFromTimer(c).hours,'1');assert.equal(draftFromTimer(c).minutes,'2');assert.equal(draftFromTimer(c).seconds,'3');
});
