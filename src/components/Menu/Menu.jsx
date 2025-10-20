"use client";
import "./Menu.css";
import { useRef, useState, useEffect } from "react";

import { useTransitionRouter } from "next-view-transitions";
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(CustomEase);
CustomEase.create("hop", ".15, 1, .25, 1");

const Menu = ({ onMenuStateChange }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [currentTime, setCurrentTime] = useState("");
  const router = useTransitionRouter();

  const menuRef = useRef(null);
  const navRef = useRef(null);
  const menuOverlayRef = useRef(null);

  const navLogoRef = useRef(null);
  const menuBtnRef = useRef(null);

  const closeBtnRef = useRef(null);

  const menuItemsRef = useRef(null);
  const menuFooterColsRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now
        .toLocaleTimeString("en-US", {
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
        .replace(/:/g, ":")
        .toUpperCase();
      setCurrentTime(timeString);
    };

    updateTime();

    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      if (typeof window !== "undefined") {
        setCurrentPath(window.location.pathname);
      }
    };

    window.addEventListener("popstate", handleRouteChange);

    router.events?.on?.("routeChangeComplete", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      router.events?.off?.("routeChangeComplete", handleRouteChange);
    };
  }, [router]);

  useGSAP(
    () => {
      gsap.set(menuOverlayRef.current, {
        opacity: 0,
        pointerEvents: "none",
      });

      gsap.set(closeBtnRef.current, {
        y: "100%",
      });

      gsap.set(".menu-overlay-items .revealer a", {
        y: "100%",
      });

      gsap.set(".menu-footer .revealer p, .menu-footer .revealer a", {
        y: "100%",
      });
    },
    { scope: menuRef }
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

  const getExactPath = () => {
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return currentPath;
  };

  const isExactPath = (path) => {
    const exactCurrentPath = getExactPath();
    return exactCurrentPath === path;
  };

  const navigateTo = (path) => {
    if (isAnimating) return;

    if (isExactPath(path)) {
      closeMenu();
      return;
    }

    closeMenu();

    setTimeout(() => {
      router.push(path, {
        onTransitionReady: slideInOut,
      });
    }, 0);
  };

  const openMenu = () => {
    if (isAnimating) return;

    onMenuStateChange?.(true);

    setIsAnimating(true);
    const tl = gsap.timeline({
      onComplete: () => setIsAnimating(false),
    });

    tl.to(menuBtnRef.current, {
      y: "-100%",
      duration: 0.5,
      ease: "power3.out",
      onComplete: () => {
        navRef.current.style.pointerEvents = "none";
        gsap.set(menuBtnRef.current, { y: "100%" });
      },
    });

    tl.to(
      menuOverlayRef.current,
      {
        opacity: 1,
        duration: 0.5,
        ease: "power3.out",
        onStart: () => {
          menuOverlayRef.current.style.pointerEvents = "all";
        },
      },
      "-=0.45"
    );

    tl.to(
      closeBtnRef.current,
      {
        y: "0%",
        duration: 1,
        ease: "power3.out",
      },
      "-=0.5"
    );

    tl.to(
      ".menu-overlay-items .revealer a",
      {
        y: "0%",
        duration: 1,
        stagger: 0.075,
        ease: "power3.out",
      },
      "<"
    );

    tl.to(
      ".menu-footer .revealer p, .menu-footer .revealer a",
      {
        y: "0%",
        duration: 1,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.5,
      },
      "<"
    );
  };

  const closeMenu = () => {
    if (isAnimating) return;

    onMenuStateChange?.(false);

    setIsAnimating(true);
    const tl = gsap.timeline({
      onComplete: () => setIsAnimating(false),
    });

    tl.to(closeBtnRef.current, {
      y: "-100%",
      duration: 0.5,
      ease: "power3.out",
    });

    tl.to(
      ".menu-overlay-items .revealer a",
      {
        y: "-100%",
        duration: 0.5,
        stagger: 0.05,
        ease: "power3.in",
      },
      "<"
    );

    tl.to(
      ".menu-footer .revealer p, .menu-footer .revealer a",
      {
        y: "-100%",
        duration: 0.5,
        stagger: 0.05,
        ease: "power3.in",
      },
      "<"
    );

    tl.to(
      menuOverlayRef.current,
      {
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        onComplete: () => {
          menuOverlayRef.current.style.pointerEvents = "none";

          gsap.set(closeBtnRef.current, {
            y: "100%",
          });

          gsap.set(".menu-overlay-items .revealer a", {
            y: "100%",
          });

          gsap.set(".menu-footer .revealer p, .menu-footer .revealer a", {
            y: "100%",
          });
        },
      },
      "+=0.1"
    );

    tl.to(
      menuBtnRef.current,
      {
        y: "0%",
        duration: 0.5,
        ease: "power3.out",
        onStart: () => {
          navRef.current.style.pointerEvents = "all";
        },
      },
      "-=0.45"
    );
  };

  return (
    <>
      <header className="nav-container">
        <div className="nav" ref={navRef}>
          <div className="nav-logo">
            <h1 className="revealer">
              <a
                href="/"
                ref={navLogoRef}
                onClick={(e) => {
                  e.preventDefault();
                  if (isExactPath("/")) return;

                  router.push("/", {
                    onTransitionReady: slideInOut,
                  });
                }}
              >
                <img
                  className="logo-img"
                  src="/images/logos/logo_type_wh.svg"
                  alt="MIVRA(ミブラ)"
                />
              </a>
            </h1>
          </div>
          <div className="nav-items">
            <div className="nav-menu-time">
              <div className="revealer">
                <p className="sm caps mono">{currentTime}</p>
              </div>
            </div>

            <div className="nav-menu-toggle-open">
              <div className="revealer" onClick={openMenu}>
                <p className="openText sm caps mono" ref={menuBtnRef}>
                  <span className="dot"><span></span></span>
                  <span>Menu</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="menu" ref={menuRef}>
        <div className="menu-overlay" ref={menuOverlayRef}>
          <div className="menu-overlay-nav">
            <div className="menu-overlay-nav-toggle-close">
              <div className="revealer" onClick={closeMenu}>
                <p className="sm caps mono" ref={closeBtnRef}>
                  Close
                </p>
              </div>
            </div>
          </div>
          <div className="menu-overlay-items" ref={menuItemsRef}>
            <div className="revealer">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/");
                }}
              >
                <h1>TOPPAGE,</h1>
              </a>
            </div>
            <div className="revealer">
              <a
                href="/work"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/work");
                }}
              >
                <h1>WORKS,</h1>
              </a>
            </div>
            <div className="revealer">
              <a
                href="/studio"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/studio");
                }}
              >
                <h1>studio,</h1>
              </a>
            </div>
            <div className="revealer">
              <a
                href="/archive"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/archive");
                }}
              >
                <h1>archive,</h1>
              </a>
            </div>
            <div className="revealer">
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/contact");
                }}
              >
                <h1>contact</h1>
              </a>
            </div>
          </div>
          <div className="menuFooter menu-footer" ref={menuFooterColsRef}>
            <div className="menu-footer-col">
              <div className="revealer"><p className="menuFooter_item"><a href="/contact" onClick={(e) => {e.preventDefault(); navigateTo("/contact");}}>Web Form</a></p></div>
              <div className="revealer"><p className="menuFooter_item"><a href="tel:0246-88-8956">+81 246 88 8956</a></p></div>
              <div className="revealer"><p className="menuFooter_item"><a href="mailto:hello@mivra.graphics">hello@mivra.graphics</a></p></div>
              <div className="revealer"><p className="menuFooter_item"><a href="https://www.instagram.com/kzs86/" target="_blank">@kzs86</a></p></div>
              <div className="revealer"><p className="menuFooter_item"><a href="https://maps.app.goo.gl/BfKZVLpT37LvCr3n7" target="_blank">Google Map</a></p></div>
            </div>
            <div className="menu-footer-col">
              <div className="socials">
                <div className="revealer">
                  <p>&copy; 2025 MIVRA</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Menu;
