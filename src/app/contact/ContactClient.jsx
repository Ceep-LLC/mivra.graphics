"use client";
import "./contact.css";
import { useEffect, useRef, useState } from "react";

import Copy from "@/components/Copy/Copy";

import { useTransitionRouter } from "next-view-transitions";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export default function ContactClient() {
  const router = useTransitionRouter();
  const contactRef = useRef(null);

  const [state, setState] = useState({ sending: false, ok: false, error: "" });
  const startedAtRef = useRef(0);


  useGSAP(
    () => {
      const contactImg = contactRef.current.querySelectorAll(".contact-img");
      const footerTexts = contactRef.current.querySelectorAll(
        ".contact-footer .footer-text"
      );

      gsap.set(contactImg, {
        clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
      });

      gsap.to(contactImg, {
        clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)",
        duration: 1,
        delay: 0.85,
        ease: "power3.out",
        stagger: 0.15,
      });

      footerTexts.forEach((element) => {
        const textContent = element.querySelector(".footer-text-content");
        gsap.set(textContent, {
          y: "100%",
        });
      });

      footerTexts.forEach((element, index) => {
        const textContent = element.querySelector(".footer-text-content");
        gsap.to(textContent, {
          y: "0%",
          duration: 0.8,
          delay: 1.8 + index * 0.1,
          ease: "power3.out",
        });
      });
    },
    { scope: contactRef }
  );

  function slideInOut() {
    document.documentElement.animate(
      [
        {
          opacity: 1,
          transform: "translateY(0) scale(1)",
        },
        {
          opacity: 0.2,
          transform: "translateY(-30%) scale(0.90)",
        },
      ],
      {
        duration: 1500,
        easing: "cubic-bezier(0.87, 0, 0.13, 1)",
        fill: "forwards",
        pseudoElement: "::view-transition-old(root)",
      }
    );

    document.documentElement.animate(
      [
        {
          clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
        },
        {
          clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)",
        },
      ],
      {
        duration: 1500,
        easing: "cubic-bezier(0.87, 0, 0.13, 1)",
        fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  }

  const handleNavigation = (e, route) => {
    e.preventDefault();
    router.push(route, {
      onTransitionReady: slideInOut,
    });
  };

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setState({ sending: true, ok: false, error: "" });

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // 経過秒（タイムトラップ）
    data.elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || "送信に失敗しました。時間を空けて再度お試しください。");
      }
      setState({ sending: false, ok: true, error: "" });
      form.reset();
    } catch (err) {
      setState({ sending: false, ok: false, error: err.message });
    }
  }

  return (
    <div className="contact" ref={contactRef}>
      {/* <div className="contact-img-wrapper">
        <div className="contact-img">
          <img src="/images/contact/contact.webp" alt="MIVRA" />
        </div>
      </div> */}

      <div className="contactCopy contact-copy">
        <div className="contactCopy_wrapper">          
          <div className="contact-copy-bio">
            <Copy delay={1}>
              <p className="contactCopy_name">MIVRA</p>
              <p className="contactCopy_area">Fukushima / Tokyo</p>
            </Copy>
          </div>

          <div className="contactLinks contact-copy-tags">
            <Copy delay={1.15}>
              <p className="contactLinks_item wf"><a href="#webform">Web Form</a></p>
              <p className="contactLinks_item"><a href="tel:0246-88-8956">+81 246 88 8956</a></p>
              <p className="contactLinks_item"><a href="mailto:hello@mivra.graphics">hello@mivra.graphics</a></p>
              <p className="contactLinks_item"><a href="https://www.instagram.com/kzs86/" target="_blank">@kzs86</a></p>
              <p className="contactLinks_item"><a href="https://maps.app.goo.gl/BfKZVLpT37LvCr3n7" target="_blank">Google Map</a></p>
            </Copy>
          </div>

          <div className="contact-copy-addresses">
            <div className="contact-address">
              <Copy delay={1.3}>
                <p className="caps">Fukushima, Japan</p>
                <p className="caps">4 Tomarigi Terrace</p>
                <p className="caps">6-10 Umegaka-cho, Taira, Iwaki</p>
              </Copy>
            </div>
          </div>
          <div className="contactCopy_imgs">
            <ul className="contactCopy_imgsWrapper">
              <li className="contactCopy_imgsItem"><div className="contactCopy_imgsItemWrapper contact-img"><img src="/images/contact/contact.webp" alt="" /></div></li>
              <li className="contactCopy_imgsItem"><div className="contactCopy_imgsItemWrapper contact-img"><img src="/images/contact/contact.webp" alt="" /></div></li>
              <li className="contactCopy_imgsItem"><div className="contactCopy_imgsItemWrapper contact-img"><img src="/images/contact/contact.webp" alt="" /></div></li>
            </ul>
          </div>
        </div>
      </div>

      <main id="webform" className="contactBody contact-wrap">
        <Copy delay={1}>
          <div className="contactHead">
            <div className="contactHead_top">
              <h1 className="contactHead_ja">お問いあわせ</h1>
              <div className="contactHead_en">Contact Me</div>
            </div>
            <p className="contactHead_bottom">プロジェクトの概要が決まっていなくても大丈夫です。まずはお気軽にご相談ください。</p>
          </div>
        </Copy>
        <form onSubmit={onSubmit} className="contactForm contact-form" autoComplete="off" noValidate>
          {/* ハニーポット（CSSで非表示・スクリーンリーダーにも非表示） */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
            <label>Leave this empty</label>
            <input type="text" name="hp_code" tabIndex={-1} />
          </div>
          <div className="contactGrid">
            <Copy delay={1}>
            <div className="contactGrid_item">
              <label htmlFor="name" className="contactGrid_label"><span>必須</span>お名前</label>
              <input name="name" id="name" type="text" className="contactGrid_input" required />
            </div>
            <div className="contactGrid_item">
              <label htmlFor="email" className="contactGrid_label"><span>必須</span>メールアドレス</label>
              <input name="email" id="email" type="email" inputMode="email" className="contactGrid_input" required />
            </div>
            <div className="contactGrid_item">
              <label htmlFor="message" className="contactGrid_label"><span>必須</span>ご相談内容</label>
              <textarea name="message" id="message" className="contactGrid_input textarea" required rows={7} />
            </div>
            <p className="contactGrid_atten">送信内容はプライバシーポリシーに基づき対応します</p>
            <div className="contactGrid_submit">
              <button type="submit" disabled={state.sending}>
                {state.sending ? "Sending..." : "Send"}
              </button>
            </div>
            {state.ok && <p className="ok">送信しました。2営業日以内にご連絡いたします。</p>}
            {state.error && <p className="err">{state.error}</p>}
            </Copy>
          </div>
        </form>
        <style jsx>{`
          .lead { margin: 8px 0 24px; opacity: 0.8; }
          .contact-form { display: block; }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }
          .span2 { grid-column: span 2; }
          input, textarea, select {
            width: 100%; border: 1px solid rgba(255,255,255,0.2);
            background: transparent; color: inherit;
          }
          select[multiple] { min-height: 120px; }
          .agree { display: flex; align-items: center; gap: 10px; font-size: 13px; }
          button {
            margin-top: 18px; padding: 12px 18px; border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.4); background: transparent; color: inherit;
          }
          .ok { color: #7fe697; margin-top: 12px; }
          .err { color: #ff8a8a; margin-top: 12px; }
          @media (max-width: 640px){
            .grid{ grid-template-columns: 1fr; }
            .span2{ grid-column: span 1; }
          }
        `}</style>
      </main>

      <div className="contact-footer">
        <div className="fc-col-lg">
          <div className="footer-text">
            <div className="footer-text-content">
            </div>
          </div>
        </div>
        <div className="fc-col-sm">
          <div className="footer-text">
            <div className="footer-text-content">
              <p className="sm caps">&copy; 2025 Ceep LLC / MIVRA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}