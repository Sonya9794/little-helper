import test from 'node:test';
import assert from 'node:assert/strict';
import { menuChoices } from '../src/menu-model.ts';
import { PRESET_COLORS, hsvToHex, hexToHsv, wheelColor, rowInk, durationMinutes } from '../src/todo-colors.ts';
test('main choices collapse productivity actions into Lock In with a right arrow',()=>{
  const choices=menuChoices('main',null); assert.deepEqual(choices.map(c=>c.label),['Settings','Lock In','Games']);
  assert.equal(choices[1].arrow,'right'); assert.deepEqual(choices[1].action,{type:'group',group:'lock_in'});
});
test('Lock In replaces the old choices and Back points to main in the opposite direction',()=>{
  const choices=menuChoices('lock_in',{most_common:'One',latest:'Two',count:2});
  assert.deepEqual(choices.map(c=>c.label),['Habit Tracker','Motivation','To-Do List','Timer','Back']);
  assert.equal(choices.at(-1).arrow,'left'); assert.deepEqual(choices.at(-1).action,{type:'group',group:'main'});
});
test('main prompt choices retain full text and original order',()=>{
  const choices=menuChoices('main',{most_common:'  Read  books ',latest:'Chess',count:2}); assert.equal(choices[0].label,'Read books'); assert.equal(choices[0].action.text,'  Read  books '); assert.equal(choices.length,5);
});
test('twelve presets and custom wheel cover hue, saturation and brightness',()=>{
  assert.equal(PRESET_COLORS.length,12); assert.equal(new Set(PRESET_COLORS).size,12);
  assert.equal(wheelColor(100,0,100,1),'#ff0000'); assert.equal(wheelColor(0,0,100,1),'#ffffff'); assert.equal(wheelColor(40,40,100,0),'#000000');
  for(const color of PRESET_COLORS) { const hsv=hexToHsv(color); assert.equal(hsvToHex(hsv.hue,hsv.saturation,hsv.value),color); }
});
test('row foreground stays readable on dark and light custom colors',()=>{
  assert.equal(rowInk('#000000'),'#ffffff'); assert.equal(rowInk('#ffffff'),'#000000'); assert.equal(rowInk('#fff2b3'),'#000000');
});
test('time estimates convert hours/minutes, clear blank/zero values and reject invalid input',()=>{
  assert.equal(durationMinutes('1','35'),95); assert.equal(durationMinutes('',''),null); assert.equal(durationMinutes('0','0'),null);
  for(const values of [['-1','0'],['1','60'],['1.5','0'],['abc','0']]) assert.throws(()=>durationMinutes(...values));
});
