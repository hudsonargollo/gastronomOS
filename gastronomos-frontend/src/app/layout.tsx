import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/contexts/language-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GastronomOS - O Sistema Operacional do seu Restaurante",
  description: "O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises",
  keywords: ["restaurante", "gestão", "estoque", "PDV", "gastronomia"],
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
