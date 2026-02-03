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
      <body className="bg-gray-50 text-gray-900 antialiased">
        <BrandProvider>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </BrandProvider>
      </body>
    </html>
  );
}
