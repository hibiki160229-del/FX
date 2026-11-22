import type { Metadata } from "next";
import { Noto_Sans_JP, Shippori_Mincho } from "next/font/google";
import "./globals.css";

const display = Shippori_Mincho({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "円脈 ENMYAKU — USD/JPY テクニカル＆ペーパー取引",
  description:
    "USD/JPY のローソク足・テクニカル指標・シグナルヒント・仮想取引。自動売買は後続。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
