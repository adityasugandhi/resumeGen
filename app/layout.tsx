import type { Metadata } from "next";
import { Toaster } from 'sonner';
import { DM_Sans, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import "./globals.css";

// Modern sans-serif for UI elements
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

// Editorial serif for headlines
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

// Code font
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "CareerForge | AI-Powered Resume Builder",
  description: "A local-first, AI-powered resume optimization platform with LaTeX editing and intelligent job matching",
  keywords: ["resume", "LaTeX", "AI", "job search", "career"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${playfair.variable} ${jetbrains.variable}`}
    >
      <body className="antialiased font-sans">
        {children}
        <Toaster
          richColors
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
      </body>
    </html>
  );
}
