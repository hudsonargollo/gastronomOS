/**
 * Product Matcher Service
 * 
 * Implements intelligent product matching for receipt line items using fuzzy matching
 * algorithms and similarity scoring. Integrates with tenant product catalogs.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { drizzle } from 'drizzle-orm/d1';
import { Product, ProductMatchCandidate, productMatchCandidates, receiptLineItems, products, receipts as receiptsTable } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema';

// Product matching interfaces
export interface LineItemCandidate {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
  rawText: string;
  coordinates?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MatchingOptions {
  similarityThreshold: number; // 0-1, minimum similarity for matches
  maxMatches: number; // Maximum number of matches to return per item
  useAliases: boolean; // Whether to match against product aliases
  categoryHints?: string[]; // Product categories to prioritize
}

export interface ProductMatchResult {
  lineItem: LineItemCandidate;
  matches: ProductMatch[];
  bestMatch: ProductMatch | null;
  requiresManualReview: boolean;
  confidence: number;
}

export interface ProductMatch {
  product: Product;
  similarity: number;
  matchType: 'EXACT' | 'FUZZY' | 'ALIAS' | 'CATEGORY';
  matchedField: 'name' | 'sku' | 'alias' | 'description';
  confidence: number;
}

// Additional interfaces for manual override capabilities
export interface UnmatchedLineItem {
  id: string;
  receiptId: string;
  description: string;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  rawText: string | null; // Allow null as per schema
  createdAt: number;
  receipt: {
    vendorName: string | null;
    transactionDate: number | null;
  };
}

// Product matcher service interface
export interface IProductMatcher {
  matchLineItems(
    lineItems: LineItemCandidate[], 
    productCatalog: Product[], 
    options: MatchingOptions
  ): Promise<ProductMatchResult[]>;
  
  fuzzyMatch(description: string, products: Product[]): ProductMatch[];
  calculateSimilarity(text1: string, text2: string): number;
  rankMatches(matches: ProductMatch[]): ProductMatch[];
  
  // Manual override capabilities - Requirements: 5.4, 5.5
  getMatchCandidatesForLineItem(receiptLineItemId: string): Promise<ProductMatchCandidate[]>;
  applyManualProductMatch(receiptLineItemId: string, productId: string, userId: string): Promise<void>;
  flagLineItemForManualReview(receiptLineItemId: string, reason: string, userId: string): Promise<void>;
  getUnmatchedLineItems(tenantId: string, limit?: number): Promise<UnmatchedLineItem[]>;
}

/**
 * Product Matcher Service Implementation
 * Uses Levenshtein distance for fuzzy matching and similarity scoring
 */
export class ProductMatcher implements IProductMatcher {
  constructor(private db: ReturnType<typeof drizzle<typeof schema>>) {}

  /**
   * Match line items against product catalog
   * Requirements: 5.1, 5.2, 5.3
   */
  async matchLineItems(
    lineItems: LineItemCandidate[], 
    productCatalog: Product[], 
    options: MatchingOptions
  ): Promise<ProductMatchResult[]> {
    const results: ProductMatchResult[] = [];

    for (const lineItem of lineItems) {
      const matches = this.fuzzyMatch(lineItem.description, productCatalog);
      const filteredMatches = matches.filter(match => 
        match.similarity >= options.similarityThreshold
      ).slice(0, options.maxMatches);

      const rankedMatches = this.rankMatches(filteredMatches);
      const bestMatch = rankedMatches.length > 0 ? rankedMatches[0] || null : null;
      
      // Enhanced confidence scoring based on match quality and quantity
      const confidence = this.calculateOverallConfidence(rankedMatches, bestMatch);
      
      // Enhanced manual review flagging logic
      const requiresManualReview = this.shouldRequireManualReview(rankedMatches, bestMatch, confidence);

      results.push({
        lineItem,
        matches: rankedMatches,
        bestMatch,
        requiresManualReview,
        confidence
      });
    }

    return results;
  }

  /**
   * Perform fuzzy matching using Levenshtein distance
   * Requirements: 5.2
   */
  fuzzyMatch(description: string, products: Product[]): ProductMatch[] {
    const matches: ProductMatch[] = [];
    const cleanDescription = this.normalizeText(description);

    for (const product of products) {
      const cleanProductName = this.normalizeText(product.name);
      const similarity = this.calculateSimilarity(cleanDescription, cleanProductName);
      
      if (similarity > 0.3) { // Minimum threshold for consideration
        matches.push({
          product,
          similarity,
          matchType: similarity > 0.9 ? 'EXACT' : 'FUZZY',
          matchedField: 'name',
          confidence: similarity
        });
      }

      // Also check description if available
      if (product.description) {
        const cleanProductDesc = this.normalizeText(product.description);
        const descSimilarity = this.calculateSimilarity(cleanDescription, cleanProductDesc);
        
        if (descSimilarity > 0.3 && descSimilarity > similarity) {
          matches.push({
            product,
            similarity: descSimilarity,
            matchType: descSimilarity > 0.9 ? 'EXACT' : 'FUZZY',
            matchedField: 'description',
            confidence: descSimilarity
          });
        }
      }
    }

    return matches;
  }

