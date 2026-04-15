import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Bera Filo - Filo Yönetim Sistemi",
  description: "Filo Yönetim Sistemi",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png?v=2",
    apple: "/apple-touch-icon.png?v=2",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="light" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable} antialiased font-sans`} suppressHydrationWarning>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
