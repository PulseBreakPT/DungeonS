/* ABISMO Engine v0.1 — deterministic, offline-first dungeon crawler */
(function () {
'use strict';
const KEY='dungeons-abisso-save-v1';
const VERSION='0.1.0';
const CLASSES={
 guardian:{name:'Guardião',role:'A muralha que resiste',icon:'♜',symbol:'⚔',desc:'Força e aço. Sobrevive onde outros tombam.',stats:{for:4,agi:2,int:1,vit:5},weapon:'Espada de Ferro',weaponBonus:2,armor:'Cota de Malha',armorBonus:1,ability:'Golpe Pesado',abilityDesc:'+5 de dano físico',abilityCost:4,abilityBonus:5,abilityType:'physical',critBonus:0},
 arcanist:{name:'Arcanista',role:'O fogo da mente',icon:'✧',symbol:'✦',desc:'Magia primordial que atravessa a escuridão.',stats:{for:1,agi:2,int:5,vit:4},weapon:'Cajado Arcano',weaponBonus:2,armor:'Robe do Viajante',armorBonus:0,ability:'Raio Arcano',abilityDesc:'+6 de dano mágico',abilityCost:4,abilityBonus:6,abilityType:'magic',critBonus:0},
 rogue:{name:'Ladino',role:'A sombra veloz',icon:'⟡',symbol:'◆',desc:'Cada golpe é um risco calculado.',stats:{for:3,agi:5,int:2,vit:2},weapon:'Adagas Gémeas',weaponBonus:2,armor:'Couro Reforçado',armorBonus:1,ability:'Ataque Furtivo',abilityDesc:'+4 dano e +10% crítico',abilityCost:4,abilityBonus:4,abilityType:'physical',critBonus:10}
};
const ENEMIES={
 rat:{id:'rat',name:'Rato Ósseo',icon:'☠',for:2,agi:3,int:0,vit:2,hp:24,armor:1,xp:25,gold:8,desc:'Um amontoado de ossos roídos que se move com uma fome sobrenatural.',trait:'Garras incessantes'},
 cultist:{id:'cultist',name:'Cultista Sombrio',icon:'♠',for:3,agi:2,int:2,vit:2,hp:32,armor:1,xp:35,gold:12,desc:'Um fanático encapuzado murmura uma prece proibida.',trait:'Dardo Negro de 3 em 3 turnos'},
 skeleton:{id:'skeleton',name:'Esqueleto Sentinela',icon:'☠',for:4,agi:1,int:0,vit:4,hp:42,armor:2,xp:50,gold:20,desc:'O vigia sem olhos ergue a sua espada enferrujada.',trait:'Defende a cada 3 turnos'},
 boss:{id:'boss',name:'Guardião do Limiar',icon:'♛',for:5,agi:2,int:1,vit:4,hp:75,armor:2,xp:100,gold:50,desc:'O último selo respira. Uma presença colossal ergue-se perante ti.',trait:'Esmagamento com aviso prévio'}
};
const ROOMS=[
 {type:'entrance',name:'Portões do Eco',icon:'⌂',floor:1,desc:'Sob as abóbadas gastas pelo tempo, o primeiro degrau conduz ao desconhecido.',quote:'A pedra guarda nomes que ninguém ousa pronunciar.'},
 {type:'rat',name:'A Galeria dos Ossos',icon:'☠',floor:1,desc:'Pequenas garras arranham a pedra. Um Rato Ósseo bloqueia a passagem.',quote:'Há criaturas que nunca conheceram a luz.'},
 {type:'chest',name:'Cofre do Esquecido',icon:'▣',floor:1,desc:'Um baú antigo brilha sob os restos de um trono quebrado.',quote:'Nem todos os tesouros pertencem aos vivos.'},
 {type:'cultist',name:'Capela Profanada',icon:'♠',floor:1,desc:'Uma figura entoa cânticos perante velas negras.',quote:'As palavras transformam-se em facas.'},
 {type:'shrine',name:'Altar da Névoa',icon:'✧',floor:2,desc:'Um altar imaculado pulsa com energia ancestral. Pede uma escolha.',quote:'O poder tem sempre uma memória do seu preço.'},
 {type:'skeleton',name:'Salão das Sentinelas',icon:'⚔',floor:2,desc:'O aço raspa o chão. Uma sentinela despertou do seu sono eterno.',quote:'Algumas promessas sobrevivem à morte.'},
 {type:'rest',name:'Fogueira das Almas',icon:'♨',floor:2,desc:'Uma pequena chama azul ilumina uma câmara inesperadamente tranquila.',quote:'Até na escuridão existe um instante de repouso.'},
 {type:'rat',name:'Corredor da Fome',icon:'☠',floor:3,desc:'Outra criatura óssea protege o acesso ao coração da cripta.',quote:'A fome nunca termina. Apenas espera.'},
 {type:'treasure',name:'Tesouro dos Reis',icon:'◇',floor:3,desc:'Um pedestal guarda a relíquia de um rei esquecido.',quote:'O ferro perece. Os juramentos permanecem.'},
 {type:'boss',name:'Trono do Limiar',icon:'♛',floor:3,desc:'O Guardião do Limiar bloqueia a saída. O destino exige um vencedor.',quote:'Nenhum nome é gravado aqui sem sacrifício.'}
];
const app=document.getElementById('app');
const toastEl=document.getElementById('toast');
let S=null,selectedClass='guardian',selectedName='',tab='explore',modal='',toastTimer=null,audioContext=null,mute=true,historyFull=false;

function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pct(a,b){return clamp((a/Math.max(1,b))*100,0,100).toFixed(2)+'%';}
function klass(){return CLASSES[S.classId]||CLASSES.guardian;}
function maxHp(){return 30+6*S.stats.vit+4*(S.level-1);}
function maxFp(){return 10+2*S.stats.int+2*(S.level-1);}
function armor(){return 1+Math.floor(S.stats.vit/3)+klass().armorBonus+(S.relicArmor||0);}
function damageBase(type){return 3+2*S.stats[type==='magic'?'int':'for']+klass().weaponBonus;}
function xpNeed(){return 50*S.level;}
function rand(){S.rng=(21*S.rng+17)%100;S.rolls++;return S.rng+1;}
function log(title,detail,type){S.eventSeq++;S.log.unshift({n:S.eventSeq,title:title,detail:detail,type:type||'info'});S.log=S.log.slice(0,100);}
function newState(id,name,test){
 const c=CLASSES[id]||CLASSES.guardian;
 const s={version:VERSION,mode:test?'test':'campaign',phase:test?'combat':'explore',classId:id,name:(name||'Viajante').slice(0,24),level:1,xp:0,stats:Object.assign({},c.stats),hp:30+6*c.stats.vit,fp:10+2*c.stats.int,potions:2,gold:0,runGold:0,earnedPotions:0,relicArmor:0,roomIndex:test?1:0,cleared:{0:true},rng:17,rolls:0,eventSeq:0,log:[{n:0,title:'O pacto foi firmado',detail:test?'Laboratório de combate iniciado com R = 17.':'A tua história começa nos Portões do Eco.',type:'info'}],run:1,enemy:null,enemyTurn:1,playerDefend:false,poison:0,pendingPoints:0,deadReason:'',lastOutcome:'',muted:true};
 if(test)s.enemy=spawnEnemy('rat',1);
 return s;
}
function spawnEnemy(type,run){const e=ENEMIES[type],bonus=(run-1)*3;return {id:e.id,name:e.name,icon:e.icon,for:e.for+(run>1?run-1:0),agi:e.agi,int:e.int,vit:e.vit,hp:e.hp+bonus*3,maxHp:e.hp+bonus*3,armor:e.armor+(run>=4?1:0),xp:e.xp+bonus*3,gold:e.gold+bonus*2,defending:false,charging:false};}
function save(){if(!S)return;try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast('Não foi possível guardar. Exporta o checkpoint.');}}
function restore(){try{const raw=localStorage.getItem(KEY);if(!raw)return null;const p=JSON.parse(raw);if(!p||p.version!==VERSION||!CLASSES[p.classId]||!p.stats||!ROOMS[p.roomIndex]||!['explore','combat','victory','dead'].includes(p.phase)||typeof p.rng!=='number'||!Array.isArray(p.log))return null;return p;}catch(e){return null;}}
function refresh(){save();render();}
function toast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove('show');},2800);}
function playSound(kind){if(mute)return;try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audioContext)audioContext=new A();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=kind==='hit'?'sawtooth':'sine';o.frequency.value=kind==='hit'?130:kind==='win'?540:360;g.gain.value=.025;o.connect(g);g.connect(audioContext.destination);o.start();o.frequency.exponentialRampToValueAtTime(Math.max(30,o.frequency.value*.55),audioContext.currentTime+.14);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.18);o.stop(audioContext.currentTime+.19);}catch(e){}}
function brand(){return '<div class="brand"><div class="brand-emblem" aria-hidden="true">✦</div><div><div class="brand-name">ABISMO</div><div class="brand-kicker">DungeonS · Crónicas da Escuridão</div></div></div>';}
function gateArt(){return '<div class="hero-art" aria-hidden="true"><div class="art-glow"></div><svg viewBox="0 0 640 580" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="stone" x1="0" x2="1"><stop stop-color="#233c3e"/><stop offset=".49" stop-color="#435451"/><stop offset="1" stop-color="#14272b"/></linearGradient><linearGradient id="fire" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f8d494"/><stop offset=".5" stop-color="#c89250"/><stop offset="1" stop-color="#643d26"/></linearGradient><radialGradient id="portal"><stop stop-color="#bd86479f"/><stop offset=".55" stop-color="#423329"/><stop offset="1" stop-color="#0a1115"/></radialGradient></defs><circle cx="330" cy="340" r="195" stroke="#bbab7350"/><circle cx="330" cy="340" r="172" stroke="#bbab7350" stroke-dasharray="2 16"/><path d="M114 488V211L166 147L225 206V488M434 488V206L498 144L553 213V488" fill="#233034" stroke="#607370" stroke-width="5"/><path d="M100 490V195L168 125L238 195V490M421 490V193L492 124L566 198V490" stroke="#536967" stroke-width="8"/><path d="M143 229L168 204L193 229V479H143V229ZM465 229L493 205L522 230V479H465V229Z" fill="#0b171b" stroke="#788177" stroke-width="3"/><path d="M210 492V231C210 163 257 112 330 66C406 112 454 168 454 231V492" fill="url(#stone)" stroke="#7c8580" stroke-width="10"/><path d="M237 491V239C237 185 274 143 330 107C390 142 428 190 428 239V491" fill="#0b1719" stroke="#9ba08a" stroke-width="4"/><path d="M253 490V251C253 203 282 170 330 136C381 170 411 209 411 251V490" fill="url(#portal)" stroke="#645b4c" stroke-width="4"/><path d="M330 145V488M267 271H393M267 357H393" stroke="#9a794755" stroke-width="5"/><path d="M330 237L345 263L330 294L315 263Z" fill="url(#fire)"/><path d="M122 485H540M107 504H554M85 529H571" stroke="#5e6259" stroke-width="12"/><path d="M212 231H449M239 198H422M279 147H382" stroke="#89836d" stroke-width="3"/><path d="M145 310H198M145 365H198M460 310H516M460 365H516" stroke="#9b9d7c55" stroke-width="3"/><path d="M86 530L1 575M568 530L640 575" stroke="#69645a" stroke-width="7"/><path d="M103 375V324H122V375M540 375V324H559V375" fill="#7a4f2a"/><path d="M113 330Q94 309 112 280Q134 306 113 330ZM550 330Q532 309 550 280Q571 305 550 330Z" fill="url(#fire)"/><path d="M170 134L170 82M490 131L490 82M330 58V5" stroke="#9b927d" stroke-width="5"/><path d="M315 37L330 19L346 37L330 55Z" fill="#c99d59"/></svg><span class="art-rune">ᚱ</span><div class="art-embers"><span style="top:30%;left:30%"></span><span style="top:56%;left:78%;animation-delay:2s"></span><span style="top:18%;left:64%;animation-delay:4s"></span><span style="top:70%;left:34%;animation-delay:1s"></span></div></div>';}
function intro(){
 const c=CLASSES[selectedClass];
 app.innerHTML='<header class="site-header">'+brand()+'<div class="header-tools"><span class="status-online">MOTOR v0.1 · OFFLINE READY</span><span class="tag">ALFA JOGÁVEL</span></div></header>'+
 '<main class="landing"><section class="hero"><div class="hero-copy"><div class="eyebrow">Um RPG de fantasia sombria</div><h1 class="hero-title">DESCE.<br><em>SOBREVIVE.</em><br>CONQUISTA.</h1><p class="hero-desc">Debaixo do mundo conhecido existe um lugar que devora nomes. Enfrenta criaturas, descobre relíquias e escreve a tua lenda. Cada decisão tem um preço. Cada golpe tem uma regra.</p><div class="hero-actions"><button class="btn btn-primary" data-action="scroll-classes">✦ Escolher destino <span>↗</span></button><button class="btn btn-secondary" data-action="test">⚔ Laboratório v0.1</button></div><div class="hero-metrics"><div><strong>03</strong><small>Classes</small></div><div><strong>10</strong><small>Salas</small></div><div><strong>01</strong><small>Boss final</small></div></div></div>'+gateArt()+'</section>'+
 '<section id="choose-class"><div class="section-heading"><div><div class="eyebrow">A primeira escolha</div><h2>QUEM ENTRA NO ABISMO?</h2></div><p>Três caminhos, três formas de dominar a escuridão. A tua classe define atributos e habilidade.</p></div><div class="class-grid">'+
 Object.keys(CLASSES).map(function(id){const k=CLASSES[id];return '<button class="class-card '+(id===selectedClass?'selected':'')+'" data-action="select:'+id+'" data-icon="'+k.icon+'" aria-pressed="'+(id===selectedClass)+'"><span class="class-icon">'+k.icon+'</span><div class="class-name">'+k.name+'</div><div class="class-role">'+k.role+'</div><div class="class-desc">'+k.desc+'</div><div class="class-stats"><span class="stat-chip">FOR '+k.stats.for+'</span><span class="stat-chip">AGI '+k.stats.agi+'</span><span class="stat-chip">INT '+k.stats.int+'</span><span class="stat-chip">VIT '+k.stats.vit+'</span></div></button>';}).join('')+'</div>'+
 '<div class="selection-footer"><div><strong>'+c.name+' • '+c.ability+'</strong><small>'+c.abilityDesc+' · 4 Foco · 2 Poções Pequenas</small><div style="margin-top:11px"><label class="small muted" for="hero-name">NOME DA PERSONAGEM</label><br><input id="hero-name" maxlength="24" autocomplete="off" value="'+escapeHtml(selectedName)+'" placeholder="Viajante" style="width:min(250px,100%);margin-top:6px;padding:9px 11px;color:#f2eadb;background:#101b1e;border:1px solid #4d625c;border-radius:6px"/></div></div><button class="btn btn-primary" data-action="start">INICIAR EXPEDIÇÃO <span>→</span></button></div></section><footer class="landing-footer">DUNGEONS / ABISMO · ENGINE '+VERSION+' · A TUA LENDA COMEÇA AQUI</footer></main>';
}
function shellHeader(){const tabs=[['explore','Explorar'],['hero','Herói'],['inventory','Arsenal'],['journal','Crónica']];return '<header class="game-topbar">'+brand()+'<nav class="header-nav" aria-label="Navegação principal">'+tabs.map(function(t){return '<button class="nav-pill '+(tab===t[0]?'active':'')+'" data-action="tab:'+t[0]+'">'+t[1]+'</button>';}).join('')+'</nav><div class="header-tools"><button class="icon-btn" title="Ativar/desativar som" data-action="sound" aria-label="Som">'+(mute?'♪̸':'♫')+'</button><button class="btn btn-secondary btn-sm" data-action="save">✦ Guardar</button></div></header>';}
function meter(label,value,max,type){return '<div class="bar-head"><span>'+label+'</span><strong>'+value+' <span class="muted">/ '+max+'</span></strong></div><div class="meter '+(type||'')+'"><i style="width:'+pct(value,max)+'"></i></div>';}
function leftPanel(){
 const c=klass(),xpDisplay=S.level>=10?'MAX':(S.xp+' / '+xpNeed());
 return '<aside class="side left"><section class="panel"><div class="panel-label">A tua personagem</div><div class="character-crest"><div class="crest-halo"></div><div class="crest-inner">'+c.symbol+'</div></div><div class="character-name">'+escapeHtml(S.name)+'</div><div class="character-sub">'+c.name+' · Nível '+S.level+'</div>'+meter('♥ Vida',S.hp,maxHp(),'health')+meter('✧ Foco',S.fp,maxFp(),'focus')+meter('◆ Experiência',S.level>=10?1:S.xp,S.level>=10?1:xpNeed(),'xp')+'<div class="attr-grid">'+Object.keys(S.stats).map(function(k){return '<div class="attr"><small>'+k.toUpperCase()+'</small><strong>'+S.stats[k]+'</strong></div>';}).join('')+'</div><div class="resource-grid"><div><strong>⛨ '+armor()+'</strong><small>Armadura</small></div><div><strong>⚔ '+damageBase(c.abilityType==='magic'?'magic':'physical')+'</strong><small>Dano-base</small></div><div><strong>◈ '+S.gold+'</strong><small>Ouro seguro</small></div><div><strong>✧ '+S.runGold+'</strong><small>Ouro da expedição</small></div></div></section>'+
 '<section class="panel"><div class="panel-label">Equipamento</div><div class="side-title">Arsenal equipado</div><div class="item-mini"><div class="item-symbol">⚔</div><div><strong>'+c.weapon+'</strong><span>Arma comum • +'+c.weaponBonus+' dano</span></div></div><div class="item-mini"><div class="item-symbol">⛨</div><div><strong>'+c.armor+'</strong><span>+ '+c.armorBonus+' armadura</span></div></div>'+(S.relicArmor?'<div class="item-mini"><div class="item-symbol">✦</div><div><strong>Selo do Limiar</strong><span>Relíquia permanente • +'+S.relicArmor+' ARM</span></div></div>':'')+'<div class="item-mini"><div class="item-symbol">⚗</div><div><strong>Poção Pequena × '+S.potions+'</strong><span>Recupera 20 pontos de vida</span></div></div></section></aside>';
}
function mapPanel(){return '<section class="panel"><div class="panel-label">Cartografia</div><div class="side-title">Rota das profundezas</div><div class="room-map">'+ROOMS.map(function(r,i){const done=!!S.cleared[i]||(i<S.roomIndex),current=i===S.roomIndex;return '<div title="'+escapeHtml(done||current?r.name:'Sala por descobrir')+'" class="map-node '+(done?'done ':'')+(current?'current ':'')+(i>S.roomIndex?'future ':'')+(r.type==='boss'?'boss-node':'')+'"><span class="map-icon">'+(i>S.roomIndex?'◇':r.icon)+'</span><span>'+String(i+1).padStart(2,'0')+'</span></div>';}).join('')+'</div><div class="room-map-helper">✦ Dourado: posição atual · Verde: concluída</div></section>';}
function rightPanel(){return '<aside class="side right"><section class="panel"><div class="panel-label">Expedição atual</div><h3 class="right-card-title">O Coração da Cripta</h3><span class="tag">ATO I · RUN '+String(S.run).padStart(2,'0')+'</span><div class="progress-track"><span style="width:'+pct(S.roomIndex+1,ROOMS.length)+'"></span></div><p class="quest-detail">Explora as dez salas da cripta, ultrapassa cada encontro e derrota o Guardião do Limiar. Os teus recursos são limitados. A coragem não.</p><div class="detail-list"><li><span>Andar</span><span>'+ROOMS[S.roomIndex].floor+' / 3</span></li><li><span>Progresso</span><span>'+(S.roomIndex+1)+' / 10</span></li><li><span>RNG canónico</span><span>R = '+S.rng+'</span></li><li><span>Rolagens</span><span>'+S.rolls+'</span></li></div></section>'+
 '<section class="panel"><div class="panel-label">Registo auditável</div><h3 class="right-card-title">Crónica da expedição</h3>'+logMarkup(5)+'<button class="btn btn-ghost btn-sm btn-block" data-action="tab:journal">Abrir registo completo ↗</button></section></aside>';}
