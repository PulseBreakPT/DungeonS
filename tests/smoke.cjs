/* ABISMO engine smoke tests: no external packages required */
const assert = require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
function setup(){
 const db={},listeners={};
 const fakeApp={innerHTML:''};
 const fakeToast={textContent:'',classList:{add(){},remove(){}}};
 const elements={app:fakeApp,toast:fakeToast};
 const document={
  getElementById(id){return elements[id]||(id==='hero-name'?{value:'Teste'}:null);},
  addEventListener(type,fn){listeners[type]=fn;},
  createElement(){return {click(){},remove(){}};},
  body:{appendChild(){}}
 };
 const storage={getItem(k){return db[k]||null;},setItem(k,v){db[k]=v;},removeItem(k){delete db[k];}};
 const sandbox={document,window:{},localStorage:storage,navigator:{},console,setTimeout(){return 1;},clearTimeout(){},URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},Blob};
 vm.runInNewContext(source,sandbox,{filename:'game.js',timeout:2000});
 function click(action){listeners.click({target:{closest(){return {dataset:{action},disabled:false};}}});}
 function state(){return JSON.parse(db['dungeons-abisso-save-v1']);}
 return {click,state,app:fakeApp};
}
// v0.1 canonical combat, same values as the reference example.
const t=setup();
assert.match(t.app.innerHTML,/INICIAR EXPEDIÇÃO/);
t.click('test');
let s=t.state();
assert.equal(s.rng,17);
assert.equal(s.phase,'combat');
assert.equal(s.hp,60);
assert.equal(s.fp,12);
assert.equal(s.enemy.hp,24);
t.click('attack');
s=t.state();
assert.equal(s.rng,71);
assert.equal(s.rolls,2);
assert.equal(s.hp,56);
assert.equal(s.enemy.hp,12);
assert.equal(s.enemyTurn,2);
assert.equal(s.eventSeq,2);
t.click('attack');
s=t.state();
assert.equal(s.rng,85);
assert.equal(s.rolls,4);
assert.equal(s.hp,56);
assert.equal(s.enemy,null);
assert.equal(s.phase,'explore');
assert.equal(s.xp,25);
assert.equal(s.runGold,8);
assert.equal(s.potions,2);
assert.equal(s.fp,12);
assert.equal(s.cleared['1'],true);
assert.match(t.app.innerHTML,/Avançar/);
// A fresh Arcanist uses magical ability and pays focus.
const a=setup();
a.click('select:arcanist');
a.click('start');
let ar=a.state();
assert.equal(ar.classId,'arcanist');
assert.equal(ar.hp,54);
assert.equal(ar.fp,20);
a.click('next');
ar=a.state();
assert.equal(ar.phase,'combat');
a.click('skill');
ar=a.state();
assert.equal(ar.fp,16);
assert.equal(ar.enemy.hp,4);
assert.equal(ar.hp,49); // Rat hits Arcanist armor 2 for 5 damage
assert.equal(ar.rng,71);
// A new game always restarts the deterministic generator.
const b=setup();
b.click('test');
b.click('defend');
let d=b.state();
assert.equal(d.rng,74);
assert.equal(d.hp,58); // 7 damage - 3 armor = 4, halved to 2
assert.equal(d.fp,12);
assert.equal(d.enemy.hp,24);
console.log('PASS: menu, classes, deterministic attacks, damage, rewards, defend, save and rendering');
