"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function WebGLLuminance() {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uColorCore: { value: new THREE.Color("#7aa8ff") },   // 中心
    uColorGlow: { value: new THREE.Color("#ff66aa") },   // グロー
    uGlowStrength: { value: 0.85 },                      // 全体の光量
    uNoiseAmp: { value: 0.03 },                          // 微かな瞬き（形は変形しない）
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ----- Renderer -----
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // ----- Scene / Camera / Quad -----
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(camera);

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vPos;

        uniform vec2  uResolution;
        uniform float uTime;
        uniform vec3  uColorCore;
        uniform vec3  uColorGlow;
        uniform float uGlowStrength;
        uniform float uNoiseAmp;

        // --- 最小シンプルなノイズ（形は動かさず色味だけ微振動） ---
        float hash(vec2 p){
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f*f*(3.0 - 2.0*f);
          return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
        }

        // 距離関数：静的な球（変形しない）
        float sdSphere(vec3 p, float r){ return length(p) - r; }

        // Raymarch
        float mapScene(vec3 p){
          return sdSphere(p, 0.82); // 半径固定：発光体は変形しない
        }

        void main(){
          // 正規化座標
          vec2 uv = vPos;
          uv.x *= uResolution.x / uResolution.y;

          // カメラ
          vec3 ro = vec3(0.0, 0.0, 3.0);
          vec3 rd = normalize(vec3(uv, -1.5));

          float t = 0.0;
          float dist;
          bool hit = false;
          vec3 p;

          // 微かな全体ノイズ（色の脈動だけ）
          float twinkle = (noise(uv*3.0 + uTime*0.5) - 0.5) * uNoiseAmp;

          // グロー蓄積
          float glowAcc = 0.0;

          const int MAX_STEPS = 96;
          for(int i=0; i<MAX_STEPS; i++){
            p = ro + rd * t;
            dist = mapScene(p);
            float ad = abs(dist);

            // 面からの距離に応じて“滲む”光を加算（背景は黒のまま）
            float nearS = smoothstep(0.15, 0.0, ad);
            float fall = 1.0 / (1.0 + t * 0.45);
            glowAcc += nearS * fall * 0.02; // ここが光の“漏れ”

            if(ad < 0.0015){
              hit = true;
              break;
            }

            // 歩幅
            t += clamp(ad * 0.9, 0.003, 0.25);
            if(t > 6.0) break;
          }

          vec3 col = vec3(0.0);
          if(hit){
            // 法線近似（テトラ差分）
            float e = 0.0025;
            vec3 n;
            {
              float d = mapScene(p);
              vec3 v1 = normalize(vec3(1.0, -1.0, -1.0));
              vec3 v2 = normalize(vec3(-1.0, -1.0, 1.0));
              vec3 v3 = normalize(vec3(-1.0, 1.0, -1.0));
              vec3 v4 = normalize(vec3(1.0, 1.0, 1.0));
              n = normalize(v1*mapScene(p+v1*e)
                          + v2*mapScene(p+v2*e)
                          + v3*mapScene(p+v3*e)
                          + v4*mapScene(p+v4*e));
            }

            vec3 L = normalize(vec3(0.35, 0.7, 0.4));
            vec3 V = normalize(-rd);
            float diff = max(dot(n, L), 0.0);
            float fres = pow(1.0 - max(dot(n, V), 0.0), 2.2);

            vec3 core = uColorCore * (0.25 + 0.75 * diff);
            vec3 rim  = uColorGlow * (0.4 + 0.6 * fres);

            col = core + rim * 0.6;
            col += uColorGlow * 0.08;          // 小さなエミッション
            col += twinkle;                     // 色の微振動
          }

          // 画面全体へのグロー（背景は黒を維持）
          vec3 bloomTint = mix(uColorCore, uColorGlow, 0.35);
          col += bloomTint * glowAcc * uGlowStrength;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      uniforms: uniformsRef.current,
      depthTest: false,
      depthWrite: false,
      transparent: true
    }));
    scene.add(quad);

    // ----- Resize -----
    const setSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      uniformsRef.current.uResolution.value.set(w, h);
    };
    setSize();
    window.addEventListener("resize", setSize);

    // ----- Loop -----
    let rafId = 0;
    const loop = () => {
      uniformsRef.current.uTime.value += 1/60;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };
    loop();

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", setSize);
      scene.clear();
      quad.geometry.dispose();
      quad.material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none", // UI操作を邪魔しない
        background: "black"
      }}
      aria-hidden
    />
  );
}