function logMarkup(limit){const arr=S.log.slice(0,limit);return '<div class="log-list">'+(arr.length?arr.map(function(e){return '<div class="log-entry '+escapeHtml(e.type)+'"><time>#'+String(e.n).padStart(3,'0')+'</time><strong>'+escapeHtml(e.title)+'</strong><small>'+escapeHtml(e.detail)+'</small></div>';}).join(''):'<div class="log-empty">A escuridão está silenciosa.</div>')+'</div>';}
function roomScene(){const room=ROOMS[S.roomIndex],enemy=S.enemy,subject=enemy?enemy.icon:({'entrance':'✧','chest':'▣','shrine':'✧','rest':'♨','treasure':'◇','boss':'♛'}[room.type]||'⚔');const sceneType=enemy&&enemy.id==='boss'?'boss':room.type==='shrine'?'shrine':'';return '<div class="scene scene-'+sceneType+'"><div class="scene-back"></div><div class="scene-subject '+(enemy?'enemy':'')+'">'+subject+'</div><div class="scene-spark" style="top:30%;left:18%"></div><div class="scene-spark" style="top:52%;left:79%;animation-delay:1.2s"></div><div class="scene-spark" style="top:19%;left:57%;animation-delay:2.7s"></div><div class="scene-spark" style="top:65%;left:26%;animation-delay:.6s"></div><div class="scene-banner"><div><div class="panel-label">Ato I · Sala '+String(S.roomIndex+1).padStart(2,'0')+'</div><h2>'+room.name+'</h2><p>'+room.desc+'</p></div><span class="scene-index">'+String(S.roomIndex+1).padStart(2,'0')+' / 10</span></div></div>';}
function actionTile(code,icon,title,sub,highlight,disabled){return '<button class="action-tile '+(highlight?'highlight':'')+'" data-action="'+code+'" '+(disabled?'disabled':'')+'><span class="action-symbol">'+icon+'</span><span><strong>'+title+'</strong><small>'+sub+'</small></span></button>';}
function combatActions(){const c=klass(),e=S.enemy;return '<div class="combat-strip"><span>⚔ Combate por turnos</span><span>Acerto '+clamp(80+2*(S.stats.agi-e.agi),60,95)+'%</span><span>Crítico '+clamp(5+S.stats.agi,5,20)+'%</span></div><div class="inline-enemy"><div class="enemy-icon">'+e.icon+'</div><div class="enemy-info"><strong>'+e.name+'</strong><small>'+e.hp+' / '+e.maxHp+' PV · '+e.armor+' ARM · '+ENEMIES[e.id].trait+'</small><div class="enemy-meter"><i style="width:'+pct(e.hp,e.maxHp)+'"></i></div></div></div><div class="action-grid">'+
 actionTile('attack','⚔','Ataque normal',damageBase(c.abilityType==='magic'?'magic':'physical')+' dano-base · Sem custo',true,false)+
 actionTile('skill','✦',c.ability,c.abilityDesc+' · 4 FO',false,S.fp<4)+
 actionTile('defend','⛨','Defender','Metade do próximo dano · +3 FO',false,false)+
 actionTile('potion','⚗','Usar poção','Cura 20 PV · '+S.potions+' disponíveis',false,S.potions<=0)+
 '</div><div class="utility-actions"><button class="btn btn-ghost btn-sm" data-action="flee" '+(e.id==='boss'?'disabled':'')+'>⇠ Tentar fugir'+(e.id==='boss'?' · Indisponível':' · '+clamp(60+3*(S.stats.agi-e.agi),30,90)+'%')+'</button></div>'+(S.poison?'<div class="action-note text-red">☣ Envenenado: −3 PV no início dos próximos '+S.poison+' turnos.</div>':'')+'<div class="action-note">Cada ataque usa 1 rolagem: R = (21 × R anterior + 17) mod 100. A rolagem determina acerto e crítico.</div>';}