  /**
   * Calculate Levenshtein distance similarity between two strings
   * Requirements: 5.2
   */
  calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;
    if (text1.length === 0 || text2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Rank matches by similarity and confidence
   * Requirements: 5.3
   */
  rankMatches(matches: ProductMatch[]): ProductMatch[] {
    return matches.sort((a, b) => {
      // Prioritize exact matches
      if (a.matchType === 'EXACT' && b.matchType !== 'EXACT') return -1;
      if (b.matchType === 'EXACT' && a.matchType !== 'EXACT') return 1;
      
      // Then by similarity score
      if (Math.abs(a.similarity - b.similarity) > 0.01) {
        return b.similarity - a.similarity;
      }
      
      // Finally by confidence
      return b.confidence - a.confidence;
    });
  }

  /**
   * Calculate overall confidence score for a set of matches
   * Requirements: 5.3 - Enhanced confidence scoring
   */
  private calculateOverallConfidence(matches: ProductMatch[], bestMatch: ProductMatch | null): number {
    if (!bestMatch || matches.length === 0) {
      return 0;
    }

    // Base confidence from best match
    let confidence = bestMatch.confidence;

    // Boost confidence if we have an exact match
    if (bestMatch.matchType === 'EXACT') {
      confidence = Math.min(confidence + 0.2, 1.0);
    }

    // Reduce confidence if there are multiple similar matches (ambiguity)
    const similarMatches = matches.filter(match => 
      Math.abs(match.similarity - bestMatch.similarity) < 0.1
    );
    
    if (similarMatches.length > 1) {
      const ambiguityPenalty = Math.min(0.3, (similarMatches.length - 1) * 0.1);
      confidence = Math.max(confidence - ambiguityPenalty, 0.1);
    }

    // Boost confidence if the best match is significantly better than others
    if (matches.length > 1) {
      const secondBest = matches[1];
      if (secondBest && bestMatch.similarity - secondBest.similarity > 0.2) {
        confidence = Math.min(confidence + 0.1, 1.0);
      }
    }

    return Math.round(confidence * 1000) / 1000; // Round to 3 decimal places
  }

  /**
   * Determine if a line item should require manual review
   * Requirements: 5.4, 5.5 - Manual override and unmatched item flagging
   */
  private shouldRequireManualReview(
    matches: ProductMatch[], 
    bestMatch: ProductMatch | null, 
    confidence: number
  ): boolean {
    // No matches found - definitely needs manual review
    if (!bestMatch || matches.length === 0) {
      return true;
    }

    // Low confidence threshold
    if (confidence < 0.7) {
      return true;
    }

    // Multiple matches with similar confidence (ambiguous)
    const ambiguousMatches = matches.filter(match => 
      Math.abs(match.confidence - bestMatch.confidence) < 0.15
    );
    
    if (ambiguousMatches.length > 1) {
      return true;
    }

    // Fuzzy matches with moderate confidence should be reviewed
    if (bestMatch.matchType === 'FUZZY' && confidence < 0.85) {
      return true;
    }

    return false;
  }

  /**
   * Normalize text for better matching
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      if (matrix[0]) {
        matrix[0][j] = j;
      }
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        const prevCell = matrix[i]?.[j - 1];
        
        if (currentRow && prevRow && typeof prevCell === 'number') {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            currentRow[j] = prevRow[j - 1] || 0;
          } else {
            currentRow[j] = Math.min(
              (prevRow[j - 1] || 0) + 1, // substitution
              prevCell + 1,              // insertion
              (prevRow[j] || 0) + 1      // deletion
            );
          }
        }
      }
    }

    const finalRow = matrix[str2.length];
    return finalRow?.[str1.length] || 0;
  }

  /**
   * Get product match candidates for a specific receipt line item
   * Requirements: 5.4 - Manual product match selection
   */
  async getMatchCandidatesForLineItem(receiptLineItemId: string): Promise<ProductMatchCandidate[]> {
    try {
      const candidates = await this.db
        .select({
          id: productMatchCandidates.id,
          receiptLineItemId: productMatchCandidates.receiptLineItemId,
          productId: productMatchCandidates.productId,
          similarityScore: productMatchCandidates.similarityScore,
          matchType: productMatchCandidates.matchType,
          confidence: productMatchCandidates.confidence,
          createdAt: productMatchCandidates.createdAt,
          // Include product details for easier consumption
          product: {
            id: products.id,
            name: products.name,
            description: products.description,
            category: products.category,
            unit: products.unit
          }
        })
        .from(productMatchCandidates)
        .innerJoin(products, eq(productMatchCandidates.productId, products.id))
        .where(eq(productMatchCandidates.receiptLineItemId, receiptLineItemId))
        .orderBy(desc(productMatchCandidates.confidence), desc(productMatchCandidates.similarityScore));

      return candidates.map(candidate => ({
        id: candidate.id,
        receiptLineItemId: candidate.receiptLineItemId,
        productId: candidate.productId,
        similarityScore: candidate.similarityScore,
        matchType: candidate.matchType as any,
        confidence: candidate.confidence,
        createdAt: candidate.createdAt
      }));

    } catch (error) {
      console.error('Failed to get match candidates:', error);
      return [];
    }
  }

  /**
   * Apply manual product match selection
   * Requirements: 5.4 - Manual override of automatic product matches
   */
  async applyManualProductMatch(receiptLineItemId: string, productId: string, userId: string): Promise<void> {
    try {
      // Get the product to calculate confidence
      const productResult = await this.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (productResult.length === 0) {
        throw new Error('Product not found');
      }

      const product = productResult[0];
      if (!product) {
        throw new Error('Product data is invalid');
      }

      // Update the receipt line item with the manual match
      await this.db
        .update(receiptLineItems)
        .set({
          matchedProductId: productId,
          matchConfidence: 1.0, // Manual matches get full confidence
          requiresManualReview: false // No longer needs review
        })
        .where(eq(receiptLineItems.id, receiptLineItemId));

      // Optional: Log the manual override for audit purposes
      console.log(`Manual product match applied: line item ${receiptLineItemId} -> product ${productId} by user ${userId}`);

    } catch (error) {
      console.error('Failed to apply manual product match:', error);
      throw new Error('Failed to apply manual product match');
    }
  }

  /**
   * Flag line item for manual review with reason
   * Requirements: 5.5 - Unmatched item flagging system
   */
  async flagLineItemForManualReview(receiptLineItemId: string, reason: string, userId: string): Promise<void> {
    try {
      // Update the receipt line item to require manual review
      await this.db
        .update(receiptLineItems)
        .set({
          requiresManualReview: true,
          matchedProductId: null, // Clear any existing match
          matchConfidence: null
        })
        .where(eq(receiptLineItems.id, receiptLineItemId));

      // Optional: Log the flagging for audit purposes
      console.log(`Line item flagged for manual review: ${receiptLineItemId}, reason: ${reason}, by user: ${userId}`);

    } catch (error) {
      console.error('Failed to flag line item for manual review:', error);
      throw new Error('Failed to flag line item for manual review');
    }
  }

  /**
   * Get unmatched line items that require manual review
   * Requirements: 5.5 - Unmatched item flagging system
   */
  async getUnmatchedLineItems(tenantId: string, limit: number = 50): Promise<UnmatchedLineItem[]> {
    try {
      // Query for line items that require manual review with proper tenant isolation
      const unmatchedItems = await this.db
        .select({
          id: receiptLineItems.id,
          receiptId: receiptLineItems.receiptId,
          description: receiptLineItems.description,
          quantity: receiptLineItems.quantity,
          unitPriceCents: receiptLineItems.unitPriceCents,
          totalPriceCents: receiptLineItems.totalPriceCents,
          rawText: receiptLineItems.rawText,
          createdAt: receiptLineItems.createdAt,
          // Include receipt details for context
          vendorName: receiptsTable.vendorName,
          transactionDate: receiptsTable.transactionDate
        })
        .from(receiptLineItems)
        .innerJoin(receiptsTable, eq(receiptLineItems.receiptId, receiptsTable.id))
        .where(
          and(
            eq(receiptLineItems.requiresManualReview, true),
            eq(receiptsTable.tenantId, tenantId) // Tenant isolation
          )
        )
        .orderBy(desc(receiptLineItems.createdAt))
        .limit(Math.min(limit, 100)); // Cap at 100 items

      return unmatchedItems.map(item => ({
        id: item.id,
        receiptId: item.receiptId,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalPriceCents: item.totalPriceCents,
        rawText: item.rawText,
        createdAt: item.createdAt,
        receipt: {
          vendorName: item.vendorName,
          transactionDate: item.transactionDate
        }
      }));

    } catch (error) {
      console.error('Failed to get unmatched line items:', error);
      return [];
    }
  }
}

/**
 * Factory function to create ProductMatcher instance
 */
export function createProductMatcher(db: ReturnType<typeof drizzle<typeof schema>>): IProductMatcher {
  return new ProductMatcher(db);
}