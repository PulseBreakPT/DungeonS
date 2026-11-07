'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../p0.js');
const G=require('../graphics-model.js');
const city=E.create();
const saved=JSON.stringify(city);
const metrics=E.analyze(city);
const first=G.build(city,metrics,{detail:2,view:'normal'});
const second=G.build(city,metrics,{detail:2,view:'normal'});
assert.equal(JSON.stringify(first),JSON.stringify(second),'visual world must be deterministic');
assert.equal(JSON.stringify(city),saved,'render scene builder must never mutate saves');
assert.equal(first.size,36);
assert.equal(first.groups.ground.length,E.N*E.N,'every parcel must have a terrain tile');
assert.ok(first.groups.water.length>0,'water surfaces must exist');
assert.ok(first.groups.asphalt.length>0,'real roads must be visible');
assert.ok(first.groups.walls.length>0,'buildings must have actual 3D mass');
assert.ok(first.groups.roof.length>=first.groups.walls.length,'buildings need roofs');
assert.ok(first.groups.glass.length>0,'building facades must have windows');
assert.ok(first.groups.foliage.length>0&&first.groups.trunk.length>0,'trees must have volumetric geometry');
assert.ok(first.groups.light.length>0,'city needs night light fixtures');
for(const group of Object.values(first.groups)){
  for(const entry of group){
    assert.equal(entry.length,8);
    assert.ok(entry.slice(0,6).every(Number.isFinite),'instance transforms must stay finite');
    assert.ok(entry.slice(3,6).every(n=>n>0),'instance dimensions must be positive');
    assert.match(entry[6],/^#[a-fA-F0-9]{6}$/,'valid material colors');
  }
}
const traffic=G.build(city,metrics,{detail:1,view:'traffic'});
assert.equal(traffic.groups.ground.length,first.groups.ground.length);
const zoning=G.build(city,metrics,{detail:0,view:'zoning'});
assert.equal(zoning.groups.glass.length,0,'low-detail mode should omit window geometry');
assert.equal(zoning.groups.ground.length,E.N*E.N);
const power=G.build(city,metrics,{detail:1,view:'power'});
const water=G.build(city,metrics,{detail:1,view:'water'});
assert.equal(power.groups.ground.length,water.groups.ground.length);
assert.equal(JSON.stringify(city),saved,'all map overlays must remain read-only');

const grid=JSON.parse(saved);
grid.grid[E.idx(2,2)]={t:'land',k:'road',lvl:0,age:0,roadType:'avenue'};
const enriched=G.build(grid,metrics,{detail:2});
assert.ok(enriched.groups.asphalt.length>=first.groups.asphalt.length);
assert.notDeepEqual(enriched.groups.asphalt,first.groups.asphalt,'building a new road must change road graphics');
assert.equal(E.validate(grid),true,'graphics and simulation must continue to use the same v1 save shape');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const game=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const moduleSource=fs.readFileSync(path.join(__dirname,'../graphics3d.mjs'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
for(const asset of ['graphics-model.js','graphics3d.mjs','id="world3d"','data-action="toggleGraphics"'])
  assert.ok(html.includes(asset),'missing renderer integration '+asset);
for(const feature of ['MetropoleRenderer3D','visualStamp','graphics.render','toggleGraphics'])
  assert.ok(game.includes(feature),'missing game integration '+feature);
assert.ok(css.includes('.graphics3d-active'));
assert.ok(moduleSource.includes('THREE.InstancedMesh'),'3D objects must use GPU instancing');
assert.ok(moduleSource.includes('webglcontextlost'),'context loss must preserve 2D fallback');
console.log('PASS GRAPHICS: deterministic 3D scene, road + building geometry, LOD, overlays, safe saves and progressive renderer wiring');
