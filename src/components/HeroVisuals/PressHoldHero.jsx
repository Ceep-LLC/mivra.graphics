"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 画面全体で「長押し→円形プログレス→満タンで /studio 遷移」
 * - マウス長押し/タップ長押し/Space/Enter に対応
 * - 押している間のみ円が伸びる。離すとキャンセル
 * - カーソル位置（タッチは指位置）に円を表示。キーボードは中央に表示
 * - 低モーション設定ならフェードのみ（アクセシビリティ配慮）
 */
export default function PressHoldNavigator({
  holdMs = 900,           // 満タンになるまでの長押し時間（ミリ秒）
  size = 72,              // 円の見た目サイズ（px）
  stroke = 4,             // 円の線幅（px）
  destination = "/studio" // 遷移先
}) {
  const router = useRouter();
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const activeRef = useRef(false);
  const completedRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();

  // 位置・進捗
  const [pos, setPos] = useState({ x: 0, y: 0, viaKb: false });
  const [progress, setProgress] = useState(0);
  const wrapRef = useRef(null);

  // 円弧計算（SVG）
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const dash = C * (1 - Math.min(1, Math.max(0, progress)));

  // 長押し開始
  const startHold = (x, y, viaKb = false) => {
    if (completedRef.current) return;
    activeRef.current = true;
    startTimeRef.current = performance.now();
    setProgress(0);
    setPos({ x, y, viaKb });

    const tick = () => {
      if (!activeRef.current) return;
      const t = performance.now() - startTimeRef.current;
      const p = Math.min(1, t / holdMs);
      setProgress(p);

      if (p >= 1) {
        completedRef.current = true;
        activeRef.current = false;
        // 小さな遅延で押下離し処理が衝突しないように
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => router.push(destination), 10);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  // 長押しキャンセル
  const cancelHold = () => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    // すっと消す
    setProgress(0);
  };

  // ポインターイベント
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const getXY = (e) => {
      // キャンバス内座標
      const r = wrap.getBoundingClientRect();
      const cx = (e.clientX ?? (e.touches && e.touches[0]?.clientX)) ?? r.left + r.width / 2;
      const cy = (e.clientY ?? (e.touches && e.touches[0]?.clientY)) ?? r.top + r.height / 2;
      return { x: cx - r.left, y: cy - r.top };
    };

    const onPointerDown = (e) => {
      if (e.button === 2) return; // 右クリック無視
      const { x, y } = getXY(e);
      startHold(x, y, false);
    };
    const onPointerMove = (e) => {
      if (!activeRef.current) return;
      const { x, y } = getXY(e);
      setPos((p) => ({ ...p, x, y }));
    };
    const onPointerUp = () => {
      if (!completedRef.current) cancelHold();
    };
    const onContext = (e) => {
      // 長押し中のコンテキストメニュー抑制（スマホ長押し等）
      if (activeRef.current) e.preventDefault();
    };

    wrap.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("contextmenu", onContext);

    return () => {
      wrap.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("contextmenu", onContext);
    };
  }, [holdMs, destination, router]);

  // キーボード（Space/Enter 長押し）
  useEffect(() => {
    const onKeyDown = (e) => {
      if (completedRef.current) return;
      if (e.repeat) return; // 長押し時のリピート抑制
      if (e.code === "Space" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        // 画面中央を基準に
        const r = wrapRef.current?.getBoundingClientRect();
        const x = r ? r.width / 2 : window.innerWidth / 2;
        const y = r ? r.height / 2 : window.innerHeight / 2;
        startHold(x, y, true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space" || e.key === " " || e.key === "Enter") {
        if (!completedRef.current) cancelHold();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // 低モーション時はフェード表示に簡略化（プログレスは表示する）
  const wrapStyle = reducedMotion ? { transition: "opacity 120ms ease" } : null;

  return (
    <div
      ref={wrapRef}
      className="presshold-wrap"
      aria-label="Press and hold to enter the studio"
      aria-live="polite"
      role="application"
      tabIndex={0}
      style={wrapStyle}
    >
      {/* 円（SVG） */}
      <div
        className={`ring ${progress > 0 ? "is-visible" : ""}`}
        style={{
          transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -50%)`,
          width: size,
          height: size,
        }}
        aria-hidden
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* 背景円 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={stroke}
            fill="none"
          />
          {/* 進捗円（ぐるっと進む） */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            style={{
              transformOrigin: "50% 50%",
              transform: "rotate(-90deg)",
              transition: "stroke-dashoffset 16ms linear",
              strokeDasharray: C,
              strokeDashoffset: dash,
            }}
          />
        </svg>
      </div>

      {/* ヒント（お好みで削除OK） */}
      <div className="hint" aria-hidden>
        <span className="mouse">Press & Hold</span>
        <span className="touch">Long press</span>
        <span className="kb">Space / Enter</span>
      </div>

      <style jsx>{`
        .presshold-wrap {
          position: fixed;
          inset: 0;
          z-index: 10; /* ヒーローの上に被せる。必要なら調整 */
          pointer-events: auto;
          /* 背景をクリック可にするなら透明のまま */
        }

        .ring {
          position: absolute;
          left: 0; top: 0;
          opacity: 0;
          transform: translate(-9999px, -9999px);
          transition: opacity 120ms ease;
          will-change: transform, opacity;
          filter: drop-shadow(0 2px 8px rgba(0,0,0,0.35));
          user-select: none;
          pointer-events: none; /* 円自体はマウスを拾わない */
        }
        .ring.is-visible {
          opacity: 1;
        }

        .hint {
          position: absolute;
          left: 50%;
          bottom: clamp(16px, 6vh, 48px);
          transform: translateX(-50%);
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          letter-spacing: 0.06em;
          display: grid;
          grid-auto-flow: column;
          gap: 10px;
          pointer-events: none;
          user-select: none;
        }
        @media (pointer: coarse) {
          .hint .mouse { display: none; }
        }
        @media (pointer: fine) {
          .hint .touch { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ring { transition: none; }
        }
      `}</style>
    </div>
  );
}

/** prefers-reduced-motion 判定 */
function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefers(!!m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, []);
  return prefers;
}