import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.knewsearch.com"),
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
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
