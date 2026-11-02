/* METRÓPOLE — pure deterministic simulation engine (also used by Node tests). */
(function(root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; root.CityEngine = api; })(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const N = 36, SAVE_KEY = 'dungeons-metropole-v1', VERSION = 1;
  const COST = {road:90,res:35,com:45,ind:45,park:2200,school:8500,clinic:9500,fire:10000,police:10500,power:14500,water:9800,bulldoze:140};
  const UPKEEP = {road:2,park:65,school:280,clinic:320,fire:300,police:310,power:520,water:300};
  const SERVICES = ['park','school','clinic','fire','police','power','water'];
  const ZONES = ['res','com','ind'];
  const LABELS = {road:'Estrada',res:'Residencial',com:'Comercial',ind:'Industrial',park:'Parque',school:'Escola',clinic:'Hospital',fire:'Bombeiros',police:'Polícia',power:'Central elétrica',water:'Estação de água',empty:'Terreno livre'};
  const hash=(x,y,seed=13)=>{let h=Math.imul(x+seed,374761393)+Math.imul(y+seed*7,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  const idx=(x,y)=>y*N+x, inside=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
  const waterAt=(x,y)=>{const v=((x-32)/5)**2+((y-12)/11)**2;const bay=((x-34)/8)**2+((y-28)/7)**2;return (v<1.05 || bay<1.0) && hash(x,y)>0.12;};
  function emptyCell(x,y){return {t:waterAt(x,y)?'water':'land',k:'empty',lvl:0,age:0};}
  function create() {
    const s={version:VERSION,seed:13,name:'Nova Aurora',month:4,year:2026,money:118000,tax:10,speed:1,paused:false,grid:Array.from({length:N*N},(_,i)=>emptyCell(i%N,Math.floor(i/N))),events:[],milestones:[],totalBuilt:0};
    const place=(x,y,k,lvl=0)=>{const c=s.grid[idx(x,y)];if(c.t==='land'){c.k=k;c.lvl=lvl;c.age=4;}};
    for(let a=11;a<=25;a++){place(a,12,'road');place(a,24,'road');place(12,a,'road');place(24,a,'road');}
    for(let a=6;a<=30;a++)place(18,a,'road');
    for(let a=7;a<=28;a++)place(a,18,'road');
    for(let a=13;a<=23;a++){
      if(a!==18) { place(a,13,a<18?'res':'com',a%3===0?2:1);place(a,23,a<18?'res':'ind',a%3===0?2:1); }
      if(a!==18 && a%2===0){place(13,a,a<18?'res':'com',1);place(23,a,a<18?'com':'ind',1);}
    }
    place(10,18,'road');place(10,17,'fire');place(9,18,'road');place(9,17,'park');
    place(27,18,'road');place(27,17,'clinic');place(28,18,'road');place(27,19,'water');
    place(18,9,'road');place(17,9,'school');
    place(18,27,'road');place(19,27,'power');place(17,27,'police');
    place(15,17,'park');place(20,17,'park');
    s.events=[{id:1,title:'Bem-vindo a Nova Aurora',description:'Expande a rede de estradas, define zonas e mantém a cidade a funcionar.',type:'info',date:'Abr 2026'}];
    s.totalBuilt=s.grid.filter(c=>c.k!=='empty').length;
    return s;
  }
  function validate(s){return !!(s&&s.version===VERSION&&Array.isArray(s.grid)&&s.grid.length===N*N&&Number.isFinite(s.money)&&Number.isFinite(s.tax)&&s.grid.every(c=>c&&['water','land'].includes(c.t)&&typeof c.k==='string'));}
  function neighbors(x,y){return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>inside(a,b));}
  function roadGraph(s) {
    const connected=new Set(),queue=[];
    const sources=[];
    for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(s.grid[idx(x,y)].k==='road') sources.push([x,y]);
    if(!sources.length)return {connected,roadCount:0};
    // All road components connected to the city's largest road network are functional.
    const seen=new Set(); let best=[];
    for(const [sx,sy] of sources){const first=idx(sx,sy);if(seen.has(first))continue;const component=[],todo=[[sx,sy]];seen.add(first);
      for(let h=0;h<todo.length;h++){const [x,y]=todo[h];component.push(idx(x,y));for(const [nx,ny] of neighbors(x,y)){const j=idx(nx,ny);if(!seen.has(j)&&s.grid[j].k==='road'){seen.add(j);todo.push([nx,ny]);}}}
      if(component.length>best.length)best=component;
    }
    for(const i of best)connected.add(i);
    return {connected,roadCount:sources.length};
  }
  function access(s,x,y,roads){return neighbors(x,y).some(([a,b])=>roads.connected.has(idx(a,b)));}
  function closeTo(x,y,services,r){return services.some(p=>Math.abs(x-p.x)+Math.abs(y-p.y)<=r);}
  function analyze(s){
    const roads=roadGraph(s), facilities={};for(const k of SERVICES)facilities[k]=[];
    const zoning={res:0,com:0,ind:0},occupied={res:0,com:0,ind:0};
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const c=s.grid[idx(x,y)];if(facilities[c.k]&&access(s,x,y,roads)) facilities[c.k].push({x,y});if(ZONES.includes(c.k)){zoning[c.k]++;if(c.lvl>0)occupied[c.k]++;}}
    const powerCap=facilities.power.length*650,waterCap=facilities.water.length*700;
    let pop=0,jobs=0,resCapacity=0,shopping=0,industry=0,pollutionSum=0,landSum=0,resCount=0,covered=0,connectedZoned=0;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const c=s.grid[idx(x,y)];if(!ZONES.includes(c.k)) continue;
      const hasAccess=access(s,x,y,roads);
      if(hasAccess)connectedZoned++;
      const density=c.lvl>0?c.lvl:0;
      if(c.k==='res'){
        const p=density*(density===3?21:density===2?14:8);pop+=p;resCapacity+=density*22;resCount++;
        let services=0;for(const [k,r] of [['park',6],['school',9],['clinic',8],['fire',8],['police',8]])if(closeTo(x,y,facilities[k],r))services++;
        covered+=services/5;
        let pol=0;for(const f of [...facilities.power,...facilities.water])if(Math.abs(x-f.x)+Math.abs(y-f.y)<5)pol+=f===undefined?0:8;
        for(let a=Math.max(0,x-5);a<=Math.min(N-1,x+5);a++)for(let b=Math.max(0,y-5);b<=Math.min(N-1,y+5);b++)if(s.grid[idx(a,b)].k==='ind'&&s.grid[idx(a,b)].lvl>0)pol+=Math.max(0,5-(Math.abs(x-a)+Math.abs(y-b)))*0.55;
        pollutionSum+=Math.min(100,pol);landSum+=Math.round(42+services*11-pol*0.8+(hasAccess?8:-20));
      }else if(c.k==='com'){const j=density*(density===3?15:density===2?10:6);jobs+=j;shopping+=j;}
      else {const j=density*(density===3?23:density===2?16:10);jobs+=j;industry+=j;}
    }
    const workers=Math.round(pop*0.48),employed=Math.min(workers,jobs),unemployed=Math.max(0,workers-jobs);
    const electricity=pop+Math.round(jobs*0.55),waterUse=pop+Math.round(jobs*0.4);
    const powered=powerCap>=electricity && powerCap>0, watered=waterCap>=waterUse&&waterCap>0;
    const averageCoverage=resCount?covered/resCount:0,averagePollution=resCount?pollutionSum/resCount:0;
    const unemployedPct=workers?unemployed/workers:0;
    const happiness=Math.max(12,Math.min(97,Math.round(53+averageCoverage*35-averagePollution*0.24-(powered?0:22)-(watered?0:22)-unemployedPct*25-(s.tax-10)*2.4)));
    const roadUtil=roads.connected.size||1,traffic=Math.max(4,Math.min(100,Math.round((pop+jobs)*0.12/Math.sqrt(roadUtil)+Math.max(0,unemployedPct*5))));
    const resDemand=Math.max(0,Math.min(100,Math.round(55+(jobs-workers)*0.2+(happiness-55)*0.7-(occupied.res-zoning.res*0.65)*3)));
    const comDemand=Math.max(0,Math.min(100,Math.round(50+(pop-shopping*2)*0.1-(occupied.com-zoning.com*0.65)*3)));
    const indDemand=Math.max(0,Math.min(100,Math.round(44+(workers-jobs)*0.22-(occupied.ind-zoning.ind*0.65)*3)));
    const upkeep=s.grid.reduce((sum,c)=>sum+(UPKEEP[c.k]||0),0);
    const income=Math.max(0,Math.round((pop*12.5+employed*5.2+shopping*3.4+industry*3.5)*(s.tax/10)));
    const expenses=Math.round(upkeep + pop*0.8);
    return {population:pop,jobs,workers,employed,unemployed,happiness,traffic,powerCap,waterCap,electricity,waterUse,powered,watered,coverage:Math.round(averageCoverage*100),pollution:Math.round(averagePollution),landValue:resCount?Math.round(landSum/resCount):40,connectedZoned,roadCount:roads.roadCount,income,expenses,balance:income-expenses, demand:{res:resDemand,com:comDemand,ind:indDemand},zoning,occupied,facilities,roads};
  }
  function addEvent(s,title,description,type='info'){s.events.unshift({id:(s.events[0]?.id||0)+1,title,description,type,date:date(s)});s.events=s.events.slice(0,12);}
  function date(s){return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][s.month-1]+' '+s.year;}
  function build(s,x,y,kind){if(!inside(x,y))return {ok:false,reason:'Fora dos limites da cidade.'};if(!COST[kind])return {ok:false,reason:'Ferramenta inválida.'};const cell=s.grid[idx(x,y)];if(cell.t==='water')return {ok:false,reason:'Não podes construir sobre a água.'};if(kind==='bulldoze'){
      if(cell.k==='empty')return {ok:false,reason:'Este terreno já está livre.'};if(s.money<COST.bulldoze)return {ok:false,reason:'Saldo insuficiente.'};const old=cell.k;cell.k='empty';cell.lvl=0;cell.age=0;s.money-=COST.bulldoze;return {ok:true,cost:COST.bulldoze,old};
    }
    if(cell.k===kind)return {ok:false,reason:'Já existe esta construção.'};
    if(cell.k!=='empty')return {ok:false,reason:'Demole primeiro a construção existente.'};
    if(s.money<COST[kind])return {ok:false,reason:'Fundos insuficientes para construir.'};
    cell.k=kind;cell.lvl=0;cell.age=0;s.money-=COST[kind];s.totalBuilt++;
    return {ok:true,cost:COST[kind]};
  }
  function tick(s) {
    s.month++;if(s.month>12){s.month=1;s.year++;}
    const a=analyze(s), canGrow=a.powered&&a.watered;
    if(canGrow){let grown=0;for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const c=s.grid[idx(x,y)],k=c.k;if(!ZONES.includes(k)||!access(s,x,y,a.roads))continue;
      c.age++;
      const demand=a.demand[k];const pct=hash(x+s.month,y+s.year,s.year%100+Math.floor(s.totalBuilt/10));
      if(c.lvl===0&&demand>15&&pct<0.12+demand*0.0035){c.lvl=1;grown++;}
      else if(c.lvl>0&&c.lvl<3&&a.happiness>45&&demand>35&&c.age>3&&pct<0.035+demand*0.0008){c.lvl++;c.age=0;grown++;}
      else if(c.lvl>1&&a.happiness<35&&pct<0.08)c.lvl--;
      if(grown>12)break;
    }}
    const end=analyze(s);s.money+=end.balance;
    if(s.money<0&&s.money-end.balance>=0)addEvent(s,'Tesouraria em défice','Os custos operacionais são superiores às receitas.','warning');
    if(!end.powered&&a.powered)addEvent(s,'Falha no fornecimento elétrico','Constrói outra central elétrica.','warning');
    if(!end.watered&&a.watered)addEvent(s,'Falta de água','A capacidade de abastecimento foi ultrapassada.','warning');
    if(end.population>=500&&!s.milestones.includes('500')){s.milestones.push('500');s.money+=12000;addEvent(s,'Cidade em crescimento','Atingiste 500 habitantes. Bónus municipal de 12 000 €.','success');}
    if(end.population>=1000&&!s.milestones.includes('1000')){s.milestones.push('1000');s.money+=30000;addEvent(s,'Metrópole emergente','Atingiste 1 000 habitantes. Recebeste 30 000 €.','success');}
    return end;
  }
  return {N,VERSION,SAVE_KEY,COST,LABELS,SERVICES,ZONES,hash,idx,inside,neighbors,create,validate,analyze,build,tick,date,roadGraph,access};
});