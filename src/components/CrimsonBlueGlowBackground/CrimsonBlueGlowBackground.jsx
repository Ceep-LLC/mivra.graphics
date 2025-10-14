"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export default function FluidGlassHero() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // ---------------- Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15; // ← 露出を少し上げる
    renderer.setClearColor(0x000000, 1);

    // ---------------- Scene / Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    // ---------------- Environment
    const pmrem = new THREE.PMREMGenerator(renderer);
    // sigma を小さくして警告を回避
    const env = pmrem.fromScene(new RoomEnvironment(), 0.1).texture;
    scene.environment = env;
    scene.background = null;

    // ---------------- Backplate（暗いグラデの薄板：ガラスが屈折で拾う）
    // 画面全体を覆う大きな板を、やや奥に配置
    {
      const planeGeo = new THREE.PlaneGeometry(30, 30, 1, 1);
      // 非常に暗い青→赤のなだらかなグラデ
      const gradMat = new THREE.ShaderMaterial({
        uniforms: {
          uBlue:   { value: new THREE.Color("#0b1020") },
          uCrim:   { value: new THREE.Color("#1a0b0b") },
          uTilt:   { value: 0.35 }, // 0..1 でグラデ角度テイスト
        },
        vertexShader: `
          varying vec2 vUv;
          void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }
        `,
        fragmentShader: `
          precision highp float; varying vec2 vUv;
          uniform vec3 uBlue, uCrim; uniform float uTilt;
          void main(){
            // 斜めにほんのり
            float g = clamp(vUv.y * (1.0 - uTilt) + vUv.x * uTilt, 0.0, 1.0);
            vec3 col = mix(uBlue, uCrim, smoothstep(0.2, 0.8, g));
            // さらに中心を少し暗く
            vec2 p = vUv - 0.5;
            float v = 1.0 - smoothstep(0.0, 0.9, length(p));
            col *= mix(0.8, 1.0, v);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        depthWrite: false,
        depthTest: false,
      });
      const plate = new THREE.Mesh(planeGeo, gradMat);
      plate.position.z = -8; // オブジェクトのかなり後方
      scene.add(plate);
    }

    // ---------------- Lights（青×クリムゾンのツートン）
    const keyBlue = new THREE.PointLight(0x2a6bff, 26, 0, 2);
    keyBlue.position.set(-2.2, 1.4, 2.2);
    scene.add(keyBlue);

    const rimRed = new THREE.PointLight(0xe83a4e, 18, 0, 2);
    rimRed.position.set(2.6, -1.2, -2.2);
    scene.add(rimRed);

    const fill = new THREE.AmbientLight(0xffffff, 0.15); // ほんの少しだけ底上げ
    scene.add(fill);

    // ---------------- Model
    const group = new THREE.Group();
    scene.add(group);

    const loader = new GLTFLoader();
    let model = null;

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.04,
      transmission: 1.0,
      ior: 1.38,
      thickness: 1.8,
      attenuationColor: new THREE.Color("#8fb2ff"),
      attenuationDistance: 2.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      specularIntensity: 1.0,
    });

    const loadGLB = async () => {
      try {
        const glb = await loader.loadAsync("/models/metaball.glb");
        model = glb.scene || glb.scenes?.[0];
        if (!model) {
          console.warn("[FluidGlassHero] GLBにシーンが見つかりません");
          return;
        }
        let meshCount = 0;
        model.traverse((o) => {
          if (o.isMesh) {
            meshCount++;
            o.castShadow = false;
            o.receiveShadow = false;
            o.material = glassMat;
          }
        });
        console.log(`[FluidGlassHero] GLB loaded. meshes=${meshCount}`);

        // センタリング & スケール
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const desired = 2.8; // 少し大きめ
        const k = desired / (maxDim || 1.0);
        model.scale.setScalar(k);

        group.add(model);
      } catch (e) {
        console.error("[FluidGlassHero] GLB load error:", e);
      }
    };

    // ---------------- PostProcessing（ブルーム）
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0.2, 0.2);
    composer.addPass(bloom);

    // ---------------- Resize
    const setSize = () => {
      const w = wrap.clientWidth || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), 1.8);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer.setSize(w, h);
      bloom.setSize(w, h);
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);

    // ---------------- Interaction
    let targetRX = 0, targetRY = 0;
    const onPointer = (e) => {
      const r = wrap.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      targetRY = (nx - 0.5) * 0.6;
      targetRX = (0.5 - ny) * 0.4;

      keyBlue.position.x = -2.2 + (nx - 0.5) * 1.2;
      keyBlue.position.y =  1.4 + (0.5 - ny) * 0.8;
      rimRed.position.x  =  2.6 + (nx - 0.5) * 1.4;
      rimRed.position.y  = -1.2 + (0.5 - ny) * 0.6;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ---------------- Animate
    let raf = 0;
    let t0 = performance.now();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.033, (now - t0) / 1000);
      t0 = now;

      group.rotation.y += 0.05 * dt;
      group.rotation.x += (targetRX - group.rotation.x) * 0.06;
      group.rotation.y += (targetRY - group.rotation.y) * 0.06;

      const pulse = 1.0 + Math.sin(now * 0.0008) * 0.025;
      group.scale.setScalar(pulse);

      composer.render();
    };

    // 読み込み後にレンダリング開始
    loadGLB().then(() => tick());

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        t0 = performance.now();
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      ro.disconnect();
      cancelAnimationFrame(raf);
      composer.dispose();
      renderer.dispose();
      pmrem.dispose();
      env?.dispose?.();
    };
  }, []);

  return (
    <div ref={wrapRef} className="fluidGlass-wrap" aria-hidden>
      <canvas ref={canvasRef} className="fluidGlass-canvas" />
      <style jsx>{`
        .fluidGlass-wrap {
          position: fixed;
          inset: 0;
          z-index: -1;
          background: #000; /* 真っ黒の中で発光させる */
          pointer-events: none;
        }
        .fluidGlass-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      `}</style>
    </div>
  );
}