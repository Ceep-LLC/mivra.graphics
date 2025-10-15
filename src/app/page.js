"use client";
import "./home.css";
import { useState, useEffect } from "react";

import FloralHero from "@/components/HeroVisuals/FloralHero";
import Copy from "@/components/Copy/Copy";
import BtnLink from "@/components/BtnLink/BtnLink";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import CustomEase from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create("hop", "0.9, 0, 0.1, 1");

let isInitialLoad = true;

export default function Home() {
  const [showPreloader, setShowPreloader] = useState(isInitialLoad);

  useEffect(() => {
    return () => {
      isInitialLoad = false;
    };
  }, []);

  useGSAP(() => {
    const heroLink = document.querySelector(".hero-link");
    const animationDelay = showPreloader ? 6.2 : 0.9;

    if (showPreloader) {
      const tl = gsap.timeline({
        delay: 0.3,
        defaults: {
          ease: "hop",
        },
      });

      const counts = document.querySelectorAll(".count");
      const progressBar = document.querySelector(".progress-bar");
      const preloaderOverlay = document.querySelector(".preloader-overlay");

      const progressTl = gsap.timeline({
        delay: 0.3,
      });

      counts.forEach((count, index) => {
        const digits = count.querySelectorAll(".digit h1");

        tl.to(
          digits,
          {
            y: "0%",
            duration: 1,
            stagger: 0.075,
          },
          index * 1
        );

        if (index < counts.length) {
          tl.to(
            digits,
            {
              y: "-120%",
              duration: 1,
              stagger: 0.075,
            },
            index * 1 + 1
          );
        }

        progressTl.to(
          progressBar,
          {
            scaleY: (index + 1) / counts.length,
            duration: 1,
            ease: "hop",
          },
          index * 1
        );
      });

      progressTl
        .set(progressBar, {
          transformOrigin: "top",
        })
        .to(progressBar, {
          scaleY: 0,
          duration: 0.75,
          ease: "hop",
        })
        .to(preloaderOverlay, {
          opacity: 0,
          duration: 0.3,
          ease: "power2.out",
          onComplete: () => {
            preloaderOverlay.style.display = "none";
          },
        });
    }

    if (heroLink) {
      gsap.set(heroLink, { y: 30, opacity: 0 });

      gsap.to(heroLink, {
        y: 0,
        opacity: 1,
        duration: 1,
        delay: animationDelay,
        ease: "power4.out",
      });
    }
  }, [showPreloader]);

  return (
    <>
      {showPreloader && (
        <div className="preloader-overlay">
          <div className="progress-bar"></div>
          <div className="counter">
            <div className="count">
              <div className="digit">
                <h1>0</h1>
              </div>
              <div className="digit">
                <h1>0</h1>
              </div>
            </div>
            <div className="count">
              <div className="digit">
                <h1>2</h1>
              </div>
              <div className="digit">
                <h1>7</h1>
              </div>
            </div>
            <div className="count">
              <div className="digit">
                <h1>6</h1>
              </div>
              <div className="digit">
                <h1>5</h1>
              </div>
            </div>
            <div className="count">
              <div className="digit">
                <h1>9</h1>
              </div>
              <div className="digit">
                <h1>8</h1>
              </div>
            </div>
            <div className="count">
              <div className="digit">
                <h1>9</h1>
              </div>
              <div className="digit">
                <h1>9</h1>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="topDocument">
        <FloralHero />

        <section className="hero topHero">

          <div className="hero-content">
            <div className="hero-header">
              <div className="hero-header-col-sm">
                <Copy animateOnScroll={false} delay={showPreloader ? 6.2 : 0.9}>
                  <h3 className="topHero_slogan">IN BEAUTY <br />WE TRUST.</h3>
                </Copy>
              </div>
            </div>

            <div className="topHero_footer hero-footer">
              <div className="topHero_footerStart">
                
                  <div className="topHero_copyGrid">
                    <Copy animateOnScroll={false} delay={showPreloader ? 6.2 : 0.9}>
                    <p className="topHero_copy">
                      MIVRA（ミブラ）は、福島県いわき市を拠点とするデザインスタジオです。流行や評価ではなく、「自分が美しいと思うもの」を信じて形にしています。
                    </p>
                    </Copy>
                    <Copy animateOnScroll={false} delay={showPreloader ? 6.2 : 0.9}>
                    <p className="topHero_copy en">
                      MIVRA is a design studio based in Iwaki, Japan. We create not for trends or praise, but from a belief in what we find truly beautiful.
                    </p>
                    </Copy>
                  </div>
                
              </div>
              <div className="topHero_footerEnd">
                <div className="hero-link">
                  <BtnLink route="/contact" label="contact" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