function nonCombatActions(){const r=ROOMS[S.roomIndex];if(S.cleared[S.roomIndex]){return '<p class="small muted">A sala foi concluída. O caminho para as profundezas está aberto.</p><div class="action-grid">'+actionTile('next','➜',S.roomIndex===0?'Entrar na cripta':'Avançar','Explorar a próxima sala',true,false)+actionTile('tab:hero','♜','Consultar herói','Atributos e evolução',false,false)+'</div>';}
 let items=[];
 if(r.type==='chest')items=[actionTile('choice:chest','▣','Abrir o cofre','+18 ouro e 1 poção',true,false)];
 if(r.type==='treasure')items=[actionTile('choice:treasure','✦','Tomar a relíquia','Selo do Limiar · +1 ARM',true,false)];
 if(r.type==='shrine')items=[actionTile('choice:meditate','✧','Meditar','Recuperar 8 Foco',true,false),actionTile('choice:offer','◆','Oferta de sangue','−8 Vida · +20 ouro',false,S.hp<=8),actionTile('choice:ignore','↗','Ignorar o altar','Continuar sem custo',false,false)];
 if(r.type==='rest')items=[actionTile('choice:resthp','♨','Descansar','Recuperar 16 Vida',true,false),actionTile('choice:restfp','✧','Concentrar','Recuperar 8 Foco',false,false)];
 return '<div class="action-grid">'+items.join('')+'</div>';}
