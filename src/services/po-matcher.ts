/**
 * Purchase Order Matching Service
 * 
 * Handles receipt-to-PO matching algorithms, variance detection, and linking.
 * Implements requirements 9.1, 9.2, 9.3, 9.5 for the receipt scanning system.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { 
  receipts,
  receiptLineItems,
  purchaseOrders,
  poItems,
  suppliers,
  products,
  Receipt,
  PurchaseOrder,
  POItem,
  ReceiptLineItem,
  POStatus
} from '../db/schema';
import { getCurrentTimestamp } from '../utils';

// PO matching interfaces
export interface POMatchCandidate {
  poId: string;
  poNumber: string | null;
  supplierId: string;
  supplierName: string;
  totalCostCents: number | null;
  status: string;
  createdAt: number;
  matchScore: number;
  matchReasons: string[];
  lineItemMatches: LineItemMatch[];
  variances: POVariance[];
}

export interface LineItemMatch {
  receiptLineItemId: string;
  poItemId: string;
  productId: string;
  productName: string;
  receiptDescription: string;
  receiptQuantity: number | null;
  receiptUnitPriceCents: number | null;
  receiptTotalPriceCents: number | null;
  poQuantityOrdered: number;
  poUnitPriceCents: number;
  poLineTotalCents: number;
  matchConfidence: number;
  priceVarianceCents: number;
  quantityVariance: number;
}

export interface POVariance {
  type: 'PRICE' | 'QUANTITY' | 'MISSING_ITEM' | 'EXTRA_ITEM' | 'TOTAL_AMOUNT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  receiptValue?: number | string;
  poValue?: number | string;
  varianceAmount?: number;
  variancePercentage?: number;
}

export interface POLinkingResult {
  receiptId: string;
  linkedPoId: string;
  linkingConfidence: number;
  automaticLinking: boolean;
  variances: POVariance[];
  matchedLineItems: number;
  totalLineItems: number;
  linkedAt: Date;
  linkedBy: string;
}

export interface POMatchingOptions {
  vendorNameThreshold: number; // 0-1, minimum similarity for vendor matching
  amountTolerancePercentage: number; // Percentage tolerance for amount matching
  dateRangedays: number; // Days before/after receipt date to search for POs
  requireExactSupplier: boolean; // Whether to require exact supplier match
  autoLinkThreshold: number; // 0-1, minimum confidence for automatic linking
  maxCandidates: number; // Maximum number of candidates to return
}

// PO matching service interface
export interface IPOMatcherService {
  findPOMatches(receiptId: string, options?: Partial<POMatchingOptions>): Promise<POMatchCandidate[]>;
  linkReceiptToPO(receiptId: string, poId: string, userId: string, manual?: boolean): Promise<POLinkingResult>;
  unlinkReceiptFromPO(receiptId: string, userId: string): Promise<void>;
  detectVariances(receiptId: string, poId: string): Promise<POVariance[]>;
  getReceiptPOVariances(tenantId: string, options?: {
    severityFilter?: 'LOW' | 'MEDIUM' | 'HIGH';
    limit?: number;
    offset?: number;
  }): Promise<{
    variances: Array<{
      receiptId: string;
      poId: string;
      receiptVendor: string | null;
      receiptTotal: number | null;
      receiptDate: Date | null;
      poNumber: string | null;
      poTotal: number | null;
      variances: POVariance[];
    }>;
    total: number;
  }>;
  attemptAutomaticLinking(receiptId: string): Promise<POLinkingResult | null>;
}

export class POMatcherService implements IPOMatcherService {
  private static readonly DEFAULT_OPTIONS: POMatchingOptions = {
    vendorNameThreshold: 0.6,
    amountTolerancePercentage: 10,
    dateRangedays: 30,
    requireExactSupplier: false,
    autoLinkThreshold: 0.8,
    maxCandidates: 10
  };

  constructor(private db: DrizzleD1Database) {}

  /**
   * Find potential PO matches for a receipt
   * Requirements: 9.1, 9.2
   */
  async findPOMatches(receiptId: string, options: Partial<POMatchingOptions> = {}): Promise<POMatchCandidate[]> {
    const opts = { ...POMatcherService.DEFAULT_OPTIONS, ...options };

    // Get receipt with line items
    const receipt = await this.getReceiptWithLineItems(receiptId);
    if (!receipt) {
      throw new Error('Receipt not found');
    }

    // Get potential PO candidates based on various criteria
    const candidates = await this.findPOCandidates(receipt, opts);

    // Score and rank candidates
    const scoredCandidates = await Promise.all(
      candidates.map(async (po) => {
        const matchScore = await this.calculateMatchScore(receipt, po, opts);
        const lineItemMatches = await this.matchLineItems(receipt.lineItems, po.items);
        const variances = await this.detectVariancesBetweenReceiptAndPO(receipt, po);

        return {
          poId: po.id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          supplierName: po.supplier?.name || 'Unknown',
          totalCostCents: po.totalCostCents,
          status: po.status,
          createdAt: po.createdAt,
          matchScore,
          matchReasons: this.generateMatchReasons(receipt, po, matchScore),
          lineItemMatches,
          variances
        };
      })
    );

    // Sort by match score and return top candidates
    return scoredCandidates
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, opts.maxCandidates);
  }

  /**
   * Link a receipt to a purchase order
   * Requirements: 9.3, 9.5
   */
  async linkReceiptToPO(receiptId: string, poId: string, userId: string, manual = false): Promise<POLinkingResult> {
    // Verify receipt and PO exist and belong to same tenant
    const receipt = await this.getReceiptWithLineItems(receiptId);
    if (!receipt) {
      throw new Error('Receipt not found');
    }

    const po = await this.getPOWithItems(poId, receipt.tenantId);
    if (!po) {
      throw new Error('Purchase order not found or access denied');
    }

    // Check if receipt is already linked
    if (receipt.linkedPoId) {
      throw new Error('Receipt is already linked to a purchase order');
    }

    // Calculate linking confidence and detect variances
    const matchScore = await this.calculateMatchScore(receipt, po, POMatcherService.DEFAULT_OPTIONS);
    const variances = await this.detectVariancesBetweenReceiptAndPO(receipt, po);
    const lineItemMatches = await this.matchLineItems(receipt.lineItems, po.items);

    // Update receipt with PO link
    const now = getCurrentTimestamp();
    await this.db
      .update(receipts)
      .set({
        linkedPoId: poId,
        updatedAt: now
      })
      .where(eq(receipts.id, receiptId));

    // Update matched line items with PO item references
    for (const match of lineItemMatches) {
      if (match.matchConfidence > 0.7) { // Only update high-confidence matches
        await this.db
          .update(receiptLineItems)
          .set({
            matchedProductId: match.productId,
            matchConfidence: match.matchConfidence,
            updatedAt: now
          })
          .where(eq(receiptLineItems.id, match.receiptLineItemId));
      }
    }

    return {
      receiptId,
      linkedPoId: poId,
      linkingConfidence: matchScore,
      automaticLinking: !manual,
      variances,
      matchedLineItems: lineItemMatches.filter(m => m.matchConfidence > 0.7).length,
      totalLineItems: receipt.lineItems.length,
      linkedAt: new Date(now),
      linkedBy: userId
    };
  }

  /**
   * Unlink a receipt from its purchase order
   * Requirements: 9.3
   */
  async unlinkReceiptFromPO(receiptId: string, _userId: string): Promise<void> {
    // Verify receipt exists and is linked
    const [receipt] = await this.db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      throw new Error('Receipt not found');
    }

    if (!receipt!.linkedPoId) {
      throw new Error('Receipt is not linked to any purchase order');
    }

    // Remove PO link
    const now = getCurrentTimestamp();
    await this.db
      .update(receipts)
      .set({
        linkedPoId: null,
        updatedAt: now
      })
      .where(eq(receipts.id, receiptId));

    // Reset line item matches that were set during linking
    await this.db
      .update(receiptLineItems)
      .set({
        matchedProductId: null,
        matchConfidence: null,
        updatedAt: now
      })
      .where(eq(receiptLineItems.receiptId, receiptId));
  }

  /**
   * Detect variances between receipt and PO
   * Requirements: 9.2, 9.4
   */
  async detectVariances(receiptId: string, poId: string): Promise<POVariance[]> {
    const receipt = await this.getReceiptWithLineItems(receiptId);
    if (!receipt) {
      throw new Error('Receipt not found');
    }

    const po = await this.getPOWithItems(poId, receipt.tenantId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    return this.detectVariancesBetweenReceiptAndPO(receipt, po);
  }

  /**
   * Get receipt-PO variances for reporting
   * Requirements: 9.4, 9.5
   */
  async getReceiptPOVariances(
    tenantId: string, 
    options: {
      severityFilter?: 'LOW' | 'MEDIUM' | 'HIGH';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    variances: Array<{
      receiptId: string;
      poId: string;
      receiptVendor: string | null;
      receiptTotal: number | null;
      receiptDate: Date | null;
      poNumber: string | null;
      poTotal: number | null;
      variances: POVariance[];
    }>;
    total: number;
  }> {
    const { limit = 50, offset = 0 } = options;

    // Get receipts linked to POs
    const linkedReceipts = await this.db
      .select({
        receipt: receipts,
        po: purchaseOrders
      })
      .from(receipts)
      .innerJoin(purchaseOrders, eq(receipts.linkedPoId, purchaseOrders.id))
      .where(and(
        eq(receipts.tenantId, tenantId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .orderBy(desc(receipts.createdAt))
      .limit(limit)
      .offset(offset);

    // Calculate variances for each receipt-PO pair
    const varianceResults = await Promise.all(
      linkedReceipts.map(async ({ receipt, po }) => {
        const receiptWithItems = await this.getReceiptWithLineItems(receipt.id);
        const poWithItems = await this.getPOWithItems(po.id, tenantId);
        
        if (!receiptWithItems || !poWithItems) {
          return null;
        }

        const variances = await this.detectVariancesBetweenReceiptAndPO(receiptWithItems, poWithItems);
        
        // Filter by severity if specified
        const filteredVariances = options.severityFilter 
          ? variances.filter(v => v.severity === options.severityFilter)
          : variances;

        return {
          receiptId: receipt.id,
          poId: po.id,
          receiptVendor: receipt.vendorName,
          receiptTotal: receipt.totalAmountCents,
          receiptDate: receipt.transactionDate ? new Date(receipt.transactionDate) : null,
          poNumber: po.poNumber,
          poTotal: po.totalCostCents,
          variances: filteredVariances
        };
      })
    );

    // Filter out null results and results with no variances (if severity filter applied)
    const validResults = varianceResults
      .filter((result): result is NonNullable<typeof result> => 
        result !== null && (options.severityFilter ? result.variances.length > 0 : true)
      );

    // Get total count for pagination
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(receipts)
      .innerJoin(purchaseOrders, eq(receipts.linkedPoId, purchaseOrders.id))
      .where(and(
        eq(receipts.tenantId, tenantId),
        eq(purchaseOrders.tenantId, tenantId)
      ));

    return {
      variances: validResults,
      total: countResult?.count || 0
    };
  }

  /**
   * Attempt automatic linking based on high confidence matches
   * Requirements: 9.1, 9.3
   */
  async attemptAutomaticLinking(receiptId: string): Promise<POLinkingResult | null> {
    const matches = await this.findPOMatches(receiptId, {
      autoLinkThreshold: 0.8,
      maxCandidates: 1
    });

    if (matches.length === 0 || matches[0]!.matchScore < 0.8) {
      return null; // No high-confidence match found
    }

    const bestMatch = matches[0]!;
    
    // Perform automatic linking
    return this.linkReceiptToPO(receiptId, bestMatch.poId, 'SYSTEM', false);
  }

  /**
   * Get receipt with line items (private helper)
   */
  private async getReceiptWithLineItems(receiptId: string): Promise<(Receipt & { lineItems: ReceiptLineItem[] }) | null> {
    const [receipt] = await this.db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      return null;
    }

    const lineItems = await this.db
      .select()
      .from(receiptLineItems)
      .where(eq(receiptLineItems.receiptId, receiptId));

    return { ...receipt, lineItems };
  }

  /**
   * Get PO with items and supplier info (private helper)
   */
  private async getPOWithItems(poId: string, tenantId: string): Promise<(PurchaseOrder & { 
    items: POItem[]; 
    supplier?: { name: string } 
  }) | null> {
    const [poWithSupplier] = await this.db
      .select({
        po: purchaseOrders,
        supplier: {
          name: suppliers.name
        }
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!poWithSupplier) {
      return null;
    }

    const items = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, poId));

    return {
      ...poWithSupplier.po,
      items,
      supplier: poWithSupplier.supplier
    };
  }

  /**
   * Find PO candidates based on receipt criteria
   */
  private async findPOCandidates(
    receipt: Receipt & { lineItems: ReceiptLineItem[] }, 
    options: POMatchingOptions
  ): Promise<Array<PurchaseOrder & { items: POItem[]; supplier?: { name: string } }>> {
    const receiptDate = receipt.transactionDate ? new Date(receipt.transactionDate) : new Date();
    const startDate = new Date(receiptDate.getTime() - (options.dateRangedays * 24 * 60 * 60 * 1000));
    const endDate = new Date(receiptDate.getTime() + (options.dateRangedays * 24 * 60 * 60 * 1000));

    // Build search conditions
    const conditions = [
      eq(purchaseOrders.tenantId, receipt.tenantId),
      // Only consider approved or received POs
      or(
        eq(purchaseOrders.status, POStatus.APPROVED),
        eq(purchaseOrders.status, POStatus.RECEIVED)
      ),
      // Date range filter
      and(
        sql`${purchaseOrders.createdAt} >= ${startDate.getTime()}`,
        sql`${purchaseOrders.createdAt} <= ${endDate.getTime()}`
      )
    ];

    // Add vendor name matching if available
    if (receipt.vendorName && !options.requireExactSupplier) {
      conditions.push(
        like(suppliers.name, `%${receipt.vendorName}%`)
      );
    }

    // Get PO candidates with supplier info
    const poResults = await this.db
      .select({
        po: purchaseOrders,
        supplier: {
          name: suppliers.name
        }
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(50); // Reasonable limit for candidates

    // Get items for each PO
    const candidatesWithItems = await Promise.all(
      poResults.map(async ({ po, supplier }) => {
        const items = await this.db
          .select()
          .from(poItems)
          .where(eq(poItems.poId, po.id));

        return { ...po, items, supplier };
      })
    );

    return candidatesWithItems;
  }

  /**
   * Calculate match score between receipt and PO
   */
  private async calculateMatchScore(
    receipt: Receipt & { lineItems: ReceiptLineItem[] },
    po: PurchaseOrder & { items: POItem[]; supplier?: { name: string } },
    options: POMatchingOptions
  ): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Vendor name matching (30% weight)
    maxScore += 30;
    if (receipt.vendorName && po.supplier?.name) {
      const vendorSimilarity = this.calculateStringSimilarity(
        receipt.vendorName.toLowerCase(),
        po.supplier.name.toLowerCase()
      );
      score += vendorSimilarity * 30;
    }

    // Amount matching (25% weight)
    maxScore += 25;
    if (receipt.totalAmountCents && po.totalCostCents) {
      const amountDifference = Math.abs(receipt.totalAmountCents - po.totalCostCents);
      const amountTolerance = (po.totalCostCents * options.amountTolerancePercentage) / 100;
      
      if (amountDifference <= amountTolerance) {
        const amountScore = Math.max(0, 1 - (amountDifference / amountTolerance));
        score += amountScore * 25;
      }
    }

    // Line item matching (35% weight)
    maxScore += 35;
    const lineItemMatches = await this.matchLineItems(receipt.lineItems, po.items);
    const matchedItems = lineItemMatches.filter(m => m.matchConfidence > 0.5).length;
    const totalItems = Math.max(receipt.lineItems.length, po.items.length);
    
    if (totalItems > 0) {
      const lineItemScore = matchedItems / totalItems;
      score += lineItemScore * 35;
    }

    // Date proximity (10% weight)
    maxScore += 10;
    if (receipt.transactionDate) {
      const receiptDate = new Date(receipt.transactionDate);
      const poDate = new Date(po.createdAt);
      const daysDifference = Math.abs(receiptDate.getTime() - poDate.getTime()) / (24 * 60 * 60 * 1000);
      
      if (daysDifference <= options.dateRangedays) {
        const dateScore = Math.max(0, 1 - (daysDifference / options.dateRangedays));
        score += dateScore * 10;
      }
    }

    // Normalize score to 0-1 range
    return maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  }

  /**
   * Match receipt line items to PO items
   */
  private async matchLineItems(
    receiptItems: ReceiptLineItem[],
    poItems: POItem[]
  ): Promise<LineItemMatch[]> {
    const matches: LineItemMatch[] = [];

    // Get product information for PO items
    const productIds = poItems.map(item => item.productId);
    const productMap = new Map();
    
    if (productIds.length > 0) {
      const productResults = await this.db
        .select()
        .from(products)
        .where(sql`${products.id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);
      
      productResults.forEach(product => {
        productMap.set(product!.id, product);
      });
    }

    for (const receiptItem of receiptItems) {
      let bestMatch: LineItemMatch | null = null;
      let bestConfidence = 0;

      for (const poItem of poItems) {
        const product = productMap.get(poItem.productId);
        if (!product) continue;

        // Calculate match confidence based on description similarity
        const descriptionSimilarity = this.calculateStringSimilarity(
          receiptItem.description.toLowerCase(),
          product.name.toLowerCase()
        );

        if (descriptionSimilarity > bestConfidence && descriptionSimilarity > 0.3) {
          const priceVariance = receiptItem.unitPriceCents && poItem.unitPriceCents
            ? receiptItem.unitPriceCents - poItem.unitPriceCents
            : 0;

          const quantityVariance = receiptItem.quantity && poItem.quantityOrdered
            ? receiptItem.quantity - poItem.quantityOrdered
            : 0;

          bestMatch = {
            receiptLineItemId: receiptItem.id,
            poItemId: poItem.id,
            productId: product.id,
            productName: product.name,
            receiptDescription: receiptItem.description,
            receiptQuantity: receiptItem.quantity,
            receiptUnitPriceCents: receiptItem.unitPriceCents,
            receiptTotalPriceCents: receiptItem.totalPriceCents,
            poQuantityOrdered: poItem.quantityOrdered,
            poUnitPriceCents: poItem.unitPriceCents,
            poLineTotalCents: poItem.lineTotalCents,
            matchConfidence: descriptionSimilarity,
            priceVarianceCents: priceVariance,
            quantityVariance: quantityVariance
          };
          bestConfidence = descriptionSimilarity;
        }
      }

      if (bestMatch) {
        matches.push(bestMatch);
      }
    }

    return matches;
  }

  /**
   * Detect variances between receipt and PO
   */
  private async detectVariancesBetweenReceiptAndPO(
    receipt: Receipt & { lineItems: ReceiptLineItem[] },
    po: PurchaseOrder & { items: POItem[]; supplier?: { name: string } }
  ): Promise<POVariance[]> {
    const variances: POVariance[] = [];

    // Total amount variance
    if (receipt.totalAmountCents && po.totalCostCents) {
      const amountDifference = receipt.totalAmountCents - po.totalCostCents;
      const variancePercentage = Math.abs(amountDifference) / po.totalCostCents * 100;

      if (Math.abs(amountDifference) > 0) {
        variances.push({
          type: 'TOTAL_AMOUNT',
          severity: variancePercentage > 20 ? 'HIGH' : variancePercentage > 10 ? 'MEDIUM' : 'LOW',
          description: `Total amount differs by ${amountDifference > 0 ? '+' : ''}$${(amountDifference / 100).toFixed(2)}`,
          receiptValue: receipt.totalAmountCents / 100,
          poValue: po.totalCostCents / 100,
          varianceAmount: amountDifference / 100,
          variancePercentage: Math.round(variancePercentage * 100) / 100
        });
      }
    }

    // Line item variances
    const lineItemMatches = await this.matchLineItems(receipt.lineItems, po.items);
    
    for (const match of lineItemMatches) {
      // Price variance
      if (Math.abs(match.priceVarianceCents) > 0) {
        const priceVariancePercentage = Math.abs(match.priceVarianceCents) / match.poUnitPriceCents * 100;
        
        variances.push({
          type: 'PRICE',
          severity: priceVariancePercentage > 25 ? 'HIGH' : priceVariancePercentage > 10 ? 'MEDIUM' : 'LOW',
          description: `Price difference for ${match.productName}: ${match.priceVarianceCents > 0 ? '+' : ''}$${(match.priceVarianceCents / 100).toFixed(2)}`,
          receiptValue: match.receiptUnitPriceCents ? match.receiptUnitPriceCents / 100 : 0,
          poValue: match.poUnitPriceCents / 100,
          varianceAmount: match.priceVarianceCents / 100,
          variancePercentage: Math.round(priceVariancePercentage * 100) / 100
        });
      }

      // Quantity variance
      if (Math.abs(match.quantityVariance) > 0) {
        const quantityVariancePercentage = Math.abs(match.quantityVariance) / match.poQuantityOrdered * 100;
        
        variances.push({
          type: 'QUANTITY',
          severity: quantityVariancePercentage > 25 ? 'HIGH' : quantityVariancePercentage > 10 ? 'MEDIUM' : 'LOW',
          description: `Quantity difference for ${match.productName}: ${match.quantityVariance > 0 ? '+' : ''}${match.quantityVariance}`,
          receiptValue: match.receiptQuantity || 0,
          poValue: match.poQuantityOrdered,
          varianceAmount: match.quantityVariance,
          variancePercentage: Math.round(quantityVariancePercentage * 100) / 100
        });
      }
    }

    // Missing items (in PO but not in receipt)
    const matchedPoItemIds = new Set(lineItemMatches.map(m => m.poItemId));
    const unmatchedPoItems = po.items.filter((item: any) => !matchedPoItemIds.has(item.id));
    
    for (const unmatchedItem of unmatchedPoItems) {
      variances.push({
        type: 'MISSING_ITEM',
        severity: 'MEDIUM',
        description: `Item ordered but not found in receipt: Product ID ${unmatchedItem.productId}`,
        poValue: unmatchedItem.quantityOrdered
      });
    }

    // Extra items (in receipt but not in PO)
    const matchedReceiptItemIds = new Set(lineItemMatches.map(m => m.receiptLineItemId));
    const unmatchedReceiptItems = receipt.lineItems.filter((item: any) => !matchedReceiptItemIds.has(item.id));
    
    for (const unmatchedItem of unmatchedReceiptItems) {
      variances.push({
        type: 'EXTRA_ITEM',
        severity: 'LOW',
        description: `Item in receipt but not in PO: ${unmatchedItem.description}`,
        receiptValue: unmatchedItem.description
      });
    }

    return variances;
  }

  /**
   * Generate match reasons for display
   */
  private generateMatchReasons(
    receipt: Receipt,
    po: PurchaseOrder & { supplier?: { name: string } },
    matchScore: number
  ): string[] {
    const reasons: string[] = [];

    if (receipt.vendorName && po.supplier?.name) {
      const similarity = this.calculateStringSimilarity(
        receipt.vendorName.toLowerCase(),
        po.supplier.name.toLowerCase()
      );
      if (similarity > 0.7) {
        reasons.push(`Vendor name match: ${po.supplier.name}`);
      } else if (similarity > 0.4) {
        reasons.push(`Partial vendor name match: ${po.supplier.name}`);
      }
    }

    if (receipt.totalAmountCents && po.totalCostCents) {
      const amountDifference = Math.abs(receipt.totalAmountCents - po.totalCostCents);
      const tolerance = po.totalCostCents * 0.1; // 10% tolerance
      
      if (amountDifference <= tolerance) {
        reasons.push(`Amount match within tolerance: $${(po.totalCostCents / 100).toFixed(2)}`);
      }
    }

    if (matchScore > 0.8) {
      reasons.push('High confidence match');
    } else if (matchScore > 0.6) {
      reasons.push('Good match');
    } else if (matchScore > 0.4) {
      reasons.push('Possible match');
    }

    return reasons;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - matrix[str2.length]![str1.length]!) / maxLength;
  }
}

/**
 * Factory function to create POMatcherService instance
 */
export function createPOMatcherService(db: DrizzleD1Database): IPOMatcherService {
  return new POMatcherService(db);
}