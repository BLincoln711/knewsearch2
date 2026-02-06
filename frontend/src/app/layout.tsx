import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-context";
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
        <AuthProvider>
          <BrandProvider>
            <Nav />
            <main className="section-container py-10">
              {children}
            </main>
          </BrandProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
