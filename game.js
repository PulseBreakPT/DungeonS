/* METRÓPOLE — responsive isometric city builder. No dependencies, no network access required. */
(()=>{
'use strict';
const E=window.CityEngine;
if(!E){document.body.textContent='Erro ao carregar o motor de jogo.';return;}
const canvas=document.getElementById('world'),ctx=canvas.getContext('2d',{alpha:false});
if(!ctx){document.body.textContent='O browser não suporta Canvas 2D.';return;}
const $=id=>document.getElementById(id),money=n=>Math.round(n).toLocaleString('pt-PT')+' €',fmt=n=>Math.round(n).toLocaleString('pt-PT');
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state;try{const saved=JSON.parse(localStorage.getItem(E.SAVE_KEY)||'null');state=E.validate(saved)?saved:E.create();}catch{state=E.create();}
let metrics=E.analyze(state),tool='inspect',selected=null,hover=null,zoom=innerWidth<700?.9:1.0;
let cam={x:0,y:innerWidth<700?-15:-25},w=0,h=0,dpr=1;
let dirty=true,painted=new Set(),undoStack=[],lastSim=performance.now(),lastFrame=0,simProgress=0,toastTimer=0;
const pointers=new Map();let drag=null,pinch=null,hideStats=false;
const toolsInfo={inspect:'Toca num edifício para ver detalhes. Arrasta para mover o mapa.',road:'Cria estradas ligadas à rede. Podes arrastar para construir.',res:'Marca terrenos residenciais junto às estradas.',com:'Marca comércio perto dos habitantes e das estradas.',ind:'Cria empregos industriais. Evita instalar junto às habitações.',park:'Os parques aumentam a felicidade das zonas próximas.',school:'Melhora os serviços dos bairros perto da escola.',clinic:'Hospitais melhoram o bem-estar da população.',fire:'Os bombeiros oferecem cobertura a bairros próximos.',police:'Esquadras aumentam a segurança dos bairros.',power:'Uma central fornece capacidade elétrica para toda a rede.',water:'A água é essencial para o crescimento da cidade.',bulldoze:'Demole construções. Atenção: a demolição é permanente.'};
function persist(){try{localStorage.setItem(E.SAVE_KEY,JSON.stringify(state));}catch{toast('Armazenamento cheio. Exporta o save.','error');}}
function toast(msg,type='ok'){const el=$('toast');el.textContent=msg;el.className='toast show'+(type==='error'?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',2450);}
function setTool(t){if(t!=='inspect'&&t!=='bulldoze'&&!E.COST[t])return;tool=t;selected=null;$('selectionPanel').classList.add('hidden');canvas.classList.toggle('building',t!=='inspect');document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===t);b.setAttribute('aria-pressed',String(b.dataset.tool===t));});$('toolInfo').textContent=toolsInfo[t]||'';dirty=true;}
function refresh(){metrics=E.analyze(state);$('cityName').textContent=state.name||'Nova Aurora';$('money').textContent=money(state.money);$('money').style.color=state.money<0?'#ff9a96':'';
$('population').textContent=fmt(metrics.population);$('jobs').textContent=fmt(metrics.jobs)+' empregos';$('happiness').textContent=metrics.happiness+'%';$('happiness').style.color=metrics.happiness>65?'#8ee7b8':metrics.happiness<40?'#f5a49d':'#f2c87f';
$('balance').textContent=(metrics.balance>=0?'+':'')+money(metrics.balance)+'/mês';$('balance').className='change '+(metrics.balance>=0?'positive':'negative');$('date').textContent=E.date(state);
for(const k of E.ZONES){$(k+'Bar').style.width=metrics.demand[k]+'%';$(k+'Pct').textContent=metrics.demand[k]+'%';}
for(const [k,used,cap] of [['power',metrics.electricity,metrics.powerCap],['water',metrics.waterUse,metrics.waterCap]]){$(k+'Text').textContent=fmt(used)+' / '+fmt(cap);$(k+'Bar').style.width=(cap?Math.min(100,100*used/cap):100)+'%';$(k+'Bar').style.background=cap<used?'#ff8b86':'#e1c274';}
$('traffic').textContent=metrics.traffic+'%';$('coverage').textContent=metrics.coverage+'%';$('unemployed').textContent=(metrics.workers?Math.round(metrics.unemployed/metrics.workers*100):0)+'%';$('income').textContent='+'+money(metrics.income);$('expenses').textContent='−'+money(metrics.expenses);$('taxValue').textContent=state.tax+'%';$('statusText').textContent=state.speed===0?'EM PAUSA':'CIDADE ATIVA';
document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.speed)===state.speed));
$('eventFeed').innerHTML=state.events.slice(0,3).map(e=>`<div class="event-item ${['warning','success'].includes(e.type)?e.type:''}"><b>${escapeHtml(e.title)}</b><p>${escapeHtml(e.description)}</p><small>${escapeHtml(e.date)}</small></div>`).join('');
if(selected)inspect(selected.x,selected.y,false);
dirty=true;
}
function resize(){const b=canvas.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);w=Math.floor(b.width);h=Math.floor(b.height);canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;}
function project(x,y,z=0){return {x:w/2+(x-y)*32*zoom+cam.x,y:h/2+(x+y-E.N+0)*16*zoom+cam.y-z*zoom};}
function unproject(px,py){const dx=(px-w/2-cam.x)/(32*zoom),dy=(py-h/2-cam.y)/(16*zoom);return{x:Math.round((dx+dy+E.N)/2),y:Math.round((dy+E.N-dx)/2)};}
function poly(points,fill,stroke=null,width=1){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width*zoom;ctx.strokeStyle=stroke;ctx.stroke();}}
function diamond(x,y,rw=32,rh=16,fill,stroke=null){poly([[x,y-rh*zoom],[x+rw*zoom,y],[x,y+rh*zoom],[x-rw*zoom,y]],fill,stroke);}
function stroke(a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width*zoom;ctx.stroke();}
function prism(x,y,rw,rh,height,roof,left,right,outline=null){const rwz=rw*zoom,rhz=rh*zoom,hz=height*zoom;
const T=[x,y-rhz-hz],R=[x+rwz,y-hz],B=[x,y+rhz-hz],L=[x-rwz,y-hz];const G_R=[x+rwz,y],G_B=[x,y+rhz],G_L=[x-rwz,y];
poly([L,B,G_B,G_L],left,outline);poly([R,B,G_B,G_R],right,outline);poly([T,R,B,L],roof,'rgba(255,255,255,.15)',.8);
return {x,y,rw:rwz,rh:rhz,height:hz};}
function drawTrees(x,y,count,seed){for(let i=0;i<count;i++){
  const hx=E.hash(x+i*4,y+i*2,seed),hy=E.hash(x+i*8,y+i*11,seed+4),cx=x+(hx-.5)*29*zoom,cy=y+(hy-.5)*10*zoom;
  stroke({x:cx,y:cy+3*zoom},{x:cx,y:cy-5*zoom},'#5c5545',2.5);
  ctx.beginPath();ctx.ellipse(cx,cy-8*zoom,(4+hx*3)*zoom,(6+hy*3)*zoom,0,0,Math.PI*2);ctx.fillStyle=['#438964','#5d9e6c','#366f64','#8ab67a'][i%4];ctx.fill();
}}
function drawHouse(x,y,cell,tx,ty){const rnd=E.hash(tx,ty,17),level=cell.lvl,height=(12+level*13+(rnd*9))*zoom;const baseW=level===3?25:23,baseH=level===3?12:11;
  let pal=cell.k==='res'?['#79bdac','#4e8292','#285d78']:cell.k==='com'?['#79b7cd','#528bc1','#3573ad']:['#c7ae87','#b08364','#836252'];
  const top=pal[level-1]||pal[0],sideL=cell.k==='res'?'#3c7580':cell.k==='com'?'#315c87':'#805e4a',sideR=cell.k==='res'?'#286070':cell.k==='com'?'#234e7e':'#684d3c';
  if(cell.k==='ind'){prism(x,y,27,12,Math.min(27,height/zoom),top,sideL,sideR);ctx.fillStyle='#60605d';const z=project(tx,ty,Math.min(27,height/zoom));ctx.fillRect(z.x+4*zoom,z.y-8*zoom,3*zoom,9*zoom);return;}
  prism(x,y,baseW,baseH,height/zoom,top,sideL,sideR);
  if(level===1){const attic=[[x,y-height-baseH*zoom],[x+(baseW-1)*zoom,y-height],[x,y-height+baseH*zoom],[x-(baseW-1)*zoom,y-height]];poly(attic,cell.k==='res'?'#96c0aa':'#a7d3d5');}
  const floors=Math.max(1,Math.round((height/zoom-7)/11));for(let n=0;n<floors;n++){
    const yy=y-(n*10+8)*zoom;for(let j=0;j<2;j++){
      ctx.fillStyle=(n+j+tx+ty)%4===0?'#e9dba8':'#a4ddda';ctx.globalAlpha=.66;
      poly([[x-(j+1)*7*zoom,yy-2*zoom],[x-(j+1)*7*zoom+3*zoom,yy-1*zoom],[x-(j+1)*7*zoom+3*zoom,yy+3*zoom],[x-(j+1)*7*zoom,yy+2*zoom]],ctx.fillStyle);
      poly([[x+(j+1)*7*zoom,yy-1*zoom],[x+(j+1)*7*zoom+3*zoom,yy-2*zoom],[x+(j+1)*7*zoom+3*zoom,yy+2*zoom],[x+(j+1)*7*zoom,yy+3*zoom]],ctx.fillStyle);ctx.globalAlpha=1;
    }
  }
}
function drawService(x,y,k,tx,ty){
  if(k==='park'){diamond(x,y,26,13,'#498865');drawTrees(x,y,4,5);return;}
  const styles={school:['#dda873','#906a5b','#79594e',24],clinic:['#f4e2cd','#9aadaf','#748f97',31],fire:['#f1a17d','#a94c45','#813f3e',24],police:['#a9b7cb','#526c91','#405777',28],power:['#a99e8e','#686d71','#55575a',27],water:['#78bbcd','#427d90','#346779',20]};
  const [roof,left,right,height]=styles[k]||styles.school;
  if(k==='water'){
    prism(x,y,17,9,15,'#528895','#28606c','#174752');ctx.fillStyle='#a1dce2';ctx.beginPath();ctx.ellipse(x,y-26*zoom,10*zoom,5*zoom,0,0,Math.PI*2);ctx.fill();stroke({x:x-6*zoom,y:y-26*zoom},{x:x-6*zoom,y:y-10*zoom},'#76abb0',2);return;
  }
  prism(x,y,26,13,height,roof,left,right);
  if(k==='power'){const px=x+7*zoom,py=y-31*zoom;poly([[px-4*zoom,py+7*zoom],[px+2*zoom,py+9*zoom],[px+2*zoom,py-17*zoom],[px-4*zoom,py-19*zoom]],'#747c7d');ctx.fillStyle='rgba(225,241,226,.24)';ctx.beginPath();ctx.arc(px,py-23*zoom+(Math.sin(Date.now()/900+tx)*3)*zoom,6*zoom,0,Math.PI*2);ctx.fill();}
  if(k==='clinic'||k==='fire'||k==='police'||k==='school'){ctx.fillStyle=k==='fire'?'#ffded0':k==='clinic'?'#ef5e62':'#f9e7c5';ctx.font=`bold ${k==='clinic'?17:14}px 'Space Grotesk',sans-serif`;ctx.textAlign='center';ctx.fillText(k==='clinic'?'+':k==='fire'?'♨':k==='police'?'★':'▤',x,y-height*zoom-2*zoom);}
}
function drawRoad(x,y,tx,ty){diamond(x,y,31.5,15.7,'#526b70','#718487');
  const neighbors=E.neighbors(tx,ty).filter(([nx,ny])=>state.grid[E.idx(nx,ny)].k==='road');
  for(const [nx,ny] of neighbors){const pt=project(nx,ny);const a={x:x+(pt.x-x)*.05,y:y+(pt.y-y)*.05},b={x:x+(pt.x-x)*.47,y:y+(pt.y-y)*.47};stroke(a,b,'#c9d1ab',1.6);}
  if(neighbors.length===0)diamond(x,y,5,3,'#d4cba7');
}
function drawTile(x,y,now){const c=state.grid[E.idx(x,y)];const p=project(x,y);if(p.x<-115||p.x>w+115||p.y<-220||p.y>h+110)return;
  const rnd=E.hash(x,y,7);
  if(c.t==='water'){diamond(p.x,p.y,32.4,16.3,rnd>.5?'#4c9ba1':'#418c92','#70b1ae');
    ctx.globalAlpha=.22;stroke({x:p.x-10*zoom,y:p.y-1.5*zoom},{x:p.x+4*zoom,y:p.y-8*zoom+(Math.sin(now/730+x)*1.8)*zoom},'#c1e9db',1);ctx.globalAlpha=1;return;}
  const ground=rnd<.28?'#589878':rnd<.56?'#62a081':rnd<.82?'#679e7b':'#6ca483';
  diamond(p.x,p.y,32.3,16.2,ground,'rgba(33,94,72,.25)');
  if(c.k==='empty'&&rnd>.83)drawTrees(p.x,p.y,1,3);
  if(c.k==='road')drawRoad(p.x,p.y,x,y);
  else if(E.ZONES.includes(c.k)){
    const color={res:'rgba(94,226,159,.33)',com:'rgba(80,169,237,.33)',ind:'rgba(235,157,94,.36)'}[c.k];
    diamond(p.x,p.y,29.6,14.6,color,c.k==='res'?'rgba(122,242,170,.55)':c.k==='com'?'rgba(124,202,249,.55)':'rgba(247,181,111,.55)');
    if(c.lvl>0)drawHouse(p.x,p.y,c,x,y);
    else if(zoom>.65){ctx.fillStyle='rgba(255,255,255,.45)';ctx.font=`${Math.max(9,10*zoom)}px sans-serif`;ctx.textAlign='center';ctx.fillText('◌',p.x,p.y+3*zoom);}
  }else if(E.SERVICES.includes(c.k))drawService(p.x,p.y,c.k,x,y);
  if((hover&&hover.x===x&&hover.y===y)||(selected&&selected.x===x&&selected.y===y)){
    diamond(p.x,p.y,32,16,hover&&hover.x===x&&hover.y===y?'rgba(255,255,255,.22)':'rgba(100,235,210,.25)','rgba(238,255,255,.95)');
  }
}
function drawTraffic(now){const active=metrics.roadCount;if(!active)return;const cars=Math.min(28,Math.floor((metrics.population+metrics.jobs)/55)+3);
  for(let i=0;i<cars;i++){
    let x=7+Math.floor(E.hash(i,2,33)*22),y=12+Math.floor(E.hash(i,8,54)*13),hop=0;
    // Use existing roads only, with local routes so visual traffic follows streets.
    let xRoad=18,yRoad=18;
    if(i%4===0){xRoad=18;yRoad=7+Math.floor(E.hash(i,8)*21);}else if(i%4===1){xRoad=7+Math.floor(E.hash(i,8)*21);yRoad=18;}else if(i%4===2){xRoad=12;yRoad=12+Math.floor(E.hash(i,8)*12);}else{xRoad=12+Math.floor(E.hash(i,8)*12);yRoad=24;}
    if(state.grid[E.idx(xRoad,yRoad)].k!=='road')continue;
    const options=E.neighbors(xRoad,yRoad).filter(([nx,ny])=>state.grid[E.idx(nx,ny)].k==='road');if(!options.length)continue;
    const next=options[Math.floor(E.hash(i,1,14)*options.length)];const t=(now/1000*(0.5+metrics.traffic/270)+i*.23)%1;
    const a=project(xRoad,yRoad),b=project(next[0],next[1]);const px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;
    ctx.fillStyle=i%5===0?'#fee5ab':i%3===0?'#f3b4a0':'#dff9e8';ctx.beginPath();ctx.ellipse(px,py,3.1*zoom,1.8*zoom,0,0,Math.PI*2);ctx.fill();
  }
}
function draw(now){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#478a82';ctx.fillRect(0,0,w,h);
  const grd=ctx.createLinearGradient(0,0,0,h);grd.addColorStop(0,'#85b1a1');grd.addColorStop(.62,'#5f998b');grd.addColorStop(1,'#386c68');ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
  for(let depth=0;depth<(E.N-1)*2+1;depth++)for(let x=0;x<E.N;x++){const y=depth-x;if(y>=0&&y<E.N)drawTile(x,y,now);}
  drawTraffic(now);
  if(tool!=='inspect'&&hover&&E.inside(hover.x,hover.y)){const p=project(hover.x,hover.y);diamond(p.x,p.y,33,17,'rgba(255,255,255,.10)',state.grid[E.idx(hover.x,hover.y)].t==='water'?'#ffaba3':'#eaffb9');}
}
function inspect(x,y,toastOn=false){if(!E.inside(x,y))return;selected={x,y};const c=state.grid[E.idx(x,y)];const name=c.t==='water'?'Água':E.LABELS[c.k]||c.k;
  $('selectionPanel').classList.remove('hidden');$('selectionTitle').textContent=name;
  let desc=c.t==='water'?'Zona aquática protegida. Não é possível construir aqui.':c.k==='empty'?'Este terreno está livre. Escolhe uma ferramenta de construção para o desenvolver.':c.k==='road'?'Estrada municipal. Liga edifícios e bairros à rede viária.':E.ZONES.includes(c.k)?`Zona ${name.toLowerCase()} · ${c.lvl?'edifício de nível '+c.lvl:'à espera de desenvolvimento'}. ${E.access(state,x,y,metrics.roads)?'Tem acesso à estrada.':'Sem acesso à estrada ligada à cidade.'}`:`Serviço público: ${name}. ${E.access(state,x,y,metrics.roads)?'Ligado à rede viária.':'Sem acesso à rede viária.'}`;
  $('selectionDesc').textContent=desc;$('selectionCoords').textContent=`SETOR ${String(x+1).padStart(2,'0')} · ${String(y+1).padStart(2,'0')}`;dirty=true;
}
function applyAt(x,y){if(!E.inside(x,y)||tool==='inspect')return;const key=E.idx(x,y);if(painted.has(key))return;painted.add(key);
  const cell=state.grid[key],prev={x,y,cell:{...cell},money:state.money,totalBuilt:state.totalBuilt};const res=E.build(state,x,y,tool);
  if(!res.ok){if(painted.size===1)toast(res.reason,'error');return;}
  undoStack.push(prev);if(undoStack.length>100)undoStack.shift();selected=null;$('selectionPanel').classList.add('hidden');refresh();persist();
}
function cursor(e){const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top};}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1&&e.button!==2)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=cursor(e);pointers.set(e.pointerId,p);
  if(pointers.size===2){const v=[...pointers.values()];pinch={distance:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),zoom,mid:{x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2}};drag=null;return;}
  painted.clear();drag={p,started:p,moved:false,mode:tool==='inspect'||e.button!==0?'pan':'paint',kind:tool};
  if(drag.mode==='paint'){const t=unproject(p.x,p.y);hover=t;applyAt(t.x,t.y);}
});
canvas.addEventListener('pointermove',e=>{
  const p=cursor(e);if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
  if(pointers.size===2){const v=[...pointers.values()];const distance=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(pinch&&pinch.distance>1){zoom=Math.max(.48,Math.min(2.35,pinch.zoom*distance/pinch.distance));dirty=true;}return;}
  if(drag){if(Math.hypot(p.x-drag.started.x,p.y-drag.started.y)>5)drag.moved=true;
    if(drag.mode==='pan'){cam.x+=p.x-drag.p.x;cam.y+=p.y-drag.p.y;drag.p=p;dirty=true;}
    else{const t=unproject(p.x,p.y);hover=t;applyAt(t.x,t.y);dirty=true;}
  }else{const p2=unproject(p.x,p.y);if(!hover||hover.x!==p2.x||hover.y!==p2.y){hover=p2;dirty=true;}}
});
function pointerUp(e){const p=cursor(e),was=drag;pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
  if(was&&was.mode==='pan'&&!was.moved&&tool==='inspect'){const t=unproject(p.x,p.y);inspect(t.x,t.y);}drag=null;painted.clear();dirty=true;
}
canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('pointerleave',()=>{if(!drag&&pointers.size===0){hover=null;dirty=true;}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=cursor(e),old=zoom;zoom=Math.max(.48,Math.min(2.35,zoom*(e.deltaY>0?.91:1.09)));cam.x+=(p.x-w/2-cam.x)*(1-zoom/old);cam.y+=(p.y-h/2-cam.y)*(1-zoom/old);dirty=true;},{passive:false});
function setSpeed(speed){state.speed=speed;state.paused=speed===0;simProgress=0;refresh();persist();}
function newGame(){if(!confirm('Criar uma cidade nova? A cidade atual será substituída. Exporta o save primeiro se quiseres guardá-la.'))return;state=E.create();undoStack=[];selected=null;$('selectionPanel').classList.add('hidden');cam={x:0,y:-15};setTool('inspect');refresh();persist();closeModal();toast('Nova cidade criada!');}
function exportSave(){const data=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download='metropole-'+state.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Ficheiro de cidade exportado.');}
function closeModal(){$('modal').classList.add('hidden');}
function modal(title,html){$('modalTitle').textContent=title;$('modalContent').innerHTML=html;$('modal').classList.remove('hidden');}
function openMenu(){modal('Centro de controlo',`<p>Constrói a cidade ao teu ritmo. Os dados são guardados automaticamente neste browser.</p><div class="action-list"><button data-action="save">Guardar agora</button><button data-action="export">Exportar cidade</button><button data-action="import">Importar cidade</button><button data-action="help">Como jogar</button><button data-action="budget">Orçamento</button><button data-action="screenshot">Capturar imagem</button><button class="danger" data-action="newGame">Nova cidade</button><button data-action="closeModal">Voltar ao jogo</button></div><p>METRÓPOLE é um jogo experimental independente de construção de cidades. Funciona offline após carregamento, sem contas nem pagamentos.</p>`);}
function openBudget(){modal('Gestão municipal',`<p>O orçamento é atualizado a cada mês da simulação. Ajusta o imposto na barra lateral.</p><div class="modal-rows">${[
['Tesouraria',money(state.money)],['Receita fiscal mensal',money(metrics.income)],['Despesas mensais',money(metrics.expenses)],['Saldo mensal',(metrics.balance>=0?'+':'')+money(metrics.balance)],['Taxa municipal',state.tax+'%'],['População',fmt(metrics.population)],['Empregos',fmt(metrics.jobs)],['Desemprego',fmt(metrics.unemployed)],['Felicidade',metrics.happiness+'%'],['Valor médio do terreno',metrics.landValue+'/100'],['Estradas',fmt(metrics.roadCount)],['Zonas ligadas às estradas',fmt(metrics.connectedZoned)]].map(([a,b])=>`<div class="modal-row"><span>${a}</span><b>${b}</b></div>`).join('')}</div>`);}
function openHelp(){modal('Como jogar',`<p><b>1.</b> Seleciona <b>Estradas</b> e desenha uma ligação a partir das vias existentes.</p><p><b>2.</b> Pinta zonas <b>Residenciais</b>, <b>Comerciais</b> e <b>Industriais</b> junto às estradas. Os edifícios aparecem e crescem ao longo dos meses.</p><p><b>3.</b> Expande eletricidade e água quando a procura ultrapassar a capacidade. Coloca parques, escolas, hospitais, polícia e bombeiros perto dos bairros.</p><p><b>4.</b> Equilibra impostos, serviços e emprego para manter habitantes satisfeitos e a tesouraria positiva.</p><h3>Controlos</h3><p><b>Telemóvel:</b> toca para construir, arrasta para pintar; escolhe Explorar para deslocar o mapa; usa dois dedos para fazer zoom.</p><p><b>Computador:</b> usa a roda do rato para zoom, arrasta para mover o mapa no modo Explorar, teclas 1–9 para ferramentas, espaço para pausa e Ctrl+Z para desfazer.</p><p>O progresso é guardado automaticamente apenas neste browser. Exporta o ficheiro JSON para o transferires para outro dispositivo.</p>`);}
function act(a){switch(a){case 'toggleStats':hideStats=!hideStats;$('rightPanel').classList.toggle('open',hideStats);return;
case 'closeSelection':selected=null;$('selectionPanel').classList.add('hidden');dirty=true;return;
case 'zoomIn':zoom=Math.min(2.35,zoom*1.2);dirty=true;return;case 'zoomOut':zoom=Math.max(.48,zoom/1.2);dirty=true;return;
case 'center':cam={x:0,y:innerWidth<700?-15:-25};zoom=innerWidth<700?.9:1;dirty=true;return;
case 'undo':{const u=undoStack.pop();if(!u){toast('Nada para desfazer.');return;}state.grid[E.idx(u.x,u.y)]=u.cell;state.money=u.money;state.totalBuilt=u.totalBuilt;refresh();persist();toast('Última construção desfeita.');return;}
case 'save':persist();toast('Cidade guardada neste dispositivo.');return;
case 'menu':openMenu();return;case 'closeModal':closeModal();return;
case 'taxDown':state.tax=Math.max(4,state.tax-1);refresh();persist();return;
case 'taxUp':state.tax=Math.min(20,state.tax+1);refresh();persist();return;
case 'budget':openBudget();return;case 'help':openHelp();return;case 'newGame':newGame();return;
case 'export':exportSave();return;case 'import':$('importFile').click();return;
case 'rename':{const name=prompt('Nome da cidade:',state.name);if(name&&name.trim()){state.name=name.trim().slice(0,30);refresh();persist();}return;}
case 'screenshot':{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='metropole-cidade.png';a.click();return;}
}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tool){setTool(b.dataset.tool);return;}if(b.dataset.speed!==undefined){setSpeed(Number(b.dataset.speed));return;}if(b.dataset.action)act(b.dataset.action);});
$('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!E.validate(data))throw new Error('Save incompatível ou inválido.');if(!confirm('Importar esta cidade e substituir a cidade atual?'))return;state=data;state.tax=Math.max(4,Math.min(20,Math.round(state.tax)));state.speed=[0,1,2,3].includes(state.speed)?state.speed:1;state.events=Array.isArray(state.events)?state.events:[];state.milestones=Array.isArray(state.milestones)?state.milestones:[];undoStack=[];selected=null;$('selectionPanel').classList.add('hidden');refresh();persist();closeModal();toast('Cidade importada.');}catch(err){toast(err.message||'Erro ao importar.','error');}finally{e.target.value='';}});
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(e.key==='Escape'){closeModal();$('rightPanel').classList.remove('open');hideStats=false;return;}if(e.key===' '){e.preventDefault();setSpeed(state.speed?0:1);return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();act('undo');return;}const keys=['inspect','road','res','com','ind','park','school','clinic','bulldoze'];const n=Number(e.key);if(n>=1&&n<=9)setTool(keys[n-1]);});
function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min(100,now-lastSim);lastSim=now;
  if(state.speed>0){simProgress+=dt*state.speed;while(simProgress>=4800){E.tick(state);simProgress-=4800;refresh();persist();}}
  if(now-lastFrame>45){draw(now);lastFrame=now;dirty=false;}
}
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{lastSim=performance.now();});
resize();refresh();persist();requestAnimationFrame(frame);
})();