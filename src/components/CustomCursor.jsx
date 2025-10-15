"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { usePathname, useRouter } from "next/navigation";

/**
 * カスタムカーソル
 * - デスクトップ：常時表示（慣性追従、プレス縮小）
 * - モバイル(pointer:coarse)：
 *    * 基本は非表示
 *    * トップページ("/")で長押し開始 → フェードイン表示
 *    * 指を離す → プログレスが逆再生で0%に戻り切ったらフェードアウト
 * - トップページで100%到達時：
 *    * .topDocument に GSAPアニメ（opacity/translate/scale）
 *    * View Transitions API 対応ブラウザでは擬似要素(::view-transition-*)にもWAAPIでエフェクト
 *    * /studio へ遷移
 */
export default function CustomCursor() {
  const pathname = usePathname();
  const router = useRouter();
  const isTop = pathname === "/";

  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const textWrapRef = useRef(null);
  const countSpanRef = useRef(null);

  const prog = useRef({ v: 0 });
  const tl = useRef(null);
  const tickerCb = useRef(null);

  const [isHolding, setIsHolding] = useState(false);
  const isCoarseRef = useRef(false);

  // ===== ページ遷移アニメ（100%到達時に呼ぶ） =====
// 100% 到達時に呼ぶ：旧→新を同時にアニメ
const runPageTransition = async () => {
  const DURATION = 1500; // ms
  const EASE = "cubic-bezier(0.87, 0, 0.13, 1)";

  // View Transitions API が使える場合：擬似要素のみをアニメ
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    const vt = document.startViewTransition(() => {
      // ★ ここで実際のDOMは /studio に切り替わるが、
      //    画面にはスナップショットが見えている状態
      router.push("/studio");
    });

    // スナップショット準備が整ったら、old/new の疑似要素にだけアニメ適用
    vt.ready.then(() => {
      // 旧（トップ）をズームアウト＆上へ
      document.documentElement.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0.2, transform: "translateY(-30%) scale(0.90)" },
        ],
        {
          duration: DURATION,
          easing: EASE,
          fill: "forwards",
          pseudoElement: "::view-transition-old(root)",
        }
      );

      // 新（/studio）を下からクリップオープン
      document.documentElement.animate(
        [
          { clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)" },
          { clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)" },
        ],
        {
          duration: DURATION,
          easing: EASE,
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });

    // 失敗しても落ちないように握りつぶし
    try { await vt.finished; } catch (e) {}
    return;
  }

  // フォールバック（VT非対応ブラウザ）：
  // 実DOMをGSAPでアニメ → 終了後に遷移
  const topEl = document.querySelector(".topDocument");
  if (topEl) {
    await new Promise((resolve) => {
      gsap.to(topEl, {
        opacity: 0.2,
        yPercent: -30,
        scale: 0.9,
        duration: DURATION / 1000,
        ease: "power3.inOut",
        onComplete: resolve,
      });
    });
  }
  router.push("/studio");
};

  // ===== 環境検出 & 初期可視状態 =====
  useEffect(() => {
    const mm = window.matchMedia?.("(pointer:coarse)");
    isCoarseRef.current = !!mm?.matches;

    const initialAlpha = isCoarseRef.current ? 0 : 1;
    gsap.set(cursorRef.current, {
      autoAlpha: initialAlpha,
      xPercent: -50,
      yPercent: -50,
      transformOrigin: "50% 50%",
    });

    const onChange = () => {
      isCoarseRef.current = !!mm?.matches;
      if (isCoarseRef.current) {
        if (!isTop || !isHolding) gsap.set(cursorRef.current, { autoAlpha: 0 });
      } else {
        gsap.set(cursorRef.current, { autoAlpha: 1 });
      }
    };
    mm?.addEventListener?.("change", onChange);
    return () => mm?.removeEventListener?.("change", onChange);
  }, [isTop, isHolding]);

  // ===== 慣性追従 =====
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const mouse = { x: pos.x, y: pos.y };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const lerp = 0.12;
    tickerCb.current = () => {
      pos.x += (mouse.x - pos.x) * lerp;
      pos.y += (mouse.y - pos.y) * lerp;
      gsap.set(el, { x: pos.x, y: pos.y });
    };
    gsap.ticker.add(tickerCb.current);

    return () => {
      window.removeEventListener("pointermove", onMove);
      if (tickerCb.current) gsap.ticker.remove(tickerCb.current);
    };
  }, []);

  // ===== 全ページ：押し込み演出 =====
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    const pressIn = (e) => {
      if (e.button === 2) return;
      gsap.to(el, { scale: 0.88, duration: 0.12, ease: "power2.out", transformOrigin: "50% 50%" });
    };
    const pressOut = () => {
      gsap.to(el, { scale: 1, duration: 0.3, ease: "power3.out", transformOrigin: "50% 50%" });
    };

    window.addEventListener("pointerdown", pressIn);
    window.addEventListener("pointerup", pressOut);
    window.addEventListener("pointercancel", pressOut);
    return () => {
      window.removeEventListener("pointerdown", pressIn);
      window.removeEventListener("pointerup", pressOut);
      window.removeEventListener("pointercancel", pressOut);
    };
  }, []);

  // ===== トップページ：長押しドーナツ + テキスト切替 =====
  useEffect(() => {
    if (!isTop) return;

    const C = 2 * Math.PI * 45;
    gsap.set(ringRef.current, {
      strokeDasharray: C,
      strokeDashoffset: C,
      transformOrigin: "50% 50%",
      scale: 1,
    });

    if (!tl.current) {
      tl.current = gsap.timeline({
        paused: true,
        onUpdate: () => {
          const v = prog.current.v;
          const pct = Math.floor(v * 100);
          if (countSpanRef.current) countSpanRef.current.textContent = `${pct}%`;
          if (ringRef.current) ringRef.current.style.strokeDashoffset = C * (1 - v);
        },
        onComplete: () => {
          // 100% 到達：ページ遷移アニメ → /studio
          setIsHolding(false);
          runPageTransition();
        },
        onReverseComplete: () => {
          if (isCoarseRef.current) {
            gsap.to(cursorRef.current, {
              autoAlpha: 0,
              duration: 0.35,
              ease: "power2.out",
              delay: 0.05,
            });
          }
        },
      });
      tl.current.to(prog.current, { v: 1, duration: 1.1, ease: "linear" });
    }

    const onDown = (e) => {
      if (e.button === 2) return;
      setIsHolding(true);
      if (isCoarseRef.current) {
        gsap.to(cursorRef.current, { autoAlpha: 1, duration: 0.18, ease: "power2.out" });
      }
      textWrapRef.current?.classList.add("holding");
      gsap.to(ringRef.current, {
        scale: 1.35,
        duration: 0.45,
        ease: "power3.out",
        transformOrigin: "50% 50%",
      });
      prog.current.v = 0;
      tl.current.restart();
    };

    const onUp = () => {
      if (!isHolding) return;
      setIsHolding(false);
      textWrapRef.current?.classList.remove("holding");
      gsap.to(ringRef.current, {
        scale: 1,
        duration: 0.4,
        ease: "power3.inOut",
        transformOrigin: "50% 50%",
      });
      tl.current.reverse();
    };

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isTop, isHolding, router]);

  return (
    <>
      <div className={`custom-cursor ${isTop ? "is-top" : ""}`} ref={cursorRef}>
        {isTop && (
          <>
            <svg className="cursor-ring" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.18)" strokeWidth="3" fill="none" />
              <circle ref={ringRef} cx="50" cy="50" r="45" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>

            <div className="cursorText_wrapper" ref={textWrapRef}>
              <div className="cursorText_inner">
                <span className="cursorText origin">HOLD</span>
                <span className="cursorText hidden" ref={countSpanRef}>0%</span>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .custom-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          pointer-events: none;
          mix-blend-mode: difference;
          z-index: 9999;
          transform: translate(-50%, -50%);
          will-change: transform, opacity;
          backface-visibility: hidden;
          transition: width 0.3s ease, height 0.3s ease, background 0.3s ease;
          opacity: 1;
        }
        .custom-cursor.is-top {
          width: 120px;
          height: 120px;
          background: transparent;
          overflow: visible;
        }
        .cursor-ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .cursorText_wrapper {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          pointer-events: none;
          color: #fff;
          font-size: 14px;
          letter-spacing: 0.06em;
          font-family: system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
        }
        .cursorText_inner {
          position: relative;
          overflow: hidden;
          height: 1em;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cursorText {
          display: inline-block;
          will-change: transform;
          transition: transform 0.4s cubic-bezier(.65,.05,.36,1);
        }
        .cursorText_wrapper .cursorText.origin { transform: translateY(0%); }
        .cursorText_wrapper .cursorText.hidden {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateY(105%);
        }
        .cursorText_wrapper.holding .cursorText.origin { transform: translateY(-105%); }
        .cursorText_wrapper.holding .cursorText.hidden { transform: translateY(0%); }
      `}</style>
    </>
  );
}