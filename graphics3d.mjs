/* METRÓPOLE P2 — progressive Three.js/WebGL renderer.
 * The existing Canvas 2D always remains available as an offline/WebGL fallback.
 * All interaction coordinates are still owned by game.js, not the GPU renderer.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';

const canvas=document.getElementById('world3d');
const model=window.CityGraphicsModel;
if(canvas&&model){
  const mobile=window.innerWidth<741;
  const priority=['high-performance','default'];
  let renderer=null;
  for(const preference of priority) {
    try {
      renderer=new THREE.WebGLRenderer({
        canvas,alpha:false,antialias:!mobile,powerPreference:preference,
        preserveDrawingBuffer:true
      });
      break;
    }catch(error){
      console.info('WebGL renderer unavailable:',error);
    }
  }
  if(renderer){
    const scene=new THREE.Scene();
    const camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,400);
    const hemi=new THREE.HemisphereLight('#e7f8ff','#62775c',2.0);
    const sun=new THREE.DirectionalLight('#fff4d7',2.8);
    const fill=new THREE.DirectionalLight('#8fc8da',.65);
    sun.position.set(-35,70,-10);fill.position.set(15,28,30);
    scene.add(hemi,sun,fill);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.18;
    renderer.setPixelRatio(Math.min(mobile?1.35:1.8,window.devicePixelRatio||1));
    const geometries={
      box:new THREE.BoxGeometry(1,1,1),
      cone:new THREE.ConeGeometry(.5,1,6),
      cylinder:new THREE.CylinderGeometry(.5,.5,1,7)
    };
    const materials={};
    const sceneMeshes=[];
    const dummy=new THREE.Object3D();
    const color=new THREE.Color();
    let sceneKey='',currentMapSize=36,previousMode='',enabled=true,activated=false,failed=false;
    const glass=['glass','litGlass'];
    const keys=model.TYPES;
    for(const type of keys){
      const glossy=glass.includes(type)||type==='water';
      materials[type]=type==='light'
        ?new THREE.MeshBasicMaterial({color:0xffffff})
        :new THREE.MeshStandardMaterial({
          color:0xffffff,roughness:glossy?.3:type==='metal'?.49:.88,
          metalness:glossy?.25:type==='metal'?.48:0,
          emissive:type==='litGlass'?'#ba6822':'#000000',
          emissiveIntensity:type==='litGlass'?0:0
        });
    }
    const selector=new THREE.Mesh(
      new THREE.BoxGeometry(.93,.012,.93),
      new THREE.MeshBasicMaterial({color:'#c9f47c',transparent:true,opacity:.24,depthWrite:false})
    );
    selector.visible=false;selector.renderOrder=10;scene.add(selector);

    const carGeometry=new THREE.BoxGeometry(.17,.095,.28);
    const carMaterial=new THREE.MeshStandardMaterial({
      color:0xffffff,roughness:.28,metalness:.3
    });
    const cars=new THREE.InstancedMesh(carGeometry,carMaterial,100);
    cars.count=0;cars.frustumCulled=false;
    scene.add(cars);

    function setLights(mode){
      if(mode===previousMode)return;
      previousMode=mode;
      const night=mode==='night',dusk=mode==='dusk';
      hemi.intensity=night?.6:dusk?1.28:2;
      sun.intensity=night?.22:dusk?1.25:2.8;
      sun.color.set(night?'#9baeda':dusk?'#ffb478':'#fff4d7');
      fill.intensity=night?.8:dusk?.5:.65;
      scene.background=new THREE.Color(night?'#14243a':dusk?'#ba9c8c':'#a8c6c6');
      materials.litGlass.emissiveIntensity=night?1.6:dusk?.6:0;
      materials.light.toneMapped=!night;
      renderer.toneMappingExposure=night?1.13:dusk?1.10:1.18;
    }
    function rebuild(state,metrics,viewMode){
      // Scene generation is pure; rebuilding never modifies a saved citizen or parcel.
      const description=model.build(state,metrics,{
        detail:window.innerWidth<741?1:2,view:viewMode
      });
      currentMapSize=description.size;
      for(const mesh of sceneMeshes){
        scene.remove(mesh);
        if(typeof mesh.dispose==='function')mesh.dispose();
      }
      sceneMeshes.length=0;
      for(const type of keys){
        const items=description.groups[type];
        if(!items.length)continue;
        const geometry=type==='foliage'?geometries.cone:type==='trunk'?geometries.cylinder:geometries.box;
        const mesh=new THREE.InstancedMesh(geometry,materials[type],items.length);
        mesh.frustumCulled=false;
        mesh.receiveShadow=false;mesh.castShadow=false;
        for(let i=0;i<items.length;i++){
          const it=items[i];
          dummy.position.set(it[0],it[1],it[2]);
          dummy.rotation.set(0,it[7]||0,0);
          dummy.scale.set(it[3],it[4],it[5]);
          dummy.updateMatrix();
          mesh.setMatrixAt(i,dummy.matrix);
          color.set(it[6]);
          mesh.setColorAt(i,color);
        }
        mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        scene.add(mesh);sceneMeshes.push(mesh);
      }
    }
    function updateCamera(w,h,zoom,cam){
      const ppu=32*zoom/Math.SQRT1_2;
      const vw=w/ppu,vh=h/ppu;
      camera.left=-vw/2;camera.right=vw/2;camera.top=vh/2;camera.bottom=-vh/2;
      camera.updateProjectionMatrix();
      // This orthographic view exactly matches game.js project/unproject on ground tiles.
      const half=currentMapSize/2,shift=cam.y*Math.SQRT2/ppu;
      const tx=half-cam.x/(ppu*Math.SQRT2)-shift;
      const tz=half+cam.x/(ppu*Math.SQRT2)-shift;
      camera.position.set(tx+80,80*Math.sqrt(2/3),tz+80);
      camera.lookAt(tx,0,tz);
      camera.updateMatrixWorld();
    }
    function updateSelection(hover,selected,tool){
      const picked=hover||selected;
      selector.visible=!!(picked&&picked.x>=0&&picked.y>=0&&picked.x<currentMapSize&&picked.y<currentMapSize);
      if(selector.visible){
        selector.position.set(picked.x,.075,picked.y);
        selector.material.color.set(tool==='bulldoze'?'#f39a8c':tool==='inspect'?'#f9ecc7':'#c9f47c');
      }
    }
    function updateCars(metrics,now){
      const agents=metrics.trafficAgents||[];
      let count=0;
      for(const agent of agents){
        const route=agent.route;if(!route||route.length<2||count>=100)continue;
        const duration=(agent.kind==='freight'?3500:2300)*(1+(metrics.traffic||0)*.006);
        const progress=((now+agent.id*233)%duration)/duration*(route.length-1);
        const a=Math.min(route.length-2,Math.floor(progress)),t=progress-a;
        const from=route[a],to=route[a+1],n=currentMapSize;
        const x=(from%n)+((to%n)-(from%n))*t;
        const z=Math.floor(from/n)+(Math.floor(to/n)-Math.floor(from/n))*t;
        const dx=(to%n)-(from%n),dz=Math.floor(to/n)-Math.floor(from/n);
        dummy.position.set(x,.13,z);
        dummy.rotation.set(0,Math.atan2(dx,dz),0);
        dummy.scale.set(agent.kind==='freight'?1.2:1,1,agent.kind==='freight'?1.3:1);
        dummy.updateMatrix();
        cars.setMatrixAt(count,dummy.matrix);
        color.set(agent.kind==='freight'?'#e6b56e':['#e9edeb','#9fdad0','#d78f85','#a6b9d8'][agent.id%4]);
        cars.setColorAt(count,color);
        count++;
      }
      cars.count=count;
      if(count){
        cars.instanceMatrix.needsUpdate=true;
        if(cars.instanceColor)cars.instanceColor.needsUpdate=true;
      }
    }
    function reveal(on){
      enabled=on;
      if(on&&activated)document.body.classList.add('graphics3d-active');
      else document.body.classList.remove('graphics3d-active');
      const label=document.getElementById('graphicsLabel');
      if(label)label.textContent=on?'3D':'2D';
      try{localStorage.setItem('metropole-renderer-preference',on?'3d':'2d');}catch{}
    }
    const api={
      get active(){return enabled&&!failed;},
      toggle(){if(failed)return false;reveal(!enabled);return true;},
      render(options){
        if(!enabled||failed)return false;
        try{
          const {state,metrics,w,h,zoom,cam,lightingMode,viewMode,hover,selected,tool,now,stamp}=options;
          if(w<1||h<1)return false;
          const key=String(stamp)+':'+state.p0.revision+':'+viewMode+':'+state.grid.length;
          if(sceneKey!==key){
            rebuild(state,metrics,viewMode);
            sceneKey=key;
          }
          renderer.setSize(w,h,false);
          updateCamera(w,h,zoom,cam);
          setLights(lightingMode);
          updateSelection(hover,selected,tool);
          updateCars(metrics,now);
          renderer.render(scene,camera);
          if(!activated){activated=true;reveal(true);}
          return true;
        }catch(error){
          failed=true;
          document.body.classList.remove('graphics3d-active');
          console.error('3D renderer switched to safe 2D fallback:',error);
          return false;
        }
      }
    };
    canvas.addEventListener('webglcontextlost',function(event){
      event.preventDefault();failed=true;
      document.body.classList.remove('graphics3d-active');
      const label=document.getElementById('graphicsLabel');
      if(label)label.textContent='2D';
    });
    window.MetropoleRenderer3D=api;
    try{enabled=localStorage.getItem('metropole-renderer-preference')!=='2d';}
    catch{enabled=true;}
    const label=document.getElementById('graphicsLabel');
    if(label)label.textContent=enabled?'3D':'2D';
  }
}