function exploreView(){const room=ROOMS[S.roomIndex];const status=S.phase==='combat'?'O inimigo aguarda a tua decisão.':S.phase==='victory'?'Conquistaste o trono. A cripta reconhece o teu nome.':S.phase==='dead'?'A tua expedição terminou. A lenda continua.':'Escolhe o próximo passo da tua jornada.';return '<div class="stage-head"><div><div class="eyebrow">O caminho sem regresso</div><h1>'+ (S.phase==='combat'?'CONFRONTO':S.phase==='victory'?'VITÓRIA':S.phase==='dead'?'O FIM DE UMA EXPEDIÇÃO':'AS PROFUNDEZAS') +'</h1></div><div class="stage-meta"><span class="tag">ANDAR '+room.floor+'</span><span class="tag">SALA '+(S.roomIndex+1)+'/10</span></div></div>'+roomScene()+'<blockquote class="event-quote">“'+room.quote+'”</blockquote>'+
 '<div class="action-panel"><div class="action-heading"><h3>'+ (S.phase==='combat'?'Escolhe o teu movimento':S.phase==='victory'?'O Abismo foi conquistado':S.phase==='dead'?'A cripta venceu esta vez':'O que vais fazer?')+'</h3><span class="action-help">'+(S.phase==='combat'?'Turno '+(S.enemyTurn)+' do inimigo':'Decisões com consequências')+'</span></div>'+
 (S.pendingPoints>0?'<p class="text-gold">✦ Subiste de nível! Distribui os pontos de atributo para continuar.</p><button class="btn btn-primary btn-block" data-action="levelup">Distribuir '+S.pendingPoints+' ponto(s)</button>':
 S.phase==='combat'?combatActions():
 S.phase==='victory'?'<p class="small muted">O ouro da expedição foi guardado. Recebeste a recompensa do Guardião.</p><div class="action-grid">'+actionTile('newrun','➜','Nova expedição','Iniciar a próxima descida',true,false)+actionTile('tab:hero','♜','Ver evolução','A tua lenda até agora',false,false)+'</div>':
 S.phase==='dead'?'<p class="small muted">'+(S.deadReason==='retreat'?'Conseguiste fugir. O ouro provisório ficou para trás.':'Caíste em batalha, mas a tua experiência mantém-se.')+'</p><div class="action-grid">'+actionTile('newrun','➜','Tentar de novo','Vida e Foco restaurados',true,false)+actionTile('tab:journal','◈','Rever crónica','Auditar cada decisão',false,false)+'</div>':
 nonCombatActions())+'</div>';}
