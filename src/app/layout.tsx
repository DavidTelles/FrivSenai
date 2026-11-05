import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display-face" });

export const metadata: Metadata = {
  title: { default: "FrivSenai — Play and share browser games", template: "%s · FrivSenai" },
  description: "Discover community-made games, play instantly in your browser and publish your own.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 py-8 text-sm text-muted">FrivSenai — made by the community.</footer>
      </body>
    </html>
  );
}
