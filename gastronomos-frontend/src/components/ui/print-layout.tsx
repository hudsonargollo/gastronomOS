"use client"

import * as React from "react"
import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PrintLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showPrintButton?: boolean
  printButtonText?: string
  className?: string
  headerContent?: React.ReactNode
  footerContent?: React.ReactNode
  pageBreakAfter?: boolean
  orientation?: "portrait" | "landscape"
}

function PrintLayout({
  children,
  title,
  subtitle,
  showPrintButton = true,
  printButtonText = "Print",
  className,
  headerContent,
  footerContent,
  pageBreakAfter = false,
  orientation = "portrait",
}: PrintLayoutProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .print-hidden {
            display: none !important;
          }
          
          .print-visible {
            display: block !important;
          }
          
          .print-page-break-before {
            page-break-before: always;
          }
          
          .print-page-break-after {
            page-break-after: always;
          }
          
          .print-avoid-break {
            page-break-inside: avoid;
          }
          
          .print-landscape {
            size: landscape;
          }
          
          .print-portrait {
            size: portrait;
          }
          
          @page {
            margin: 1in;
            size: ${orientation};
          }
          
          .print-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 1in;
            background: white;
            border-bottom: 1px solid #ccc;
            padding: 0.5in;
            z-index: 1000;
          }
          
          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 0.5in;
            background: white;
            border-top: 1px solid #ccc;
            padding: 0.25in 0.5in;
            font-size: 12px;
            z-index: 1000;
          }
          
          .print-content {
            margin-top: ${headerContent ? '1.5in' : '0'};
            margin-bottom: ${footerContent ? '1in' : '0'};
          }
        }
        
        @media screen {
          .print-visible {
            display: none;
          }
        }
      `}</style>

      <div className={cn("print-layout", className, orientation === "landscape" && "print-landscape")}>
        {/* Screen-only Print Button */}
        {showPrintButton && (
          <div className="print-hidden mb-4 flex justify-end">
            <Button onClick={handlePrint} variant="outline">
              <PrinterIcon className="mr-2 h-4 w-4" />
              {printButtonText}
            </Button>
          </div>
        )}

        {/* Print Header */}
        {headerContent && (
          <div className="print-header print-visible">
            {headerContent}
          </div>
        )}

        {/* Main Content */}
        <div className={cn("print-content", pageBreakAfter && "print-page-break-after")}>
          {/* Title Section */}
          {(title || subtitle) && (
            <div className="mb-6 text-center print-avoid-break">
              {title && (
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-lg text-gray-600">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Content */}
          <div className="print-content-body">
            {children}
          </div>
        </div>

        {/* Print Footer */}
        {footerContent && (
          <div className="print-footer print-visible">
            {footerContent}
          </div>
        )}
      </div>
    </>
  )
}

export interface PrintTableProps {
  children: React.ReactNode
  className?: string
  breakInside?: "auto" | "avoid" | "avoid-page" | "avoid-column"
}

function PrintTable({
  children,
  className,
  breakInside = "avoid",
}: PrintTableProps) {
  return (
    <div 
      className={cn("print-table", className)}
      style={{ breakInside }}
    >
      {children}
    </div>
  )
}

export interface PrintSectionProps {
  children: React.ReactNode
  title?: string
  pageBreakBefore?: boolean
  pageBreakAfter?: boolean
  avoidBreak?: boolean
  className?: string
}

function PrintSection({
  children,
  title,
  pageBreakBefore = false,
  pageBreakAfter = false,
  avoidBreak = false,
  className,
}: PrintSectionProps) {
  return (
    <div
      className={cn(
        "print-section",
        pageBreakBefore && "print-page-break-before",
        pageBreakAfter && "print-page-break-after",
        avoidBreak && "print-avoid-break",
        className
      )}
    >
      {title && (
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}

// Hook for print detection
export function usePrintMode() {
  const [isPrinting, setIsPrinting] = React.useState(false)

  React.useEffect(() => {
    const beforePrint = () => setIsPrinting(true)
    const afterPrint = () => setIsPrinting(false)

    window.addEventListener("beforeprint", beforePrint)
    window.addEventListener("afterprint", afterPrint)

    // Also check for print media query
    const mediaQuery = window.matchMedia("print")
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsPrinting(e.matches)
    }

    mediaQuery.addEventListener("change", handleMediaChange)
    setIsPrinting(mediaQuery.matches)

    return () => {
      window.removeEventListener("beforeprint", beforePrint)
      window.removeEventListener("afterprint", afterPrint)
      mediaQuery.removeEventListener("change", handleMediaChange)
    }
  }, [])

  return isPrinting
}

// Utility component for print-only content
export function PrintOnly({ children }: { children: React.ReactNode }) {
  return <div className="print-visible">{children}</div>
}

// Utility component for screen-only content
export function ScreenOnly({ children }: { children: React.ReactNode }) {
  return <div className="print-hidden">{children}</div>
}

export { PrintLayout, PrintTable, PrintSection }