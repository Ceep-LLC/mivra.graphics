"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * マウス/タッチに追従して「染料（インク）」を落とし、
 * 時間でワープ＋ブラー＋ディケイして混ざり消えるオーバーレイ。
 *
 * 使い方：ヒーローの上に置く（position:fixed, pointer-events:none）
 *
 * props:
 *  - intensity:      インク明るさ（0.6〜1.6）
 *  - decay:          時間減衰（0.90〜0.995）※画面リフレッシュ毎に乗算
 *  - blur:           ぼかし量（0.0〜1.0）
 *  - flowAmp:        ワープ強度（0.0〜1.0）
 *  - splatRadius:    しぶき半径の基準（ピクセル基準のスケール）
 *  - chroma:         青↔赤の配色比（0=青寄り,1=赤寄り）※速度で自動バイアスもあり
 *  - maxFPS:         省電力のための上限FPS（例: 60/48/30）
 */
export default function InkMixOverlay({
  intensity   = 1.1,
  decay       = 0.976,
  blur        = 0.35,
  flowAmp     = 0.22,
  flowScale   = 2.0,
  splatRadius = 80,     // 基準半径(px)
  chroma      = 0.5,    // 基本の色バランス
  maxFPS      = 60,
} = {}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    // シーン（フルスクリーンクアッド x 1）
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(quad);

    // 16Fでなめらかに
    const makeRT = (w, h) =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        colorSpace: THREE.SRGBColorSpace,
      });

    // 画面サイズ & RT
    let dpr = 1, vw = 1, vh = 1;
    let rtA, rtB; // ping-pong
    const resizeRT = () => {
      const w = wrap.clientWidth || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      vw = Math.max(1, Math.floor(w * dpr));
      vh = Math.max(1, Math.floor(h * dpr));
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      rtA?.dispose();
      rtB?.dispose();
      rtA = makeRT(vw, vh);
      rtB = makeRT(vw, vh);

      evolveMat.uniforms.uRes.value.set(vw, vh);
      composeMat.uniforms.uRes.value.set(vw, vh);
      splatMat.uniforms.uRes.value.set(vw, vh);

      // 初期は真っ黒（染料なし）
      renderer.setRenderTarget(rtA);
      renderer.clearColor();
      renderer.setRenderTarget(rtB);
      renderer.clearColor();
      renderer.setRenderTarget(null);
    };

    // ==== GLSL ユーティリティ ====
    const NOISE = /* glsl */`
      float hash21(vec2 p){ p=fract(p*vec2(123.34, 456.21)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
      float n2(vec2 p){
        vec2 i=floor(p), f=fract(p);
        vec2 u=f*f*(3.0-2.0*f);
        float a=hash21(i+vec2(0,0));
        float b=hash21(i+vec2(1,0));
        float c=hash21(i+vec2(0,1));
        float d=hash21(i+vec2(1,1));
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float f=0.0, a=0.5;
        for(int i=0;i<4;i++){ f+=a*n2(p); p*=2.03; a*=0.5; }
        return f;
      }
    `;

    // ==== evolve: 前フレームの染料を「ワープ＋ブラー＋減衰」 ====
    const evolveFrag = /* glsl */`
      precision highp float;
      uniform sampler2D tDye;
      uniform vec2  uRes;
      uniform float uTime;
      uniform float uDecay;
      uniform float uBlur;     // 0..1
      uniform float uFlowAmp;  // 0..1
      uniform float uFlowScale;

      ${NOISE}

      vec4 tap(vec2 uv, vec2 off){
        return texture2D(tDye, uv + off);
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;

        // 緩い流れ（ノイズで擬似アドベクション）
        vec2 flow = vec2(
          fbm(uv*uFlowScale + vec2(uTime*0.07, 0.0)) - 0.5,
          fbm(uv*(uFlowScale*1.12) + vec2(0.0, uTime*0.08)) - 0.5
        ) * (0.02 + 0.08*uFlowAmp);

        vec2 px = 1.0 / uRes;
        float r = mix(0.0, 2.5, uBlur); // ブラー半径（画素基準）
        vec2 o = px * r;

        // ガウシアン風の7tap
        vec4 c =
            tap(uv + flow,         vec2(0.0))      * 0.36 +
            tap(uv + flow,  vec2( o.x,  0.0))      * 0.12 +
            tap(uv + flow,  vec2(-o.x,  0.0))      * 0.12 +
            tap(uv + flow,  vec2( 0.0,  o.y))      * 0.12 +
            tap(uv + flow,  vec2( 0.0, -o.y))      * 0.12 +
            tap(uv + flow,  vec2( o.x,  o.y))      * 0.08 +
            tap(uv + flow,  vec2(-o.x, -o.y))      * 0.08;

        // 減衰
        c.rgb *= uDecay;

        gl_FragColor = c;
      }
    `;

    const evolveMat = new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: evolveFrag,
      uniforms: {
        tDye:      { value: null },
        uRes:      { value: new THREE.Vector2(1,1) },
        uTime:     { value: 0 },
        uDecay:    { value: decay },
        uBlur:     { value: blur },
        uFlowAmp:  { value: flowAmp },
        uFlowScale:{ value: flowScale },
      },
      depthWrite: false,
      depthTest: false,
      transparent: false,
    });

    // ==== splat: ポインタ位置に“染料”を描き足す ====
    const splatFrag = /* glsl */`
      precision highp float;
      uniform sampler2D tDye;
      uniform vec2  uRes;
      uniform vec2  uPoint;     // px座標
      uniform float uRadiusPx;  // 半径 px
      uniform vec3  uColor;
      uniform float uStrength;

      void main(){
        vec2 uv  = gl_FragCoord.xy / uRes;
        vec4 src = texture2D(tDye, uv);

        // 距離（px基準）
        vec2  p  = gl_FragCoord.xy;
        float d  = length(p - uPoint);

        // ガウシアン
        float r  = max(uRadiusPx, 1.0);
        float g  = exp(- (d*d) / (2.0 * r*r));

        vec3 add = uColor * (g * uStrength);
        gl_FragColor = vec4(src.rgb + add, 1.0);
      }
    `;

    const splatMat = new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: splatFrag,
      uniforms: {
        tDye:      { value: null },
        uRes:      { value: new THREE.Vector2(1,1) },
        uPoint:    { value: new THREE.Vector2(-9999, -9999) },
        uRadiusPx: { value: 40 },
        uColor:    { value: new THREE.Color(1,1,1) },
        uStrength: { value: 1.0 },
      },
      depthWrite: false,
      depthTest: false,
      transparent: false,
    });

    // ==== compose: 画面に合成（発光っぽくトーン調整） ====
    const composeFrag = /* glsl */`
      precision highp float;
      uniform sampler2D tDye;
      uniform vec2  uRes;
      uniform float uIntensity;

      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec3 c  = texture2D(tDye, uv).rgb;

        // ソフトトーンマッピング＆少しだけ発光
        vec3 glow = c * uIntensity;
        glow = glow / (1.0 + glow);      // Reinhard
        glow += c * 0.35 * uIntensity;   // 擬似ブルーム寄せ

        // ビネット弱
        vec2 p = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
        float v = smoothstep(1.2, 0.2, length(p));
        vec3 outc = glow * v;

        gl_FragColor = vec4(outc, 1.0);
      }
    `;

    const composeMat = new THREE.ShaderMaterial({
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: composeFrag,
      uniforms: {
        tDye:      { value: null },
        uRes:      { value: new THREE.Vector2(1,1) },
        uIntensity:{ value: intensity },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending, // 背景（ヒーロー）に“光として”重なる
    });

    // 初期サイズ確定
    const setSize = () => {
      resizeRT();
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    // ===== 入力（マウス/タッチ）→ スプラットキュー =====
    let lastX = 0, lastY = 0, hasLast = false;
    let lastT = 0;
    const splatQueue = []; // {x,y, radius, color:[r,g,b], strength}

    const toPx = (e) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) * dpr;
      const y = (e.clientY - r.top)  * dpr;
      return { x, y };
    };

    const addSplat = (x, y, vx, vy) => {
      // 速度から色バイアス（青↔赤）を少し決める
      const speed = Math.min(1.0, Math.sqrt(vx*vx + vy*vy) / (800*dpr));
      const bias  = THREE.MathUtils.clamp(chroma + (vy>=0?1:-1)*speed*0.25, 0, 1);
      const blue    = new THREE.Color("#3AA7FF");
      const crimson = new THREE.Color("#E03A4E");
      const col = blue.clone().lerp(crimson, bias);

      // 半径も速度でスケール
      const rad = splatRadius * (0.7 + speed*0.9);

      // 強さ（ちょい強め→時間で減衰するのでOK）
      const strength = 1.2 * (0.6 + speed*0.8);

      splatQueue.push({
        x, y, radius: rad, color: col, strength
      });
    };

    const onMove = (e) => {
      const { x, y } = toPx(e);
      const now = performance.now();
      if (!hasLast) {
        lastX = x; lastY = y; lastT = now; hasLast = true;
        return;
      }
      const dt = Math.max(1, now - lastT);
      const vx = (x - lastX) / dt; // px/ms
      const vy = (y - lastY) / dt;
      addSplat(x, y, vx, vy);
      lastX = x; lastY = y; lastT = now;
    };

    const onDown = (e) => {
      hasLast = false;
      const { x, y } = toPx(e);
      // タップ時にも1発落とす
      addSplat(x, y, 0, 0);
    };

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });

    // ===== ループ（最大FPS制御）=====
    const frameInterval = 1000 / Math.max(24, Math.min(120, maxFPS));
    let raf = 0, acc = 0, tPrev = performance.now();

    const renderTo = (target, material, inputTex) => {
      quad.material = material;
      if (inputTex) material.uniforms.tDye.value = inputTex.texture;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const tNow = performance.now();
      const dt   = tNow - tPrev; tPrev = tNow;
      acc += dt;
      if (acc < frameInterval) return;
      acc = 0;

      // evolve（rtA -> rtB）
      evolveMat.uniforms.uTime.value = tNow * 0.001;
      evolveMat.uniforms.tDye.value  = rtA.texture;
      renderTo(rtB, evolveMat);

      // queued splats を rtB 上に書き足す（数件まとめて）
      if (splatQueue.length) {
        renderer.setRenderTarget(rtB);
        for (let i=0; i<splatQueue.length; i++){
          const s = splatQueue[i];
          splatMat.uniforms.tDye.value      = rtB.texture;
          splatMat.uniforms.uPoint.value.set(s.x, s.y);
          splatMat.uniforms.uRadiusPx.value = s.radius;
          splatMat.uniforms.uColor.value    = s.color;
          splatMat.uniforms.uStrength.value = s.strength;
          quad.material = splatMat;
          renderer.render(scene, camera);
        }
        renderer.setRenderTarget(null);
        splatQueue.length = 0;
      }

      // ping-pong swap
      const tmp = rtA; rtA = rtB; rtB = tmp;

      // compose（画面へ）
      composeMat.uniforms.tDye.value = rtA.texture;
      quad.material = composeMat;
      renderer.render(scene, camera);
    };
    tick();

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { tPrev = performance.now(); acc = 0; tick(); }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      quad.geometry.dispose();
      evolveMat.dispose();
      composeMat.dispose();
      splatMat.dispose();
      rtA?.dispose();
      rtB?.dispose();
    };
  }, [intensity, decay, blur, flowAmp, flowScale, splatRadius, chroma, maxFPS]);

  return (
    <div ref={wrapRef} className="inkMix-wrap" aria-hidden>
      <canvas ref={canvasRef} className="inkMix-canvas" />
      <style jsx>{`
        .inkMix-wrap   { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
        .inkMix-canvas { width: 100%; height: 100%; display: block; }
      `}</style>
    </div>
  );
}