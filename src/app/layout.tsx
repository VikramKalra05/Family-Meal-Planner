import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SwCleanup } from "@/components/sw-cleanup";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family Meal Planner",
  description:
    "AI-powered personalized nutrition for the whole household — plans, pantry, shopping and cooking.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MealPlanner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-amber-50">
        <SwCleanup />
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
