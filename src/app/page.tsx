import type { Metadata } from "next";
import { HemoedgeLanding } from "@/components/landing/hemoedge-landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "HemoEdge — Blood film morphology training for laboratory professionals",
  description:
    "A whole slide imaging platform for blood cell morphology training and competency, built for the laboratory workforce. Consultant-reviewed cases, a manual differential counter, guided annotation and an AI tutor grounded in curated content.",
  openGraph: {
    title: "HemoEdge — Blood film morphology training for laboratory professionals",
    description:
      "Whole slide imaging, consultant-reviewed cases, a manual differential counter and an AI tutor grounded in curated morphology content. Join the waitlist.",
    type: "website",
    url: "https://hemoedge.ai",
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 110 150'%3E%3Crect x='6' y='10' width='38' height='130' rx='7' fill='none' stroke='%238A8FA4' stroke-width='4'/%3E%3Crect x='66' y='10' width='38' height='130' rx='7' fill='none' stroke='%238A8FA4' stroke-width='4'/%3E%3Cpath d='M10 96h30v37a7 7 0 01-7 7H17a7 7 0 01-7-7z' fill='%230B1440'/%3E%3Cpath d='M70 96h30v37a7 7 0 01-7 7H77a7 7 0 01-7-7z' fill='%230B1440'/%3E%3Ccircle cx='55' cy='80' r='25' fill='%23F6F1E7'/%3E%3Ccircle cx='55' cy='80' r='21' fill='%237A0018'/%3E%3Ccircle cx='49' cy='74' r='9' fill='%23B01A2E'/%3E%3C/svg%3E",
  },
};

export default function Home() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router page; this rule targets the Pages Router's _document.js and doesn't apply here. React hoists this <link> into <head>. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Montserrat:wght@700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap"
        rel="stylesheet"
      />
      <HemoedgeLanding />
    </>
  );
}
