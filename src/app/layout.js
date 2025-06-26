import "./globals.css";

import ClientLayout from "@/client-layout";

import { ViewTransitions } from "next-view-transitions";

export const metadata = {
  title: "WuWei Studio",
  description: "Creative Studio Website Template — Codegrid",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ViewTransitions>
          <ClientLayout>{children}</ClientLayout>
        </ViewTransitions>
      </body>
    </html>
  );
}
