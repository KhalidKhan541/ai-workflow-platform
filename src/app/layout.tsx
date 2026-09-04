import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "AutoFlow - AI-Powered Workflow Automation",
    template: "%s | AutoFlow",
  },
  description: "Enterprise-grade AI workflow automation platform. Build, deploy, and manage intelligent workflows that scale with your business.",
  keywords: ["workflow automation", "AI", "enterprise", "integration", "no-code", "low-code"],
  authors: [{ name: "AutoFlow Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AutoFlow",
    title: "AutoFlow - AI-Powered Workflow Automation",
    description: "Enterprise-grade AI workflow automation platform.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
