import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/contexts/language-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pontal Stock - Sistema de Gestão de Estoque",
  description: "Sistema completo de gestão de estoque, compras, transferências e análises para sua operação",
  keywords: ["estoque", "gestão", "inventário", "PDV", "pontal"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <BrandingProvider>
            <LanguageProvider>
              {children}
              <Toaster position="top-right" richColors />
            </LanguageProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
