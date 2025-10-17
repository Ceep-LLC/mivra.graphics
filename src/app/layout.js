import "./globals.css";
import ClientLayout from "@/client-layout";
import CustomCursor from "@/components/CustomCursor";
import NoiseOverlay from "@/components/NoiseOverlay";
import { ViewTransitions } from "next-view-transitions";
import localFont from "next/font/local";  
import { SITE } from "@/lib/site";
import SeoJsonLd from "@/components/SeoJsonLd";
import Analytics from "@/components/Analytics";
import GaListener from "@/app/providers/ga-listener";

// 英字
const enFont = localFont({
  src: [
    { path: "../fonts/AmelieFierce-Regular.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-unique-en",
  display: "swap",
});
const enFontMain = localFont({
  src: [
    { path: "../fonts/HelveticaNeueCyr_Medium.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-main-en",
  display: "swap",
});

// 日本語本文用
const jpFont = localFont({
  src: [
    { path: "../fonts/ZenKakuGothicNew-Medium.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-main-jp",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(SITE.domain),
  title: {
    default: `MIVRA | 磯上和志 - 福島県いわき市のデザインスタジオ`,
    template: `%s | MIVRA`,
  },
  description: SITE.description,
  alternates: {
    canonical: SITE.domain,
  },
  openGraph: {
    type: "website",
    url: SITE.domain,
    title: "MIVRA | 磯上和志 - 福島県いわき市のデザインスタジオ",
    description: SITE.description,
    siteName: SITE.name,
    locale: SITE.locale,
    images: [
      { url: SITE.ogImage, width: 1200, height: 630, alt: "MIVRA - Studio" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter || undefined,
    creator: SITE.twitter || undefined,
    title: "MIVRA | Kazushi Isogami",
    description: SITE.description,
    images: [SITE.ogImage],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className={`${enFont.variable} ${jpFont.variable} ${enFontMain.variable}`}>
      <body>
        <SeoJsonLd />
        <ViewTransitions>
          <ClientLayout>
            <GaListener />
            {children}
            <CustomCursor />
            <NoiseOverlay />
            <Analytics />
          </ClientLayout>
        </ViewTransitions>
      </body>
    </html>
  );
}
