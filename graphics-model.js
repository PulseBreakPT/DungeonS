/* METRÓPOLE P2: deterministic visual scene description, no DOM or GPU dependencies.
 * Not part of save format. Rendering never mutates city state.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CityGraphicsModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TYPES = ['ground','water','asphalt','paint','shadow','walls','roof','glass','litGlass','trunk','foliage','metal','light'];
  const COLORS = {
    grass: ['#81ab83','#86b48a','#78a47e','#8db792','#78a580'],
    road: {road:'#414b52',avenue:'#394956',oneway:'#3c4b5c',highway:'#303f4d',bridge:'#657078'},
    res:['#dbd2bd','#e1d8cb','#b9c6bb','#cfcbc1'],
    com:['#a6bec5','#9aafc3','#bbc6c9','#95b2b5'],
    ind:['#9b9c98','#b4aa99','#9da9a6','#9fa5b3'],
    roof:['#48565f','#705750','#586c64','#76665d']
  };
  function hash(x,y,seed=7) {
    let k=Math.imul(x+seed,374761393)+Math.imul(y+seed*7,668265263);
    k=Math.imul(k^(k>>>13),1274126177);
    return ((k^(k>>>16))>>>0)/4294967295;
  }
  function build(state, metrics={}, options={}) {
    if(!state||!Array.isArray(state.grid))throw new TypeError('Invalid city');
    const N=Math.sqrt(state.grid.length);
    if(!Number.isInteger(N)||N<1)throw new TypeError('Invalid map geometry');
    const detail=options.detail===0?0:options.detail===1?1:2;
    const view=options.view||'normal';
    const groups=Object.fromEntries(TYPES.map(k=>[k,[]]));
    function put(group,x,y,z,sx,sy,sz,color,ry=0){
      groups[group].push([x,y,z,sx,sy,sz,color,ry]);
    }
    function landColor(x,y,c,i) {
      if(view==='zoning'&&['res','com','ind'].includes(c.k))
        return {res:'#639e6a',com:'#6799c5',ind:'#c79761'}[c.k];
      if(view==='power'||view==='water'){
        const u=metrics.utilityCoverage?.zones?.[i];
        if(u)return (view==='power'?u.powered:u.watered&&u.sewage)?'#6aa982':'#c07772';
      }
      return COLORS.grass[Math.min(4,Math.floor(hash(x,y,19)*5))];
    }
    function road(x,y,c,i) {
      const kind=c.roadType||'road', color=COLORS.road[kind]||COLORS.road.road;
      const highlight=view==='traffic'?metrics.congestionByRoad?.[i]||0:0;
      put('asphalt',x,.025,y,.95,.045,.95,highlight>110?'#c16353':highlight>65?'#cb9a58':color);
      const n=(dx,dy)=>x+dx>=0&&y+dy>=0&&x+dx<N&&y+dy<N&&state.grid[(y+dy)*N+x+dx].k==='road';
      const ns=n(0,-1),ss=n(0,1),ew=n(1,0),ww=n(-1,0);
      const straightX=(ew||ww)&&!(ns||ss),straightZ=(ns||ss)&&!(ew||ww);
      if(straightX||straightZ){
        for(const k of [-.28,.28]){
          if(straightX)put('paint',x,.052,y+k,.82,.009,.016,'#bec3ae');
          else put('paint',x+k,.052,y,.016,.009,.82,'#bec3ae');
        }
        if(kind!=='road'&&kind!=='bridge'){
          if(straightX)put('paint',x,.053,y,.3,.01,.014,kind==='oneway'?'#dfc682':'#abb5b4');
          else put('paint',x,.053,y,.014,.01,.3,kind==='oneway'?'#dfc682':'#abb5b4');
        }
      }else if(detail>0){
        // Junction edge markers make road direction legible at a distance.
        for(const [dx,dy,rot] of [[-1,0,0],[1,0,0],[0,-1,1],[0,1,1]])
          if(n(dx,dy))put('paint',x+dx*.34,.052,y+dy*.34,rot?.4:.015,.009,rot?.015:.4,'#b8b8aa');
      }
      if(kind==='bridge'){
        put('metal',x,-.17,y,.12,.3,.12,'#58616a');
        put('paint',x-.42,.13,y,.035,.14,.9,'#9daaae');
        put('paint',x+.42,.13,y,.035,.14,.9,'#9daaae');
      }
      if(detail>0 && hash(x,y,59)>.89 && (straightX||straightZ)){
        const lx=x+(straightX?0:.43),lz=y+(straightZ?0:.43);
        put('metal',lx,.34,lz,.025,.62,.025,'#55616b');
        put('light',lx,.67,lz,.14,.06,.09,'#fff0ac');
      }
    }
    function tree(x,z,size,seed){
      const jx=(hash(x*7,z*11,seed)-.5)*.2,jz=(hash(z*3,x*13,seed+3)-.5)*.2;
      const px=x+jx,pz=z+jz;
      put('trunk',px,.17*size,pz,.065*size,.34*size,.065*size,'#715e47');
      put('foliage',px,.48*size,pz,.46*size,.68*size,.46*size,
        ['#4d8b63','#609b66','#468b70','#72985e'][Math.floor(hash(x,z,seed+6)*4)]);
      if(detail>1)put('foliage',px,.68*size,pz,.32*size,.40*size,.32*size,'#81ae72');
    }
    function house(x,y,c){
      const r=hash(x,y,41);
      const type=c.k,lv=c.lvl,baseColor=COLORS[type][Math.floor(r*4)];
      const width=type==='ind'?.82:(lv===3?.73:.62);
      const depth=type==='ind'?.76:.70;
      const height=type==='res'?(lv===3?2.05:lv===2?1.06:.52):(type==='com'?(lv===3?2.55:lv===2?1.2:.62):(lv===3?1.15:lv===2?.83:.57));
      put('shadow',x+.08,.008,y+.08,width*.95,.013,depth*.95,'#1c342c');
      put('walls',x,height/2+.06,y,width,height,depth,baseColor);
      put('roof',x,height+.085,y,width+.05,.075,depth+.05,
        COLORS.roof[Math.floor(hash(x,y,66)*4)]);
      if(lv===3&&type!=='ind'){
        put('metal',x,height+.15,y,.16,.10,.23,'#8d9996');
        if(detail>0)put('metal',x+.18,height+.15,y-.12,.08,.11,.09,'#71878b');
      }else if(type==='ind'){
        put('metal',x-.19,height+.18,y-.17,.10,.26,.10,'#78848a');
        put('metal',x+.15,height+.18,y+.1,.15,.2,.13,'#87928e');
      }else if(detail>1&&type==='res'&&lv===1){
        put('roof',x,height+.17,y,.44,.16,.52,'#825f55');
      }
      if(detail===0)return;
      const floors=Math.min(detail===1?4:8,Math.max(1,Math.round(height/.30)));
      const columns=type==='ind'?2:lv===1?2:3;
      for(let f=0;f<floors;f++){
        const heightAt=.24+(height-.27)*(f+.5)/floors;
        for(let col=0;col<columns;col++){
          const off=(col-(columns-1)/2)*(width*.78/columns);
          const lit=hash(x*20+f,y*18+col,8)>.60;
          const group=lit?'litGlass':'glass';
          const color=lit?'#ffdba5':'#527b8b';
          put(group,x+off,heightAt+.04,y+depth/2+.007,width*.46/columns,.095,.014,color);
          put(group,x+width/2+.007,heightAt+.04,y+off,.014,.095,depth*.46/columns,color);
        }
      }
      if(type==='com'&&lv>0)put('light',x,height*.12+.09,y+depth/2+.03,width*.58,.045,.045,'#b8cbe0');
      if(type==='res'&&lv===1){
        put('metal',x+.19,.22,y+depth/2+.025,.13,.38,.025,'#755d51');
      }
    }
    function service(x,y,k) {
      if(k==='park'){
        put('asphalt',x,.018,y,.84,.015,.19,'#c7bca0');
        put('asphalt',x,.018,y,.19,.015,.84,'#c7bca0');
        for(let j=0;j<4;j++)tree(x+(j%2?-.3:.3),y+(j<2?-.3:.3),.65,31+j);
        return;
      }
      const color={school:'#d3b48d',clinic:'#c5d9dc',fire:'#ce8b7d',police:'#a6b8ce',power:'#999b93',water:'#8bafb5',sewage:'#8ca4a1'}[k]||'#beb7a5';
      const h=(k==='power'||k==='sewage') ? .66 : k==='clinic' ? 1.18 : .78;
      put('shadow',x+.1,.01,y+.1,.84,.014,.81,'#1c342c');
      put('walls',x,h/2+.06,y,.83,h,.78,color);
      put('roof',x,h+.075,y,.86,.06,.80,k==='fire'?'#a84d47':'#5c7478');
      if(detail===0)return;
      if(k==='power'||k==='sewage'){
        put('metal',x-.20,h+.3,y-.13,.16,.55,.16,'#788287');
        put('metal',x+.18,h+.2,y+.12,.20,.36,.17,'#9aa2a0');
      }else if(k==='water'){
        put('metal',x+.19,h+.25,y-.16,.27,.32,.27,'#7aadb2');
      }else{
        for(let a=-1;a<=1;a++){
          put('glass',x+a*.22,.49,y+.4,.13,.2,.018,'#6093a3');
          put('glass',x+.42,.49,y+a*.22,.018,.2,.13,'#6093a3');
        }
        if(k==='clinic')put('light',x,h+.12,y,.30,.06,.1,'#fbfbef');
        if(k==='fire')put('metal',x,.23,y+.41,.40,.33,.02,'#62676a');
      }
    }
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const i=y*N+x,c=state.grid[i];
      const water=c.t==='water';
      put('ground',x,-.09,y,1,.17,1,water?'#426d75':landColor(x,y,c,i));
      if(water){
        put('water',x,-.004,y,.99,.018,.99,hash(x,y,17)>.5?'#438f9f':'#4d9daa');
        if(c.k!=='road')continue;
      }
      if(c.k==='road'){road(x,y,c,i);continue;}
      if(c.k==='empty'){
        if(detail>0&&hash(x,y,13)>.77&&(!c.powerLine&&!c.waterPipe))tree(x,y,.5+hash(x,y,20)*.28,19);
        continue;
      }
      if(['res','com','ind'].includes(c.k)){
        if(!c.lvl){
          put('paint',x,.012,y,.75,.012,.75,
            {res:'#80b588',com:'#86a4d2',ind:'#c9a27b'}[c.k]);
        }else house(x,y,c);
      }else service(x,y,c.k);
      if(c.powerLine){put('metal',x+.35,.25,y+.35,.03,.45,.03,'#b9a567');}
      if(c.waterPipe){put('metal',x-.32,.035,y-.32,.30,.025,.05,'#77b5c3');}
    }
    return {size:N,groups};
  }
  return {TYPES,hash,build};
});