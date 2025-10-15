"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function FloralHero_Fake3D() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const debugRef = useRef(null);
  const orientation = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const tiltEnabled = useRef(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const IMG_URL   = "/images/hero/floral.jpg";
    const DEPTH_URL = "/images/hero/floral_depth.jpg";

    // three.js setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    scene.add(quad);

    const loader = new THREE.TextureLoader();
    const texImg   = loader.load(IMG_URL, onImageLoaded);
    const texDepth = loader.load(DEPTH_URL);

    texImg.colorSpace = THREE.SRGBColorSpace;
    texImg.minFilter = THREE.LinearFilter;
    texImg.magFilter = THREE.LinearFilter;
    texImg.wrapS = texImg.wrapT = THREE.ClampToEdgeWrapping;
    texImg.generateMipmaps = false;

    texDepth.minFilter = THREE.LinearFilter;
    texDepth.magFilter = THREE.LinearFilter;
    texDepth.wrapS = texDepth.wrapT = THREE.ClampToEdgeWrapping;
    texDepth.generateMipmaps = false;

    // fragment shader (object-fit: cover 対応)
    const frag = /* glsl */`
precision highp float;

uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2  uRes;
uniform vec2  uImgRes;
uniform vec2  uCoverScale;
uniform vec2  uMouse;
uniform float uTime;

uniform float uAmount;
uniform float uCenterBias;
uniform float uFalloff;
uniform float uEdgeDamp;
uniform float uBlurSigma;
uniform float uNoiseAmp;
uniform float uVign;

float gauss(float x, float s){ return exp(-(x*x)/(2.0*s*s)); }
float rand(vec2 uv){ return fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453); }

vec2 coverUV(vec2 uv, vec2 res, vec2 img){
  float rTex = img.x / img.y;
  float rCan = res.x / res.y;
  if (rCan > rTex){
    float scale = rTex / rCan;
    uv.y = (uv.y - 0.5) * scale + 0.5;
  }else{
    float scale = rCan / rTex;
    uv.x = (uv.x - 0.5) * scale + 0.5;
  }
  return uv;
}

float depthRaw(vec2 uv){ return texture2D(uDepth, uv).r; }

float depthSmooth(vec2 uv){
  vec2 px = (1.0 / uRes) / uCoverScale;
  float c = depthRaw(uv);
  float sum = 0.0, wsum = 0.0;
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 o = vec2(float(i), float(j)) * px;
      float d = depthRaw(uv + o);
      float wg = gauss(length(o * uRes), 1.0 + uBlurSigma*1.5);
      float wr = gauss(abs(d - c), 0.15 + uBlurSigma*0.15);
      float w = wg*wr;
      sum += d*w; wsum += w;
    }
  }
  return sum/max(1e-4,wsum);
}

float edge(vec2 uv){
  vec2 px = (1.0 / uRes) / uCoverScale;
  float dx = depthRaw(uv+vec2(px.x,0.0)) - depthRaw(uv-vec2(px.x,0.0));
  float dy = depthRaw(uv+vec2(0.0,px.y)) - depthRaw(uv-vec2(0.0,px.y));
  return smoothstep(0.02, 0.12, length(vec2(dx,dy)));
}

float grain(vec2 uv){
  float n = rand(uv*vec2(uRes));
  float m = rand(uv*vec2(uRes.y, uRes.x));
  return (n + m) - 1.0;
}

void main(){
  vec2 uvScr = gl_FragCoord.xy / uRes;
  vec2 uv     = coverUV(uvScr, uRes, uImgRes);
  vec2 c = uvScr - 0.5;
  float fall = 1.0 - smoothstep(0.0, uFalloff, length(c));
  vec2 m = (uMouse - 0.5) * 2.0;
  float d = depthSmooth(uv);
  float e = edge(uv);
  float damp = mix(1.0, 1.0 - e, uEdgeDamp);
  float z = (d - uCenterBias);
  vec2 parallax = m * (uAmount * z) * fall * damp;
  float g = grain(uvScr + vec2(uTime*0.015, -uTime*0.01));
  parallax += (g * 0.003) * uNoiseAmp;
  vec2 uvImg = uv + parallax;
  uvImg = mix(uvImg, clamp(uvImg, 0.0, 1.0), 0.9);
  vec3 col = texture2D(uImage, uvImg).rgb;
  float vign = smoothstep(1.0, 0.0, length(c)*1.15);
  col *= mix(1.0 - uVign, 1.0, vign);
  col = pow(col, vec3(1.0/1.03));
  float n = grain(uvScr * 1.8 + vec2(uTime * 0.25, -uTime * 0.22));
  n = smoothstep(0.4, 1.0, abs(n));
  col += n * 0.03 * uNoiseAmp;
  gl_FragColor = vec4(col, 1.0);
}
`;

    function getCoverScale(canvasW, canvasH, imgW, imgH) {
      const rTex = imgW / imgH;
      const rCan = canvasW / canvasH;
      if (rCan > rTex) return new THREE.Vector2(1, rTex / rCan);
      else return new THREE.Vector2(rCan / rTex, 1);
    }

    const uniforms = {
      uImage:      { value: texImg },
      uDepth:      { value: texDepth },
      uRes:        { value: new THREE.Vector2(1,1) },
      uImgRes:     { value: new THREE.Vector2(1,1) },
      uCoverScale: { value: new THREE.Vector2(1,1) },
      uMouse:      { value: new THREE.Vector2(0.5,0.5) },
      uTime:       { value: 0 },
      uAmount:     { value: 0.04 },
      uCenterBias: { value: 0.50 },
      uFalloff:    { value: 0.85 },
      uEdgeDamp:   { value: 0.85 },
      uBlurSigma:  { value: 1.6 },
      uNoiseAmp:   { value: 0.35 },
      uVign:       { value: 0.22 },
    };

    quad.material = new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: frag,
      uniforms,
    });

    function onImageLoaded(tex) {
      const img = tex.image;
      if (img && img.width && img.height) {
        uniforms.uImgRes.value.set(img.width, img.height);
        const w = renderer.domElement.width;
        const h = renderer.domElement.height;
        const scale = getCoverScale(w, h, img.width, img.height);
        uniforms.uCoverScale.value.copy(scale);
      }
    }

    // Size & DPR
    const setSize = () => {
      const wCss = wrap.clientWidth || window.innerWidth;
      const hCss = wrap.clientHeight || window.innerHeight;
      const dpr  = Math.min(window.devicePixelRatio || 1, 1.8);
      renderer.setPixelRatio(dpr);
      renderer.setSize(wCss, hCss, false);
      const w = Math.floor(wCss * dpr);
      const h = Math.floor(hCss * dpr);
      uniforms.uRes.value.set(w, h);
      const iw = uniforms.uImgRes.value.x;
      const ih = uniforms.uImgRes.value.y;
      if (iw > 1 && ih > 1) {
        const scale = getCoverScale(w, h, iw, ih);
        uniforms.uCoverScale.value.copy(scale);
      }
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    // mouse fallback
    let tx=0.5, ty=0.5, cx=0.5, cy=0.5;
    const onPointer = (e) => {
      const r = wrap.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top)  / r.height;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // tilt motion setup
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    function handleOrientation(e) {
      const { beta = 0, gamma = 0 } = e;
      const nx = THREE.MathUtils.clamp((gamma + 45) / 90, 0, 1);
      const ny = THREE.MathUtils.clamp((beta + 45) / 90, 0, 1);
      tx = nx;
      ty = ny;
    }

    async function enableMotion() {
      try {
        if (isIOS && typeof DeviceMotionEvent !== "undefined" &&
            typeof DeviceMotionEvent.requestPermission === "function") {
          await DeviceMotionEvent.requestPermission().catch(()=>{});
        }
        if (isIOS && typeof DeviceOrientationEvent !== "undefined" &&
            typeof DeviceOrientationEvent.requestPermission === "function") {
          const s = await DeviceOrientationEvent.requestPermission();
          if (s !== "granted") throw new Error("Orientation permission denied");
        }
        window.addEventListener("deviceorientation", handleOrientation, true);
        tiltEnabled.current = true;
      } catch (err) {
        console.warn("[tilt] permission error:", err);
      }
    }

    function attachGestureOnce() {
      const handler = () => {
        enableMotion();
        detach();
      };
      const events = ["pointerdown", "touchstart", "mousedown", "keydown"];
      function detach() { events.forEach(ev=>window.removeEventListener(ev, handler, opts)); }
      const opts = { once: true, passive: true };
      events.forEach(ev=>window.addEventListener(ev, handler, opts));
      return detach;
    }

    let detachGesture = null;
    if (isIOS) {
      detachGesture = attachGestureOnce();
    } else {
      window.addEventListener("deviceorientation", handleOrientation, true);
      tiltEnabled.current = true;
    }

    // render loop
    let raf=0, t0=performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt  = Math.min(0.033, (now - t0)/1000); t0 = now;
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      const autoX = 0.5 + 0.01*Math.sin(now*0.0004);
      const autoY = 0.5 + 0.01*Math.cos(now*0.00033);
      uniforms.uMouse.value.set(
        THREE.MathUtils.lerp(cx, autoX, 0.18),
        THREE.MathUtils.lerp(cy, autoY, 0.18)
      );
      uniforms.uTime.value += dt;
      renderer.render(scene, camera);
    };
    tick();

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { t0 = performance.now(); tick(); }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      detachGesture?.();
      ro.disconnect();
      cancelAnimationFrame(raf);
      renderer.dispose();
      quad.geometry.dispose();
      quad.material?.dispose();
      texImg.dispose?.();
      texDepth.dispose?.();
    };
  }, []);

  return (
    <div ref={wrapRef} className="floral-fake3d-wrap" aria-hidden>
      <canvas ref={canvasRef} className="floral-fake3d-canvas" />
      <style jsx>{`
        .floral-fake3d-wrap {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:#000;
          pointer-events:none;
        }
        .floral-fake3d-canvas {
          width:100%;
          height:100%;
          display:block;
        }
      `}</style>
    </div>
  );
}