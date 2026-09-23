import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// The marketing site (hemoedge.ai) uses Archivo for its bold display
// headings — matching it here keeps section titles like "Whole Slide
// Viewer" visually consistent with the site a learner arrives from.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "HemoEdge",
  description:
    "WSI-based blood cell morphology training for laboratory professionals.",
};

// Runs before hydration so a returning visitor's saved preference applies
// before first paint — no flash of the wrong theme, and (unlike reading a
// cookie in this layout) it doesn't force every page in the app to render
// dynamically just to know the theme.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("he-theme");
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${archivo.variable}`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-surface text-ink">{children}</body>
    </html>
  );
}