function heroView(){return '<section class="panel"><div class="panel-label">Folha de personagem</div><h2 class="view-heading">'+escapeHtml(S.name)+' · '+klass().name+'</h2><p class="view-description">As tuas escolhas moldam a lenda. Cada nível amplia o potencial do herói.</p><div class="hero-advanced">'+[['♥ Vida',S.hp+'/'+maxHp()],['✧ Foco',S.fp+'/'+maxFp()],['⛨ Armadura',armor()],['⚔ Dano físico',damageBase('physical')],['✦ Dano mágico',damageBase('magic')],['◆ Nível',S.level]].map(function(v){return '<div class="adv-stat"><small>'+v[0]+'</small><strong>'+v[1]+'</strong></div>';}).join('')+'</div><h3 class="side-title mt-3">Atributos e especialização</h3><ul class="detail-list">'+[['Força',S.stats.for],['Agilidade',S.stats.agi],['Intelecto',S.stats.int],['Vitalidade',S.stats.vit],['Habilidade',klass().ability],['Pontos por distribuir',S.pendingPoints]].map(function(v){return '<li><span>'+v[0]+'</span><span>'+v[1]+'</span></li>';}).join('')+'</ul>'+(S.pendingPoints?'<button class="btn btn-primary mt-3" data-action="levelup">Distribuir pontos</button>':'')+'<div class="utility-actions"><button class="btn btn-secondary" data-action="tab:explore">↩ Voltar à dungeon</button></div></section>';}
function inventoryView(){return '<section class="panel"><div class="panel-label">Inventário</div><h2 class="view-heading">ARSENAL & RELÍQUIAS</h2><p class="view-description">O poder vive no equipamento e nas decisões que tomaste para o conquistar.</p><div class="inventory-item"><div><strong>⚔ '+klass().weapon+'</strong><br><span>Arma equipada • +'+klass().weaponBonus+' dano</span></div><span class="tag">EQUIPADO</span></div><div class="inventory-item"><div><strong>⛨ '+klass().armor+'</strong><br><span>Armadura equipada • +'+klass().armorBonus+' ARM</span></div><span class="tag">EQUIPADO</span></div><div class="inventory-item"><div><strong>⚗ Poção Pequena</strong><br><span>Recupera 20 PV • limite 5</span></div><strong>'+S.potions+' / 5</strong></div>'+(S.relicArmor?'<div class="inventory-item"><div><strong>✦ Selo do Limiar</strong><br><span>Relíquia permanente • +'+S.relicArmor+' ARM</span></div><span class="tag">LENDÁRIO</span></div>':'')+'<h3 class="side-title mt-3">Tesouro</h3><ul class="detail-list"><li><span>Ouro permanente</span><span>'+S.gold+' ◈</span></li><li><span>Ouro provisório</span><span>'+S.runGold+' ◈</span></li></ul><div class="utility-actions"><button class="btn btn-secondary" data-action="buy-potion" '+(S.gold<12||S.potions>=5?'disabled':'')+'>⚗ Comprar poção · 12 ouro</button><button class="btn btn-ghost" data-action="tab:explore">↩ Voltar</button></div><p class="action-note">O mercador só vende poções fora de combate. Ao morrer, o ouro provisório é perdido.</p></section>';}
function journalView(){return '<section class="panel"><div class="panel-label">Registo imutável de eventos</div><h2 class="view-heading">CRÓNICA DO ABISMO</h2><p class="view-description">Cada rolagem é calculada por uma fórmula reproduzível e as alterações ficam no histórico local.</p><div class="hero-advanced"><div class="adv-stat"><small>Estado R</small><strong>'+S.rng+'</strong></div><div class="adv-stat"><small>Rolagens</small><strong>'+S.rolls+'</strong></div><div class="adv-stat"><small>Eventos</small><strong>'+S.eventSeq+'</strong></div><div class="adv-stat"><small>Expedições</small><strong>'+S.run+'</strong></div></div><h3 class="side-title mt-3">Histórico de ações</h3>'+logMarkup(historyFull?100:14)+'<div class="utility-actions"><button class="btn btn-secondary btn-sm" data-action="history">'+(historyFull?'Ver recentes':'Mostrar tudo')+'</button><button class="btn btn-secondary btn-sm" data-action="export">↓ Exportar save</button><button class="btn btn-ghost btn-sm" data-action="checkpoint">▤ Copiar checkpoint</button></div><div class="utility-actions"><button class="btn btn-ghost btn-sm" data-action="import">↑ Importar save</button><button class="btn btn-danger btn-sm" data-action="confirm-reset">Reiniciar campanha</button></div><input id="import-file" type="file" accept=".json,application/json" style="display:none" aria-label="Importar save"/><p class="action-note">A gravação automática usa localStorage deste navegador. Exporta o ficheiro JSON para recuperares a campanha noutro dispositivo.</p></section>';}
function overlay(){if(S&&S.pendingPoints>0)return '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-icon">✧</div><h2 id="modal-title">PODER DESPERTADO</h2><p>Nível '+S.level+' alcançado. Escolhe um atributo para melhorar. Pontos disponíveis: '+S.pendingPoints+'</p><div class="level-choice-grid">'+Object.keys(S.stats).map(function(k){const names={for:'Força',agi:'Agilidade',int:'Intelecto',vit:'Vitalidade'};return '<button class="level-choice" data-action="attr:'+k+'">'+names[k]+' <strong>'+S.stats[k]+' → '+(S.stats[k]+1)+'</strong></button>';}).join('')+'</div></div></div>';
 if(modal==='reset')return '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-icon">⚠</div><h2>RECOMEÇAR DO ZERO?</h2><p>Isto elimina a campanha guardada neste navegador. Não é possível desfazer sem um checkpoint exportado.</p><div class="modal-actions"><button class="btn btn-ghost" data-action="cancel-modal">Cancelar</button><button class="btn btn-danger" data-action="reset">Apagar campanha</button></div></div></div>';
 return '';}
