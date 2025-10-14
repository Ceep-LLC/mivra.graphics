import "./globals.css";
import ClientLayout from "@/client-layout";
import { ViewTransitions } from "next-view-transitions";
import localFont from "next/font/local";  

const myFont = localFont({
  src: [
    { path: "../fonts/AmelieFierce-Regular.otf", weight: "400", style: "normal" },
  ],
  variable: "--font-unique-en",
  display: "swap",
});

export const metadata = {
  title: "MIVRA | 磯上デザイン事務所 - 福島県いわき市のロゴ・名刺・パンフレット制作",
  description: "MIVRA（ミブラ）は福島県いわき市のデザイン事務所です。ロゴ・名刺・パンフレットなどのグラフィック制作を通じて、企業や店舗の本質を映し出すブランディングを行います。地方発の本物志向デザインを全国へ。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className={myFont.variable}>
      <body>
        <ViewTransitions>
          <ClientLayout>{children}</ClientLayout>
        </ViewTransitions>
      </body>
    </html>
  );
}
