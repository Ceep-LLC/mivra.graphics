"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/* ====== 設定エリア ====== */
// 各行ごとに配置・倍率を自由指定できます

const FONT_FAMILY = "AmelieFierce";
const FONT_URL = "/fonts/AmelieFierce-Regular.otf";
const TEXT_COLOR = "#ffffff";
const BASE_SCALE = 1.0; // 全体倍率（必要なら調整）

export default function WavyHeadline() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {

    const isMobile = window.innerWidth <= 768;

    const TEXT_LINES = isMobile
      ? [
          // --- モバイル時 ---
          { text: "IN", align: "left", scale: 1.0 },
          { text: "BEAUTY", align: "left", scale: 1.0 },
          { text: "WE.", align: "left", scale: 1.0 },
          { text: "TRUST.", align: "left", scale: 1.0 },
        ]
      : [
          // --- PC / タブレット時 ---
          { text: "IN BEAUTY", align: "left", scale: 1.0 },
          { text: "WE TRUST.", align: "right", scale: 1.0 },
        ];

    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // --- THREE setup ---
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(quad);

    // --- offscreen canvas ---
    const off = document.createElement("canvas");
    const ctx = off.getContext("2d");
    const tex = new THREE.CanvasTexture(off);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    // --- font load ---
    const loadFont = async () => {
      const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
      await face.load();
      document.fonts.add(face);
      await document.fonts.ready;
    };

    // --- fragment shader ---
    const frag = /* glsl */`
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uRes;
      uniform float uTime;
      uniform vec2 uMouse;

      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=h(i), b=h(i+vec2(1.,0.)), c=h(i+vec2(0.,1.)), d=h(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v=0., a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
        for(int i=0;i<4;i++){ v+=a*n(p); p=m*p*1.2; a*=0.5; }
        return v;
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        float d = distance(uv, uMouse);
        float boost = smoothstep(0.35, 0.05, d);
        float amp = 0.012 + boost * 0.05;

        vec2 disp = vec2(
          fbm(uv*3.0 + vec2(uTime*0.3)),
          fbm(uv*3.0 - vec2(uTime*0.2))
        );
        uv += disp * amp;

        gl_FragColor = texture2D(uTex, uv);
      }
    `;

    const uniforms = {
      uTex: { value: tex },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    };

    quad.material = new THREE.ShaderMaterial({
      vertexShader: `void main(){gl_Position=vec4(position,1.0);}`,
      fragmentShader: frag,
      uniforms,
      transparent: true,
    });

    // --- テキスト描画 ---
    const drawText = (W, H, dpr) => {
      off.width = W;
      off.height = H;
      ctx.clearRect(0, 0, W, H);

      const marginX = isMobile
      ? W * 0.025
      : W * 0.06; 

      const maxW = W - marginX * 2;
      const maxH = H * 0.7;

      // ベースフォントサイズ
      let baseFontSize;
      if (window.innerWidth <= 768) {
        baseFontSize = (maxH / 3.2) * BASE_SCALE;
      } else {
        baseFontSize = (maxH / 2.4) * BASE_SCALE;
      }
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = TEXT_COLOR;

      // 高さの計算
      const totalLineHeight = TEXT_LINES.reduce((sum, l) => sum + baseFontSize * l.scale * 1.1, 0);
      let startY = isMobile
      ? H * 0.62 // 上端が中央
      : (H - totalLineHeight) / 2 + baseFontSize * 0.9; // 通常の中央寄せ

      TEXT_LINES.forEach((line, i) => {
        const size = baseFontSize * line.scale;
        ctx.font = `${size}px '${FONT_FAMILY}', serif`;
        ctx.textAlign = line.align;

        const x =
          line.align === "left"
            ? marginX
            : line.align === "right"
            ? W - marginX
            : W / 2;

        ctx.fillText(line.text, x, startY);
        startY += size * 0.9;
      });

      tex.needsUpdate = true;
    };

    // --- サイズ設定 ---
    const setSize = () => {
      const wCss = wrap.clientWidth;
      const hCss = wrap.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(wCss, hCss, false);
      uniforms.uRes.value.set(wCss * dpr, hCss * dpr);
      drawText(wCss * dpr, hCss * dpr, dpr);
    };

    // --- マウス追従 ---
    const target = { x: 0.5, y: 0.5 };
    const cur = { x: 0.5, y: 0.5 };
    const onMove = (e) => {
      const r = wrap.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0,
      t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.033, (now - t0) / 1000);
      t0 = now;
      cur.x += (target.x - cur.x) * 0.1;
      cur.y += (target.y - cur.y) * 0.1;
      uniforms.uMouse.value.set(cur.x, cur.y);
      uniforms.uTime.value += dt;
      renderer.render(scene, camera);
    };

    (async () => {
      await loadFont();
      setSize();
      loop();
    })();

    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      renderer.dispose();
      tex.dispose();
      quad.geometry.dispose();
      quad.material.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="hero-wavy">
      <canvas ref={canvasRef} />
      <style jsx>{`
        .hero-wavy {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100lvh;
          pointer-events: none;
        }
        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      `}</style>
    </div>
  );
}