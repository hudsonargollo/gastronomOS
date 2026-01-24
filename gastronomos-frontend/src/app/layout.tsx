import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LanguageProvider } from "@/contexts/language-context";
import { AnimationProvider } from "@/contexts/animation-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { DevPerformanceMonitor } from "@/components/ui/performance-monitor";
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
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <ThemeProvider
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AnimationProvider>
            <LanguageProvider>
              {children}
              <Toaster position="top-right" richColors />
              <DevPerformanceMonitor />
            </LanguageProvider>
          </AnimationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