function render(){if(!S){intro();return;}app.innerHTML='<div class="game-shell">'+shellHeader()+'<div class="game-grid">'+leftPanel()+'<main class="center-stage">'+(tab==='explore'?exploreView():tab==='hero'?heroView():tab==='inventory'?inventoryView():journalView())+'</main>'+rightPanel()+'</div><div class="footer-note">ABISMO ENGINE '+VERSION+' · GUARDA AUTOMÁTICA LOCAL · TODAS AS ROLAGENS VERIFICÁVEIS</div></div>'+overlay();}
function enterNext(){if(S.phase!=='explore'||!S.cleared[S.roomIndex]||S.roomIndex>=9)return;S.roomIndex++;const room=ROOMS[S.roomIndex];if(ENEMIES[room.type]){S.enemy=spawnEnemy(room.type,S.run);S.enemyTurn=1;S.phase='combat';S.playerDefend=false;S.poison=0;}log('Sala '+(S.roomIndex+1)+' · '+room.name,room.desc,'info');playSound('move');refresh();}
function choice(kind){if(S.phase!=='explore'||S.cleared[S.roomIndex])return;const r=ROOMS[S.roomIndex],t=r.type;let msg='';
 if(t==='chest'&&kind==='chest'){S.runGold+=18;if(S.potions<5){S.potions++;S.earnedPotions++;msg='+18 ouro provisório, +1 Poção Pequena.';}else{S.runGold+=4;msg='+22 ouro provisório (poção convertida em 4 ouro).';}}
 else if(t==='treasure'&&kind==='treasure'){S.relicArmor++;msg='Relíquia Selo do Limiar obtida: +1 ARM permanente.';}
 else if(t==='shrine'&&['meditate','offer','ignore'].includes(kind)){
 if(kind==='meditate'){const gain=Math.min(8,maxFp()-S.fp);S.fp+=gain;msg='O altar recuperou '+gain+' FO.';}
 if(kind==='offer'){if(S.hp<=8)return toast('Vida insuficiente para a oferta.');S.hp-=8;S.runGold+=20;msg='−8 PV, +20 ouro provisório.';}
 if(kind==='ignore')msg='Deixaste o altar intocado.';
 }else if(t==='rest'&&['resthp','restfp'].includes(kind)){
 if(kind==='resthp'){const gain=Math.min(16,maxHp()-S.hp);S.hp+=gain;msg='Recuperaste '+gain+' PV.';}
 else{const gain=Math.min(8,maxFp()-S.fp);S.fp+=gain;msg='Recuperaste '+gain+' FO.';}
 }else return;
 S.cleared[S.roomIndex]=true;log('Decisão · '+r.name,msg,'reward');playSound('win');refresh();}
