"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function FloralHero_Fake3D() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // 画像パス（必要に応じて変更）
    const IMG_URL   = "/images/hero/floral.jpg";
    const DEPTH_URL = "/images/hero/floral_depth.jpg";

    // ---- three setup ----
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

    // テクスチャ
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

    // ---- fragment shader（object-fit:cover 対応）----
    const frag = /* glsl */`
precision highp float;

uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2  uRes;          // (canvas width,height)*dpr
uniform vec2  uImgRes;       // 画像の実サイズ(px)
uniform vec2  uCoverScale;   // cover時のUVスケール（片方<=1）
uniform vec2  uMouse;        // 0..1
uniform float uTime;

// チューニング用
uniform float uAmount;      // 視差量（0.03〜0.10）
uniform float uCenterBias;  // 深度中心の補正（0.45〜0.55）
uniform float uFalloff;     // 画面端ほど弱く（0.4〜1.2）
uniform float uEdgeDamp;    // エッジ減衰の強さ（0〜1）
uniform float uBlurSigma;   // 深度ぼかし（1.2〜2.2）
uniform float uNoiseAmp;    // 微細なゆらぎ（0〜0.6）
uniform float uVign;        // ビネット（0〜0.5）

// ---- helpers ----
float gauss(float x, float s){ return exp(-(x*x)/(2.0*s*s)); }
float rand(vec2 uv){
  return fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453);
}

// object-fit: cover 相当のUV
vec2 coverUV(vec2 uv, vec2 res, vec2 img){
  float rTex = img.x / img.y;
  float rCan = res.x / res.y;
  if (rCan > rTex){
    // canvas の方が横長 → Yを縮める（上下トリミング）
    float scale = rTex / rCan; // <= 1
    uv.y = (uv.y - 0.5) * scale + 0.5;
  }else{
    // canvas の方が縦長 → Xを縮める（左右トリミング）
    float scale = rCan / rTex; // <= 1
    uv.x = (uv.x - 0.5) * scale + 0.5;
  }
  return uv;
}

// 3x3 の簡易バイラテラル（coverスケール補正込）
float depthRaw(vec2 uv){ return texture2D(uDepth, uv).r; }

float depthSmooth(vec2 uv){
  // cover で片軸が縮んでいる → 1px相当のUVステップを補正
  vec2 px = (1.0 / uRes) / uCoverScale;
  float c = depthRaw(uv);
  float sum = 0.0, wsum = 0.0;
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 o = vec2(float(i), float(j)) * px;
      float d = depthRaw(uv + o);
      float wg = gauss(length(o * uRes), 1.0 + uBlurSigma*1.5); // 画素距離ベース
      float wr = gauss(abs(d - c), 0.15 + uBlurSigma*0.15);
      float w = wg*wr;
      sum += d*w; wsum += w;
    }
  }
  return sum/max(1e-4,wsum);
}

// 深度勾配（境界検出）— px補正あり
float edge(vec2 uv){
  vec2 px = (1.0 / uRes) / uCoverScale;
  float dx = depthRaw(uv+vec2(px.x,0.0)) - depthRaw(uv-vec2(px.x,0.0));
  float dy = depthRaw(uv+vec2(0.0,px.y)) - depthRaw(uv-vec2(0.0,px.y));
  return smoothstep(0.02, 0.12, length(vec2(dx,dy)));
}

// 三角分布ノイズ（0±）
float grain(vec2 uv){
  float n = rand(uv*vec2(uRes));
  float m = rand(uv*vec2(uRes.y, uRes.x));
  return (n + m) - 1.0;
}

void main(){
  vec2 uvScr = gl_FragCoord.xy / uRes;         // スクリーンUV（0..1）
  vec2 uv     = coverUV(uvScr, uRes, uImgRes); // cover適用UV

  // 画面端ほど減衰（飛び出し抑制）
  vec2 c = uvScr - 0.5;
  float fall = 1.0 - smoothstep(0.0, uFalloff, length(c));

  // マウス（-1..1）
  vec2 m = (uMouse - 0.5) * 2.0;

  // 深度（境界なめらか＆エッジ軽減）- coverUV後の座標で
  float d = depthSmooth(uv);
  float e = edge(uv);
  float damp = mix(1.0, 1.0 - e, uEdgeDamp);

  // 視差（Fake3D の肝：深度でUVを押す）
  float z = (d - uCenterBias);
  vec2 parallax = m * (uAmount * z) * fall * damp;

  // 微細なゆらぎ（ゆっくり・弱く）
  float g = grain(uvScr + vec2(uTime*0.015, -uTime*0.01));
  parallax += (g * 0.003) * uNoiseAmp;

  vec2 uvImg = uv + parallax;
  // cover領域から極端に外れないようソフトクランプ
  uvImg = mix(uvImg, clamp(uvImg, 0.0, 1.0), 0.9);

  vec3 col = texture2D(uImage, uvImg).rgb;

  // ほんのりビネット + ガンマ微調整
  float vign = smoothstep(1.0, 0.0, length(c)*1.15);
  col *= mix(1.0 - uVign, 1.0, vign);
  col = pow(col, vec3(1.0/1.03));

  // 粒子状ノイズ（砂嵐っぽさ）
  float n = grain(uvScr * 1.8 + vec2(uTime * 0.25, -uTime * 0.22));
  n = smoothstep(0.4, 1.0, abs(n));
  col += n * 0.03 * uNoiseAmp;

  gl_FragColor = vec4(col, 1.0);
}
    `;

    // カバー用スケール計算（JS側でも算出して渡す）
    function getCoverScale(canvasW, canvasH, imgW, imgH) {
      const rTex = imgW / imgH;
      const rCan = canvasW / canvasH;
      // どちらかの軸が縮む（<=1）
      if (rCan > rTex) {
        // 横が広い → Yを縮める
        return new THREE.Vector2(1, rTex / rCan);
      } else {
        // 縦が高い → Xを縮める
        return new THREE.Vector2(rCan / rTex, 1);
      }
    }

    const uniforms = {
      uImage:      { value: texImg },
      uDepth:      { value: texDepth },
      uRes:        { value: new THREE.Vector2(1,1) },
      uImgRes:     { value: new THREE.Vector2(1,1) },
      uCoverScale: { value: new THREE.Vector2(1,1) },
      uMouse:      { value: new THREE.Vector2(0.5,0.5) },
      uTime:       { value: 0 },

      // “雰囲気重視・自然”の初期値
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

    // 画像ロード後に実寸を反映
    function onImageLoaded(tex) {
      const img = tex.image;
      if (img && img.width && img.height) {
        uniforms.uImgRes.value.set(img.width, img.height);
        // 既にcanvasサイズが入っているなら coverScale を更新
        const w = renderer.domElement.width;
        const h = renderer.domElement.height;
        const scale = getCoverScale(w, h, img.width, img.height);
        uniforms.uCoverScale.value.copy(scale);
      }
    }

    // ---- サイズ & DPR ----
    const setSize = () => {
      const wCss = wrap.clientWidth || window.innerWidth;
      const hCss = wrap.clientHeight || window.innerHeight;
      const dpr  = Math.min(window.devicePixelRatio || 1, 1.8);
      renderer.setPixelRatio(dpr);
      renderer.setSize(wCss, hCss, false);
      const w = Math.floor(wCss * dpr);
      const h = Math.floor(hCss * dpr);
      uniforms.uRes.value.set(w, h);

      // 画像サイズが既知なら coverScale 更新
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

    // ---- マウス慣性（控えめ） ----
    let tx=0.5, ty=0.5, cx=0.5, cy=0.5;
    const onPointer = (e) => {
      const r = wrap.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top)  / r.height;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ---- ループ ----
    let raf=0, t0=performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt  = Math.min(0.033, (now - t0)/1000); t0 = now;

      // 慣性 + 微自動ゆらぎ
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

    // ---- cleanup ----
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
      if (quad.material) quad.material.dispose();
      texImg.dispose?.();
      texDepth.dispose?.();
    };
  }, []);

  return (
    <div ref={wrapRef} className="floral-fake3d-wrap" aria-hidden>
      <canvas ref={canvasRef} className="floral-fake3d-canvas" />
      <style jsx>{`
        .floral-fake3d-wrap { position: fixed; inset: 0; z-index: -1; background:#000; pointer-events:none; }
        .floral-fake3d-canvas { width:100%; height:100%; display:block; }
      `}</style>
    </div>
  );
}