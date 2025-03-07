import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrivyProvider from "./providers/PrivyProvider";
import NotificationProvider from "./contexts/NotificationContext";
import { AppInitializer } from "./components/AppInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AllNdas, All Nads",
  description: "Degen AI Buddy for All",
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
        <PrivyProvider>
          <NotificationProvider>
            <AppInitializer />
            {children}
          </NotificationProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
