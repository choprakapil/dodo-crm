import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "DODO CRM — Multi-Tenant SaaS",
  description: "Enterprise multi-tenant CRM for high-velocity teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-indigo-100 selection:text-indigo-900">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
