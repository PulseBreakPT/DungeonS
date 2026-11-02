/* METRÓPOLE Director Edition UI regression suite — no dependencies. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('../engine.js');
const canvasCtx=new Proxy({
 createLinearGradient(){return {addColorStop(){}}},
 measureText(text){return {width:text.length*7}}
},{get(obj,key){if(!(key in obj))obj[key]=()=>{};return obj[key]},set(obj,key,value){obj[key]=value;return true}});
const nodes=new Map(),listeners={};
const make=id=>({id,style:{},dataset:{},classList:{value:new Set(),add(x){this.value.add(x)},remove(x){this.value.delete(x)},toggle(x,force){let on=force===undefined?!this.value.has(x):force;on?this.value.add(x):this.value.delete(x);return on},contains(x){return this.value.has(x)}},
 addEventListener(name,fn){listeners[id+':'+name]=fn},setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:1280,height:800}},getContext(){return canvasCtx},toDataURL(){return'data:'},click(){},remove(){},appendChild(){},textContent:'',innerHTML:''});
const document={body:make('body'),hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,make(id));return nodes.get(id)},querySelectorAll(){return []},addEventListener(name,fn){listeners['doc:'+name]=fn},createElement(tag){return make(tag)}};
let raf;const localStorage={data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=v}};
const window={addEventListener(){},devicePixelRatio:1,CityEngine:C};
const sandbox={window,document,localStorage,innerWidth:1280,performance:{now:()=>100},requestAnimationFrame(fn){raf=fn},setTimeout(){return 1},clearTimeout(){},console,Math,Date,Blob,URL,confirm:()=>true,prompt:()=> 'Cidade de Teste'};
vm.runInNewContext(fs.readFileSync('game.js','utf8'),sandbox,{filename:'game.js',timeout:3000});
const get=id=>nodes.get(id);
function action(name){listeners['doc:click']({target:{closest(){return{dataset:{action:name}}}}});}
function build(name){listeners['doc:click']({target:{closest(){return{dataset:{tool:name}}}}});}
assert.ok(localStorage.getItem(C.SAVE_KEY),'City auto save missing');
assert.match(get('money').textContent,/€/);
assert.equal(typeof raf,'function');raf(150);
assert.equal(get('population').textContent,'136');
assert.equal(document.body.dataset.lighting,'day');
action('cycleLight');assert.equal(document.body.dataset.lighting,'dusk');
action('cycleLight');assert.equal(document.body.dataset.lighting,'night');
action('cycleLight');assert.equal(document.body.dataset.lighting,'day');
action('toggleTools');assert.ok(document.body.classList.contains('builder-open'));
build('road');assert.equal(get('buildStatusName').textContent,'Estradas');assert.ok(!get('constructionStatus').classList.contains('hidden'));
action('cancelBuild');assert.ok(get('constructionStatus').classList.contains('hidden'));
action('toggleStats');assert.ok(get('rightPanel').classList.contains('open'));
action('toggleStats');assert.ok(!get('rightPanel').classList.contains('open'));
assert.ok(get('missionTitle').textContent.length>4);
const html=fs.readFileSync('index.html','utf8');
for(const id of ['minimap','cityHealth','healthBar','cityHealthDesc','constructionStatus','missionCard','milestoneBanner','tileTooltip','lightLabel'])assert.ok(html.includes(`id="${id}"`),'Missing HUD control: '+id);
for(const category of ['all','zone','service'])assert.ok(html.includes(`data-category="${category}"`),'Missing construction category: '+category);
for(const view of ['normal','zoning','traffic'])assert.ok(html.includes(`data-view="${view}"`),'Missing map layer: '+view);
assert.ok(html.includes('viewport-fit=cover')&&html.includes('tool-grid'));
console.log('PASS: game bootstrap, city stats, day/dusk/night, builder tools, HUD toggles, all overlays and first isometric frame.');