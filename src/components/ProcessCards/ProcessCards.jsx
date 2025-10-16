"use client";
import "./ProcessCards.css";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ProcessCards = () => {
  const processCardsData = [
    {
      index: "01",
      title: "Web Design & Development",
      image: "/images/process/process_001.jpeg",
      description:
        "The heart of MIVRA’s craft. We merge graphic, typographic, and interactive elements into a single living canvas — designing and developing websites as functional works of art. Our approach values both aesthetics and usability, building systems that evolve gracefully over time.",
      description_ja:
        "MIVRAの核となる領域。グラフィック、タイポグラフィ、インタラクション、アニメーション——あらゆる要素を一枚のキャンバス上で有機的に結びつけ、機能する“作品”としてのウェブサイトを設計・開発します。美しさと操作性の共存、そして時間とともに進化していく構造を大切にしています。",
    },
    {
      index: "02",
      title: "Graphic Design & Art Direction",
      image: "/images/process/process_004.jpeg",
      description:
        "Tangible design that holds presence and depth. From visual identity to printed matter, we craft compositions with precision and silence — treating every piece as architectural space on paper.",
      description_ja:
        "印刷物、ロゴ、ビジュアルアイデンティティ。触れられるデザインとしての重みと美しさを追求します。構成・余白・質感にこだわり、ブランドが持つ空気感を“紙の上の建築物”のように設計します。",
    },
    {
      index: "03",
      title: "Photography",
      image: "/images/process/process_002.jpeg",
      description:
        "We capture stillness, light, and texture — revealing the quiet strength within every subject. Each frame is guided by the atmosphere and intent of the brand, expressing beauty that speaks softly but stays in memory.",
      description_ja:
        "静寂の中に流れる空気、光、温度。被写体の“本質”をすくい上げるように撮影します。ブランドの世界観やプロジェクトの文脈に合わせて、静けさの中にある強さと美しさを引き出すことを意識しています。",
    },
    {
      index: "04",
      title: "Film & Motion",
      image: "/images/process/process_003.jpeg",
      description:
        "Designing the rhythm of light and time. Our films explore the harmony between stillness and motion — evoking quiet emotion and allowing audiences to feel the essence of a brand.",
      description_ja:
        "光と時間をデザインする領域。MIVRAでは“静”と“動”の調和を意識し、映像作品を構築します。見る人の感情を静かに動かし、世界観を深く体験させるための編集・構成・演出を追求します。",
    },
  ];

  useGSAP(() => {
    const processCards = document.querySelectorAll(".process-card");

    processCards.forEach((card, index) => {
      if (index < processCards.length - 1) {
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          endTrigger: processCards[processCards.length - 1],
          end: "top top",
          pin: true,
          pinSpacing: false,
          id: `card-pin-${index}`,
        });
      }

      if (index < processCards.length - 1) {
        ScrollTrigger.create({
          trigger: processCards[index + 1],
          start: "top bottom",
          end: "top top",
          onUpdate: (self) => {
            const progress = self.progress;
            const scale = 1 - progress * 0.25;
            const rotation = (index % 2 === 0 ? 5 : -5) * progress;
            const afterOpacity = progress;

            gsap.set(card, {
              scale: scale,
              rotation: rotation,
              "--after-opacity": afterOpacity,
            });
          },
        });
      }
    });
  }, []);

  return (
    <div className="process-cards">
      {processCardsData.map((cardData, index) => (
        <div key={index} className="process-card processCard">
          <div className="processCard_text">
            <div className="processCard_textTop">
              <div className="processCard_header">
                <span>{cardData.index}</span>
                <span>OUR APPROACH</span>
              </div>
              <h3 className="processCard_name">{cardData.title}</h3>
            </div>
            <div className="processCard_textBottom">
              <p className="processCard_desc">{cardData.description_ja}</p>
              <p className="processCard_desc en">{cardData.description}</p>
            </div>
          </div>
          <div className="processCard_img">
            <div className="processCard_imgWrapper">
              <img src={cardData.image} alt="" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProcessCards;
