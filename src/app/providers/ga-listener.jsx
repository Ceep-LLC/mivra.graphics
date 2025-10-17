"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function GaListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  useEffect(() => {
    if (!gaId || !window.gtag) return;
    window.gtag("config", gaId, {
      page_path: pathname + searchParams.toString(),
    });
  }, [pathname, searchParams, gaId]);

  return null;
}