function resolveAttack(attacker,defender,base,critBonus){
 const ac=clamp(80+2*(attacker.agi-defender.agi),60,95),crit=clamp(5+attacker.agi+(critBonus||0),5,critBonus?30:20),r=rand(),hit=r<=ac,isCrit=hit&&r<=crit;
 const block=defender.defending||false;
 let amount=hit?Math.max(1,Math.floor(base*(isCrit?1.5:1))-defender.armor):0;
 if(hit&&block){amount=Math.max(1,Math.floor(amount/2));defender.defending=false;}
 if(hit)defender.hp=clamp(defender.hp-amount,0,defender.maxHp);
 return {roll:r,ac:ac,crit:crit,hit:hit,isCrit:isCrit,amount:amount,base:base,arm:defender.armor,blocked:block&&hit};
}
function playerAttack(skill){
 const k=klass(),e=S.enemy,type=skill?k.abilityType:(k.abilityType==='magic'?'magic':'physical');
 if(skill)S.fp-=k.abilityCost;
 const attacker={agi:S.stats.agi},target=e;
 const a=resolveAttack(attacker,target,damageBase(type)+(skill?k.abilityBonus:0),skill?k.critBonus:0);
 let label=skill?k.ability:'Ataque normal';
 log(label,a.hit?('R='+S.rng+' · Dado '+a.roll+'/'+a.ac+' AC · '+(a.isCrit?'CRÍTICO · ':'')+a.base+' dano-base − '+a.arm+' ARM'+(a.blocked?' (defesa /2)':'')+' = '+a.amount+' dano. '+e.name+': '+e.hp+'/'+e.maxHp+' PV.'):'R='+S.rng+' · Dado '+a.roll+' > '+a.ac+' AC. Falhou.','hit');
 playSound(a.hit?'hit':'move');
}
function enemyAction(){if(!S.enemy||S.enemy.hp<=0)return;const e=S.enemy,turn=S.enemyTurn;
 if(e.defending){e.defending=false;} // defense expires on the defender's next turn
 if(e.id==='skeleton'&&turn%3===0){e.defending=true;log('Sentinela defende','Turno inimigo '+turn+': escudo erguido. O próximo ataque recebido será reduzido.','info');S.enemyTurn++;return;}
 if(e.id==='boss'&&turn%3===2){e.charging=true;log('Esmagamento preparado','Turno inimigo '+turn+': o Guardião do Limiar prepara um golpe devastador. Não ataca.','hit');S.enemyTurn++;return;}
 let type='physical',bonus=0,poison=false,move='Garras ósseas';
 if(e.id==='cultist'){move='Golpe do Cultista';if(turn%3===0){move='Dardo Negro';type='magic';bonus=3;poison=true;}}
 if(e.id==='skeleton')move='Espada da Sentinela';
 if(e.id==='boss'){move=e.charging?'Esmagamento':'Golpe do Guardião';if(e.charging){bonus=10;e.charging=false;}}
 const base=3+2*(type==='magic'?e.int:e.for)+bonus;
 const defendProxy={hp:S.hp,maxHp:maxHp(),agi:S.stats.agi,armor:armor(),defending:S.playerDefend};
 const a=resolveAttack(e,defendProxy,base,0);S.hp=defendProxy.hp;S.playerDefend=defendProxy.defending;
 if(poison&&a.hit)S.poison=2;
 log(move,a.hit?('R='+S.rng+' · Dado '+a.roll+'/'+a.ac+' AC · '+(a.isCrit?'CRÍTICO · ':'')+a.base+' dano-base − '+a.arm+' ARM'+(a.blocked?' (defesa /2)':'')+' = '+a.amount+' dano.'+(poison?' Veneno: 2 turnos.':'')):'R='+S.rng+' · Dado '+a.roll+' > '+a.ac+' AC. Falhou.','hit');
 S.enemyTurn++;if(S.hp<=0)die(false);
}
function gainXp(n){S.xp+=n;while(S.level<10&&S.xp>=xpNeed()){S.xp-=xpNeed();S.level++;S.hp+=4;S.fp+=2;if(S.level%2===0)S.pendingPoints++;log('Nível '+S.level+' alcançado','+4 PV máximos, +2 FO máximos'+(S.level%2===0?' e +1 ponto de atributo.':''),'reward');}if(S.level>=10)S.xp=0;}
function winFight(){
 const e=S.enemy;S.runGold+=e.gold;S.fp=Math.min(maxFp(),S.fp+3);log('Vitória sobre '+e.name,'+'+e.xp+' XP · +'+e.gold+' ouro provisório · +3 FO (até ao máximo).','reward');
 gainXp(e.xp);
 const r=rand();if(r<=25){if(S.potions<5){S.potions++;S.earnedPotions++;log('Saque · Poção Pequena','R='+S.rng+' · Dado '+r+' ≤ 25: +1 poção.','reward');}else{S.runGold+=4;log('Saque convertido em ouro','R='+S.rng+' · Dado '+r+' ≤ 25: inventário cheio, +4 ouro.','reward');}}
 else log('Saque · Sem item','R='+S.rng+' · Dado '+r+' > 25: sem poção.','info');
 S.cleared[S.roomIndex]=true;S.enemy=null;S.enemyTurn=1;S.playerDefend=false;S.poison=0;S.phase='explore';playSound('win');
 if(e.id==='boss'){const prize=S.runGold;S.gold+=prize;S.runGold=0;S.earnedPotions=0;S.phase='victory';S.lastOutcome='win';log('O Limiar caiu','Expedição concluída! '+prize+' ouro depositado no tesouro permanente.','reward');}
}
function die(retreated){S.phase='dead';S.deadReason=retreated?'retreat':'death';S.hp=Math.max(0,S.hp);S.runGold=0;S.potions=Math.max(0,S.potions-S.earnedPotions);S.earnedPotions=0;S.enemy=null;S.poison=0;S.playerDefend=false;log(retreated?'Retirada estratégica':'O herói caiu',retreated?'Regressaste sem o ouro provisório.':'A tua expedição acabou. Experiência e equipamento mantidos.','hit');playSound('hit');}
function act(action){
 if(!S||S.phase!=='combat'||!S.enemy||S.pendingPoints>0)return;
 const e=S.enemy,k=klass();
 if(action==='skill'&&S.fp<k.abilityCost)return toast('Foco insuficiente.');
 if(action==='potion'&&S.potions<=0)return toast('Sem poções.');
 if(action==='flee'&&e.id==='boss')return toast('Não podes fugir de um boss.');
 if(!['attack','skill','defend','potion','flee'].includes(action))return;
 // Beginning of player's turn: poison ticks, previous defense expires.
 S.playerDefend=false;
 if(S.poison>0){S.hp=Math.max(0,S.hp-3);S.poison--;log('Veneno','−3 PV verdadeiros. Duração restante: '+S.poison+' turno(s).','hit');if(S.hp<=0){die(false);refresh();return;}}
 if(action==='attack'||action==='skill'){playerAttack(action==='skill');}
 if(action==='defend'){S.playerDefend=true;const gain=Math.min(3,maxFp()-S.fp);S.fp+=gain;log('Posição defensiva','O próximo ataque recebido causa metade do dano. Recuperados '+gain+' FO.','info');}
 if(action==='potion'){S.potions--;if(S.earnedPotions>0)S.earnedPotions--;const gain=Math.min(20,maxHp()-S.hp);S.hp+=gain;log('Poção Pequena','Consumida 1 poção. Recuperados '+gain+' PV.','reward');}
 if(action==='flee'){const chance=clamp(60+3*(S.stats.agi-e.agi),30,90),r=rand();log('Tentativa de fuga','R='+S.rng+' · Dado '+r+' / '+chance+'% → '+(r<=chance?'sucesso.':'falha.'),r<=chance?'reward':'hit');if(r<=chance){die(true);refresh();return;}}
 if(S.enemy&&S.enemy.hp<=0){winFight();refresh();return;}
 enemyAction();refresh();
}
function allocate(k){if(!S||S.pendingPoints<=0||!Object.prototype.hasOwnProperty.call(S.stats,k))return;const oldHp=maxHp(),oldFp=maxFp();S.stats[k]++;S.pendingPoints--;S.hp+=Math.max(0,maxHp()-oldHp);S.fp+=Math.max(0,maxFp()-oldFp);log('Atributo aumentado',k.toUpperCase()+' agora é '+S.stats[k]+'.','reward');refresh();}
function newRun(){if(!S||!['victory','dead'].includes(S.phase))return;S.run++;S.hp=maxHp();S.fp=maxFp();S.roomIndex=0;S.cleared={0:true};S.phase='explore';S.enemy=null;S.enemyTurn=1;S.poison=0;S.playerDefend=false;S.runGold=0;S.earnedPotions=0;S.deadReason='';log('Nova expedição iniciada','A cripta desperta novamente. Os inimigos serão mais resistentes na expedição '+S.run+'.','info');tab='explore';refresh();}
function buyPotion(){if(!S||S.phase==='combat')return toast('O mercador não está disponível em combate.');if(S.gold<12)return toast('Precisas de 12 ouro.');if(S.potions>=5)return toast('Limite de 5 poções.');S.gold-=12;S.potions++;log('Compra no mercador','−12 ouro permanente, +1 Poção Pequena.','reward');refresh();}
function copyCheckpoint(){const checkpoint='ABISMO '+VERSION+' | MODO '+S.mode+' | EVENTO '+S.eventSeq+' | R='+S.rng+' | ROLAGENS '+S.rolls+' | RUN '+S.run+' | SALA '+(S.roomIndex+1)+' | FASE '+S.phase+' | '+S.name+' '+S.classId+' NIV '+S.level+' XP '+S.xp+' | FOR '+S.stats.for+' AGI '+S.stats.agi+' INT '+S.stats.int+' VIT '+S.stats.vit+' | PV '+S.hp+'/'+maxHp()+' | FO '+S.fp+'/'+maxFp()+' | ARM '+armor()+' | POCOES '+S.potions+' | OURO '+S.gold+'+'+S.runGold+' | INIMIGO '+(S.enemy?S.enemy.name+' PV '+S.enemy.hp+'/'+S.enemy.maxHp+' TURNO '+S.enemyTurn:'NENHUM')+' | VENENO '+S.poison+' | DEFESA '+S.playerDefend;
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(checkpoint).then(function(){toast('Checkpoint copiado.');},function(){toast('Permissão de cópia indisponível.');});}else{toast('Área de transferência indisponível. Usa Exportar save.');}}
function exportSave(){if(!S)return;const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ABISMO-save-run-'+S.run+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);toast('Save exportado.');}
function importSave(file){if(!file)return;const reader=new FileReader();reader.onload=function(){try{const data=JSON.parse(reader.result);if(!data||data.version!==VERSION||!CLASSES[data.classId]||!data.stats||!ROOMS[data.roomIndex]||typeof data.rng!=='number'||!Array.isArray(data.log)||!['explore','combat','victory','dead'].includes(data.phase))throw Error('Formato inválido.');S=data;tab='explore';modal='';refresh();toast('Campanha importada.');}catch(e){toast('Save incompatível ou inválido.');}};reader.readAsText(file);}
function trigger(action){
 if(action==='scroll-classes'){document.getElementById('choose-class')?.scrollIntoView({behavior:'smooth'});return;}
 if(action.startsWith('select:')){selectedName=document.getElementById('hero-name')?.value||'';selectedClass=action.slice(7);intro();return;}
 if(action==='start'||action==='test'){if(S)return;selectedName=document.getElementById('hero-name')?.value.trim()||'Viajante';const test=action==='test';S=newState(test?'guardian':selectedClass,test?'Sentinela':selectedName,test);tab='explore';refresh();toast(test?'Laboratório iniciado · R = 17.':'O Abismo aguarda-te.');return;}
 if(!S)return;
 if(action.startsWith('tab:')){tab=action.slice(4);render();return;}
 if(action==='sound'){mute=!mute;S.muted=mute;playSound('win');refresh();return;}
 if(action==='save'){save();toast('Progresso guardado neste dispositivo.');return;}
 if(action==='next'){enterNext();return;}
 if(action.startsWith('choice:')){choice(action.slice(7));return;}
 if(['attack','skill','defend','potion','flee'].includes(action)){act(action);return;}
 if(action==='newrun'){newRun();return;}
 if(action==='levelup'){render();return;}
 if(action.startsWith('attr:')){allocate(action.slice(5));return;}
 if(action==='buy-potion'){buyPotion();return;}
 if(action==='checkpoint'){copyCheckpoint();return;}
 if(action==='export'){exportSave();return;}
 if(action==='import'){document.getElementById('import-file')?.click();return;}
 if(action==='history'){historyFull=!historyFull;render();return;}
 if(action==='confirm-reset'){modal='reset';render();return;}
 if(action==='cancel-modal'){modal='';render();return;}
 if(action==='reset'){try{localStorage.removeItem(KEY);}catch(e){}S=null;modal='';tab='explore';selectedClass='guardian';selectedName='';render();toast('Campanha reiniciada.');return;}
}
document.addEventListener('click',function(ev){const button=ev.target.closest('[data-action]');if(!button||button.disabled)return;trigger(button.dataset.action);});
document.addEventListener('change',function(ev){if(ev.target&&ev.target.id==='import-file')importSave(ev.target.files&&ev.target.files[0]);});
document.addEventListener('keydown',function(ev){if(!S||ev.altKey||ev.metaKey||ev.ctrlKey||['INPUT','TEXTAREA'].includes(ev.target.tagName))return;if(tab==='explore'&&S.phase==='combat'){const actn={'1':'attack','2':'skill','3':'defend','4':'potion'}[ev.key];if(actn){ev.preventDefault();act(actn);}}});
S=restore();mute=S?!!S.muted:true;render();
})();
