import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "@/components/brand-context";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "KnewSearch Dashboard",
  description: "AEO Visibility Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <BrandProvider>
          <Nav />
          <main className="section-container py-10">
            {children}
          </main>
        </BrandProvider>
      </body>
    </html>
  );
}
