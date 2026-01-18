"use client"

import * as React from "react"
import { DownloadIcon, FileTextIcon, FileSpreadsheetIcon, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import * as Papa from "papaparse"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ExportFormat = 'csv' | 'json' | 'pdf' | 'excel'

export interface ExportColumn {
  key: string
  label: string
  format?: (value: any) => string
}

export interface ExportDataProps<T> {
  data: T[]
  columns: ExportColumn[]
  filename?: string
  formats?: ExportFormat[]
  onExport?: (format: ExportFormat, data: T[]) => void
  className?: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  disabled?: boolean
  children?: React.ReactNode
}

function ExportData<T extends Record<string, any>>({
  data,
  columns,
  filename = "export",
  formats = ['csv', 'json', 'pdf'],
  onExport,
  className,
  size = "default",
  variant = "outline",
  disabled = false,
  children,
}: ExportDataProps<T>) {
  const [isExporting, setIsExporting] = React.useState(false)

  const downloadFile = (content: string | Blob, filename: string, type: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatValue = (value: any, column: ExportColumn): string => {
    if (column.format) {
      return column.format(value)
    }
    
    if (value === null || value === undefined) {
      return ""
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    
    return String(value)
  }

  const exportToCSV = () => {
    try {
      const csvData = data.map(row => {
        const csvRow: Record<string, string> = {}
        columns.forEach(column => {
          csvRow[column.label] = formatValue(row[column.key], column)
        })
        return csvRow
      })

      const csv = Papa.unparse(csvData, {
        header: true,
        skipEmptyLines: true,
      })

      downloadFile(csv, `${filename}.csv`, 'text/csv')
      toast.success(`Exported ${data.length} rows to CSV`)
    } catch (error) {
      console.error('CSV export error:', error)
      toast.error('Failed to export CSV')
    }
  }

  const exportToJSON = () => {
    try {
      const jsonData = data.map(row => {
        const jsonRow: Record<string, any> = {}
        columns.forEach(column => {
          jsonRow[column.key] = row[column.key]
        })
        return jsonRow
      })

      const json = JSON.stringify(jsonData, null, 2)
      downloadFile(json, `${filename}.json`, 'application/json')
      toast.success(`Exported ${data.length} rows to JSON`)
    } catch (error) {
      console.error('JSON export error:', error)
      toast.error('Failed to export JSON')
    }
  }

  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF()
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20
      const lineHeight = 10
      let yPosition = margin

      // Title
      pdf.setFontSize(16)
      pdf.text(`${filename} Export`, margin, yPosition)
      yPosition += lineHeight * 2

      // Headers
      pdf.setFontSize(10)
      const columnWidth = (pageWidth - margin * 2) / columns.length
      columns.forEach((column, index) => {
        pdf.text(column.label, margin + index * columnWidth, yPosition)
      })
      yPosition += lineHeight

      // Data rows
      pdf.setFontSize(8)
      data.forEach((row, rowIndex) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage()
          yPosition = margin
        }

        columns.forEach((column, colIndex) => {
          const value = formatValue(row[column.key], column)
          const text = value.length > 20 ? value.substring(0, 17) + '...' : value
          pdf.text(text, margin + colIndex * columnWidth, yPosition)
        })
        yPosition += lineHeight
      })

      pdf.save(`${filename}.pdf`)
      toast.success(`Exported ${data.length} rows to PDF`)
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Failed to export PDF')
    }
  }

  const exportToExcel = () => {
    try {
      // Create CSV format that Excel can open
      const csvData = data.map(row => {
        const csvRow: Record<string, string> = {}
        columns.forEach(column => {
          csvRow[column.label] = formatValue(row[column.key], column)
        })
        return csvRow
      })

      const csv = Papa.unparse(csvData, {
        header: true,
        skipEmptyLines: true,
      })

      // Add BOM for proper Excel UTF-8 handling
      const bom = '\uFEFF'
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      
      downloadFile(blob, `${filename}.csv`, 'text/csv')
      toast.success(`Exported ${data.length} rows to Excel format`)
    } catch (error) {
      console.error('Excel export error:', error)
      toast.error('Failed to export Excel format')
    }
  }

  const handleExport = async (format: ExportFormat) => {
    if (isExporting || disabled || data.length === 0) return

    setIsExporting(true)
    
    try {
      // Call custom export handler if provided
      if (onExport) {
        await onExport(format, data)
        return
      }

      // Default export handlers
      switch (format) {
        case 'csv':
          exportToCSV()
          break
        case 'json':
          exportToJSON()
          break
        case 'pdf':
          await exportToPDF()
          break
        case 'excel':
          exportToExcel()
          break
        default:
          toast.error(`Export format "${format}" not supported`)
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
      case 'excel':
        return <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
      case 'json':
        return <FileTextIcon className="mr-2 h-4 w-4" />
      case 'pdf':
        return <FileTextIcon className="mr-2 h-4 w-4" />
      default:
        return <DownloadIcon className="mr-2 h-4 w-4" />
    }
  }

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return 'Export as CSV'
      case 'json':
        return 'Export as JSON'
      case 'pdf':
        return 'Export as PDF'
      case 'excel':
        return 'Export as Excel'
      default:
        return `Export as ${(format as string).toUpperCase()}`
    }
  }

  if (data.length === 0) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={true}
        className={className}
      >
        <DownloadIcon className="mr-2 h-4 w-4" />
        {children || "Export"}
      </Button>
    )
  }

  if (formats.length === 1) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={disabled || isExporting}
        onClick={() => handleExport(formats[0])}
        className={className}
      >
        {isExporting ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Exporting...
          </>
        ) : (
          <>
            {getFormatIcon(formats[0])}
            {children || getFormatLabel(formats[0])}
          </>
        )}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Exporting...
            </>
          ) : (
            <>
              <DownloadIcon className="mr-2 h-4 w-4" />
              {children || "Export"}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={isExporting}
          >
            {getFormatIcon(format)}
            {getFormatLabel(format)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ExportData }