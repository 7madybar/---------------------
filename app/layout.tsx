import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VG+ | صندوق التواصل المباشر",
  description: "شارك أفكارك واقتراحاتك وملاحظاتك مع فريق Visionary Growth.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
