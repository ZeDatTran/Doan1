import type React from "react";
import { Inter, Roboto_Mono } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata = {
  title: "IoT Device Management",
  description: "Quản lý thiết bị IoT thông minh",
  generator: "",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${robotoMono.variable} antialiased`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
