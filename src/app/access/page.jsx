"use client";
import "./access.css";
import { useRef } from "react";

import Copy from "@/components/Copy/Copy";

import { useTransitionRouter } from "next-view-transitions";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const page = () => {
  const router = useTransitionRouter();
  const contactRef = useRef(null);

  useGSAP(
    () => {
      const contactImg = contactRef.current.querySelector(".contact-img");
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

  return (
    <div className="contact" ref={contactRef}>
      <div className="contact-img-wrapper">
        <div className="contact-img">
          <img src="/images/contact/contact.webp" alt="MIVRA" />
        </div>
      </div>
      <div className="contact-copy">
        <div className="contact-copy-bio">
          <Copy delay={1}>
            <p className="caps sm">MIVRA</p>
            <p className="caps sm">Fukushima / Tokyo</p>
          </Copy>
        </div>

        <div className="contact-copy-tags">
          <Copy delay={1.15}>
            <p className="caps sm">Web Systems</p>
            <p className="caps sm">Interface Design</p>
            <p className="caps sm">Creative Development</p>
            <p className="caps sm">Graphic Design</p>
            <p className="caps sm">Photography</p>
            <p className="caps sm">Videography</p>
          </Copy>
        </div>

        <div className="contact-copy-addresses">
          <div className="contact-address">
            <Copy delay={1.3}>
              <p className="caps sm">Fukushima, Japan</p>
              <p className="caps sm">4 Tomarigi Terrace</p>
              <p className="caps sm">6-10 Umegaka-cho, Taira, Iwaki</p>
            </Copy>
          </div>
          <div className="contact-address">
            <Copy delay={1.3}>
              <p className="caps sm">福島</p>
              <p className="caps sm">いわき市平梅香町6-10</p>
              <p className="caps sm">とまり木テラス 4号棟</p>
            </Copy>
          </div>
        </div>

        <div className="contact-copy-links">
          <Copy delay={1.6}>
            <a href="/studio" onClick={(e) => handleNavigation(e, "/studio")}>
              <p className="caps sm">Studio Overview</p>
            </a>
            <a href="/archive" onClick={(e) => handleNavigation(e, "/archive")}>
              <p className="caps sm">Project Archive</p>
            </a>
            <a href="/work" onClick={(e) => handleNavigation(e, "/work")}>
              <p className="caps sm">Selected Work</p>
            </a>
          </Copy>
        </div>
      </div>

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
};

export default page;
