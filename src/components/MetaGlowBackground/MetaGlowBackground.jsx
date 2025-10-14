"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function MetaGlowBackground() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    scene.add(quad);

    const frag = /* glsl */`
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;

/* ---- Palette (inky) ---- */
uniform vec3  uBaseA;      // very dark blue-black
uniform vec3  uBaseB;      // deep indigo
uniform vec3  uInkCyan;    // glow cyan
uniform vec3  uInkBlue;    // deep blue
uniform vec3  uInkMagenta; // magenta
uniform vec3  uInkCrimson; // crimson

/* ---- Look controls ---- */
uniform float uMixCool;    // 0..1 base blend
uniform float uGlow;       // ★ 全体バックグローの強さ
uniform float uFresPow;    // fresnel power
uniform float uCoreScale;  // smaller = hotter core
uniform float uVeinAmp;    // color modulation amount
uniform float uVeinScale;  // fbm scale
uniform float uDetailAmp;  // ★ bump amount（ザラつく場合は下げる）
uniform float uSpecPow;    // specular power
uniform float uSpecGain;   // specular gain
uniform float uAOBoost;    // ambient occlusion boost

/* ---- lightweight noise ---- */
float hash(vec2 p){ p = fract(p*0.3183099+vec2(0.71,0.113)); return fract(13.545317*p.x*p.y); }
float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p);
  vec2 u=f.xy*f.xy*(3.0-2.0*f.xy);
  float n000=hash(i.xy);
  float n100=hash(i.xy+vec2(1.,0.));
  float n010=hash(i.xy+vec2(0.,1.));
  float n110=hash(i.xy+vec2(1.,1.));
  float a=mix(mix(n000,n100,u.x),mix(n010,n110,u.x),u.y);
  return mix(a, hash(i.xy), f.z);
}
float fbm(vec3 p){
  // 帯域高めを抑えるため、4oct・減衰強め
  float a=0.55, f=0.0;
  for(int i=0;i<4;i++){ f += a*noise(p); p*=2.02; a*=0.5; }
  return f;
}
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

/* ---- metaball field ---- */
float sdf(vec3 p, float t){
  vec3 q = p;
  q.x += 0.34*sin(t*0.60 + p.y*0.70);
  q.y += 0.30*sin(t*0.50 + p.z*0.85);
  q.z += 0.28*sin(t*0.45 + p.x*0.95);

  vec3 c1 = vec3( 0.92*sin(t*0.70),  0.62*cos(t*0.50), 0.00);
  vec3 c2 = vec3(-0.82*cos(t*0.40),  0.74*sin(t*0.65), 0.22);
  vec3 c3 = vec3( 0.00,             -0.94*sin(t*0.55),-0.68*cos(t*0.33));

  float d1 = length(q - c1) - 0.92;
  float d2 = length(q - c2) - 0.86;
  float d3 = length(q - c3) - 0.78;

  float k = 0.70;
  float d = smin(smin(d1, d2, k), d3, k);

  // surface swell（ややソフト）
  float swell = (fbm(q*1.6 + t*0.6) - 0.5);
  d += swell * 0.065; // 0.08 → 0.065

  return d;
}

vec3 getNormal(vec3 p, float t){
  // 法線の差分をやや広げると微小ノイズを拾いにくくなる
  float e = 0.0024; // 0.0020 → 0.0024
  vec2 h = vec2(1.0, -1.0)*0.5773;
  return normalize( h.xyy * sdf(p + h.xyy*e, t)
                  + h.yyx * sdf(p + h.yyx*e, t)
                  + h.yxy * sdf(p + h.yxy*e, t)
                  + h.xxx * sdf(p + h.xxx*e, t) );
}

/* detail normal from fbm gradient — スムーズ化 */
vec3 detailNormal(vec3 p, float t){
  // サンプル間隔を広げて高周波を抑制
  float e = 0.030; // 0.015 → 0.030
  float n0 = fbm(p*uVeinScale + t*0.45);
  float nx = fbm((p+vec3(e,0.,0.))*uVeinScale + t*0.45);
  float ny = fbm((p+vec3(0.,e,0.))*uVeinScale + t*0.45);
  float nz = fbm((p+vec3(0.,0.,e))*uVeinScale + t*0.45);
  return normalize(vec3(nx-n0, ny-n0, nz-n0));
}

/* simple AO */
float ao(vec3 p, vec3 n, float t){
  float occ = 0.0;
  float step = 0.06;
  float w = 1.0;
  for(int i=1;i<=5;i++){
    float h = float(i)*step;
    float d = sdf(p + n*h, t);
    occ += (h - max(0.0, d)) * w;
    w *= 0.85;
  }
  return 1.0 - clamp(occ, 0.0, 1.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float t = uTime;

  // camera (slight mouse sway)
  vec3 ro = vec3(0.0, 0.0, 3.25);
  vec2 m = uMouse * 0.35;
  vec3 fw = normalize(vec3(0.0, 0.0, -1.0));
  mat3 Rx = mat3(1.0,0.0,0.0, 0.0,cos(m.x),-sin(m.x), 0.0,sin(m.x),cos(m.x));
  mat3 Ry = mat3(cos(m.y),0.0,sin(m.y), 0.0,1.0,0.0, -sin(m.y),0.0,cos(m.y));
  fw = normalize(Rx * Ry * fw);
  vec3 rt = normalize(cross(fw, vec3(0.0,1.0,0.0)));
  vec3 up = normalize(cross(rt, fw));
  vec3 rd = normalize(uv.x*rt + uv.y*up + 1.6*fw);

  // march + glow accumulation
  float dist = 0.0;
  float d;
  vec3  p;
  bool  hit = false;
  float maxDist = 6.0;
  float eps     = 0.0020;   // 0.0016 → 0.0020（微振れ抑制）

  float glowAcc = 0.0;

  for(int i=0;i<110;i++){
    p = ro + rd * dist;
    d = sdf(p, t);

    float nd    = abs(d);
    // ★ グロー半径を少し拡げ、フォールも緩め
    float nearS = smoothstep(0.14, 0.0, nd);   // 0.13 → 0.14（柔らかい芯）
    float fall  = 1.0 / (1.0 + dist*dist*0.25); // 0.28 → 0.25（伸ばす）
    glowAcc += nearS * fall * 0.07;

    if (nd < eps){ hit = true; break; }
    // ★ 最小ステップを上げて（0.010）、高周波の引っ掛かりを抑える
    dist += clamp(d, 0.010, 0.20); // 0.006–0.24 → 0.010–0.20
    if (dist > maxDist) break;
  }

  vec3 col = vec3(0.0);

  if (hit){
    vec3 n  = getNormal(p, t);
    vec3 dn = detailNormal(p, t);
    // ★ ディテール法線のブレンドを弱める（0.9 → 0.65）
    n = normalize(mix(n, normalize(n + dn*uDetailAmp), 0.65));

    vec3 v = normalize(ro - p);
    vec3 l = normalize(vec3(0.25, 0.85, 0.55));
    vec3 hh = normalize(l + v);

    float diff = clamp(dot(n,l), 0.0, 1.0);
    float fres = pow(1.0 - max(dot(n,v), 0.0), uFresPow);

    // vertical inky lanes（しきい値をワイドに）
    float lanes    = fbm(vec3(p.x*0.6, p.y*2.2, p.z*0.6) + vec3(0.0, t*0.35, 0.0));
    float laneMask = smoothstep(0.28, 0.88, lanes); // 0.35–0.9 → 0.28–0.88

    float core = 1.0 - smoothstep(1.6, uCoreScale, length(p));
    float ang  = atan(p.y, p.x);
    float side = smoothstep(-0.6, 0.6, sin(ang*1.0 + lanes*2.2)); // 0=blue,1=red

    vec3 baseTone = mix(uBaseA, uBaseB, uMixCool);

    float blueMix = clamp(0.2 + 0.6*core + 0.2*laneMask, 0.0, 1.0);
    vec3  blueInk = mix(uInkCyan, uInkBlue, blueMix);

    float redMix  = clamp(0.25 + 0.65*core + 0.35*laneMask, 0.0, 1.0);
    vec3  redInk  = mix(uInkMagenta, uInkCrimson, redMix);

    vec3 inkCol = mix(blueInk, redInk, side);

    vec3 base = mix(baseTone, inkCol, clamp(0.15 + 0.85*core, 0.0, 1.0));
    col = base * (0.18 + 0.82*diff);
    // フレネルも彩度の高い inkCol を使用 → 縁を滑らかに
    col += inkCol * fres * 0.95; // 1.0 → 0.95（にじみ重視）

    // veins（ワイド＆弱め）
    float veins = fbm(p * uVeinScale + t*0.5);
    veins = smoothstep(0.30, 0.70, veins); // 0.35–0.65 → 0.30–0.70
    col = mix(col, inkCol, veins * uVeinAmp * 0.20); // 0.24 → 0.20

    // ハイライト（少し柔らかく）
    float spec = pow(max(dot(n,hh),0.0), uSpecPow) * uSpecGain;
    col += vec3(0.92,0.98,1.0) * spec;

    // 厚み発光（縁のボワッ）
    float s1 = sdf(p - n*0.055, t);
    float s2 = sdf(p - n*0.12,  t);
    float thickness = smoothstep(-0.28, 0.0, -min(s1, s2));
    col += inkCol * thickness * 0.24; // 0.22 → 0.24（★強めたいときに上げる）

    // さらに縁のソフトハロ
    col += mix(uBaseA,uBaseB,uMixCool) * smoothstep(0.08,0.0,abs(d)) * 0.10;

    col *= pow(ao(p, n, t), uAOBoost);
  } else {
    float halo = smoothstep(0.10, 0.0, abs(d));
    vec3 tone = mix(uBaseA,uBaseB,uMixCool);
    col = tone * halo * 0.05;
  }

  // ★ 全体バックグロー（最も効くノブは uGlow）
  vec3 glowTone = mix(uBaseA, uBaseB, uMixCool);
  vec3 glowCol  = mix(glowTone, uInkCyan, 0.25) * glowAcc * uGlow;

  // ビネット
  float r = length(uv);
  float vign = smoothstep(1.18, 0.28, r);
  col = col * vign + glowCol;

  gl_FragColor = vec4(col, 1.0);
}
    `;

    const uniforms = {
      uRes:   { value: new THREE.Vector2(1, 1) },
      uTime:  { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },

      // very dark base
      uBaseA:      { value: new THREE.Color("#07090E") },
      uBaseB:      { value: new THREE.Color("#0B1120") },

      // inky primaries (blue〜crimson)
      uInkCyan:    { value: new THREE.Color("#6EC9FF") },
      uInkBlue:    { value: new THREE.Color("#123A80") },
      uInkMagenta: { value: new THREE.Color("#C12B5E") },
      uInkCrimson: { value: new THREE.Color("#7A0E2A") },

      // look (滑らか寄りの既定値)
      uMixCool:   { value: 0.35 },
      uGlow:      { value: 1.40 }, // ★発光を強めたい → 1.4〜1.8 へ
      uFresPow:   { value: 2.6 },
      uCoreScale: { value: 0.32 },
      uVeinAmp:   { value: 0.90 }, // 0.95 → 0.90
      uVeinScale: { value: 2.0 },  // 2.2 → 2.0（細かさをやや抑制）
      uDetailAmp: { value: 0.20 }, // 0.9 → 0.70（★ザラつくならさらに下げる）
      uSpecPow:   { value: 32.0 }, // 36 → 32（ハイライトも少しやわらかく）
      uSpecGain:  { value: 0.18 }, // 0.20 → 0.18
      uAOBoost:   { value: 1.25 },
    };

    quad.material = new THREE.ShaderMaterial({
      fragmentShader: frag,
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      uniforms,
    });

    // size / DPR
    const setSize = () => {
      const w = wrap.clientWidth || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    // mouse sway
    let targetX = 0, targetY = 0;
    const onPointer = (e) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top)  / r.height;
      targetX = x * 2 - 1;
      targetY = 1 - y * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // loop
    let raf = 0, t0 = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      t0 = now;

      const auto = Math.sin(now*0.00025)*0.25;
      uniforms.uMouse.value.x += ((targetX*0.9 + auto) - uniforms.uMouse.value.x) * 0.06;
      uniforms.uMouse.value.y += ((targetY*0.9)            - uniforms.uMouse.value.y) * 0.06;

      uniforms.uTime.value = now * 0.0015;
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
      ro.disconnect();
      cancelAnimationFrame(raf);
      renderer.dispose();
      quad.geometry.dispose();
      quad.material.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="metaGlow-wrap" aria-hidden>
      <canvas ref={canvasRef} className="metaGlow-canvas" />
      <style jsx>{`
        .metaGlow-wrap { position: fixed; inset: 0; z-index: -1; pointer-events: none; mix-blend-mode: screen; }
        .metaGlow-canvas { width: 100%; height: 100%; display: block; }
      `}</style>
    </div>
  );
}