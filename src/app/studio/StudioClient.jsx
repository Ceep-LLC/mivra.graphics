"use client";
import "./studio.css";
import { useRef } from "react";

import Copy from "@/components/Copy/Copy";
import BtnLink from "@/components/BtnLink/BtnLink";
import WhoWeAre from "@/components/WhoWeAre/WhoWeAre";
import ProcessCards from "@/components/ProcessCards/ProcessCards";
import Footer from "@/components/Footer/Footer";

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(SplitText, ScrollTrigger);

export default function StudioClient() {
  const studioRef = useRef(null);

  useGSAP(() => {
    if (!studioRef.current) return;

    const studioHeroH1 = studioRef.current.querySelector(".studio-hero h1");
    const studioHeroImgWrapper = studioRef.current.querySelector(
      ".studio-hero-img-wrapper"
    );
    const missionLinkWrapper = studioRef.current.querySelector(".mission-link");

    if (studioHeroH1) {
      const split = SplitText.create(studioHeroH1, {
        type: "chars",
        charsClass: "char++",
      });

      split.chars.forEach((char) => {
        const wrapper = document.createElement("span");
        wrapper.className = "char-mask";
        wrapper.style.overflow = "hidden";
        wrapper.style.display = "inline-block";
        char.parentNode.insertBefore(wrapper, char);
        wrapper.appendChild(char);
      });

      gsap.set(split.chars, { y: "100%" });

      gsap.to(split.chars, {
        y: "0%",
        duration: 0.8,
        stagger: 0.2,
        delay: 0.85,
        ease: "power3.out",
      });
    }

    if (studioHeroImgWrapper) {
      gsap.set(studioHeroImgWrapper, {
        clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
      });

      gsap.to(studioHeroImgWrapper, {
        clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)",
        duration: 1,
        delay: 1,
        ease: "power3.out",
      });
    }

    if (missionLinkWrapper) {
      gsap.set(missionLinkWrapper, { y: 30, opacity: 0 });

      ScrollTrigger.create({
        trigger: missionLinkWrapper.closest(".mission-intro-copy"),
        start: "top 75%",
        once: true,
        onEnter: () => {
          gsap.to(missionLinkWrapper, {
            y: 0,
            opacity: 1,
            duration: 1,
            delay: 1.2,
            ease: "power3.out",
          });
        },
      });
    }
  });

  return (
    <>
      <div className="studio" ref={studioRef}>
        <section className="studio-hero">
          <h1 className="caps">MIVRA</h1>
        </section>

        <section className="studio-hero-img">
          <div className="studio-hero-img-wrapper">
            <img src="/images/studio/hero.jpeg" alt="" />
          </div>
        </section>

        <section className="studio-header">
          <div className="studio-header-copy">
            <Copy>
              <h2>
              At MIVRA, we create from instinct and conviction.
              Guided not by trends or approval, but by a quiet belief in what we find beautiful,
              we shape work that carries our sense of balance, restraint, and grace.
              </h2>
              <p>
              MIVRA(ミブラ)はデザイナー兼ウェブエンジニア<br />
              磯上和志が主宰する、<br />
              福島県いわき市の小さなデザインスタジオです。<br />
              私は、流行よりも「美しいと思える感覚」を信じて<br />
              ひとつひとつの仕事に向き合っています。<br />
              かっこよく見せるためではなく、<br />
              誰かの時間を、少しでも豊かにできるように。<br />
              そんな想いで、日々デザインと向き合っています。
              </p>
            </Copy>
          </div>
        </section>

        <WhoWeAre />

        <section className="mission-intro">
          <div className="mission-intro-col-sm"></div>
          <div className="mission-intro-col-lg">
            <div className="mission-intro-copy">
              <Copy>
                <h3>
                  We are a design-driven studio exploring the intersection of clarity and craft.
                  Our approach blends thoughtful structure with subtle emotion, turning ideas
                  into timeless, functional design systems.
                </h3>
                <br />
                <h3>
                  Through strategy, design, and technology, we shape identities and experiences
                  that resonate with purpose. Every detail is considered, every outcome built
                  to endure.
                </h3>
                <h3 className="ja">
                サイト制作、ロゴ、印刷物、撮影など、事業やブランドの本質を伝えるための表現を幅広く手がけています。  
                一つひとつの案件に丁寧に向き合い、確かな成果を積み重ねていきます。
                </h3>
              </Copy>
            </div>
          </div>
        </section>

        <ProcessCards />

        <section className="recognition">
          <div className="recognition-copy">
            <Copy>
              <p className="sm caps">( PHILOSOPHY )</p>
              <br />
              <h2>
              At MIVRA, design begins with belief.
              We create from what we truly find beautiful — with precision, restraint, and intent.
              Our work seeks harmony between function and feeling, shaping experiences that endure quietly over time.
              </h2>
            </Copy>
          </div>
          <div className="philosophy">
            <div className="philosophy_img"></div>
            <div className="philosophy_grid">
              <p className="philosophy_item">
                私は、自分が「美しい」と思えるものしか信じません。<br className="pc" />
                その感覚が鈍れば、誰かの時間を豊かにすることもできないと思うからです。<br /><br />
                私は、会社を大きくしたいわけでも、<br className="pc" />
                ただ仕事を増やしたいわけでもありません。<br className="pc" />
                ただ——“作品をつくりたいだけ”なのです。<br /><br />
                丁寧な手仕事こそが、機能して人や社会の役に立つ。<br className="pc" />
                その過程こそが、私にとっての「仕事」です。<br /><br />
                そんな私や作品を信じてくれる大切なお客様、<br className="pc" />
                そして日々ともに歩む社員の皆。<br className="pc" />
                いつも本当にありがとうございます。<br /><br />
                私は、美しく、前衛的で、圧倒的で、双方的なデザイン制作を通じて、<br className="pc" />
                世の中に貢献し、大切な人たちの笑顔を守れるよう、自分の道を進みます。
              </p>
              <p className="philosophy_item en">
                I only believe in what I find beautiful.
                Because when that sense dulls, I can no longer enrich someone else’s time through what I create.
                I have no desire to grow a company, nor to simply take on more work.
                I just want to create — to make works of art.
                It is through careful, thoughtful craftsmanship that design gains function and meaning.
                That process itself is what “work” means to me.
                To my dear clients who trust in me and my creations, and to my team who walks this path with me — thank you, always.
                Through design that is beautiful, avant-garde, and profoundly human, I will continue walking my own path — to contribute to the world, and to protect the smiles of those I hold dear.                </p>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};