/* METRÓPOLE — responsive isometric city builder. No dependencies, no network access required. */
(()=>{
'use strict';
const E=window.CityEngine;
if(!E){document.body.textContent='Erro ao carregar o motor de jogo.';return;}
const canvas=document.getElementById('world'),ctx=canvas.getContext('2d',{alpha:false}),mini=document.getElementById('minimap'),mctx=mini?.getContext('2d');
if(!ctx){document.body.textContent='O browser não suporta Canvas 2D.';return;}
const $=id=>document.getElementById(id),money=n=>Math.round(n).toLocaleString('pt-PT')+' €',fmt=n=>Math.round(n).toLocaleString('pt-PT');
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state;try{const saved=JSON.parse(localStorage.getItem(E.SAVE_KEY)||'null');state=E.validate(saved)?saved:E.create();}catch{state=E.create();}
E.migrate(state);
let metrics=E.analyze(state),tool='inspect',viewMode='normal',selected=null,hover=null,zoom=innerWidth<700?.88:1.01;
let lightingMode='day',activeCategory='all',builderOpen=false,tipVisible=false,milestoneTimer=0;
let cam={x:0,y:innerWidth<700?-15:-25},w=0,h=0,dpr=1;
let dirty=true,painted=new Set(),undoStack=[],lastSim=performance.now(),lastFrame=0,simProgress=0,toastTimer=0;
const pointers=new Map();let drag=null,pinch=null,hideStats=false;
const toolsInfo={inspect:'Toca num edifício para ver detalhes. Arrasta para mover o mapa.',road:'Cria estradas ligadas à rede. Podes arrastar para construir.',res:'Marca terrenos residenciais junto às estradas.',com:'Marca comércio perto dos habitantes e das estradas.',ind:'Cria empregos industriais. Evita instalar junto às habitações.',park:'Os parques aumentam a felicidade das zonas próximas.',school:'Melhora os serviços dos bairros perto da escola.',clinic:'Hospitais melhoram o bem-estar da população.',fire:'Os bombeiros oferecem cobertura a bairros próximos.',police:'Esquadras aumentam a segurança dos bairros.',power:'Uma central fornece capacidade elétrica para toda a rede.',water:'A água é essencial para o crescimento da cidade.',sewage:'Trata esgotos em redes de condutas e estradas.',powerline:'Extensão da rede elétrica para bairros isolados.',waterpipe:'Estende a rede de água e esgotos para bairros isolados.',avenue:'Avenidas com mais velocidade e capacidade. Podes melhorar estradas existentes.',oneway:'Sentido único. Usa Rodar direção para definir a orientação.',highway:'Via rápida com elevada capacidade e velocidade.',bridge:'Constrói uma ponte apenas sobre água.',bulldoze:'Demole construções. Atenção: a demolição é permanente.'};
function persist(){try{localStorage.setItem(E.SAVE_KEY,JSON.stringify(state));}catch{toast('Armazenamento cheio. Exporta o save.','error');}}
function toast(msg,type='ok'){const el=$('toast');el.textContent=msg;el.className='toast show'+(type==='error'?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',2450);}
const featureNames={inspect:'Explorar',road:'Estradas',res:'Residencial',com:'Comércio',ind:'Indústria',park:'Parques',school:'Escolas',clinic:'Hospitais',fire:'Bombeiros',police:'Segurança',power:'Energia',water:'Água',sewage:'Esgotos',powerline:'Linha elétrica',waterpipe:'Conduta',avenue:'Avenida',oneway:'Sentido único',highway:'Via rápida',bridge:'Ponte',bulldoze:'Demolição'};
function updateBuildHUD(){const el=$('constructionStatus');if(!el)return;el.classList.toggle('hidden',tool==='inspect');$('roadOrientation').classList.toggle('hidden',tool!=='oneway');if(tool==='inspect')return;
  $('buildStatusName').textContent=featureNames[tool]||tool;
  $('buildStatusCost').textContent=money(E.COST[tool]||0)+' / parcela';
  $('buildStatusIcon').textContent=tool==='bulldoze'?'×':tool==='road'?'⌁':'+';
  $('roadOrientation').classList.toggle('hidden',tool!=='oneway');$('roadDirectionLabel').textContent='Sentido '+['←','↑','→','↓'][state.p0.roadDirection];
}
function setLight(mode){lightingMode=mode;$('lightLabel').textContent={day:'DIA',dusk:'CREPÚSCULO',night:'NOITE'}[mode];
  $('dayPart').innerHTML=`<svg><use href="#${mode==='night'?'i-moon':mode==='dusk'?'i-sunset':'i-sun'}"/></svg><span>${mode==='night'?'NOITE':mode==='dusk'?'PÔR DO SOL':'DIA'}</span>`;
  document.body.dataset.lighting=mode;dirty=true;
}
function setCategory(cat){activeCategory=cat;document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b.dataset.category===cat);b.setAttribute('aria-pressed',String(b.dataset.category===cat));});
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('filtered',cat!=='all'&&b.dataset.group!==cat&&b.dataset.group!=='all'));
}
function toggleTools(){builderOpen=!builderOpen;document.body.classList.toggle('builder-open',builderOpen);}
function updateMission(){let title='Faz a cidade crescer',info='Liga novos bairros às estradas para atrair habitantes.';
 if(!metrics.powered){title='Precisas de eletricidade';info='Aumenta a capacidade da rede para manter os bairros ativos.';}
 else if(!metrics.sewageOk){title='Tratar os esgotos';info='Reforça as estações de tratamento e as condutas de água.';}
 else if(!metrics.watered){title='Garantir água para todos';info='Constrói uma estação de abastecimento antes da próxima expansão.';}
 else if(metrics.balance<0){title='Recuperar o orçamento';info='Equilibra os impostos e os custos dos serviços municipais.';}
 else if(metrics.happiness<55){title='Melhorar a qualidade de vida';info='Investe em parques, segurança, escolas e saúde.';}
 else if(metrics.demand.res>65){title='A cidade quer mais casas';info='Cria zonas residenciais junto das principais avenidas.';}
 else if(metrics.demand.com>65){title='O comércio está a crescer';info='Reserva novas parcelas para lojas e negócios.';}
 else if(metrics.demand.ind>65){title='Novos empregos são prioridade';info='Expande zonas industriais para fortalecer a economia.';}
 else {title='Uma cidade que prospera';info='Planeia novos bairros, reforça serviços e cria uma cidade memorável.';}
 $('missionTitle').textContent=title;$('missionText').textContent=info;
}
function showMilestone(e){if(!e)return;$('milestoneTitle').textContent=e.title;$('milestoneDescription').textContent=e.description;
 $('milestoneBanner').classList.remove('hidden');clearTimeout(milestoneTimer);milestoneTimer=setTimeout(()=>$('milestoneBanner').classList.add('hidden'),6500);
}
function setTool(t){if(t!=='inspect'&&t!=='bulldoze'&&!E.COST[t])return;tool=t;selected=null;$('selectionPanel').classList.add('hidden');canvas.classList.toggle('building',t!=='inspect');document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===t);b.setAttribute('aria-pressed',String(b.dataset.tool===t));});$('toolInfo').textContent=toolsInfo[t]||'';updateBuildHUD();if(t!=='inspect'&&innerWidth>=741){builderOpen=true;document.body.classList.add('builder-open');}if(innerWidth<741&&builderOpen){builderOpen=false;document.body.classList.remove('builder-open');}if(t==='inspect'){$('tileTooltip').classList.add('hidden');}dirty=true;}
function refresh(){metrics=E.analyze(state);$('cityName').textContent=state.name||'Nova Aurora';$('money').textContent=money(state.money);$('money').style.color=state.money<0?'#ff9a96':'';
$('population').textContent=fmt(metrics.population);$('jobs').textContent=fmt(metrics.jobs)+' empregos';$('happiness').textContent=metrics.happiness+'%';$('happiness').style.color=metrics.happiness>65?'#8ee7b8':metrics.happiness<40?'#f5a49d':'#f2c87f';
$('balance').textContent=(metrics.balance>=0?'+':'')+money(metrics.balance)+'/mês';$('balance').className='change '+(metrics.balance>=0?'positive':'negative');$('date').textContent=E.date(state);
const health=Math.max(0,Math.min(100,Math.round(metrics.happiness*.58+(100-metrics.traffic)*.12+metrics.coverage*.18+(metrics.balance>=0?12:0))));
$('cityHealth').textContent=health>=75?'Em crescimento':health>=54?'Estável':health>=35?'Precisa de atenção':'Em risco';
$('cityHealthDesc').textContent=metrics.balance<0?'As despesas superam as receitas':!metrics.powered?'A cidade precisa de eletricidade':!metrics.watered?'O abastecimento de água é insuficiente':health>=75?'Os teus cidadãos estão a prosperar':'Continua a melhorar os serviços';
$('healthBar').style.width=health+'%';
for(const k of E.ZONES){$(k+'Bar').style.width=metrics.demand[k]+'%';$(k+'Pct').textContent=metrics.demand[k]+'%';}
for(const [k,used,cap] of [['power',metrics.electricity,metrics.powerCap],['water',metrics.waterUse,metrics.waterCap]]){$(k+'Text').textContent=fmt(used)+' / '+fmt(cap);$(k+'Bar').style.width=(cap?Math.min(100,100*used/cap):100)+'%';$(k+'Bar').style.background=cap<used?'#ff8b86':'#e1c274';}
$('sewageText').textContent=fmt(metrics.sewageUse)+' / '+fmt(metrics.sewageCap);$('sewageBar').style.width=(metrics.sewageCap?Math.min(100,100*metrics.sewageUse/metrics.sewageCap):100)+'%';$('sewageBar').style.background=metrics.sewageOk?'#85dda6':'#f58f8f';
$('commuteText').textContent=metrics.commuters+' viagens · '+metrics.averageCommute+' min';$('commuteBar').style.width=Math.min(100,metrics.traffic)+'%';
$('traffic').textContent=metrics.traffic+'%';$('coverage').textContent=metrics.coverage+'%';$('unemployed').textContent=(metrics.workers?Math.round(metrics.unemployed/metrics.workers*100):0)+'%';$('income').textContent='+'+money(metrics.income);$('expenses').textContent='−'+money(metrics.expenses);$('taxValue').textContent=state.tax+'%';$('statusText').textContent=state.speed===0?'EM PAUSA':'CIDADE ATIVA';
document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.speed)===state.speed));
$('dockDate').textContent=E.date(state);updateMission();
$('eventFeed').innerHTML=state.events.slice(0,3).map(e=>`<div class="event-item ${['warning','success'].includes(e.type)?e.type:''}"><b>${escapeHtml(e.title)}</b><p>${escapeHtml(e.description)}</p><small>${escapeHtml(e.date)}</small></div>`).join('');
if(selected)inspect(selected.x,selected.y,false);
drawMinimap();dirty=true;
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
  ctx.fillStyle='rgba(21,53,39,.17)';ctx.beginPath();ctx.ellipse(cx+4*zoom,cy+3*zoom,6.5*zoom,2.6*zoom,-.2,0,Math.PI*2);ctx.fill();
  stroke({x:cx,y:cy+3*zoom},{x:cx,y:cy-5*zoom},'#6a5c4a',2.3);
  ctx.beginPath();ctx.ellipse(cx,cy-9*zoom,(4.5+hx*3)*zoom,(6.7+hy*3)*zoom,-.15,0,Math.PI*2);ctx.fillStyle=['#347850','#639f65','#286a57','#8ab96b'][i%4];ctx.fill();
  ctx.beginPath();ctx.ellipse(cx-2*zoom,cy-11*zoom,3.2*zoom,3.9*zoom,0,0,Math.PI*2);ctx.fillStyle='rgba(189,228,160,.27)';ctx.fill();
}}
function drawHouse(x,y,cell,tx,ty){
  const rnd=E.hash(tx,ty,17),level=cell.lvl,kind=cell.k;
  const residential=kind==='res',commercial=kind==='com',industrial=kind==='ind';
  const high=level===3,veryTall=high&&rnd>.37;
  const height=industrial?18+level*5:(residential?14:18)+level*(veryTall?17:11)+rnd*8;
  const width=industrial?27:high?23:20.5,depth=industrial?12:high?11.5:10.5;
  // Diffuse cast shadow anchors the architecture to its parcel.
  poly([[x-22*zoom,y+6*zoom],[x+5*zoom,y+14*zoom],[x+(30+height*.20)*zoom,y+(9+height*.11)*zoom],[x+8*zoom,y-6*zoom]],'rgba(28,50,49,.17)');
  const palette=residential?[['#e8e0cc','#a9b9b2','#82999a'],['#cad4c7','#8dada5','#628887'],['#dae0cf','#8caeaf','#688b99']]:commercial?[['#b2ced3','#739da8','#527f94'],['#c7cfc6','#78a0ab','#507c94'],['#b9d9d9','#699aa5','#447a91']]:[['#d2be9e','#a48a6c','#806c58'],['#bcab90','#95785c','#776148'],['#d5c0a5','#b08d6d','#876951']];
  const [roof,left,right]=palette[Math.min(level-1,2)];
  if(industrial){
    prism(x,y,width,depth,height,roof,left,right);
    // Industrial roof sawtooth and vents.
    for(let i=-1;i<=1;i++){
      const xx=x+i*8*zoom,yy=y-height*zoom-3*zoom;
      poly([[xx-4*zoom,yy],[xx,yy-3*zoom],[xx+5*zoom,yy],[xx+1*zoom,yy+3*zoom]],i===0?'#f1d4ab':'#d5bea3');
    }
    ctx.fillStyle='#736f62';ctx.fillRect(x+8*zoom,y-(height+19)*zoom,4*zoom,22*zoom);
    ctx.fillStyle='#f8e1a8';ctx.fillRect(x+8*zoom,y-(height+19)*zoom,4*zoom,2*zoom);
    return;
  }
  prism(x,y,width,depth,height,roof,left,right);
  if(level===1 && residential){
    poly([[x-17*zoom,y-height*zoom-1*zoom],[x,y-(height+7)*zoom],[x+17*zoom,y-height*zoom-1*zoom],[x,y-(height-6)*zoom]],rnd>.5?'#e6a889':'#b5bfa5');
  }else{
    // Rooftop HVAC, skylights and roof edges for tall buildings.
    const roofY=y-height*zoom;
    poly([[x-7*zoom,roofY-2*zoom],[x,roofY-5*zoom],[x+7*zoom,roofY-2*zoom],[x,roofY+1*zoom]],commercial?'#638d96':'#c4ccba');
    ctx.fillStyle='rgba(236,248,224,.46)';ctx.fillRect(x-2*zoom,roofY-6*zoom,5*zoom,2*zoom);
    if(high){ctx.strokeStyle='#e3e6d8';ctx.lineWidth=1.5*zoom;ctx.strokeRect(x-10*zoom,roofY-2*zoom,20*zoom,4*zoom);}
  }
  const floors=Math.max(1,Math.floor((height-7)/9));
  for(let f=0;f<floors;f++){
    const y0=y-(7+f*9)*zoom;
    for(let j=0;j<2;j++){
      const light=(f+j+tx+ty)%4===0;
      poly([[x-(j+1)*6.8*zoom,y0-1*zoom],[x-(j+1)*6.8*zoom+3.1*zoom,y0-2*zoom],[x-(j+1)*6.8*zoom+3.1*zoom,y0+3.8*zoom],[x-(j+1)*6.8*zoom,y0+4.8*zoom]],light?'#f6d99b':'#62898e');
      poly([[x+(j+1)*6.8*zoom,y0-2*zoom],[x+(j+1)*6.8*zoom+3.1*zoom,y0-.8*zoom],[x+(j+1)*6.8*zoom+3.1*zoom,y0+4.8*zoom],[x+(j+1)*6.8*zoom,y0+3.8*zoom]],light?'#eed4a0':'#9fc5ca');
    }
  }
  if(high&&residential){for(let f=0;f<floors;f+=2){const py=y-(f*9+7)*zoom;stroke({x:x-20*zoom,y:py+6*zoom},{x:x-2*zoom,y:py+15*zoom},'rgba(230,241,224,.67)',1);}}
  if(commercial){ctx.fillStyle='#d6efe4';ctx.fillRect(x-12*zoom,y-7*zoom,6*zoom,3*zoom);}
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
function drawRoad(x,y,tx,ty){
  const cell=state.grid[E.idx(tx,ty)],kind=E.roadType(cell),paint={road:'#485761',avenue:'#344c62',oneway:'#4e526a',highway:'#384655',bridge:'#626a72'}[kind]||'#485761';
  if(kind==='bridge'){diamond(x,y+7*zoom,33,17,'#416877');}
  diamond(x,y+2.5*zoom,32.4,16.2,'#5e746c');
  diamond(x,y,31.3,15.5,paint,kind==='highway'?'#c5d0a5':'#6b8081');
  if(kind==='oneway'&&zoom>.65){ctx.save();ctx.fillStyle='#ffe4aa';ctx.font=`bold ${Math.round(16*zoom)}px sans-serif`;ctx.textAlign='center';ctx.fillText(['←','↑','→','↓'][cell.direction??2],x,y+5*zoom);ctx.restore();}
  if(kind==='avenue'||kind==='highway'){stroke({x:x-16*zoom,y:y+4*zoom},{x:x+16*zoom,y:y-4*zoom},kind==='highway'?'#f4dca5':'#a4baca',kind==='highway'?2.2:1.5);}

  const neighbors=E.neighbors(tx,ty).filter(([nx,ny])=>state.grid[E.idx(nx,ny)].k==='road');
  for(const [nx,ny] of neighbors){const pt=project(nx,ny);
    const a={x:x+(pt.x-x)*.12,y:y+(pt.y-y)*.12},b={x:x+(pt.x-x)*.44,y:y+(pt.y-y)*.44};
    stroke(a,b,'#f4e3b4',1.25);
  }
  if(neighbors.length===0)diamond(x,y,4,2,'#f1e3bd');
  if(neighbors.length===1){const pt=project(neighbors[0][0],neighbors[0][1]);stroke({x:x-(pt.x-x)*.1,y:y-(pt.y-y)*.1},{x:x-(pt.x-x)*.23,y:y-(pt.y-y)*.23},'#c0c6b3',1.3);}
}
function drawTile(x,y,now){const c=state.grid[E.idx(x,y)];const p=project(x,y);if(p.x<-130||p.x>w+130||p.y<-230||p.y>h+130)return;
  const rnd=E.hash(x,y,7),water=c.t==='water';
  if(water && c.k!=='road'){
    diamond(p.x,p.y,32.2,16.2,rnd>.5?'#3c94a3':'#478f9d','rgba(137,214,217,.18)');
    if((x+y)%3===0){ctx.globalAlpha=.3;stroke({x:p.x-11*zoom,y:p.y+2*zoom},{x:p.x+3*zoom,y:p.y-5*zoom+Math.sin(now/1100+x)*1.3*zoom},'#d6f5ec',1);ctx.globalAlpha=1;}
    return;
  }
  const colors=['#719c79','#78a77f','#81ab86','#73a280','#83aa82'];
  let ground=colors[Math.min(4,Math.floor(rnd*5))];
  if(viewMode==='zoning' && c.k==='empty')ground='#7b9a85';
  if(viewMode==='traffic'&&c.k!=='road')ground='#759086';
  diamond(p.x,p.y,32.25,16.15,ground,'rgba(35,90,67,.11)');
  // Micro-detail: flowers, grass patches and footpaths, deterministic per tile.
  if(c.k==='empty'){
    if(rnd>.86)drawTrees(p.x,p.y,1,3);
    else if(rnd<.13&&zoom>.69){ctx.fillStyle='rgba(202,228,168,.45)';ctx.beginPath();ctx.ellipse(p.x+6*zoom,p.y+2*zoom,4*zoom,1.7*zoom,-.3,0,7);ctx.fill();}
  }
  if(c.k==='road')drawRoad(p.x,p.y,x,y);
  else if(E.ZONES.includes(c.k)){
    const col={res:'rgba(132,210,132,.36)',com:'rgba(104,166,224,.37)',ind:'rgba(244,171,110,.40)'}[c.k];
    diamond(p.x,p.y,29.5,14.5,col,c.k==='res'?'rgba(208,255,175,.56)':c.k==='com'?'rgba(160,210,255,.59)':'rgba(250,203,150,.57)');
    if(viewMode==='zoning')diamond(p.x,p.y,30.2,15,col,'rgba(247,255,246,.53)');
    if(c.lvl>0)drawHouse(p.x,p.y,c,x,y);
    else if(zoom>.65){ctx.fillStyle='rgba(248,255,240,.7)';ctx.font=`${Math.max(9,11*zoom)}px Manrope,sans-serif`;ctx.textAlign='center';ctx.fillText('＋',p.x,p.y+3*zoom);}
  }else if(E.SERVICES.includes(c.k))drawService(p.x,p.y,c.k,x,y);
  if(c.powerLine){stroke({x:p.x-14*zoom,y:p.y+5*zoom},{x:p.x+13*zoom,y:p.y-6*zoom},'#f5dd77',2.4);diamond(p.x,p.y,4,2,'#ffeb99');}
  if(c.waterPipe){stroke({x:p.x-13*zoom,y:p.y-5*zoom},{x:p.x+13*zoom,y:p.y+5*zoom},'#73d6f1',2.6);diamond(p.x,p.y,3,2,'#b9eaff');}
  if(viewMode==='power'||viewMode==='water'){const z=metrics.utilityCoverage?.zones?.[E.idx(x,y)];if(z){const ok=viewMode==='power'?z.powered:z.watered&&z.sewage;diamond(p.x,p.y,29,14,ok?'rgba(108,236,155,.2)':'rgba(244,100,97,.45)',ok?'#9df4b0':'#ff6a6a');}}
  if(viewMode==='traffic' && c.k==='road'){const value=metrics.congestionByRoad?.[E.idx(x,y)]||0;diamond(p.x,p.y,31,15,value>110?'rgba(240,63,71,.75)':value>65?'rgba(249,162,71,.62)':'rgba(125,231,133,.28)');}
  if((hover&&hover.x===x&&hover.y===y)||(selected&&selected.x===x&&selected.y===y)){
    diamond(p.x,p.y,32,16,hover&&hover.x===x&&hover.y===y?'rgba(251,255,233,.20)':'rgba(201,244,124,.23)',viewMode==='normal'?'#edffb7':'#ffffff');
  }
}
function drawTraffic(now){
 const agents=metrics.trafficAgents||[];if(!agents.length)return;
 for(const agent of agents){const route=agent.route;if(!route||route.length<2)continue;
  const duration=(agent.kind==='freight'?3500:2300)*(1+metrics.traffic*.006);const progress=((now+agent.id*233)%duration)/duration*(route.length-1);
  const segment=Math.min(route.length-2,Math.floor(progress)),t=progress-segment;
  const a=route[segment],b=route[segment+1],p=project(a%E.N,Math.floor(a/E.N)),q=project(b%E.N,Math.floor(b/E.N));
  const px=p.x+(q.x-p.x)*t,py=p.y+(q.y-p.y)*t;
  if(px<-20||px>w+20||py<-20||py>h+20)continue;
  ctx.fillStyle='rgba(17,31,37,.32)';ctx.beginPath();ctx.ellipse(px+zoom,py+2.3*zoom,4.5*zoom,2.3*zoom,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=agent.kind==='freight'?'#f2c17d':['#f7f0d6','#9ee5ce','#e59993','#dce6fc'][agent.id%4];ctx.beginPath();ctx.ellipse(px,py,(agent.kind==='freight'?5:3.4)*zoom,2*zoom,0,0,Math.PI*2);ctx.fill();
 }
}
function paintLighting(now){
 if(lightingMode==='day')return;
 ctx.save();ctx.globalAlpha=lightingMode==='night'?.57:.21;ctx.fillStyle=lightingMode==='night'?'#10253f':'#a56958';ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
 if(lightingMode==='night'){
  ctx.globalCompositeOperation='screen';ctx.shadowColor='#ffbd7a';ctx.shadowBlur=13*zoom;
  for(let y=0;y<E.N;y++)for(let x=0;x<E.N;x++){
    const c=state.grid[E.idx(x,y)];if(!E.ZONES.includes(c.k)||c.lvl<1||E.hash(x,y,87)<.25)continue;
    const a=project(x,y,9+c.lvl*9);if(a.x<-20||a.x>w+20||a.y<-40||a.y>h+40)continue;
    ctx.beginPath();ctx.ellipse(a.x+2*zoom,a.y,3.5*zoom,2.5*zoom,0,0,Math.PI*2);ctx.fillStyle='rgba(255,206,132,.66)';ctx.fill();
  }
  ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
 }
 ctx.restore();
}
function drawDistrictLabels(){if(zoom<.73||w<740)return;
 const districts=[{x:13,y:12,name:'CENTRO CÍVICO',code:'01'},{x:19,y:24,name:'DISTRITO INDUSTRIAL',code:'02'},{x:26,y:12,name:'NOVA COSTA',code:'03'}];
 ctx.save();for(const d of districts){const p=project(d.x,d.y,58);if(p.x<40||p.x>w-40||p.y<125||p.y>h-175)continue;
 const wd=Math.max(105,(ctx.measureText?.(d.name)?.width ?? d.name.length*7)+32);ctx.fillStyle='rgba(12,24,30,.77)';ctx.strokeStyle='rgba(247,212,160,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(p.x-wd/2,p.y-12,wd,27,7);ctx.fill();ctx.stroke();ctx.fillStyle='#f6e6c9';ctx.font='700 10px Manrope, sans-serif';ctx.textAlign='center';ctx.fillText(d.name,p.x,p.y+5);
 ctx.strokeStyle='rgba(235,206,156,.54)';ctx.beginPath();ctx.moveTo(p.x,p.y+15);ctx.lineTo(p.x,p.y+28);ctx.stroke();}
 ctx.restore();
}
function draw(now){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#6b9a82';ctx.fillRect(0,0,w,h);
  const grd=ctx.createLinearGradient(0,0,0,h);grd.addColorStop(0,'#b0c6a0');grd.addColorStop(.58,'#7ea78c');grd.addColorStop(1,'#4b8478');ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
  for(let depth=0;depth<(E.N-1)*2+1;depth++)for(let x=0;x<E.N;x++){const y=depth-x;if(y>=0&&y<E.N)drawTile(x,y,now);}
  drawTraffic(now);
  paintLighting(now);drawDistrictLabels();
  if(tool!=='inspect'&&hover&&E.inside(hover.x,hover.y)){const p=project(hover.x,hover.y);diamond(p.x,p.y,33,17,'rgba(255,255,255,.10)',state.grid[E.idx(hover.x,hover.y)].t==='water'?'#ffaba3':'#eaffb9');}
}
function drawMinimap(){
  if(!mctx||!mini)return;
  const scale=mini.width/E.N;
  mctx.clearRect(0,0,mini.width,mini.height);
  for(let y=0;y<E.N;y++)for(let x=0;x<E.N;x++){
    const cell=state.grid[E.idx(x,y)];
    mctx.fillStyle=cell.t==='water'?'#388d9d':({road:'#4c5d62',res:'#a3c991',com:'#83b5d0',ind:'#d3ac7e',park:'#3d925e',school:'#e2c79a',clinic:'#e9dada',fire:'#e78f83',police:'#9cacc8',power:'#767e76',water:'#65c7b8',sewage:'#6aaeb4'}[cell.k]||'#77a17f');
    mctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale));
  }
  const center=unproject(w/2,h/2);mctx.strokeStyle='#e9ffb4';mctx.lineWidth=1.8;
  mctx.strokeRect(Math.max(0,(center.x-5)*scale),Math.max(0,(center.y-5)*scale),Math.min(mini.width,10*scale),Math.min(mini.height,10*scale));
}
if(mini)mini.addEventListener('click',e=>{
  const b=mini.getBoundingClientRect();const x=Math.max(0,Math.min(E.N-1,Math.floor((e.clientX-b.left)/b.width*E.N)));
  const y=Math.max(0,Math.min(E.N-1,Math.floor((e.clientY-b.top)/b.height*E.N)));
  cam.x=-(x-y)*32*zoom;cam.y=-(x+y-E.N)*16*zoom;dirty=true;drawMinimap();
});
function updatePointerTip(p,t){const tooltip=$('tileTooltip');if(!tooltip)return;
 if(!p||!t||!E.inside(t.x,t.y)||tool==='inspect'){tooltip.classList.add('hidden');return;}
 const c=state.grid[E.idx(t.x,t.y)];const valid=c.t==='land'&&(tool==='bulldoze'?c.k!=='empty':c.k==='empty')&&state.money>=(E.COST[tool]||0);
 $('tileTooltipTitle').textContent=(valid?'✓ ':'× ')+(featureNames[tool]||tool);
 $('tileTooltipDesc').textContent=valid?money(E.COST[tool])+' · tocar para construir':(c.t==='water'?'Terreno aquático':c.k!=='empty'?'Parcela ocupada':'Saldo insuficiente');
 tooltip.dataset.valid=valid?'true':'false';tooltip.style.left=Math.min(w-165,Math.max(5,p.x+18))+'px';tooltip.style.top=Math.max(86,Math.min(h-155,p.y-69))+'px';tooltip.classList.remove('hidden');
}
function inspect(x,y,toastOn=false){if(!E.inside(x,y))return;selected={x,y};const c=state.grid[E.idx(x,y)];const name=c.t==='water'?'Água':E.LABELS[c.k]||c.k;
  $('selectionPanel').classList.remove('hidden');$('selectionTitle').textContent=name;
  let desc=c.t==='water'?'Zona aquática protegida. Não é possível construir aqui.':c.k==='empty'?'Este terreno está livre. Escolhe uma ferramenta de construção para o desenvolver.':c.k==='road'?`Via ${E.LABELS[c.roadType]||'local'} · capacidade ${E.roadCapacity[E.roadType(c)]||28} veículos por ciclo. Congestão: ${metrics.congestionByRoad?.[E.idx(x,y)]||0}%.`:E.ZONES.includes(c.k)?`Zona ${name.toLowerCase()} · ${c.lvl?'edifício de nível '+c.lvl:'à espera de desenvolvimento'}. ${E.access(state,x,y,metrics.roads)?'Tem acesso à estrada.':'Sem acesso à estrada ligada à cidade.'}`:`Serviço público: ${name}. ${E.access(state,x,y,metrics.roads)?'Ligado à rede viária.':'Sem acesso à rede viária.'}`;
  $('selectionDesc').textContent=desc;$('selectionCoords').textContent=`SETOR ${String(x+1).padStart(2,'0')} · ${String(y+1).padStart(2,'0')}`;dirty=true;
}
function applyAt(x,y){if(!E.inside(x,y)||tool==='inspect')return;const key=E.idx(x,y);if(painted.has(key))return;painted.add(key);
  const cell=state.grid[key],prev={x,y,cell:{...cell},money:state.money,totalBuilt:state.totalBuilt};const res=E.build(state,x,y,tool);
  if(!res.ok){if(painted.size===1)toast(res.reason,'error');return;}
  undoStack.push(prev);if(undoStack.length>100)undoStack.shift();selected=null;$('selectionPanel').classList.add('hidden');refresh();persist();
}
function cursor(e){const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top};}
canvas.addEventListener('pointerdown',e=>{
  $('tileTooltip').classList.add('hidden');
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
  }else{const p2=unproject(p.x,p.y);if(!hover||hover.x!==p2.x||hover.y!==p2.y){hover=p2;dirty=true;}updatePointerTip(p,p2);}
});
function pointerUp(e){drawMinimap();const p=cursor(e),was=drag;$('tileTooltip').classList.add('hidden');pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;
  if(was&&was.mode==='pan'&&!was.moved&&tool==='inspect'){const t=unproject(p.x,p.y);inspect(t.x,t.y);}drag=null;painted.clear();dirty=true;
}
canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('pointerleave',()=>{if(!drag&&pointers.size===0){hover=null;$('tileTooltip').classList.add('hidden');dirty=true;}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=cursor(e),old=zoom;zoom=Math.max(.48,Math.min(2.35,zoom*(e.deltaY>0?.91:1.09)));cam.x+=(p.x-w/2-cam.x)*(1-zoom/old);cam.y+=(p.y-h/2-cam.y)*(1-zoom/old);drawMinimap();dirty=true;},{passive:false});
function setSpeed(speed){state.speed=speed;state.paused=speed===0;simProgress=0;refresh();persist();}
function newGame(){if(!confirm('Criar uma cidade nova? A cidade atual será substituída. Exporta o save primeiro se quiseres guardá-la.'))return;state=E.create();undoStack=[];selected=null;$('selectionPanel').classList.add('hidden');cam={x:0,y:-15};setTool('inspect');refresh();persist();closeModal();toast('Nova cidade criada!');}
function exportSave(){const data=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download='metropole-'+state.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Ficheiro de cidade exportado.');}
function closeModal(){$('modal').classList.add('hidden');}
function modal(title,html){$('modalTitle').textContent=title;$('modalContent').innerHTML=html;$('modal').classList.remove('hidden');}
function openMenu(){modal('Centro de controlo',`<p>Constrói a cidade ao teu ritmo. Os dados são guardados automaticamente neste browser.</p><div class="action-list"><button data-action="save">Guardar agora</button><button data-action="export">Exportar cidade</button><button data-action="import">Importar cidade</button><button data-action="help">Como jogar</button><button data-action="budget">Orçamento</button><button data-action="screenshot">Capturar imagem</button><button class="danger" data-action="newGame">Nova cidade</button><button data-action="closeModal">Voltar ao jogo</button></div><p>METRÓPOLE é um jogo experimental independente de construção de cidades. Funciona offline após carregamento, sem contas nem pagamentos.</p>`);}
function openBudget(){modal('Gestão municipal',`<p>O orçamento é atualizado a cada mês da simulação. Ajusta o imposto na barra lateral.</p><div class="modal-rows">${[
['Tesouraria',money(state.money)],['Receita fiscal mensal',money(metrics.income)],['Despesas mensais',money(metrics.expenses)],['Saldo mensal',(metrics.balance>=0?'+':'')+money(metrics.balance)],['Taxa municipal',state.tax+'%'],['População',fmt(metrics.population)],['Empregos',fmt(metrics.jobs)],['Desemprego',fmt(metrics.unemployed)],['Felicidade',metrics.happiness+'%'],['Valor médio do terreno',metrics.landValue+'/100'],['Estradas',fmt(metrics.roadCount)],['Zonas ligadas às estradas',fmt(metrics.connectedZoned)],['Tratamento de esgotos',fmt(metrics.sewageUse)+' / '+fmt(metrics.sewageCap)],['Tempo médio deslocação',metrics.averageCommute+' min'],['Viagens com rota válida',fmt(metrics.commuters)],['Entregas industriais',fmt(metrics.deliveries)],['Dívida municipal',money(metrics.debt)]].map(([a,b])=>`<div class="modal-row"><span>${a}</span><b>${b}</b></div>`).join('')}</div><h3>Finanças avançadas</h3><p>Impostos sectoriais e dívida municipal. A prestação e os juros são cobrados mensalmente.</p><div class="action-list">${['res','com','ind'].map(k=>`<div class="modal-row"><span>${{res:'Residencial',com:'Comércio',ind:'Indústria'}[k]} ${state.p0.fiscal.zoneTax[k]}%</span><span><button data-action="taxZone:${k}:-1">−</button> <button data-action="taxZone:${k}:1">+</button></span></div>`).join('')}<button data-action="borrow">Contrair empréstimo +25 000 €</button><button data-action="repay">Amortizar dívida −10 000 €</button></div><h3>Histórico financeiro</h3><div class="modal-rows">${state.p0.fiscal.history.slice(-8).reverse().map(h=>`<div class="modal-row"><span>${escapeHtml(h.date)}</span><b>${money(h.balance)}</b></div>`).join('')||'<p>Os primeiros dados aparecem após um mês.</p>'}</div>`);}
function openCitizens(){const people=state.p0.citizens;modal('Vida na cidade',`<p>${metrics.simulatedCitizens} habitantes simulados individualmente (amostragem até 480), ${metrics.commuters} viagens com rota e ${metrics.unreachableTrips} trajetos sem ligação. Tempo médio: ${metrics.averageCommute} minutos.</p><div class="modal-rows">${people.slice(0,30).map(c=>`<div class="modal-row"><span>${escapeHtml(c.name)} · ${c.age} anos<br><small>${escapeHtml(c.role)} · ${c.commute} min</small></span><b>${money(c.income)}</b></div>`).join('')}</div>`);}
function openHelp(){modal('Como jogar',`<p><b>1.</b> Seleciona <b>Estradas</b> e desenha uma ligação a partir das vias existentes.</p><p><b>2.</b> Pinta zonas <b>Residenciais</b>, <b>Comerciais</b> e <b>Industriais</b> junto às estradas. Os edifícios aparecem e crescem ao longo dos meses.</p><p><b>3.</b> Expande eletricidade e água quando a procura ultrapassar a capacidade. Coloca parques, escolas, hospitais, polícia e bombeiros perto dos bairros.</p><p><b>4.</b> Equilibra impostos, serviços e emprego para manter habitantes satisfeitos e a tesouraria positiva.</p><h3>Controlos</h3><p><b>Telemóvel:</b> toca para construir, arrasta para pintar; escolhe Explorar para deslocar o mapa; usa dois dedos para fazer zoom.</p><p><b>Computador:</b> usa a roda do rato para zoom, arrasta para mover o mapa no modo Explorar, teclas 1–9 para ferramentas, espaço para pausa e Ctrl+Z para desfazer.</p><p>O progresso é guardado automaticamente apenas neste browser. Exporta o ficheiro JSON para o transferires para outro dispositivo.</p>`);}
function setView(mode){if(!['normal','zoning','traffic','power','water'].includes(mode))return;viewMode=mode;
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===mode);b.setAttribute('aria-pressed',String(b.dataset.view===mode));});dirty=true;
}
function act(a){if(a.startsWith('taxZone:')){const [,zone,step]=a.split(':');E.setZoneTax(state,zone,state.p0.fiscal.zoneTax[zone]+Number(step));refresh();persist();openBudget();return;}switch(a){case 'toggleTools':toggleTools();return;
case 'cycleLight':{const order=['day','dusk','night'];setLight(order[(order.indexOf(lightingMode)+1)%3]);return;}
case 'cancelBuild':setTool('inspect');return;
case 'rotateRoad':E.rotateDirection(state);updateBuildHUD();persist();return;
case 'borrow':{const r=E.borrow(state);toast(r.ok?'Empréstimo recebido.':r.reason,r.ok?'ok':'error');refresh();persist();openBudget();return;}
case 'repay':{const r=E.repay(state);toast(r.ok?'Dívida amortizada.':r.reason,r.ok?'ok':'error');refresh();persist();openBudget();return;}
case 'citizens':openCitizens();return;
case 'closeMilestone':$('milestoneBanner').classList.add('hidden');return;
case 'toggleStats':hideStats=!hideStats;$('rightPanel').classList.toggle('open',hideStats);return;
case 'closeSelection':selected=null;$('selectionPanel').classList.add('hidden');dirty=true;return;
case 'zoomIn':zoom=Math.min(2.35,zoom*1.2);drawMinimap();dirty=true;return;case 'zoomOut':zoom=Math.max(.48,zoom/1.2);drawMinimap();dirty=true;return;
case 'center':cam={x:0,y:innerWidth<700?-15:-25};zoom=innerWidth<700?.93:1.03;drawMinimap();dirty=true;return;
case 'undo':{const u=undoStack.pop();if(!u){toast('Nada para desfazer.');return;}state.grid[E.idx(u.x,u.y)]=u.cell;state.money=u.money;state.totalBuilt=u.totalBuilt;state.p0.revision=u.revision+1;refresh();persist();toast('Última construção desfeita.');return;}
case 'save':persist();toast('Cidade guardada neste dispositivo.');return;
case 'menu':openMenu();return;case 'closeModal':closeModal();return;
case 'taxDown':state.tax=Math.max(4,state.tax-1);refresh();persist();return;
case 'taxUp':state.tax=Math.min(20,state.tax+1);refresh();persist();return;
case 'budget':openBudget();return;case 'help':openHelp();return;case 'newGame':newGame();return;
case 'export':exportSave();return;case 'import':$('importFile').click();return;
case 'rename':{const name=prompt('Nome da cidade:',state.name);if(name&&name.trim()){state.name=name.trim().slice(0,30);refresh();persist();}return;}
case 'screenshot':{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='metropole-cidade.png';a.click();return;}
}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.category){setCategory(b.dataset.category);return;}if(b.dataset.tool){setTool(b.dataset.tool);return;}if(b.dataset.view){setView(b.dataset.view);return;}if(b.dataset.speed!==undefined){setSpeed(Number(b.dataset.speed));return;}if(b.dataset.action)act(b.dataset.action);});
$('importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!E.validate(data))throw new Error('Save incompatível ou inválido.');if(!confirm('Importar esta cidade e substituir a cidade atual?'))return;state=E.migrate(data);state.tax=Math.max(4,Math.min(20,Math.round(state.tax)));state.speed=[0,1,2,3].includes(state.speed)?state.speed:1;state.events=Array.isArray(state.events)?state.events:[];state.milestones=Array.isArray(state.milestones)?state.milestones:[];undoStack=[];selected=null;$('selectionPanel').classList.add('hidden');refresh();persist();closeModal();toast('Cidade importada.');}catch(err){toast(err.message||'Erro ao importar.','error');}finally{e.target.value='';}});
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(e.key.toLowerCase()==='r'&&tool==='oneway'){act('rotateRoad');return;}if(e.key==='Escape'){closeModal();$('rightPanel').classList.remove('open');hideStats=false;setTool('inspect');return;}if(e.key===' '){e.preventDefault();setSpeed(state.speed?0:1);return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();act('undo');return;}const keys=['inspect','road','res','com','ind','park','school','clinic','bulldoze'];const n=Number(e.key);if(n>=1&&n<=9)setTool(keys[n-1]);});
function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min(100,now-lastSim);lastSim=now;
  if(state.speed>0){simProgress+=dt*state.speed;while(simProgress>=4800){const completed=state.milestones?.length||0;E.tick(state);simProgress-=4800;refresh();persist();if((state.milestones?.length||0)>completed)showMilestone(state.events?.[0]);}}
  if(now-lastFrame>45){draw(now);lastFrame=now;dirty=false;}
}
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{lastSim=performance.now();});
resize();setLight('day');setCategory('all');updateBuildHUD();refresh();persist();requestAnimationFrame(frame);
})();