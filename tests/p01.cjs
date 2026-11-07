'use strict';
// P0.1 deterministic regression tests: saves, observers, graph invalidation and economy.
const assert=require('node:assert/strict');
const E=require('../p0.js');
const original=E.create();
assert.equal(E.validate(original),true);
const source=JSON.stringify(original);
for(let i=0;i<4;i++){
 const metrics=E.analyze(original);
 assert.ok(metrics.population>=100);
 assert.ok(metrics.simulatedCitizens>0);
 assert.equal(JSON.stringify(original),source,'analyze() must never mutate a migrated city');
}
const firstMonth=original.month;
E.tick(original);
assert.notEqual(original.month,firstMonth);
assert.ok(original.p0.citizens.length>0,'citizens snapshot committed by tick');
assert.ok(original.p0.citizens.every(c=>Number.isFinite(c.commute)&&Array.isArray(c.route)));
const afterTick=JSON.stringify(original);
for(let i=0;i<3;i++)E.analyze(original);
assert.equal(JSON.stringify(original),afterTick,'analyze() after tick must be read-only');

// Full save round-trip, including representative citizens and P0 financial data.
const serialized=JSON.stringify(original);
const loaded=JSON.parse(serialized);
assert.equal(E.validate(loaded),true);
E.migrate(loaded);
assert.equal(JSON.stringify(loaded),serialized,'migration of an upgraded save is idempotent');
assert.equal(E.analyze(loaded).balance,E.analyze(original).balance);

// Original v1 state (without P0) must migrate without changing its grid or treasury.
const legacy=JSON.parse(serialized);
delete legacy.p0;
assert.equal(E.validate(legacy),true);
const gridBefore=JSON.stringify(legacy.grid),cash=legacy.money;
E.migrate(legacy);
assert.equal(legacy.version,1);
assert.equal(JSON.stringify(legacy.grid),gridBefore);
assert.equal(legacy.money,cash);
assert.equal(E.validate(legacy),true);
const migrated=JSON.stringify(legacy);
E.migrate(legacy);
assert.equal(JSON.stringify(legacy),migrated,'legacy migration must be idempotent');
assert.ok(E.analyze(legacy).sewageCap>0,'legacy sewage grace retained');

// Bad input must be rejected rather than passed into rendering or migration.
const broken=(fn)=>{const x=JSON.parse(serialized);fn(x);assert.equal(E.validate(x),false);};
broken(s=>{s.grid[0].k='__unknown_type__';});
broken(s=>{delete s.grid[0].lvl;});
broken(s=>{s.grid[0].direction=999;});
broken(s=>{s.grid[0].powerLine='yes';});
broken(s=>{s.p0.citizens=[null];});
broken(s=>{s.month=0;});
broken(s=>{s.p0.fiscal.zoneTax='invalid';});
broken(s=>{s.p0.citizens=Array.from({length:481},(_,i)=>({id:i,home:0}));});

// Road caches must never return a route after a graph revision change.
const map=E.create();
for(const cell of map.grid){cell.k='empty';cell.t='land';cell.lvl=0;cell.powerLine=false;cell.waterPipe=false;}
map.p0.revision++;
for(let x=10;x<=12;x++){const c=map.grid[E.idx(x,10)];c.k='road';c.roadType='road';}
map.p0.revision++;
const a=E.idx(10,10),b=E.idx(12,10);
assert.deepEqual(E.shortestRoute(map,a,b),[a,E.idx(11,10),b]);
assert.equal(E.build(map,11,10,'bulldoze').ok,true);
assert.equal(E.shortestRoute(map,a,b),null,'demolishing the middle segment invalidates cached route');
assert.equal(E.build(map,11,10,'road').ok,true);
assert.deepEqual(E.shortestRoute(map,a,b),[a,E.idx(11,10),b]);

// Loan + tax reads must have observable, finite consequences.
const financial=E.create();
const before=E.analyze(financial);
assert.equal(E.setZoneTax(financial,'res',20),true);
const taxed=E.analyze(financial);
assert.ok(taxed.income>before.income);
assert.equal(E.borrow(financial,25000).ok,true);
assert.ok(E.analyze(financial).expenses>taxed.expenses);
console.log('PASS P0.1: pure analysis, monthly snapshots, v1 migration, save round-trip, input validation, route cache, fiscal consequences');
