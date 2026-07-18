import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HemoEdge",
  description:
    "WSI-based blood cell morphology training for laboratory professionals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
