import { z } from 'zod';
import { like, or, and, eq } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * Full-Text Search Service
 * Requirements: 9.1, 9.2
 */

export interface SearchOptions {
  query: string;
  fields: string[];
  operator: 'and' | 'or';
  fuzzy?: boolean;
  caseSensitive?: boolean;
  exactMatch?: boolean;
  minLength?: number;
  maxResults?: number;
  boost?: Record<string, number>;
  filters?: Record<string, any>;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: Array<{
    field: string;
    value: string;
    highlights: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}

export interface SearchResponse<T> {
  results: SearchResult<T>[];
  total: number;
  query: string;
  executionTime: number;
  suggestions?: string[];
}

export interface IndexConfig {
  table: string;
  fields: Array<{
    name: string;
    weight: number;
    type: 'text' | 'keyword' | 'number' | 'date';
  }>;
}

/**
 * Search validation schema
 */
export const searchOptionsSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(1000, 'Query too long'),
  fields: z.array(z.string()).min(1, 'At least one field is required'),
  operator: z.enum(['and', 'or']).default('or'),
  fuzzy: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
  exactMatch: z.boolean().default(false),
  minLength: z.number().int().min(1).default(2),
  maxResults: z.number().int().min(1).max(1000).default(100),
  boost: z.record(z.number()).optional(),
  filters: z.record(z.any()).optional(),
});

/**
 * Full-Text Search Service
 */
export class FullTextSearchService {
  private db: any;
  private indexes: Map<string, IndexConfig> = new Map();

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Register a search index for a table
   */
  registerIndex(tableName: string, config: IndexConfig): void {
    this.indexes.set(tableName, config);
  }

  /**
   * Perform full-text search across specified fields
   */
  async search<T>(
    table: SQLiteTable,
    options: SearchOptions,
    tenantId?: string
  ): Promise<SearchResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Validate search options
      const validatedOptions = searchOptionsSchema.parse(options);
      
      // Prepare search terms
      const searchTerms = this.prepareSearchTerms(validatedOptions.query, validatedOptions);
      
      // Build search query
      const searchConditions = this.buildSearchConditions(
        table,
        searchTerms,
        validatedOptions
      );

      // Build base query
      let query = this.db.select().from(table);

      // Add tenant filter if provided
      if (tenantId && 'tenantId' in table) {
        query = query.where(and(eq(table.tenantId, tenantId), searchConditions));
      } else {
        query = query.where(searchConditions);
      }

      // Apply additional filters
      if (validatedOptions.filters) {
        const filterConditions = this.buildFilterConditions(table, validatedOptions.filters);
        if (filterConditions.length > 0) {
          query = query.where(and(searchConditions, ...filterConditions));
        }
      }

      // Apply limit
      query = query.limit(validatedOptions.maxResults);

      // Execute search
      const rawResults = await query;

      // Score and rank results
      const scoredResults = this.scoreResults(
        rawResults,
        searchTerms,
        validatedOptions
      );

      // Sort by score (highest first)
      scoredResults.sort((a, b) => b.score - a.score);

      const executionTime = Date.now() - startTime;

