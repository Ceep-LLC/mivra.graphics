"use client";
import { useEffect, useRef } from "react";

export default function NoiseOverlay() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    let w = window.innerWidth;
    let h = window.innerHeight;
    let id;
    let frame = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    // 粒の設定
    const DENSITY = 20.12; // 粒密度
    const SIZE = 1.0; // 粒サイズ(px)
    const NUM_PARTICLES = Math.floor(w * h * DENSITY * 0.0015);

    const draw = () => {
      frame++;
      if (frame % 3 !== 0) { // 約20FPSで更新
        id = requestAnimationFrame(draw);
        return;
      }

      // 全体に透明な黒をかけて、前のフレームを少し残す（残像感）
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, w, h);

      // 粒描画（明暗ランダム）
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const shade = 180 + Math.random() * 75; // 明度のランダム
        const alpha = 0.25 + Math.random() * 0.25;
        ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
        ctx.fillRect(x, y, SIZE, SIZE);
      }

      id = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="noise-overlay" />
      <style jsx>{`
        .noise-overlay {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1000;
        }
      `}</style>
    </>
  );
}