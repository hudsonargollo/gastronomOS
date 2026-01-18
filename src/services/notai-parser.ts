/**
 * Notai Parser Adaptation Service
 * 
 * Adapts the open-source Notai repository's heuristic parsing logic
 * for receipt text analysis and structured data extraction.
 * Implements requirements 4.1, 4.2, 4.3, 4.4, 4.5.
 */

// Core parsing interfaces
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NotaiParseResult {
  vendor: VendorInfo | null;
  transactionDate: Date | null;
  totalAmount: number | null;
  subtotal: number | null;
  tax: number | null;
  lineItems: LineItemCandidate[];
  confidence: ParseConfidence;
  parsingMetadata: ParsingMetadata;
}

export interface VendorInfo {
  name: string;
  confidence: number;
  coordinates?: BoundingBox;
}

export interface LineItemCandidate {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
  rawText: string;
  coordinates?: BoundingBox;
}

export interface ParseConfidence {
  overall: number; // 0-1 confidence score
  vendor: number;
  date: number;
  total: number;
  lineItems: number;
}

export interface ParsingMetadata {
  processingTime: number;
  ocrModel: string;
  parsingStrategy: string;
  textBlocks: number;
  coordinatesAvailable: boolean;
}

export type ParsingStrategy = 'AGGRESSIVE' | 'CONSERVATIVE' | 'ADAPTIVE';

// Notai Parser Service Interface
export interface INotaiParserService {
  parseReceiptText(text: string, strategy: ParsingStrategy, coordinates?: BoundingBox[]): Promise<NotaiParseResult>;
  extractTransactionDate(text: string): Date | null;
  extractTotalAmount(text: string): number | null;
  extractVendorName(text: string, coordinates?: BoundingBox[]): VendorInfo | null;
  extractLineItems(text: string): LineItemCandidate[];
}

/**
 * Notai Parser Service Implementation
 * Adapts proven heuristic parsing patterns from the Notai repository
 */
export class NotaiParserService implements INotaiParserService {
  
  // Date extraction patterns (adapted from Notai)
  private static readonly DATE_PATTERNS = [
    // MM/DD/YYYY formats
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    /\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/g,
    
    // DD/MM/YYYY formats
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    
    // MM-DD-YYYY formats
    /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g,
    /\b(\d{1,2})-(\d{1,2})-(\d{2})\b/g,
    
    // Month DD, YYYY formats
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    
    // DD Month YYYY formats
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi,
    
    // ISO date formats
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    
    // Time-based patterns (for today's receipts)
    /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi
  ];

  // Amount extraction patterns (adapted from Notai)
  private static readonly AMOUNT_PATTERNS = [
    // Total patterns with various keywords
    /(?:total|amount|sum|grand\s*total|final\s*total|balance)\s*:?\s*\$?(\d+\.?\d*)/gi,
    
    // Currency patterns
    /\$\s*(\d+\.?\d*)/g,
    /(\d+\.?\d*)\s*USD/gi,
    /(\d+\.?\d*)\s*\$/g,
    
    // Decimal number patterns at end of lines (likely totals)
    /(\d+\.\d{2})\s*$/gm,
    
    // Large amounts (likely totals)
    /\b(\d{2,}\.\d{2})\b/g
  ];