      return {
        results: scoredResults,
        total: scoredResults.length,
        query: validatedOptions.query,
        executionTime,
        suggestions: this.generateSuggestions(validatedOptions.query, scoredResults),
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Perform multi-table search
   */
  async multiTableSearch(
    searches: Array<{
      table: SQLiteTable;
      options: SearchOptions;
      weight?: number;
    }>,
    tenantId?: string
  ): Promise<SearchResponse<any>> {
    const startTime = Date.now();
    
    try {
      const allResults: SearchResult<any>[] = [];
      
      // Execute searches in parallel
      const searchPromises = searches.map(async ({ table, options, weight = 1 }) => {
        const results = await this.search(table, options, tenantId);
        
        // Apply table weight to scores
        return results.results.map(result => ({
          ...result,
          score: result.score * weight,
          table: table._.name,
        }));
      });

      const searchResults = await Promise.all(searchPromises);
      
      // Combine and deduplicate results
      searchResults.forEach(results => {
        allResults.push(...results);
      });

      // Sort by score
      allResults.sort((a, b) => b.score - a.score);

      // Limit results
      const maxResults = searches[0]?.options.maxResults || 100;
      const limitedResults = allResults.slice(0, maxResults);

      const executionTime = Date.now() - startTime;

      return {
        results: limitedResults,
        total: limitedResults.length,
        query: searches[0]?.options.query || '',
        executionTime,
      };
    } catch (error) {
      console.error('Multi-table search error:', error);
      throw error;
    }
  }

  /**
   * Prepare search terms from query string
   */
  private prepareSearchTerms(query: string, options: SearchOptions): string[] {
    let terms: string[] = [];

    if (options.exactMatch) {
      // Treat entire query as single term
      terms = [query];
    } else {
      // Split query into terms
      terms = query
        .split(/\s+/)
        .filter(term => term.length >= options.minLength)
        .map(term => options.caseSensitive ? term : term.toLowerCase());
    }

    // Remove duplicates
    return [...new Set(terms)];
  }

  /**
   * Build search conditions for SQL query
   */
  private buildSearchConditions(
    table: SQLiteTable,
    searchTerms: string[],
    options: SearchOptions
  ): any {
    const fieldConditions: any[] = [];

    options.fields.forEach(fieldName => {
      const field = table[fieldName as keyof typeof table];
      if (!field) return;

      const termConditions = searchTerms.map(term => {
        if (options.exactMatch) {
          return eq(field, term);
        } else {
          return like(field, `%${term}%`);
        }
      });

      // Combine term conditions based on operator
      const fieldCondition = options.operator === 'and' 
        ? and(...termConditions)
        : or(...termConditions);

      fieldConditions.push(fieldCondition);
    });

    // Combine field conditions (always OR - match in any field)
    return or(...fieldConditions);
  }

  /**
   * Build filter conditions
   */
  private buildFilterConditions(table: SQLiteTable, filters: Record<string, any>): any[] {
    const conditions: any[] = [];

    Object.entries(filters).forEach(([fieldName, value]) => {
      const field = table[fieldName as keyof typeof table];
      if (field && value !== undefined && value !== null) {
        conditions.push(eq(field, value));
      }
    });

    return conditions;
  }

  /**
   * Score search results based on relevance
   */
  private scoreResults<T>(
    results: T[],
    searchTerms: string[],
    options: SearchOptions
  ): SearchResult<T>[] {
    return results.map(item => {
      let totalScore = 0;
      const matches: SearchResult<T>['matches'] = [];

      options.fields.forEach(fieldName => {
        const fieldValue = (item as any)[fieldName];
        if (!fieldValue) return;

        const stringValue = String(fieldValue);
        const searchValue = options.caseSensitive ? stringValue : stringValue.toLowerCase();
        
        let fieldScore = 0;
        const fieldMatches: Array<{ start: number; end: number; text: string }> = [];

        searchTerms.forEach(term => {
          const searchTerm = options.caseSensitive ? term : term.toLowerCase();
          
          if (options.exactMatch) {
            if (searchValue === searchTerm) {
              fieldScore += 100; // Exact match gets highest score
              fieldMatches.push({
                start: 0,
                end: searchValue.length,
                text: stringValue,
              });
            }
          } else {
            // Calculate term frequency and position
            const termRegex = new RegExp(this.escapeRegex(searchTerm), 'gi');
            const termMatches = [...searchValue.matchAll(termRegex)];
            
            termMatches.forEach(match => {
              if (match.index !== undefined) {
                // Score based on position (earlier matches score higher)
                const positionScore = Math.max(0, 50 - (match.index / searchValue.length) * 50);
                
                // Score based on term length vs field length
                const lengthScore = (searchTerm.length / searchValue.length) * 50;
                
                fieldScore += positionScore + lengthScore;
                
                fieldMatches.push({
                  start: match.index,
                  end: match.index + searchTerm.length,
                  text: stringValue.substring(match.index, match.index + searchTerm.length),
                });
              }
            });
          }
        });

        // Apply field boost if configured
        const boost = options.boost?.[fieldName] || 1;
        fieldScore *= boost;

        totalScore += fieldScore;

        if (fieldMatches.length > 0) {
          matches.push({
            field: fieldName,
            value: stringValue,
            highlights: fieldMatches,
          });
        }
      });

      return {
        item,
        score: totalScore,
        matches,
      };
    });
  }

  /**
   * Generate search suggestions based on results
   */
  private generateSuggestions(query: string, results: SearchResult<any>[]): string[] {
    // Simple suggestion generation - in a real implementation, you might use:
    // - Levenshtein distance for typo correction
    // - Popular search terms
    // - Autocomplete based on indexed content
    
    const suggestions: string[] = [];
    
    // Extract common terms from successful matches
    const commonTerms = new Set<string>();
    
    results.slice(0, 10).forEach(result => {
      result.matches.forEach(match => {
        const words = match.value.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 2 && !query.toLowerCase().includes(word)) {
            commonTerms.add(word);
          }
        });
      });
    });

    // Add up to 5 suggestions
    suggestions.push(...Array.from(commonTerms).slice(0, 5));

    return suggestions;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Create search index for better performance (placeholder)
   */
  async createSearchIndex(tableName: string, fields: string[]): Promise<void> {
    // In a real implementation with SQLite FTS, you would create FTS tables
    // For now, this is a placeholder
    console.log(`Creating search index for ${tableName} on fields: ${fields.join(', ')}`);
    
    // Example FTS table creation (commented out as it requires FTS extension)
    /*
    const ftsTableName = `${tableName}_fts`;
    const fieldList = fields.join(', ');
    
    await this.db.execute(`
      CREATE VIRTUAL TABLE ${ftsTableName} USING fts5(
        ${fieldList},
        content='${tableName}',
        content_rowid='id'
      )
    `);
    
    // Populate FTS table
    await this.db.execute(`
      INSERT INTO ${ftsTableName}(${ftsTableName})
      VALUES('rebuild')
    `);
    */
  }

  /**
   * Update search index when data changes (placeholder)
   */
  async updateSearchIndex(tableName: string, recordId: string, data: Record<string, any>): Promise<void> {
    // In a real implementation, you would update the FTS index
    console.log(`Updating search index for ${tableName}:${recordId}`);
  }

  /**
   * Delete from search index (placeholder)
   */
  async deleteFromSearchIndex(tableName: string, recordId: string): Promise<void> {
    // In a real implementation, you would remove from FTS index
    console.log(`Removing from search index: ${tableName}:${recordId}`);
  }
}

