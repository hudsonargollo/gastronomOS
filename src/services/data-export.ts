import { z } from 'zod';

/**
 * Advanced Data Export Service
 * Requirements: 9.3, 9.4
 */

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx' | 'pdf';
  fields?: string[];
  filters?: Record<string, any>;
  sorting?: {
    field: string;
    order: 'asc' | 'desc';
  };
  limit?: number;
  includeHeaders?: boolean;
  filename?: string;
}

export interface ExportResult {
  success: boolean;
  data?: string | Buffer;
  filename: string;
  mimeType: string;
  size: number;
  recordCount: number;
  error?: string;
}

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  includeCharts?: boolean;
  includeMetadata?: boolean;
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Export validation schema
 */
export const exportOptionsSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx', 'pdf']),
  fields: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
  sorting: z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']),
  }).optional(),
  limit: z.number().int().min(1).max(100000).default(10000),
  includeHeaders: z.boolean().default(true),
  filename: z.string().optional(),
});

/**
 * Data Export Service
 */
export class DataExportService {
  /**
   * Export data to CSV format
   */
  static async exportToCSV(
    data: any[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const { fields, includeHeaders = true, filename } = options;
      
      if (data.length === 0) {
        return {
          success: false,
          filename: filename || 'export.csv',
          mimeType: 'text/csv',
          size: 0,
          recordCount: 0,
          error: 'No data to export',
        };
      }

      // Determine fields to export
      const exportFields = fields || Object.keys(data[0]);
      
      // Generate CSV content
      let csvContent = '';
      
      // Add headers
      if (includeHeaders) {
        csvContent += exportFields.map(field => this.escapeCsvValue(field)).join(',') + '\n';
      }
      
      // Add data rows
      for (const record of data) {
        const row = exportFields.map(field => {
          const value = record[field];
          return this.escapeCsvValue(this.formatCsvValue(value));
        }).join(',');
        csvContent += row + '\n';
      }

      const buffer = Buffer.from(csvContent, 'utf-8');
      
      return {
        success: true,
        data: csvContent,
        filename: filename || `export_${Date.now()}.csv`,
        mimeType: 'text/csv',
        size: buffer.length,
        recordCount: data.length,
      };
    } catch (error) {
      console.error('CSV export error:', error);
      return {
        success: false,
        filename: filename || 'export.csv',
        mimeType: 'text/csv',
        size: 0,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export data to JSON format
   */
  static async exportToJSON(
    data: any[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const { fields, filename } = options;
      
      // Filter fields if specified
      let exportData = data;
      if (fields && fields.length > 0) {
        exportData = data.map(record => {
          const filteredRecord: any = {};
          fields.forEach(field => {
            if (record[field] !== undefined) {
              filteredRecord[field] = record[field];
            }
          });
          return filteredRecord;
        });
      }

      // Generate JSON with metadata
      const jsonData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          recordCount: exportData.length,
          fields: fields || (data.length > 0 ? Object.keys(data[0]) : []),
        },
        data: exportData,
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      
      return {
        success: true,
        data: jsonString,
        filename: filename || `export_${Date.now()}.json`,
        mimeType: 'application/json',
        size: buffer.length,
        recordCount: exportData.length,
      };
    } catch (error) {
      console.error('JSON export error:', error);
      return {
        success: false,
        filename: filename || 'export.json',
        mimeType: 'application/json',
        size: 0,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export data to Excel format (XLSX)
   */
  static async exportToXLSX(
    data: any[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Note: In a real implementation, you would use a library like 'xlsx' or 'exceljs'
      // For now, we'll create a basic implementation that generates CSV-like content
      // but with XLSX mime type for demonstration
      
      const { fields, includeHeaders = true, filename } = options;
      
      if (data.length === 0) {
        return {
          success: false,
          filename: filename || 'export.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 0,
          recordCount: 0,
          error: 'No data to export',
        };
      }

      // For demonstration, we'll create a simple tab-separated format
      // In production, use a proper XLSX library
      const exportFields = fields || Object.keys(data[0]);
      
      let content = '';
      
      // Add headers
      if (includeHeaders) {
        content += exportFields.join('\t') + '\n';
      }
      
      // Add data rows
      for (const record of data) {
        const row = exportFields.map(field => {
          const value = record[field];
          return this.formatExcelValue(value);
        }).join('\t');
        content += row + '\n';
      }

      const buffer = Buffer.from(content, 'utf-8');
      
      return {
        success: true,
        data: buffer,
        filename: filename || `export_${Date.now()}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: buffer.length,
        recordCount: data.length,
      };
    } catch (error) {
      console.error('XLSX export error:', error);
      return {
        success: false,
        filename: filename || 'export.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 0,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export data to PDF report format
   */
  static async exportToPDF(
    data: any[],
    options: ExportOptions,
    reportOptions?: PDFReportOptions
  ): Promise<ExportResult> {
    try {
      // Note: In a real implementation, you would use a library like 'puppeteer', 'jsPDF', or 'pdfkit'
      // For now, we'll create a basic HTML representation that could be converted to PDF
      
      const { fields, filename } = options;
      const {
        title = 'Data Export Report',
        subtitle,
        includeMetadata = true,
        pageSize = 'A4',
        orientation = 'portrait',
      } = reportOptions || {};
      
      if (data.length === 0) {
        return {
          success: false,
          filename: filename || 'export.pdf',
          mimeType: 'application/pdf',
          size: 0,
          recordCount: 0,
          error: 'No data to export',
        };
      }

      const exportFields = fields || Object.keys(data[0]);
      
      // Generate HTML content for PDF conversion
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .subtitle { font-size: 16px; color: #666; margin-bottom: 20px; }
            .metadata { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .page-break { page-break-before: always; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${title}</div>
            ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
          </div>
      `;

      // Add metadata section
      if (includeMetadata) {
        htmlContent += `
          <div class="metadata">
            <h3>Report Information</h3>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Total Records:</strong> ${data.length}</p>
            <p><strong>Fields:</strong> ${exportFields.join(', ')}</p>
            <p><strong>Page Size:</strong> ${pageSize}</p>
            <p><strong>Orientation:</strong> ${orientation}</p>
          </div>
        `;
      }

      // Add data table
      htmlContent += `
        <table>
          <thead>
            <tr>
              ${exportFields.map(field => `<th>${this.escapeHtml(field)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
      `;

      // Add data rows (limit to prevent huge PDFs)
      const maxRows = Math.min(data.length, 1000);
      for (let i = 0; i < maxRows; i++) {
        const record = data[i];
        htmlContent += '<tr>';
        exportFields.forEach(field => {
          const value = record[field];
          htmlContent += `<td>${this.escapeHtml(this.formatPdfValue(value))}</td>`;
        });
        htmlContent += '</tr>';
        
        // Add page break every 50 rows
        if ((i + 1) % 50 === 0 && i < maxRows - 1) {
          htmlContent += '</tbody></table><div class="page-break"></div><table><thead><tr>';
          htmlContent += exportFields.map(field => `<th>${this.escapeHtml(field)}</th>`).join('');
          htmlContent += '</tr></thead><tbody>';
        }
      }

      htmlContent += `
          </tbody>
        </table>
        </body>
        </html>
      `;

      const buffer = Buffer.from(htmlContent, 'utf-8');
      
      return {
        success: true,
        data: buffer,
        filename: filename || `report_${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        size: buffer.length,
        recordCount: Math.min(data.length, 1000),
      };
    } catch (error) {
      console.error('PDF export error:', error);
      return {
        success: false,
        filename: filename || 'export.pdf',
        mimeType: 'application/pdf',
        size: 0,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Main export method that delegates to specific format handlers
   */
  static async exportData(
    data: any[],
    options: ExportOptions,
    reportOptions?: PDFReportOptions
  ): Promise<ExportResult> {
    try {
      // Validate options
      const validatedOptions = exportOptionsSchema.parse(options);
      
      switch (validatedOptions.format) {
        case 'csv':
          return await this.exportToCSV(data, validatedOptions);
        case 'json':
          return await this.exportToJSON(data, validatedOptions);
        case 'xlsx':
          return await this.exportToXLSX(data, validatedOptions);
        case 'pdf':
          return await this.exportToPDF(data, validatedOptions, reportOptions);
        default:
          throw new Error(`Unsupported export format: ${validatedOptions.format}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        filename: options.filename || 'export',
        mimeType: 'application/octet-stream',
        size: 0,
        recordCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Utility methods for data formatting
   */
  private static escapeCsvValue(value: string): string {
    if (typeof value !== 'string') return String(value);
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private static formatCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return value.toString();
    return String(value);
  }

  private static formatExcelValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return value.toString();
    return String(value).replace(/\t/g, ' '); // Replace tabs with spaces
  }

  private static formatPdfValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  }

  private static escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML || text.replace(/[&<>"']/g, (match: string) => {
      const escapeMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return escapeMap[match] || match;
    });
  }
}

/**
 * Export utilities
 */
export const exportUtils = {
  /**
   * Generate filename with timestamp
   */
  generateFilename(prefix: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${timestamp}.${format}`;
  },

  /**
   * Get MIME type for format
   */
  getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      csv: 'text/csv',
      json: 'application/json',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
    };
    return mimeTypes[format] || 'application/octet-stream';
  },

  /**
   * Validate export permissions
   */
  validateExportPermissions(userRole: string, format: string): boolean {
    const permissions: Record<string, string[]> = {
      ADMIN: ['csv', 'json', 'xlsx', 'pdf'],
      MANAGER: ['csv', 'json', 'xlsx', 'pdf'],
      STAFF: ['csv', 'json'],
      VIEWER: ['csv'],
    };
    
    return permissions[userRole]?.includes(format) || false;
  },

  /**
   * Calculate estimated export size
   */
  estimateExportSize(recordCount: number, fieldCount: number, format: string): number {
    // Rough estimates in bytes
    const avgFieldSize = 20; // Average field size in characters
    const baseSize = recordCount * fieldCount * avgFieldSize;
    
    const formatMultipliers: Record<string, number> = {
      csv: 1,
      json: 1.5,
      xlsx: 2,
      pdf: 3,
    };
    
    return Math.round(baseSize * (formatMultipliers[format] || 1));
  },
};