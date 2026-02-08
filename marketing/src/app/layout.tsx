import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnewSearch | AI Search Visibility Analytics",
  description:
    "See how your brand appears in AI-generated search answers. KnewSearch measures brand visibility, citations, and volatility across AI search experiences that traditional SEO cannot track.",
  keywords: [
    "AI search visibility",
    "AI search analytics",
    "brand monitoring",
    "AI search optimization",
    "ChatGPT visibility",
    "Gemini visibility",
    "Perplexity visibility",
    "AEO",
    "AI engine optimization",
  ],
  openGraph: {
    title: "KnewSearch | AI Search Visibility Analytics",
    description:
      "See how your brand appears in AI-generated search answers. Measure visibility, citations, and volatility across AI search.",
    url: "https://knewsearch.com",
    siteName: "KnewSearch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KnewSearch | AI Search Visibility Analytics",
    description:
      "See how your brand appears in AI-generated search answers.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
