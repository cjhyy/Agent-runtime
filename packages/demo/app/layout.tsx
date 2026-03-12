import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Runtime Demo",
  description: "Q&A demo with browser SDK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* Agent Runtime SDK - 自动连接到 AgentServer */}
        <Script
          src="/agent-runtime-sdk.js"
          data-ws-url="ws://localhost:3100"
          data-page-id="demo-qa"
          data-auto-connect="true"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
