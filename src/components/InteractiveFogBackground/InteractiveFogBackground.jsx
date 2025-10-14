"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Blueyard風：黒背景 × 煙の軌跡 × ほのかな発光
 * - マウス周辺に“煙インク”を注入（ガウシアン）
 * - fbmノイズの流れ場でアドベクション（漂う感じ）
 * - 時間で減衰（軌跡が消えていく）
 * - 擬似ブルームでふわっと発光合成
 *
 * 置き方：ヒーローの最背面に敷くだけ
 * <InteractiveSmokeGlowBackground />
 */
export default function InteractiveSmokeGlowBackground() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);

    // ---------- Scenes / Camera / Quad ----------
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    scene.add(quad);

    // ---------- RenderTargets (Ping-Pong for trail) ----------
    const makeRT = (w, h, dpr) =>
      new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(w * dpr)),
        Math.max(1, Math.floor(h * dpr)),
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
          type: THREE.HalfFloatType in THREE ? THREE.HalfFloatType : THREE.UnsignedByteType,
          format: THREE.RGBAFormat,
        }
      );

    // ---------- Shaders ----------
    const VERT = /* glsl */`
      void main(){ gl_Position = vec4(position, 1.0); }
    `;

    // 2D fbm noise
    const NOISE = /* glsl */`
      float hash21(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
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
        for(int i=0;i<5;i++){ f+=a*n2(p); p*=2.03; a*=0.5; }
        return f;
      }
    `;

    // Step A: trail 更新（前フレームを減衰＋ノイズ流れでUVシフト＋マウス注入）
    const FRAG_UPDATE = /* glsl */`
      precision highp float;
      uniform sampler2D uPrev;   // 前フレームの蓄積
      uniform vec2 uRes;
      uniform float uTime;
      uniform vec2 uMouse;       // -1..1  (中心0)
      uniform float uPulse;      // 0..1   マウス直後の強さ
      uniform float uDecay;      // 0..1   減衰 (大きいほど速く消える)
      uniform float uFlow;       // 0..1   流速
      uniform float uFlowScale;  // 流れ場スケール
      uniform float uInkSize;    // 注入サイズ(半径)
      uniform float uInkStrength;// 注入強度
      ${NOISE}
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;

        // ノイズベクトル場（回転を持たせる）
        float t = uTime;
        vec2 p = uv * uFlowScale;
        float a = fbm(p + vec2(t*0.10, -t*0.07)) * 6.28318;
        vec2 flow = vec2(cos(a), sin(a));
        // 前フレームのサンプル位置（逆向きに少し戻る＝アドベクション）
        vec2 adv = uv - flow * (uFlow * 0.0025);

        vec4 prev = texture2D(uPrev, adv);

        // 減衰
        prev.rgb *= (1.0 - uDecay);

        // マウス注入（ガウシアン）
        vec2 m = (uMouse*vec2(1.0,-1.0))*0.5 + 0.5; // -1..1 → 0..1
        float d = distance(uv, m);
        float g = exp(- (d*d) / (uInkSize*uInkSize + 1e-6)); // 0..1
        // 注入色：中心は青シアン寄り、外縁はクリムゾン寄り
        float ring = smoothstep(0.0, 1.0, g);
        vec3 blue   = vec3(0.16, 0.45, 0.95);
        vec3 crimson= vec3(0.86, 0.18, 0.22);
        vec3 inkCol = mix(crimson, blue, ring*0.85 + 0.10);
        vec3 add = inkCol * (uInkStrength * uPulse) * g;

        gl_FragColor = vec4(prev.rgb + add, 1.0);
      }
    `;

    // Step B: 画面合成（暗い縦グラデに、トレイルを擬似ブルームで発光）
    const FRAG_COMPOSE = /* glsl */`
      precision highp float;
      uniform sampler2D uTrail;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec3  uTop;
      uniform vec3  uBottom;
      uniform float uGlow;     // 発光量
      uniform float uSoft;     // ぼかし半径係数

      vec4 tap(vec2 uv, vec2 off){
        return texture2D(uTrail, uv + off);
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;

        // ベース背景（黒〜ごく僅かな縦グラデ）
        float gy = smoothstep(0.0,1.0, uv.y);
        vec3 base = mix(uBottom, uTop, gy);
        base = mix(base, vec3(0.0), 0.85); // しっかり暗く

        // 擬似ブルーム：周囲サンプルの合計でふわっと
        float px = 1.0 / uRes.y;
        float r = uSoft * px * 24.0; // 画素基準の半径
        vec4 c = vec4(0.0);
        c += tap(uv, vec2(-r,  0.0));
        c += tap(uv, vec2( r,  0.0));
        c += tap(uv, vec2( 0.0,-r));
        c += tap(uv, vec2( 0.0, r));
        c += tap(uv, vec2(-r,-r));
        c += tap(uv, vec2( r,-r));
        c += tap(uv, vec2(-r, r));
        c += tap(uv, vec2( r, r));
        c *= 0.125; // 平均

        // 中心サンプル（芯を少し立てる）
        vec3 trail = texture2D(uTrail, uv).rgb;
        vec3 glow  = mix(c.rgb, trail, 0.35);

        // 発光合成（加算寄り）
        vec3 col = base + glow * uGlow;

        // 外縁ビネットで締める
        vec2 p = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
        float vign = smoothstep(1.10, 0.40, length(p));
        col *= vign;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    // ---------- Materials & uniforms ----------
    const uCommon = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
    };

    const updateMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_UPDATE,
      uniforms: {
        ...uCommon,
        uPrev: { value: null },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uPulse: { value: 0 },
        uDecay: { value: 0.035 },      // 0.02〜0.07
        uFlow: { value: 0.90 },        // 全体の流れ速度
        uFlowScale: { value: 2.6 },    // 流れ場スケール（細かさ）
        uInkSize: { value: 0.18 },     // 注入半径
        uInkStrength: { value: 1.2 },  // 注入強度
      },
      depthTest: false,
      depthWrite: false,
    });

    const composeMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_COMPOSE,
      uniforms: {
        ...uCommon,
        uTrail: { value: null },
        uTop: { value: new THREE.Color("#0b0f1a") },
        uBottom: { value: new THREE.Color("#030409") },
        uGlow: { value: 1.25 }, // 全体発光量（1.0〜1.6）
        uSoft: { value: 1.0 },  // ぼかし量（0.6〜1.6）
      },
      depthTest: false,
      depthWrite: false,
    });

    // ---------- Size / DPR / RT setup ----------
    let dpr = 1;
    let rtA, rtB, readRT, writeRT;

    const setSize = () => {
      const w = wrap.clientWidth || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.8);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      updateMat.uniforms.uRes.value.set(w * dpr, h * dpr);
      composeMat.uniforms.uRes.value.set(w * dpr, h * dpr);

      // RTを作り直す
      if (rtA) { rtA.dispose(); rtB.dispose(); }
      rtA = makeRT(w, h, dpr);
      rtB = makeRT(w, h, dpr);
      readRT = rtA;
      writeRT = rtB;

      // クリア
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rtA);
      renderer.clearColor();
      renderer.setRenderTarget(rtB);
      renderer.clearColor();
      renderer.setRenderTarget(prev);
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    // ---------- Interaction ----------
    let tx = 0, ty = 0; // target mouse
    const onPointer = (e) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      tx = x * 2 - 1;
      ty = 1 - y * 2;
      updateMat.uniforms.uPulse.value = 1.0; // 動かした瞬間に強め注入
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ---------- Loop ----------
    let raf = 0, t0 = performance.now();
    const SPEED = 1.0; // 時間進行倍率（0.6〜1.2）
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.033, (now - t0) / 1000);
      t0 = now;

      // 時間とインタラクションの減衰
      uCommon.uTime.value += dt * SPEED;
      const mx = updateMat.uniforms.uMouse.value.x;
      const my = updateMat.uniforms.uMouse.value.y;
      updateMat.uniforms.uMouse.value.set(
        mx + (tx - mx) * 0.12,
        my + (ty - my) * 0.12
      );
      updateMat.uniforms.uPulse.value *= 0.93;

      // --- Step A: 更新 → writeRT に描く
      quad.material = updateMat;
      updateMat.uniforms.uPrev.value = readRT.texture;
      renderer.setRenderTarget(writeRT);
      renderer.render(scene, camera);

      // swap
      const tmp = readRT; readRT = writeRT; writeRT = tmp;

      // --- Step B: 合成 → 画面へ
      quad.material = composeMat;
      composeMat.uniforms.uTrail.value = readRT.texture;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    };
    tick();

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { t0 = performance.now(); tick(); }
    };
    document.addEventListener("visibilitychange", onVis);

    // ---------- Cleanup ----------
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      ro.disconnect();
      cancelAnimationFrame(raf);
      renderer.dispose();
      quad.geometry.dispose();
      updateMat.dispose();
      composeMat.dispose();
      rtA?.dispose(); rtB?.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="smokeGlow-wrap" aria-hidden>
      <canvas ref={canvasRef} className="smokeGlow-canvas" />
      <style jsx>{`
        .smokeGlow-wrap{ position:fixed; inset:0; z-index:-2; pointer-events:none; filter: brightness(90%); }
        .smokeGlow-canvas{ width:100%; height:100%; display:block; }
      `}</style>
    </div>
  );
}