  // Vendor name extraction patterns
  private static readonly VENDOR_PATTERNS = [
    // Common receipt headers (first few lines)
    /^([A-Z][A-Z\s&'-]{2,30})/gm,
    
    // Store name patterns
    /(?:store|shop|restaurant|cafe|market|deli|pizza|burger|coffee)\s*:?\s*([A-Z][A-Za-z\s&'-]{2,30})/gi,
    
    // Business name patterns (all caps, multiple words)
    /^([A-Z]{2,}\s+[A-Z\s&'-]{2,30})/gm,
    
    // Address-based extraction (business name often before address)
    /^([A-Z][A-Za-z\s&'-]{3,30})\s*\n.*(?:street|st|avenue|ave|road|rd|blvd|drive|dr)/gmi
  ];

  // Line item extraction patterns (enhanced for various receipt formats)
  private static readonly LINE_ITEM_PATTERNS = [
    // Quantity Description Price format (e.g., "2 Coffee $3.50")
    /^(\d+)\s+([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s+\$?(\d+\.?\d*)/gm,
    
    // Description Quantity @ Price format (e.g., "Coffee 2 @ $1.75")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s+(\d+)\s*@\s*\$?(\d+\.?\d*)/gm,
    
    // Description Price format (quantity assumed 1, e.g., "Coffee $3.50")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s+\$?(\d+\.?\d*)\s*$/gm,
    
    // Tab-separated format (e.g., "Coffee		$3.50")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\t+\$?(\d+\.?\d*)/gm,
    
    // Multi-space separated format (e.g., "Coffee    $3.50")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s{3,}\$?(\d+\.?\d*)/gm,
    
    // Dot leader format (e.g., "Coffee................$3.50")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\.{3,}\$?(\d+\.?\d*)/gm,
    
    // Dash separator format (e.g., "Coffee - $3.50")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s*-\s*\$?(\d+\.?\d*)/gm,
    
    // Colon separator format (e.g., "Coffee: $3.50")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s*:\s*\$?(\d+\.?\d*)/gm,
    
    // Parentheses quantity format (e.g., "Coffee (2) $7.00")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s*\((\d+)\)\s*\$?(\d+\.?\d*)/gm,
    
    // X quantity format (e.g., "Coffee x2 $7.00")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s*x(\d+)\s*\$?(\d+\.?\d*)/gm,
    
    // Asterisk quantity format (e.g., "Coffee *2 $7.00")
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s*\*(\d+)\s*\$?(\d+\.?\d*)/gm,
    
    // Price on next line format (multi-line items)
    /^([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s*\n\s*\$?(\d+\.?\d*)/gm,
    
    // SKU/Code format (e.g., "12345 Coffee $3.50")
    /^(\d{3,8})\s+([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s+\$?(\d+\.?\d*)/gm,
    
    // Department/Category format (e.g., "FOOD Coffee $3.50")
    /^([A-Z]{2,8})\s+([A-Za-z][A-Za-z\s\-&'#.]{2,40})\s+\$?(\d+\.?\d*)/gm
  ];

  // Tax and subtotal patterns
  private static readonly TAX_PATTERNS = [
    /(?:tax|vat|gst|hst)\s*:?\s*\$?(\d+\.?\d*)/gi,
    /(\d+\.?\d*)\s*tax/gi
  ];

  private static readonly SUBTOTAL_PATTERNS = [
    /(?:subtotal|sub\s*total|sub-total)\s*:?\s*\$?(\d+\.?\d*)/gi,
    /(?:before\s*tax|pre\s*tax)\s*:?\s*\$?(\d+\.?\d*)/gi
  ];

  // Month name mappings
  private static readonly MONTH_NAMES: { [key: string]: number } = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };

  /**
   * Main parsing method - orchestrates all parsing operations
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  async parseReceiptText(
    text: string, 
    strategy: ParsingStrategy, 
    coordinates?: BoundingBox[]
  ): Promise<NotaiParseResult> {
    const startTime = Date.now();
    
    try {
      // Clean and normalize text for better parsing
      const cleanText = this.normalizeText(text);
      
      // Extract core receipt components
      const vendor = this.extractVendorName(cleanText, coordinates);
      const transactionDate = this.extractTransactionDate(cleanText);
      const totalAmount = this.extractTotalAmount(cleanText);
      const subtotal = this.extractSubtotal(cleanText);
      const tax = this.extractTax(cleanText);
      const lineItems = this.extractLineItems(cleanText);

      // Calculate confidence scores
      const confidence = this.calculateConfidence(
        vendor, transactionDate, totalAmount, lineItems, strategy
      );

      // Validate and adjust results based on strategy
      const validatedResult = this.validateAndAdjustResults({
        vendor,
        transactionDate,
        totalAmount,
        subtotal,
        tax,
        lineItems,
        confidence,
        strategy
      });

      const processingTime = Date.now() - startTime;

      return {
        ...validatedResult,
        parsingMetadata: {
          processingTime,
          ocrModel: 'notai-adapted',
          parsingStrategy: strategy,
          textBlocks: cleanText.split('\n').length,
          coordinatesAvailable: !!coordinates && coordinates.length > 0
        }
      };

    } catch (error) {
      console.error('Notai parsing failed:', error);
      
      // Return minimal result with low confidence
      return {
        vendor: null,
        transactionDate: null,
        totalAmount: null,
        subtotal: null,
        tax: null,
        lineItems: [],
        confidence: {
          overall: 0.1,
          vendor: 0.0,
          date: 0.0,
          total: 0.0,
          lineItems: 0.0
        },
        parsingMetadata: {
          processingTime: Date.now() - startTime,
          ocrModel: 'notai-adapted',
          parsingStrategy: strategy,
          textBlocks: 0,
          coordinatesAvailable: false
        }
      };
    }
  }

  /**
   * Extract transaction date using Notai patterns
   * Requirements: 4.1
   */
  extractTransactionDate(text: string): Date | null {
    const cleanText = this.normalizeText(text);
    
    // Try each date pattern
    for (const pattern of NotaiParserService.DATE_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex state
      const matches = Array.from(cleanText.matchAll(pattern));
      
      for (const match of matches) {
        const date = this.parseMatchedDate(match);
        if (date && this.isReasonableDate(date)) {
          return date;
        }
      }
    }

    // If no explicit date found, try to infer from context
    return this.inferDateFromContext(cleanText);
  }

  /**
   * Extract total amount using Notai patterns
   * Requirements: 4.2
   */
  extractTotalAmount(text: string): number | null {
    const cleanText = this.normalizeText(text);
    const candidates: { amount: number; confidence: number }[] = [];

    // Try total-specific patterns first (highest confidence)
    const totalPattern = /(?:total|amount|sum|grand\s*total|final\s*total|balance)\s*:?\s*\$?(\d+\.?\d*)/gi;
    let match;
    while ((match = totalPattern.exec(cleanText)) !== null) {
      const amount = this.parseAmount(match[1] || '');
      if (amount !== null && amount > 0) {
        candidates.push({ amount, confidence: 0.9 });
      }
    }

    // Try currency patterns (medium confidence)
    for (const pattern of NotaiParserService.AMOUNT_PATTERNS.slice(1)) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(cleanText)) !== null) {
        const amount = this.parseAmount(match[1] || '');
        if (amount !== null && amount > 0) {
          candidates.push({ amount, confidence: 0.6 });
        }
      }
    }

    // Return the highest confidence amount, or largest reasonable amount
    if (candidates.length === 0) return null;

    // Sort by confidence, then by amount (larger amounts more likely to be totals)
    candidates.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      return b.amount - a.amount;
    });

    const bestCandidate = candidates[0];
    return bestCandidate && this.isReasonableAmount(bestCandidate.amount) 
      ? Math.round(bestCandidate.amount * 100) // Convert to cents
      : null;
  }

  /**
   * Extract vendor name using coordinate mapping and text analysis
   * Requirements: 4.3
   */
  extractVendorName(text: string, coordinates?: BoundingBox[]): VendorInfo | null {
    const cleanText = this.normalizeText(text);
    const lines = cleanText.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return null;

    // Strategy 1: Use coordinates if available (highest confidence)
    if (coordinates && coordinates.length > 0) {
      const topLines = lines.slice(0, 3); // Vendor usually in top 3 lines
      for (const line of topLines) {
        const vendor = this.extractVendorFromLine(line);
        if (vendor) {
          return {
            name: vendor,
            confidence: 0.9,
            coordinates: coordinates[0] // Use first coordinate as approximation
          };
        }
      }
    }

    // Strategy 2: Pattern-based extraction
    for (const pattern of NotaiParserService.VENDOR_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(cleanText);
      if (match && match[1]) {
        const vendorName = this.cleanVendorName(match[1]);
        if (this.isValidVendorName(vendorName)) {
          return {
            name: vendorName,
            confidence: 0.7
          };
        }
      }
    }

    // Strategy 3: First line heuristic (fallback)
    const firstLine = lines[0]?.trim();
    if (firstLine && firstLine.length > 2 && firstLine.length < 50) {
      const cleanedName = this.cleanVendorName(firstLine);
      if (this.isValidVendorName(cleanedName)) {
        return {
          name: cleanedName,
          confidence: 0.5
        };
      }
    }

    return null;
  }

  /**
   * Extract line items using adaptive parsing for various receipt formats
   * Requirements: 4.4, 4.5
   */
  extractLineItems(text: string): LineItemCandidate[] {
    const cleanText = this.normalizeText(text);
    const lineItems: LineItemCandidate[] = [];
    const processedLines = new Set<string>(); // Avoid duplicates
    
    // Split text into lines for line-by-line analysis
    const lines = cleanText.split('\n').filter(line => line.trim().length > 0);
    
    // First pass: Try structured patterns
    for (const pattern of NotaiParserService.LINE_ITEM_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(cleanText)) !== null) {
        const lineItem = this.parseLineItemMatch(match, pattern);
        
        if (lineItem && !processedLines.has(lineItem.rawText)) {
          lineItems.push(lineItem);
          processedLines.add(lineItem.rawText);
        }
      }
    }
    
    // Second pass: Adaptive parsing for unstructured formats
    if (lineItems.length < 2) {
      const adaptiveItems = this.extractLineItemsAdaptive(lines, processedLines);
      lineItems.push(...adaptiveItems);
    }
    
    // Third pass: Multi-line item detection (items split across lines)
    const multiLineItems = this.extractMultiLineItems(lines, processedLines);
    lineItems.push(...multiLineItems);

    // Filter, validate, and rank line items
    return this.validateAndRankLineItems(lineItems);
  }

  // Private helper methods

  /**
   * Normalize text for consistent parsing
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }

  /**
   * Parse matched date from regex results
   */
  private parseMatchedDate(match: RegExpMatchArray): Date | null {
    try {
      if (match.length >= 4) {
        // Handle month name formats
        const monthStr = match[1]?.toLowerCase();
        if (monthStr && NotaiParserService.MONTH_NAMES.hasOwnProperty(monthStr)) {
          const month = NotaiParserService.MONTH_NAMES[monthStr];
          const day = parseInt(match[2] || '0');
          const year = parseInt(match[3] || '0');
          if (month !== undefined && day && year) {
            return new Date(year, month, day);
          }
        }
      }

      if (match.length >= 4) {
        // Handle numeric formats MM/DD/YYYY or DD/MM/YYYY
        const part1 = parseInt(match[1] || '0');
        const part2 = parseInt(match[2] || '0');
        let year = parseInt(match[3] || '0');
        
        // Handle 2-digit years
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }

        // Try MM/DD/YYYY first (US format)
        if (part1 <= 12 && part2 <= 31) {
          return new Date(year, part1 - 1, part2);
        }
        
        // Try DD/MM/YYYY (international format)
        if (part2 <= 12 && part1 <= 31) {
          return new Date(year, part2 - 1, part1);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if date is reasonable for a receipt
   */
  private isReasonableDate(date: Date): boolean {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneWeekFuture = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return date >= oneYearAgo && date <= oneWeekFuture;
  }

  /**
   * Infer date from context (e.g., "today", timestamps)
   */
  private inferDateFromContext(text: string): Date | null {
    // Look for time patterns that might indicate today's date
    const timePattern = /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi;
    if (timePattern.test(text)) {
      return new Date(); // Assume today if we see a time
    }
    
    return null;
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string): number | null {
    try {
      const cleaned = amountStr.replace(/[^\d.]/g, '');
      const amount = parseFloat(cleaned);
      return isNaN(amount) ? null : amount;
    } catch {
      return null;
    }
  }

  /**
   * Check if amount is reasonable for a receipt
   */
  private isReasonableAmount(amount: number): boolean {
    return amount > 0 && amount < 10000; // Between $0 and $10,000
  }

  /**
   * Extract vendor from a single line
   */
  private extractVendorFromLine(line: string): string | null {
    const trimmed = line.trim();
    
    // Skip lines that look like addresses, phone numbers, or other non-vendor info
    if (this.looksLikeAddress(trimmed) || 
        this.looksLikePhoneNumber(trimmed) || 
        this.looksLikeDateTime(trimmed)) {
      return null;
    }

    // Must be reasonable length and contain letters
    if (trimmed.length < 2 || trimmed.length > 50 || !/[A-Za-z]/.test(trimmed)) {
      return null;
    }

    return this.cleanVendorName(trimmed);
  }

  /**
   * Clean vendor name by removing unwanted characters
   */
  private cleanVendorName(name: string): string {
    return name
      .replace(/[^\w\s&'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b(store|shop|restaurant|cafe|inc|llc|ltd)\b/gi, '')
      .trim();
  }

  /**
   * Validate vendor name
   */
  private isValidVendorName(name: string): boolean {
    return name.length >= 2 && 
           name.length <= 40 && 
           /[A-Za-z]/.test(name) &&
           !this.looksLikeAddress(name) &&
           !this.looksLikePhoneNumber(name);
  }

  /**
   * Check if text looks like an address
   */
  private looksLikeAddress(text: string): boolean {
    return /\b(\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln))\b/i.test(text) ||
           /\b\d{5}(-\d{4})?\b/.test(text); // ZIP code
  }

  /**
   * Check if text looks like a phone number
   */
  private looksLikePhoneNumber(text: string): boolean {
    return /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) ||
           /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/.test(text);
  }

  /**
   * Check if text looks like date/time
   */
  private looksLikeDateTime(text: string): boolean {
    return /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(text) ||
           /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(text);
  }

  /**
   * Parse line item from regex match with enhanced pattern support
   */
  private parseLineItemMatch(match: RegExpMatchArray, pattern: RegExp): LineItemCandidate | null {
    try {
      let description: string;
      let quantity: number | null = null;
      let price: number | null = null;
      let isSkuPattern = false;
      let isDepartmentPattern = false;

      // Determine pattern type and extract accordingly
      const patternIndex = NotaiParserService.LINE_ITEM_PATTERNS.indexOf(pattern);
      
      switch (patternIndex) {
        case 0: // Quantity Description Price format
          quantity = parseInt(match[1] || '1');
          description = (match[2] || '').trim();
          price = this.parseAmount(match[3] || '');
          break;
          
        case 1: // Description Quantity @ Price format
          description = (match[1] || '').trim();
          quantity = parseInt(match[2] || '1');
          price = this.parseAmount(match[3] || '');
          break;
          
        case 8: // Parentheses quantity format
          description = (match[1] || '').trim();
          quantity = parseInt(match[2] || '1');
          price = this.parseAmount(match[3] || '');
          break;
          
        case 9: // X quantity format
        case 10: // Asterisk quantity format
          description = (match[1] || '').trim();
          quantity = parseInt(match[2] || '1');
          price = this.parseAmount(match[3] || '');
          break;
          
        case 12: // SKU/Code format
          isSkuPattern = true;
          description = (match[2] || '').trim();
          quantity = 1;
          price = this.parseAmount(match[3] || '');
          break;
          
        case 13: // Department/Category format
          isDepartmentPattern = true;
          description = (match[2] || '').trim();
          quantity = 1;
          price = this.parseAmount(match[3] || '');
          break;
          
        default: // Description Price format (quantity assumed 1)
          description = (match[1] || '').trim();
          quantity = 1;
          const lastMatch = match[match.length - 1];
          price = this.parseAmount(match[2] || lastMatch || '');
          break;
      }

      if (!description || !price || price <= 0) {
        return null;
      }

      // Skip items that look like totals, taxes, or other non-product lines
      if (this.isNonProductLine(description)) {
        return null;
      }

      const totalPrice = quantity && quantity > 0 ? price * quantity : price;
      const confidence = this.calculateLineItemConfidence(description, quantity, price, isSkuPattern, isDepartmentPattern);

      return {
        description: this.cleanDescription(description),
        quantity,
        unitPrice: price ? Math.round(price * 100) : null, // Convert to cents
        totalPrice: Math.round(totalPrice * 100), // Convert to cents
        confidence,
        rawText: match[0].trim()
      };

    } catch {
      return null;
    }
  }

  /**
   * Adaptive parsing for unstructured receipt formats
   */
  private extractLineItemsAdaptive(lines: string[], processedLines: Set<string>): LineItemCandidate[] {
    const adaptiveItems: LineItemCandidate[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      
      if (!line || processedLines.has(line) || line.length < 3) {
        continue;
      }
      
      // Look for lines with potential product names and prices
      const priceMatch = line.match(/\$?(\d+\.?\d*)/);
      if (!priceMatch || !priceMatch[1]) continue;
      
      const price = this.parseAmount(priceMatch[1]);
      if (!price || price <= 0 || price > 1000) continue;
      
      // Extract description (everything before the price)
      const descriptionPart = line.substring(0, line.indexOf(priceMatch[0])).trim();
      if (descriptionPart.length < 2 || this.isNonProductLine(descriptionPart)) {
        continue;
      }
      
      // Check for quantity indicators
      let quantity = 1;
      let cleanDescription = descriptionPart;
      
      const qtyMatch = descriptionPart.match(/^(\d+)\s+(.+)/) || 
                      descriptionPart.match(/(.+)\s+x(\d+)$/) ||
                      descriptionPart.match(/(.+)\s+\*(\d+)$/);
      
      if (qtyMatch && qtyMatch[1] && qtyMatch[2]) {
        const firstPart = qtyMatch[1];
        const secondPart = qtyMatch[2];
        
        if (/^\d+$/.test(firstPart)) {
          quantity = parseInt(firstPart);
          cleanDescription = secondPart;
        } else if (/^\d+$/.test(secondPart)) {
          quantity = parseInt(secondPart);
          cleanDescription = firstPart;
        }
      }
      
      const lineItem: LineItemCandidate = {
        description: this.cleanDescription(cleanDescription),
        quantity,
        unitPrice: Math.round(price * 100),
        totalPrice: Math.round(price * quantity * 100),
        confidence: 0.6, // Lower confidence for adaptive parsing
        rawText: line
      };
      
      adaptiveItems.push(lineItem);
      processedLines.add(line);
    }
    
    return adaptiveItems;
  }

  /**
   * Extract multi-line items (items split across multiple lines)
   */
  private extractMultiLineItems(lines: string[], processedLines: Set<string>): LineItemCandidate[] {
    const multiLineItems: LineItemCandidate[] = [];
    
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i]?.trim();
      const nextLine = lines[i + 1]?.trim();
      
      if (!currentLine || !nextLine || processedLines.has(currentLine) || processedLines.has(nextLine)) {
        continue;
      }
      
      // Check if current line looks like a product name and next line has a price
      if (this.looksLikeProductName(currentLine) && this.looksLikePrice(nextLine)) {
        const priceMatch = nextLine.match(/\$?(\d+\.?\d*)/);
        if (priceMatch && priceMatch[1]) {
          const price = this.parseAmount(priceMatch[1]);
          if (price && price > 0 && price <= 1000) {
            const lineItem: LineItemCandidate = {
              description: this.cleanDescription(currentLine),
              quantity: 1,
              unitPrice: Math.round(price * 100),
              totalPrice: Math.round(price * 100),
              confidence: 0.5, // Lower confidence for multi-line parsing
              rawText: `${currentLine} ${nextLine}`
            };
            
            multiLineItems.push(lineItem);
            processedLines.add(currentLine);
            processedLines.add(nextLine);
          }
        }
      }
    }
    
    return multiLineItems;
  }

  /**
   * Check if line looks like a product name
   */
  private looksLikeProductName(line: string): boolean {
    return line.length >= 3 && 
           line.length <= 50 && 
           /[A-Za-z]/.test(line) &&
           !this.isNonProductLine(line) &&
           !this.looksLikePrice(line) &&
           !this.looksLikeDateTime(line) &&
           !this.looksLikeAddress(line);
  }

  /**
   * Check if line looks like a price
   */
  private looksLikePrice(line: string): boolean {
    return /^\s*\$?\d+\.?\d*\s*$/.test(line) && 
           !line.includes(':') && 
           !line.includes('/');
  }

  /**
   * Check if line is a non-product line (total, tax, etc.)
   */
  private isNonProductLine(description: string): boolean {
    const lowerDesc = description.toLowerCase();
    const nonProductKeywords = [
      'total', 'subtotal', 'sub total', 'tax', 'vat', 'gst', 'hst',
      'discount', 'coupon', 'change', 'cash', 'credit', 'debit',
      'balance', 'amount', 'due', 'paid', 'tender', 'receipt',
      'thank you', 'thanks', 'visit', 'store', 'location',
      'phone', 'address', 'street', 'avenue', 'road', 'blvd'
    ];
    
    return nonProductKeywords.some(keyword => lowerDesc.includes(keyword));
  }

  /**
   * Enhanced confidence calculation for line items
   */
  private calculateLineItemConfidence(
    description: string, 
    quantity: number | null, 
    price: number | null,
    isSkuPattern: boolean = false,
    isDepartmentPattern: boolean = false
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for reasonable values
    if (description.length >= 3 && description.length <= 40) confidence += 0.2;
    if (quantity && quantity > 0 && quantity <= 100) confidence += 0.1;
    if (price && price > 0 && price <= 1000) confidence += 0.2;
    
    // Boost confidence for structured patterns
    if (isSkuPattern) confidence += 0.1;
    if (isDepartmentPattern) confidence += 0.05;
    
    // Reduce confidence for suspicious patterns
    if (this.isNonProductLine(description)) confidence -= 0.3;
    if (description.length < 3 || description.length > 50) confidence -= 0.2;
    
    return Math.max(0.1, Math.min(confidence, 1.0));
  }

  /**
   * Enhanced validation and ranking of line items
   */
  private validateAndRankLineItems(lineItems: LineItemCandidate[]): LineItemCandidate[] {
    return lineItems
      .filter(item => 
        item.description.length >= 2 &&
        item.totalPrice !== null &&
        item.totalPrice > 0 &&
        item.confidence >= 0.3 &&
        !this.isNonProductLine(item.description)
      )
      .sort((a, b) => {
        // Sort by confidence first, then by price (higher prices often more reliable)
        if (Math.abs(a.confidence - b.confidence) > 0.1) {
          return b.confidence - a.confidence;
        }
        return (b.totalPrice || 0) - (a.totalPrice || 0);
      })
      .slice(0, 25) // Limit to 25 items max
      .map((item, index) => ({
        ...item,
        // Slightly reduce confidence for lower-ranked items
        confidence: item.confidence * (1 - index * 0.02)
      }));
  }

  /**
   * Clean item description with enhanced cleaning
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/[^\w\s\-&'#.]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(ea|each|pc|pcs|piece|pieces|item|items)\b/gi, '')
      .trim();
  }

  /**
   * Validate and filter line items (legacy method, replaced by validateAndRankLineItems)
   */
  private validateLineItems(lineItems: LineItemCandidate[]): LineItemCandidate[] {
    return this.validateAndRankLineItems(lineItems);
  }

  /**
   * Extract subtotal from text
   */
  private extractSubtotal(text: string): number | null {
    for (const pattern of NotaiParserService.SUBTOTAL_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match && match[1]) {
        const amount = this.parseAmount(match[1]);
        if (amount !== null && this.isReasonableAmount(amount)) {
          return Math.round(amount * 100); // Convert to cents
        }
      }
    }
    return null;
  }

  /**
   * Extract tax from text
   */
  private extractTax(text: string): number | null {
    for (const pattern of NotaiParserService.TAX_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match && match[1]) {
        const amount = this.parseAmount(match[1]);
        if (amount !== null && amount >= 0 && amount < 1000) {
          return Math.round(amount * 100); // Convert to cents
        }
      }
    }
    return null;
  }

  /**
   * Calculate overall confidence scores
   */
  private calculateConfidence(
    vendor: VendorInfo | null,
    date: Date | null,
    total: number | null,
    lineItems: LineItemCandidate[],
    strategy: ParsingStrategy
  ): ParseConfidence {
    const vendorConf = vendor ? vendor.confidence : 0;
    const dateConf = date ? 0.8 : 0;
    const totalConf = total ? 0.8 : 0;
    const lineItemsConf = lineItems.length > 0 
      ? lineItems.reduce((sum, item) => sum + item.confidence, 0) / lineItems.length 
      : 0;

    // Adjust confidence based on strategy
    const strategyMultiplier = strategy === 'AGGRESSIVE' ? 1.1 : 
                              strategy === 'CONSERVATIVE' ? 0.9 : 1.0;

    const overall = Math.min(
      (vendorConf * 0.2 + dateConf * 0.2 + totalConf * 0.3 + lineItemsConf * 0.3) * strategyMultiplier,
      1.0
    );

    return {
      overall,
      vendor: vendorConf,
      date: dateConf,
      total: totalConf,
      lineItems: lineItemsConf
    };
  }

  /**
   * Validate and adjust results based on parsing strategy
   */
  private validateAndAdjustResults(result: {
    vendor: VendorInfo | null;
    transactionDate: Date | null;
    totalAmount: number | null;
    subtotal: number | null;
    tax: number | null;
    lineItems: LineItemCandidate[];
    confidence: ParseConfidence;
    strategy: ParsingStrategy;
  }): Omit<NotaiParseResult, 'parsingMetadata'> {
    
    // Conservative strategy: require higher confidence
    if (result.strategy === 'CONSERVATIVE') {
      if (result.confidence.overall < 0.6) {
        return {
          vendor: null,
          transactionDate: null,
          totalAmount: null,
          subtotal: null,
          tax: null,
          lineItems: [],
          confidence: {
            overall: 0.3,
            vendor: 0,
            date: 0,
            total: 0,
            lineItems: 0
          }
        };
      }
    }

    // Aggressive strategy: accept lower confidence results
    if (result.strategy === 'AGGRESSIVE') {
      // Keep all results as-is
    }

    // Adaptive strategy: adjust based on available data
    if (result.strategy === 'ADAPTIVE') {
      // If we have line items but no total, calculate total from line items
      if (result.lineItems.length > 0 && !result.totalAmount) {
        const calculatedTotal = result.lineItems.reduce((sum, item) => 
          sum + (item.totalPrice || 0), 0
        );
        if (calculatedTotal > 0) {
          result.totalAmount = calculatedTotal;
          result.confidence.total = 0.6;
        }
      }
    }

    return {
      vendor: result.vendor,
      transactionDate: result.transactionDate,
      totalAmount: result.totalAmount,
      subtotal: result.subtotal,
      tax: result.tax,
      lineItems: result.lineItems,
      confidence: result.confidence
    };
  }
}

/**
 * Factory function to create NotaiParserService instance
 */
export function createNotaiParserService(): INotaiParserService {
  return new NotaiParserService();
}