/**
 * Search utilities
 */
export const searchUtils = {
  /**
   * Highlight search terms in text
   */
  highlightMatches(text: string, matches: Array<{ start: number; end: number }>): string {
    if (matches.length === 0) return text;

    // Sort matches by start position
    const sortedMatches = matches.sort((a, b) => a.start - b.start);
    
    let result = '';
    let lastEnd = 0;

    sortedMatches.forEach(match => {
      // Add text before match
      result += text.substring(lastEnd, match.start);
      
      // Add highlighted match
      result += `<mark>${text.substring(match.start, match.end)}</mark>`;
      
      lastEnd = match.end;
    });

    // Add remaining text
    result += text.substring(lastEnd);

    return result;
  },

  /**
   * Extract snippet around matches
   */
  extractSnippet(text: string, matches: Array<{ start: number; end: number }>, maxLength = 200): string {
    if (matches.length === 0) {
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Find the best match (first one for simplicity)
    const match = matches[0];
    const matchCenter = Math.floor((match.start + match.end) / 2);
    
    // Calculate snippet boundaries
    const snippetStart = Math.max(0, matchCenter - Math.floor(maxLength / 2));
    const snippetEnd = Math.min(text.length, snippetStart + maxLength);
    
    let snippet = text.substring(snippetStart, snippetEnd);
    
    // Add ellipsis if needed
    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < text.length) snippet = snippet + '...';
    
    return snippet;
  },

  /**
   * Calculate search relevance score
   */
  calculateRelevanceScore(
    query: string,
    text: string,
    options: {
      exactMatchBoost?: number;
      positionBoost?: number;
      frequencyBoost?: number;
    } = {}
  ): number {
    const {
      exactMatchBoost = 100,
      positionBoost = 50,
      frequencyBoost = 10,
    } = options;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    let score = 0;

    // Exact match bonus
    if (textLower === queryLower) {
      score += exactMatchBoost;
    }

    // Position bonus (earlier matches score higher)
    const firstIndex = textLower.indexOf(queryLower);
    if (firstIndex !== -1) {
      const positionScore = Math.max(0, positionBoost - (firstIndex / textLower.length) * positionBoost);
      score += positionScore;
    }

    // Frequency bonus
    const matches = textLower.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    if (matches) {
      score += matches.length * frequencyBoost;
    }

    return score;
  },

  /**
   * Validate search query
   */
  validateSearchQuery(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!query || query.trim().length === 0) {
      errors.push('Search query cannot be empty');
    }

    if (query.length > 1000) {
      errors.push('Search query is too long (maximum 1000 characters)');
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /[<>]/g, // HTML tags
      /javascript:/gi, // JavaScript URLs
      /on\w+\s*=/gi, // Event handlers
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(query)) {
        errors.push('Search query contains invalid characters');
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};