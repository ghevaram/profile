/* Three.js ribbon renderer. Classic scripts keep file:// and static hosting usable. */
window.createRibbonExperience = function (canvas, options) {
  if (!window.THREE) return null;
  const T = window.THREE;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' }); }
  catch (_) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const camera = new T.Camera();
  const scene = new T.Scene();
  const post = new T.Scene();
  const uniforms = {
    uReveal: { value: 0 }, uTime: { value: 0 }, uScroll: { value: 0 }, uLight: { value: 0 },
    uResolution: { value: new T.Vector2(1, 1) }, uPointer: { value: new T.Vector2() },
  };
  // Both shaders share a two-segment cubic spine; the narrow turn matches the
  // reference at 36% / 68%, with an opening fan toward the upper-right corner.
  const curve = `
    vec2 bezier(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
      float q=1.0-t; return q*q*q*a+3.0*q*q*t*b+3.0*q*t*t*c+t*t*t*d;
    }
    vec2 ribbon(float t, float lane, float seed) {
      float turn=0.367+0.008*sin(uTime*0.24);
      float mid=0.68+0.012*sin(uTime*0.21)-0.12*sin(uScroll*1.3);
      vec2 p;
      if(t<0.5) p=bezier(vec2(1.10,-0.15),vec2(1.02,0.28),vec2(turn-0.03,mid-0.13),vec2(turn,mid),t*2.0);
      else p=bezier(vec2(turn,mid),vec2(turn+0.03,mid+0.13),vec2(0.75,0.73),vec2(0.82,1.25),(t-0.5)*2.0);
      float fan=pow(abs(t-0.5)*2.0,1.1);
      float twist=sin(t*7.0+uTime*0.12);
      p+=vec2(lane*(0.004+0.17*fan),lane*(0.007+0.12*fan)*twist);
      p+=vec2(sin(t*18.0+seed*19.0+uTime*0.38),cos(t*13.0+seed*11.0-uTime*0.28))*0.015*fan;
      p+=uPointer*0.004;
      return vec2(p.x,1.0-p.y);
    }
  `;
  const vertex = `
    attribute vec4 aData;
    attribute float aSide;
    uniform float uTime, uScroll;
    uniform vec2 uResolution, uPointer;
    varying float vSide, vT, vSeed, vLane;
    ${curve}
    void main(){
      float t=aData.x;
      vec2 p=ribbon(t,aData.y,aData.w);
      vec2 tangent=normalize((ribbon(min(t+0.001,1.0),aData.y,aData.w)-ribbon(max(t-0.001,0.0),aData.y,aData.w))*uResolution);
      vec2 normal=vec2(-tangent.y,tangent.x);
      p+=normal*aSide*aData.z/uResolution;
      gl_Position=vec4(p*2.0-1.0,0.0,1.0);
      vSide=aSide; vT=t; vSeed=aData.w; vLane=aData.y;
    }
  `;
  const fragment = `
    uniform float uTime,uReveal,uScroll;
    varying float vSide,vT,vSeed,vLane;
    void main(){
      float edge=pow(max(0.0,1.0-abs(vSide)),1.3);
      float blue=step(0.89,vSeed);
      vec3 color=mix(vec3(0.66,0.91,0.26),vec3(0.22,0.55,0.84),blue);
      float flow=0.7+0.3*sin(vT*16.0-uTime*0.65-uScroll*4.0+vSeed*23.0);
      float pulse=pow(max(0.0,sin(vT*12.0-uTime*0.8-uScroll*5.0+vSeed*43.0)),16.0);
      float intensity=(0.10+vSeed*0.18)*flow+pulse*0.12;
      // Each strand draws from the upper tip through the bend to its lower tip.
      float delay=(vLane+1.0)*0.65+vSeed*0.22;
      float head=clamp((uReveal-delay)/2.5,0.0,1.06);
      float formed=1.0-smoothstep(head-0.035,head,vT);
      gl_FragColor=vec4(color*intensity,edge*formed);
    }
  `;
  const positions=[], data=[], sides=[], indices=[];
  const strandCount=window.innerWidth<650?72:115, steps=180;
  for(let line=0;line<strandCount;line++) {
    const seed=(Math.sin(line*127.1+1)*43758.5453)%1;
    const random=seed-Math.floor(seed);
    const lane=(line/(strandCount-1)-0.5)*2;
    const size=line%13===0?1.5:0.45+random*0.7;
    const base=positions.length/3;
    for(let step=0;step<=steps;step++) for(const side of [-1,1]) {
      positions.push(0,0,0); data.push(step/steps,lane,size,random); sides.push(side);
    }
    for(let step=0;step<steps;step++) { const n=base+step*2; indices.push(n,n+1,n+2,n+1,n+3,n+2); }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aData',new T.Float32BufferAttribute(data,4));
  geometry.setAttribute('aSide',new T.Float32BufferAttribute(sides,1));
  geometry.setIndex(indices);
  const material=new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,blending:T.AdditiveBlending,depthTest:false,depthWrite:false,side:T.DoubleSide});
  const ribbons=new T.Mesh(geometry,material);ribbons.frustumCulled=false;scene.add(ribbons);
  const dustGeometry=new T.BufferGeometry();
  const dustPositions=[],dustSeeds=[];
  for(let i=0;i<90;i++){dustPositions.push(0,0,0);dustSeeds.push(i/90,Math.sin(i*73.3));}
  dustGeometry.setAttribute('position',new T.Float32BufferAttribute(dustPositions,3));
  dustGeometry.setAttribute('aSeed',new T.Float32BufferAttribute(dustSeeds,2));
  const dustMaterial=new T.ShaderMaterial({uniforms,transparent:true,blending:T.AdditiveBlending,depthTest:false,depthWrite:false,
    vertexShader:`
      attribute vec2 aSeed; uniform float uTime,uScroll,uReveal; uniform vec2 uPointer,uResolution;
      varying float vOpacity;
      ${curve}
      void main(){float t=fract(aSeed.x+uTime*0.012+uScroll*0.12);vec2 p=ribbon(t,aSeed.y*1.9,aSeed.x);
        p+=vec2(sin(aSeed.x*71.0),cos(aSeed.x*91.0))*0.035;
        gl_Position=vec4(p*2.0-1.0,0.,1.);gl_PointSize=1.4+2.2*abs(aSeed.y);
        vOpacity=sin(t*3.14159)*0.6*smoothstep(2.5,4.5,uReveal);
      }`,
    fragmentShader:`varying float vOpacity;void main(){float a=1.0-smoothstep(0.1,0.5,length(gl_PointCoord-0.5));gl_FragColor=vec4(0.78,0.95,0.5,a*vOpacity);}`
  });
  const dust=new T.Points(dustGeometry,dustMaterial);dust.frustumCulled=false;scene.add(dust);
  const targetOptions={depthBuffer:false,stencilBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter};
  const sharp=new T.WebGLRenderTarget(1,1,targetOptions);
  const blurA=new T.WebGLRenderTarget(1,1,targetOptions);
  const blurB=new T.WebGLRenderTarget(1,1,targetOptions);
  const quadGeometry=new T.PlaneGeometry(2,2);
  const quadVertex='varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }';
  const blurUniforms={source:{value:null},direction:{value:new T.Vector2()}};
  const blurMaterial=new T.ShaderMaterial({uniforms:blurUniforms,vertexShader:quadVertex,depthTest:false,depthWrite:false,fragmentShader:`
    uniform sampler2D source; uniform vec2 direction; varying vec2 vUv;
    void main(){
      vec3 c=texture2D(source,vUv).rgb*0.227027;
      c+=(texture2D(source,vUv+direction*1.384615).rgb+texture2D(source,vUv-direction*1.384615).rgb)*0.316216;
      c+=(texture2D(source,vUv+direction*3.230769).rgb+texture2D(source,vUv-direction*3.230769).rgb)*0.070270;
      gl_FragColor=vec4(c,1.);
    }
  `});
  const compositeUniforms={...uniforms,sharp:{value:sharp.texture},bloom:{value:blurB.texture}};
  const composite=new T.ShaderMaterial({uniforms:compositeUniforms,vertexShader:quadVertex,depthTest:false,depthWrite:false,fragmentShader:`
    uniform sampler2D sharp,bloom; uniform float uLight,uTime,uScroll; uniform vec2 uResolution;
    varying vec2 vUv;
    void main(){
      vec3 lines=texture2D(sharp,vUv).rgb;
      vec3 glow=texture2D(bloom,vUv).rgb;
      vec2 turn=vec2(0.367+0.008*sin(uTime*0.24),0.32-0.012*sin(uTime*0.21)+0.12*sin(uScroll*1.3));
      vec2 d=(vUv-turn)*vec2(uResolution.x/uResolution.y,1.);
      float haze=exp(-dot(d,d)*13.0);
      vec3 energy=lines*1.8+glow*3.4;
      vec3 dark=vec3(0.014,0.022,0.008)+vec3(0.12,0.16,0.025)*haze;
      dark+=energy;
      dark=1.0-exp(-dark*1.15);
      // Blue and lime overlap to produce a warm white core, as in the reference.
      float core=dot(lines,vec3(0.3,0.6,0.1));
      dark+=vec3(0.22,0.12,0.32)*pow(core,2.0);
      // Light mode uses deep sage ink rather than pale additive light.
      float ink=1.0-exp(-dot(lines,vec3(0.3,0.6,0.1))*4.0);
      float softInk=1.0-exp(-dot(glow,vec3(0.3,0.6,0.1))*1.8);
      vec3 paper=vec3(0.937,0.949,0.91)-vec3(0.035,0.025,0.05)*haze;
      vec3 light=mix(paper,vec3(0.25,0.40,0.15),softInk*0.30);
      light=mix(light,vec3(0.18,0.34,0.12),ink*0.85);
      gl_FragColor=vec4(mix(dark,light,uLight),1.0);
    }
  `});
  const quad=new T.Mesh(quadGeometry,composite);quad.frustumCulled=false;post.add(quad);
  let frame=0,last=0,time=0,lost=false;
  let targetScroll=0,scroll=0;
  const pointer=new T.Vector2(), targetPointer=new T.Vector2();
  const diagnostics={engine:'Three.js / WebGL',frames:0,meanFrameMs:0,shaderErrors:0,contextLost:false};
  canvas.ribbonDiagnostics=diagnostics;
  renderer.debug.onShaderError=()=>{ diagnostics.shaderErrors++; };
  function draw(){
    if(lost)return;
    uniforms.uTime.value=time+scroll*2.0;
    uniforms.uReveal.value=options.isPaused()?6:time;
    uniforms.uLight.value=options.isLight()?1:0;
    uniforms.uScroll.value=scroll;
    uniforms.uPointer.value.copy(pointer);
    renderer.setRenderTarget(sharp);renderer.render(scene,camera);
    quad.material=blurMaterial;
    blurUniforms.source.value=sharp.texture;blurUniforms.direction.value.set(3/sharp.width,0);
    renderer.setRenderTarget(blurA);renderer.render(post,camera);
    blurUniforms.source.value=blurA.texture;blurUniforms.direction.value.set(0,3/blurA.height);
    renderer.setRenderTarget(blurB);renderer.render(post,camera);
    quad.material=composite;
    renderer.setRenderTarget(null);renderer.render(post,camera);
    diagnostics.frames++;
    diagnostics.theme=options.isLight()?'light':'dark';
    diagnostics.time=time;
    diagnostics.scroll=scroll;
  }
  function tick(now){
    frame=0;
    if(options.isPaused()||document.hidden||lost){last=0;return;}
    const delta=last?Math.min((now-last)/1000,0.06):1/60;
    if(last)diagnostics.meanFrameMs=diagnostics.meanFrameMs*.95+(now-last)*.05;
    last=now;time+=delta;
    const ease=1-Math.exp(-delta*5);
    scroll+=(targetScroll-scroll)*ease;
    pointer.lerp(targetPointer,ease);
    draw();frame=requestAnimationFrame(tick);
  }
  function start(){if(!frame&&!options.isPaused()&&!document.hidden&&!lost)frame=requestAnimationFrame(tick);}
  function resize(){
    const w=innerWidth,h=innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<650?1:1.35));
    renderer.setSize(w,h,false);
    const ratio=Math.min(1,1500/w);
    sharp.setSize(Math.round(w*ratio),Math.round(h*ratio));
    blurA.setSize(Math.round(w*ratio/3),Math.round(h*ratio/3));blurB.setSize(blurA.width,blurA.height);
    uniforms.uResolution.value.set(w,h);
    targetScroll=Math.max(0,window.scrollY/h);scroll=targetScroll;
    draw();
  }
  function refresh(){
    if(frame){cancelAnimationFrame(frame);frame=0;last=0;}
    draw();start();
  }
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('scroll',()=>{targetScroll=Math.max(0,window.scrollY/innerHeight);if(options.isPaused()){scroll=targetScroll;draw();}},{passive:true});
  window.addEventListener('pointermove',e=>{if(!options.isPaused())targetPointer.set(e.clientX/innerWidth-.5,.5-e.clientY/innerHeight);},{passive:true});
  document.addEventListener('visibilitychange',refresh);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;diagnostics.contextLost=true;if(frame)cancelAnimationFrame(frame);frame=0;});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;diagnostics.contextLost=false;resize();start();});
  resize();start();
  return {draw,refresh,diagnostics};
};
