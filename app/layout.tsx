import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaunchVerdict — one card per release: keep it or roll it back",
  description:
    "For solo makers who ship every week with AI. Each release becomes one black-and-white verdict card: did it help or hurt the flow that matters?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
