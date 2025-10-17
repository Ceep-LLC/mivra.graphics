"use client";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function GaInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  useEffect(() => {
    if (!gaId || !window.gtag) return;
    const url = pathname + (searchParams?.toString() ? "?" + searchParams.toString() : "");
    window.gtag("config", gaId, { page_path: url });
  }, [pathname, searchParams, gaId]);

  return null;
}

export default function GaListener() {
  // Suspense で囲むことでNext.js 15対応
  return (
    <Suspense fallback={null}>
      <GaInner />
    </Suspense>
  );
}