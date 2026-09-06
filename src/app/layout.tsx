import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  display: "swap",
  variable: "--font-geist-sans",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://studysourced.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "StudySourced AI | Course-grounded study tools",
  description:
    "Create editable assessments and citation-backed tutoring from your private course materials.",
  openGraph: {
    title: "StudySourced AI | Course-grounded study tools",
    description:
      "Create editable assessments and citation-backed tutoring from your private course materials.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StudySourced AI | Course-grounded study tools",
    description:
      "Create editable assessments and citation-backed tutoring from your private course materials.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
