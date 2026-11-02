/* METRÓPOLE P0 — deterministic city systems, compatible with the v1 save format.
   Runs after engine.js and before game.js; no third-party libraries or requests. */
(function(root,factory){
  const E=(typeof module==='object'&&module.exports)?require('./engine.js'):root.CityEngine;
  const upgraded=factory(E);
  if(typeof module==='object'&&module.exports)module.exports=upgraded;
  root.CityEngine=upgraded;
})(typeof window!=='undefined'?window:globalThis,function(E){
'use strict';
if(E.P0_VERSION)return E;
const base={create:E.create,analyze:E.analyze,build:E.build,tick:E.tick,validate:E.validate};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ROAD_COST={road:90,avenue:380,oneway:170,highway:950,bridge:1800};
const ROAD_CAPACITY={road:28,avenue:64,oneway:45,highway:140,bridge:55};
const ROAD_SPEED={road:1,avenue:.60,oneway:.72,highway:.35,bridge:.8};
const MAX_CITIZENS=480;
const N=E.N, size=N*N;
const aliases={avenue:'road',oneway:'road',highway:'road',bridge:'road'};
const dirSteps=[[-1,0],[0,-1],[1,0],[0,1]]; // west, north, east, south
const nameA=['Ana','Miguel','Beatriz','Rui','Inês','João','Lara','Pedro','Marta','Sofia','Tomás','Diana','Luís','Carolina','Nuno','Eva'];
const nameB=['Silva','Costa','Ferreira','Santos','Almeida','Pereira','Oliveira','Rodrigues','Martins','Sousa'];
Object.assign(E.COST,{avenue:380,oneway:170,highway:950,bridge:1800,powerline:160,waterpipe:130,sewage:11700});
Object.assign(E.LABELS,{avenue:'Avenida',oneway:'Sentido único',highway:'Via rápida',bridge:'Ponte',powerline:'Linha elétrica',waterpipe:'Conduta de água',sewage:'Estação de tratamento'});
if(!E.SERVICES.includes('sewage'))E.SERVICES.push('sewage');
const baseCreate=base.create;
E.create=function(){const s=baseCreate(); migrate(s);s.p0.legacySewage=false; // a starting treatment plant with road access
  const x=19,y=28,cell=s.grid[E.idx(x,y)];if(cell.k==='empty'&&cell.t==='land'){cell.k='sewage';s.totalBuilt++;}
  return s;
};
function migrate(s){
 if(!s.p0||typeof s.p0!=='object'){
  s.p0={version:2,citizens:[],nextCitizen:1,roadDirection:2,revision:0,legacySewage:true,fiscal:{zoneTax:{res:10,com:10,ind:10},debt:0,interest:.008,history:[]},lastMobility:null};
  // Existing cities retain the originally provided waste disposal contract.
  s.p0.legacySewage=!!s.grid?.some(c=>c.k!=='sewage');
 }
 const p=s.p0;
 p.version=2;
 if(!Array.isArray(p.citizens))p.citizens=[];
 if(!Number.isFinite(p.nextCitizen))p.nextCitizen=1;
 if(!Number.isFinite(p.revision))p.revision=0;
 if(!Number.isInteger(p.roadDirection))p.roadDirection=2;
 if(!p.fiscal||typeof p.fiscal!=='object')p.fiscal={};
 if(!p.fiscal.zoneTax)p.fiscal.zoneTax={res:10,com:10,ind:10};
 for(const k of E.ZONES)p.fiscal.zoneTax[k]=clamp(Number(p.fiscal.zoneTax[k])||10,4,22);
 p.fiscal.debt=Math.max(0,Number(p.fiscal.debt)||0);
 p.fiscal.interest=clamp(Number(p.fiscal.interest)||.008,.001,.05);
 if(!Array.isArray(p.fiscal.history))p.fiscal.history=[];
 return s;
}
E.migrate=migrate;
E.P0_VERSION=2;
E.validate=function(s){return base.validate(s) && (!s.p0 || (typeof s.p0==='object'&&(!s.p0.citizens||Array.isArray(s.p0.citizens))));};
function roadType(cell){return cell?.k==='road'?(ROAD_CAPACITY[cell.roadType]?cell.roadType:'road'):null;}
E.roadType=roadType;
E.rotateDirection=function(s){migrate(s);s.p0.roadDirection=(s.p0.roadDirection+1)%4;return s.p0.roadDirection;};
E.build=function(s,x,y,kind){
 migrate(s);
 if(!E.inside(x,y))return {ok:false,reason:'Fora dos limites da cidade.'};
 const cell=s.grid[E.idx(x,y)];let result;
 if(ROAD_COST[kind]){
  if(cell.t==='water'&&kind!=='bridge')return {ok:false,reason:'Para atravessar a água, utiliza a ferramenta Ponte.'};
  if(cell.t!=='water'&&kind==='bridge')return {ok:false,reason:'As pontes apenas podem ser construídas sobre água.'};
  if(cell.k!=='empty'&&cell.k!=='road')return {ok:false,reason:'Demole primeiro o edifício existente.'};
  if(cell.k==='road'&&roadType(cell)===kind&&!(kind==='oneway'&&cell.direction!==s.p0.roadDirection))return {ok:false,reason:'Este troço já tem essa configuração.'};
  const cost=cell.k==='road'?Math.max(30,ROAD_COST[kind]-(ROAD_COST[roadType(cell)]||90)):ROAD_COST[kind];
  if(s.money<cost)return {ok:false,reason:'Fundos insuficientes.'};
  cell.k='road';cell.roadType=kind;cell.direction=kind==='oneway'?s.p0.roadDirection:undefined;cell.lvl=0;
  s.money-=cost;s.totalBuilt++;result={ok:true,cost};
 }else if(kind==='powerline'||kind==='waterpipe'){
  if(cell.t==='water')return {ok:false,reason:'Não é possível passar esta ligação em água.'};
  const field=kind==='powerline'?'powerLine':'waterPipe';
  if(cell[field])return {ok:false,reason:'Ligação já instalada nesta parcela.'};
  if(s.money<E.COST[kind])return {ok:false,reason:'Fundos insuficientes.'};
  cell[field]=true;s.money-=E.COST[kind];result={ok:true,cost:E.COST[kind]};
 }else if(kind==='bulldoze'&&cell.k==='empty'&&(cell.powerLine||cell.waterPipe)){
  if(s.money<E.COST.bulldoze)return {ok:false,reason:'Fundos insuficientes.'};
  cell.powerLine=false;cell.waterPipe=false;s.money-=E.COST.bulldoze;result={ok:true,cost:E.COST.bulldoze};
 }else if(kind==='bulldoze'&&cell.t==='water'&&cell.k==='road'){
  if(s.money<E.COST.bulldoze)return {ok:false,reason:'Fundos insuficientes.'};
  cell.k='empty';cell.roadType=undefined;cell.direction=undefined;s.money-=E.COST.bulldoze;result={ok:true,cost:E.COST.bulldoze};
 }else if(kind==='sewage'){
  if(cell.t==='water'||cell.k!=='empty')return {ok:false,reason:'A estação precisa de terreno livre.'};
  if(s.money<E.COST.sewage)return {ok:false,reason:'Fundos insuficientes.'};
  cell.k='sewage';cell.lvl=0;cell.age=0;s.money-=E.COST.sewage;s.totalBuilt++;result={ok:true,cost:E.COST.sewage};
 }else{
  result=base.build(s,x,y,kind);
  if(result.ok&&kind==='bulldoze'){cell.powerLine=false;cell.waterPipe=false;cell.roadType=undefined;cell.direction=undefined;}
 }
 if(result.ok)s.p0.revision++;
 return result;
};
function hasConduit(cell,utility){return cell.k==='road'||(utility==='power'?cell.powerLine:cell.waterPipe);}
function networks(s,utility){
 const components=new Int16Array(size).fill(-1),groups=[];
 for(let i=0;i<size;i++){
  if(components[i]!==-1||!hasConduit(s.grid[i],utility))continue;
  const id=groups.length, group={id,nodes:[],supply:0,demand:0,used:0,served:0};
  groups.push(group);components[i]=id;const q=[i];
  for(let z=0;z<q.length;z++){
   const j=q[z],x=j%N,y=Math.floor(j/N);group.nodes.push(j);
   for(const [nx,ny] of E.neighbors(x,y)){const k=E.idx(nx,ny);if(components[k]<0&&hasConduit(s.grid[k],utility)){components[k]=id;q.push(k);}}
  }
 }
 return {components,groups};
}
function buildingNetwork(s,nets,x,y){
 const home=E.idx(x,y);if(nets.components[home]>=0)return nets.components[home];
 for(const [nx,ny] of E.neighbors(x,y)){const k=nets.components[E.idx(nx,ny)];if(k>=0)return k;}
 return -1;
}
function networkCoverage(s,a){
 const power=networks(s,'power'),water=networks(s,'water');
 const sewageCap=water.groups.map(()=>0),needPower=power.groups.map(()=>0),needWater=water.groups.map(()=>0),needSewage=water.groups.map(()=>0);
 const zoneStatus=Array(size).fill(null);
 let elecCap=0,waterCap=0,sevCap=0,elecDemand=0,waterDemand=0,sewDemand=0;
 for(let i=0;i<size;i++){
  const c=s.grid[i],x=i%N,y=Math.floor(i/N),pi=buildingNetwork(s,power,x,y),wi=buildingNetwork(s,water,x,y);
  if(c.k==='power'&&pi>=0){power.groups[pi].supply+=650;elecCap+=650;}
  if(c.k==='water'&&wi>=0){water.groups[wi].supply+=700;waterCap+=700;}
  if(c.k==='sewage'&&wi>=0){sewageCap[wi]+=850;sevCap+=850;}
  if(!E.ZONES.includes(c.k)||c.lvl<1)continue;
  const units=c.k==='res'?c.lvl*(c.lvl===3?21:c.lvl===2?14:8):c.k==='com'?c.lvl*(c.lvl===3?15:c.lvl===2?10:6):c.lvl*(c.lvl===3?23:c.lvl===2?16:10);
  const ed=c.k==='res'?units:Math.round(units*.55),wd=c.k==='res'?units:Math.round(units*.4);
  zoneStatus[i]={pi,wi,elec:ed,water:wd};elecDemand+=ed;waterDemand+=wd;sewDemand+=wd;
  if(pi>=0)needPower[pi]+=ed;if(wi>=0){needWater[wi]+=wd;needSewage[wi]+=wd;}
 }
 const legacy=!!s.p0.legacySewage && !s.grid.some(c=>c.k==='sewage');
 if(legacy){for(let i=0;i<sewageCap.length;i++)sewageCap[i]+=700;sevCap+=700*sewageCap.length;}
 let poweredUnits=0,wateredUnits=0,sewageUnits=0,missing=0;
 for(const z of zoneStatus){if(!z)continue;
  z.powered=z.pi>=0&&power.groups[z.pi].supply>=needPower[z.pi];
  z.watered=z.wi>=0&&water.groups[z.wi].supply>=needWater[z.wi];
  z.sewage=z.wi>=0&&sewageCap[z.wi]>=needSewage[z.wi];
  poweredUnits+=z.powered?z.elec:0;wateredUnits+=z.watered?z.water:0;sewageUnits+=z.sewage?z.water:0;if(!z.powered||!z.watered||!z.sewage)missing++;
 }
 return {power,water,zones:zoneStatus,powerCap:elecCap,waterCap,sewageCap:sevCap,electricity:elecDemand,waterUse:waterDemand,sewageUse:sewDemand, powered:elecDemand===0||poweredUnits>=elecDemand,watered:waterDemand===0||wateredUnits>=waterDemand,sewageOk:sewDemand===0||sewageUnits>=sewDemand,disconnectedBuildings:missing,servedZones:zoneStatus.filter(z=>z&&!(!z.powered||!z.watered||!z.sewage)).length,underServed:zoneStatus.filter(Boolean).length};
}
function canTravel(s,a,b){
 const from=s.grid[a],to=s.grid[b],fr=roadType(from),tr=roadType(to);if(!fr||!tr)return false;
 const dx=b%N-a%N,dy=Math.floor(b/N)-Math.floor(a/N);
 const direction=dx===-1?0:dy===-1?1:dx===1?2:3;
 if(fr==='oneway'&&from.direction!==direction)return false;
 if(tr==='oneway'&&to.direction!==direction)return false;
 return true;
}
function closestRoad(s,cellIndex){
 const x=cellIndex%N,y=Math.floor(cellIndex/N),choices=[cellIndex,...E.neighbors(x,y).map(([xx,yy])=>E.idx(xx,yy))];
 return choices.find(i=>s.grid[i].k==='road')??-1;
}
const routeCache=new WeakMap();
function shortest(s,a,b){
 if(a<0||b<0)return null;
 if(a===b)return [a];
 let cache=routeCache.get(s);if(!cache||cache.revision!==s.p0.revision){cache={revision:s.p0.revision,routes:new Map()};routeCache.set(s,cache);}
 const key=a+':'+b;if(cache.routes.has(key))return cache.routes.get(key);
 // Binary heap Dijkstra: weighted travel time by road speed, with lawful one-way access.
 const dist=new Float64Array(size).fill(Infinity),parent=new Int32Array(size).fill(-1),heap=[];
 function put(i,d){let k=heap.length;heap.push([d,i]);while(k>0){const p=(k-1)>>1;if(heap[p][0]<=d)break;heap[k]=heap[p];k=p;}heap[k]=[d,i];}
 function pop(){const out=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let j=k*2+1;if(j+1<heap.length&&heap[j+1][0]<heap[j][0])j++;if(heap[j][0]>=last[0])break;heap[k]=heap[j];k=j;}heap[k]=last;}return out;}
 dist[a]=0;put(a,0);
 while(heap.length){const [cost,u]=pop();if(cost>dist[u])continue;if(u===b)break;
  const x=u%N,y=Math.floor(u/N);
  for(const [xx,yy] of E.neighbors(x,y)){const v=E.idx(xx,yy);if(!canTravel(s,u,v))continue;
   const t=roadType(s.grid[v]);const next=cost+(ROAD_SPEED[t]+ROAD_SPEED[roadType(s.grid[u])])*.5;
   if(next+1e-9<dist[v]){dist[v]=next;parent[v]=u;put(v,next);}
  }
 }
 let route=null;
 if(Number.isFinite(dist[b])){route=[];for(let v=b;v!==-1;v=parent[v]){route.push(v);if(v===a)break;}route.reverse();}
 if(cache.routes.size>2500)cache.routes.clear();cache.routes.set(key,route);return route;
}
E.shortestRoute=(s,a,b)=>{migrate(s);return shortest(s,a,b);};
function syncCitizens(s,basic){
 const p=s.p0;const homeSlots=[],workSlots=[];
 for(let i=0;i<size;i++){
  const c=s.grid[i];if(c.lvl<1)continue;
  if(c.k==='res'){const count=c.lvl*(c.lvl===3?21:c.lvl===2?14:8);for(let j=0;j<count;j++)homeSlots.push(i);}
  if(c.k==='com'||c.k==='ind'){const jobs=c.lvl*(c.k==='com'?(c.lvl===3?15:c.lvl===2?10:6):(c.lvl===3?23:c.lvl===2?16:10));for(let j=0;j<jobs;j++)workSlots.push(i);}
 }
 const scale=Math.max(1,Math.ceil(homeSlots.length/MAX_CITIZENS));const old=new Map(p.citizens.map(c=>[c.id,c]));const citizens=[];
 for(let j=0;j<homeSlots.length;j+=scale){const home=homeSlots[j],id=home*128+(j%128),former=old.get(id),age=former?.age??Math.floor(8+E.hash(id,34,45)*66);
  const worker=age>=18&&age<67;const job=worker&&workSlots.length?workSlots[Math.floor(E.hash(id,4,71)*workSlots.length)]:-1;
  const name=former?.name||(nameA[id%nameA.length]+' '+nameB[Math.floor(E.hash(id,14)*nameB.length)]);
  citizens.push({id,name,age,home,work:job,role:worker?(job>=0?'Empregado':'À procura de emprego'):'Sem atividade profissional',income:job>=0?Math.round(950+E.hash(id,99)*1850):0,route:former?.route||[],commute:former?.commute||0,satisfaction:former?.satisfaction||50});
 }
 p.citizens=citizens;return citizens;
}
function mobility(s,citizens){
 const flow=new Float32Array(size),agents=[],commute=[],keyPaths=new Map();let trips=0,unreachable=0;
 for(const c of citizens){
  if(c.work<0){c.route=[];c.commute=0;continue;}
  const from=closestRoad(s,c.home),to=closestRoad(s,c.work);const key=from+':'+to;
  let route=keyPaths.get(key);if(route===undefined){route=shortest(s,from,to);keyPaths.set(key,route);}
  if(!route){c.route=[];c.commute=0;unreachable++;continue;}
  c.route=route;c.commute=Math.max(1,Math.round(route.reduce((sum,j)=>sum+ROAD_SPEED[roadType(s.grid[j])],0)*2));
  c.satisfaction=clamp(94-c.commute*.7-(s.tax-10)*2,15,97);
  commute.push(c.commute);trips++;
  for(const j of route)flow[j]+=.38;
  if(route.length>1&&agents.length<75)agents.push({route,id:c.id,kind:'commuter'});
 }
 // Real goods deliveries: factories supplying commercial premises through valid routes.
 const firms=[],shops=[];
 for(let i=0;i<size;i++){const c=s.grid[i];if(c.lvl>0&&c.k==='ind')firms.push(i);if(c.lvl>0&&c.k==='com')shops.push(i);}
 let deliveries=0;
 for(let i=0;i<shops.length;i++){
  if(!firms.length)break;const src=firms[i%firms.length];const from=closestRoad(s,src),to=closestRoad(s,shops[i]);const path=shortest(s,from,to);if(!path)continue;
  deliveries++;for(const j of path)flow[j]+=.55;
  if(path.length>1&&agents.length<85)agents.push({route:path,id:99999+i,kind:'freight'});
 }
 let congested=0,load=0,active=0,maxLoad=0;
 const perRoad=Array(size).fill(0);
 for(let i=0;i<size;i++){const k=roadType(s.grid[i]);if(!k)continue;
  const volume=flow[i];const ratio=volume/ROAD_CAPACITY[k];perRoad[i]=Math.round(clamp(ratio*100,0,250));
  if(volume>0){load+=Math.min(1.5,ratio);active++;if(ratio>1)congested++;maxLoad=Math.max(maxLoad,ratio);}
 }
 const averageCommute=commute.length?Math.round(commute.reduce((a,b)=>a+b,0)/commute.length):0;
 const traffic=active?Math.round(clamp(load/active*72,0,100)):0;
 return {citizens:citizens.length,totalRepresented:s.grid.reduce((sum,c)=>sum+(c.k==='res'?c.lvl*(c.lvl===3?21:c.lvl===2?14:8):0),0),trips,unreachable,deliveries,averageCommute,traffic,congested,maxLoad,flow:perRoad,agents};
}
function economy(s,basic,net,mob){
 const fiscal=s.p0.fiscal,rates=fiscal.zoneTax;
 const homes=basic.population,shopping=basic.zoning.com,manufacturing=basic.zoning.ind;
 const property=Math.round(homes*16.5*rates.res/10*(s.tax/10));
 const commercial=Math.round(basic.employed*5.2*rates.com/10*(s.tax/10)+shopping*18*rates.com/10);
 const industry=Math.round(manufacturing*30*rates.ind/10*(s.tax/10)+mob.deliveries*14);
 const exports=Math.round(mob.deliveries*9);
 const importCosts=Math.round(Math.max(0,shopping-mob.deliveries)*12);
 const transitTolls=Math.round(mob.trips*.48);
 const basicCosts=basic.expenses;
 const premiumRoad=s.grid.reduce((sum,c)=>sum+({avenue:9,oneway:4,highway:26,bridge:35}[c.roadType]||0),0);
 const networkMaintenance=s.grid.reduce((sum,c)=>sum+(c.powerLine?3:0)+(c.waterPipe?3:0)+(c.k==='sewage'?350:0),0);
 const salaries=Math.round(basic.population*.65),welfare=Math.round(basic.unemployed*4.5);
 const outsourced=!!s.p0.legacySewage&&!s.grid.some(c=>c.k==='sewage')?250:0;
 const debtService=Math.round(fiscal.debt*fiscal.interest+Math.min(fiscal.debt,Math.max(0,fiscal.debt*.007)));
 const income=property+commercial+industry+exports+transitTolls;
 const expenses=basicCosts+premiumRoad+networkMaintenance+salaries+welfare+importCosts+outsourced+debtService;
 return {income,expenses,balance:income-expenses,breakdown:{property,commercial,industry,exports,transitTolls,basicCosts,premiumRoad,networkMaintenance,salaries,welfare,importCosts,outsourced,debtService},debt:fiscal.debt};
}
E.analyze=function(s){
 migrate(s);
 const basicMetrics=base.analyze(s),net=networkCoverage(s,basicMetrics);
 const citizens=syncCitizens(s,basicMetrics),mob=mobility(s,citizens),fin=economy(s,basicMetrics,net,mob);
 const unavailable=net.underServed?net.disconnectedBuildings/net.underServed:0;
 const happiness=clamp(Math.round(basicMetrics.happiness-(net.sewageOk?0:18)-unavailable*18-mob.traffic*.12),8,97);
 return {...basicMetrics,powerCap:net.powerCap,waterCap:net.waterCap,electricity:net.electricity,waterUse:net.waterUse,powered:net.powered,watered:net.watered,sewageCap:net.sewageCap,sewageUse:net.sewageUse,sewageOk:net.sewageOk,disconnectedBuildings:net.disconnectedBuildings,utilityCoverage:net,traffic:mob.traffic,congestionByRoad:mob.flow,trafficAgents:mob.agents,commuters:mob.trips,unreachableTrips:mob.unreachable,deliveries:mob.deliveries,averageCommute:mob.averageCommute,simulatedCitizens:mob.citizens,happiness,...fin};
};
E.tick=function(s){
 migrate(s);const before=base.analyze(s);const previousLevels=s.grid.map(c=>c.lvl);
 base.tick(s);
 // Growth requires functioning network access for the specific parcel, not only city-wide supply.
 let extended=E.analyze(s);
 for(let i=0;i<size;i++)if(s.grid[i].lvl>previousLevels[i]){
  const z=extended.utilityCoverage.zones[i];if(z&&(!z.powered||!z.watered||!z.sewage))s.grid[i].lvl=previousLevels[i];
 }
 extended=E.analyze(s);const afterBasic=base.analyze(s);
 s.money+=extended.balance-afterBasic.balance;
 const fiscal=s.p0.fiscal;
 const payment=Math.min(fiscal.debt,fiscal.debt*.007);fiscal.debt=Math.max(0,Math.round(fiscal.debt-payment));
 if(s.month===1){for(const c of s.p0.citizens)c.age++;}
 fiscal.history.push({date:E.date(s),balance:extended.balance,income:extended.income,expenses:extended.expenses,population:extended.population,traffic:extended.traffic,unemployment:extended.unemployed,treasury:Math.round(s.money)});
 if(fiscal.history.length>48)fiscal.history.splice(0,fiscal.history.length-48);
 if(!extended.sewageOk && !s.events.some(e=>e.title==='Esgotos insuficientes'))s.events.unshift({id:s.year*12+s.month,title:'Esgotos insuficientes',description:'Aumenta a capacidade de tratamento ou liga bairros à rede de condutas.',type:'warning',date:E.date(s)});
 return extended;
};
E.borrow=function(s,amount=25000){migrate(s);amount=Number(amount);if(!Number.isInteger(amount)||amount<=0||s.p0.fiscal.debt+amount>250000)return {ok:false,reason:'Limite de crédito municipal: 250 000 €.'};s.p0.fiscal.debt+=amount;s.money+=amount;return {ok:true};};
E.repay=function(s,amount=10000){migrate(s);amount=Math.min(Math.max(0,Math.floor(Number(amount)||0)),s.p0.fiscal.debt);if(!amount||s.money<amount)return {ok:false,reason:'Não tens saldo ou dívida suficiente.'};s.money-=amount;s.p0.fiscal.debt-=amount;return {ok:true};};
E.setZoneTax=function(s,k,amount){migrate(s);if(!E.ZONES.includes(k))return false;s.p0.fiscal.zoneTax[k]=clamp(Math.round(amount),4,22);return true;};
E.roadCapacity=ROAD_CAPACITY;
return E;
});