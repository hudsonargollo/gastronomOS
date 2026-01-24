const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api/v1';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams {
  search?: string;
  active?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    return searchParams.toString();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    email: string;
    password: string;
    tenantName: string;
    tenantSlug: string;
  }) {
    return this.request<{ token: string; user: any; tenant: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProfile() {
    return this.request<{ user: any }>('/auth/profile');
  }

  // Demo endpoints
  async getDemoCredentials() {
    return this.request<ApiResponse<{
      accounts: Array<{
        role: string;
        email: string;
        password: string;
        description: string;
      }>;
      defaultAccount: {
        role: string;
        email: string;
        password: string;
        description: string;
      };
      message: string;
    }>>('/demo/credentials');
  }

  async getDemoStatus() {
    return this.request<ApiResponse<{
      demoDataReady: boolean;
      message: string;
      timestamp: string;
    }>>('/demo/status');
  }

  async initializeDemoData() {
    return this.request<ApiResponse<{
      message: string;
      timestamp: string;
    }>>('/demo/initialize', {
      method: 'POST',
    });
  }

  async resetDemoData() {
    return this.request<ApiResponse<{
      message: string;
      timestamp: string;
      warning: string;
    }>>('/demo/reset', {
      method: 'POST',
    });
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; timestamp: string; environment: string }>('/health');
  }

  // Tenants
  async getTenants() {
    return this.request<{ tenants: any[] }>('/tenants');
  }

  // Categories
  async getCategories(params?: PaginationParams & SearchParams & { parentId?: string }) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ categories: any[]; pagination?: any }>>(`/categories${queryString ? `?${queryString}` : ''}`);
  }

  async getCategory(id: string) {
    return this.request<ApiResponse<{ category: any }>>(`/categories/${id}`);
  }

  async createCategory(data: any) {
    return this.request<ApiResponse<{ category: any }>>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: any) {
    return this.request<ApiResponse<{ category: any }>>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteCategories(ids: string[]) {
    return this.request<ApiResponse<{ message: string; deletedIds: string[] }>>('/categories/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  // Inventory
  async getInventory(params?: PaginationParams & SearchParams & { 
    productId?: string; 
    locationId?: string; 
    minQuantity?: number; 
    maxQuantity?: number; 
  }) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ inventory: any[]; pagination?: any }>>(`/inventory${queryString ? `?${queryString}` : ''}`);
  }

  async getInventoryItem(id: string) {
    return this.request<ApiResponse<{ inventory: any }>>(`/inventory/${id}`);
  }

  async createInventoryItem(data: any) {
    return this.request<ApiResponse<{ inventory: any }>>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInventoryItem(id: string, data: any) {
    return this.request<ApiResponse<{ inventory: any }>>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInventoryItem(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/inventory/${id}`, {
      method: 'DELETE',
    });
  }

  async getLowStockItems(threshold?: number) {
    const queryString = threshold ? this.buildQueryString({ maxQuantity: threshold }) : '';
    return this.request<ApiResponse<{ lowStockItems: any[]; threshold: number }>>(`/inventory/low-stock${queryString ? `?${queryString}` : ''}`);
  }

  // Enhanced Products
  async getProducts(params?: PaginationParams & SearchParams & { 
    categoryId?: string; 
    status?: string;
    tags?: string[];
    minPrice?: number; 
    maxPrice?: number;
    minStock?: number;
    maxStock?: number;
    hasVariants?: boolean;
  }) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ products: any[]; pagination?: any }>>(`/products${queryString ? `?${queryString}` : ''}`);
  }

  async getProduct(id: string) {
    return this.request<ApiResponse<{ product: any }>>(`/products/${id}`);
  }

  async createProduct(data: any) {
    return this.request<ApiResponse<{ product: any }>>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<ApiResponse<{ product: any }>>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async duplicateProduct(id: string, name?: string) {
    return this.request<ApiResponse<{ product: any }>>(`/products/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async archiveProduct(id: string) {
    return this.request<ApiResponse<{ product: any }>>(`/products/${id}/archive`, {
      method: 'POST',
    });
  }

  async restoreProduct(id: string) {
    return this.request<ApiResponse<{ product: any }>>(`/products/${id}/restore`, {
      method: 'POST',
    });
  }

  async bulkUpdateProducts(data: { productIds: string[]; updates: any }) {
    return this.request<ApiResponse<{ products: any[]; updated: number }>>('/products/bulk-update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkDeleteProducts(ids: string[]) {
    return this.request<ApiResponse<{ message: string; deletedIds: string[] }>>('/products/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  }

  async importProducts(data: any[]) {
    return this.request<ApiResponse<{ created: number; errors: string[]; total: number }>>('/products/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportProducts(params?: any) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ products: any[] }>>(`/products/export${queryString ? `?${queryString}` : ''}`);
  }

  async searchProducts(query: string, limit?: number) {
    const queryString = this.buildQueryString({ q: query, limit });
    return this.request<ApiResponse<{ products: any[] }>>(`/products/search?${queryString}`);
  }

  async getLowStockProducts(threshold?: number) {
    const queryString = threshold ? this.buildQueryString({ threshold }) : '';
    return this.request<ApiResponse<{ products: any[]; threshold: number | string }>>(`/products/low-stock${queryString ? `?${queryString}` : ''}`);
  }

  async getTopProducts(metric: 'ordered' | 'cost' | 'frequency', limit?: number) {
    const queryString = this.buildQueryString({ metric, limit });
    return this.request<ApiResponse<{ products: any[]; metric: string; limit: number }>>(`/products/top?${queryString}`);
  }

  async getProductAnalytics(id: string, days?: number) {
    const queryString = days ? this.buildQueryString({ days }) : '';
    return this.request<ApiResponse<{ analytics: any }>>(`/products/${id}/analytics${queryString ? `?${queryString}` : ''}`);
  }

  async getProductPurchaseHistory(id: string, limit?: number) {
    const queryString = limit ? this.buildQueryString({ limit }) : '';
    return this.request<ApiResponse<{ history: any[] }>>(`/products/${id}/purchase-history${queryString ? `?${queryString}` : ''}`);
  }

  // Product Variants
  async getProductVariants(productId: string) {
    return this.request<ApiResponse<{ variants: any[] }>>(`/products/${productId}/variants`);
  }

  async createProductVariant(productId: string, data: any) {
    return this.request<ApiResponse<{ variant: any }>>(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProductVariant(productId: string, variantId: string, data: any) {
    return this.request<ApiResponse<{ variant: any }>>(`/products/${productId}/variants/${variantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProductVariant(productId: string, variantId: string) {
    return this.request<ApiResponse<{ message: string }>>(`/products/${productId}/variants/${variantId}`, {
      method: 'DELETE',
    });
  }

  // Product Relationships
  async getProductRelationships(productId: string) {
    return this.request<ApiResponse<{ relationships: any[] }>>(`/products/${productId}/relationships`);
  }

  async createProductRelationship(productId: string, data: any) {
    return this.request<ApiResponse<{ relationship: any }>>(`/products/${productId}/relationships`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteProductRelationship(productId: string, relationshipId: string) {
    return this.request<ApiResponse<{ message: string }>>(`/products/${productId}/relationships/${relationshipId}`, {
      method: 'DELETE',
    });
  }

  // Product Templates
  async getProductTemplates() {
    return this.request<ApiResponse<{ templates: any[] }>>('/products/templates');
  }

  async createProductTemplate(data: any) {
    return this.request<ApiResponse<{ template: any }>>('/products/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createProductFromTemplate(templateId: string, overrides: any) {
    return this.request<ApiResponse<{ product: any }>>(`/products/templates/${templateId}/create-product`, {
      method: 'POST',
      body: JSON.stringify(overrides),
    });
  }

  async deleteProductTemplate(templateId: string) {
    return this.request<ApiResponse<{ message: string }>>(`/products/templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  // Product Utilities
  async generateSKU(categoryId?: string) {
    const queryString = categoryId ? this.buildQueryString({ categoryId }) : '';
    return this.request<ApiResponse<{ sku: string }>>(`/products/generate-sku${queryString ? `?${queryString}` : ''}`);
  }

  async generateBarcode() {
    return this.request<ApiResponse<{ barcode: string }>>('/products/generate-barcode');
  }

  // Enhanced Locations
  async getLocations(params?: PaginationParams & SearchParams & { 
    type?: string; 
    managerId?: string; 
  }) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ locations: any[]; pagination?: any }>>(`/locations${queryString ? `?${queryString}` : ''}`);
  }

  async getLocation(id: string) {
    return this.request<ApiResponse<{ location: any }>>(`/locations/${id}`);
  }

  async createLocation(data: any) {
    return this.request<ApiResponse<{ location: any }>>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLocation(id: string, data: any) {
    return this.request<ApiResponse<{ location: any }>>(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLocation(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/locations/${id}`, {
      method: 'DELETE',
    });
  }

  // Enhanced Users
  async getUsers(params?: PaginationParams & SearchParams & { 
    role?: string; 
    locationId?: string; 
  }) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ users: any[]; pagination?: any }>>(`/users${queryString ? `?${queryString}` : ''}`);
  }

  async getUser(id: string) {
    return this.request<ApiResponse<{ user: any }>>(`/users/${id}`);
  }

  async createUser(data: any) {
    return this.request<ApiResponse<{ user: any }>>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request<ApiResponse<{ user: any }>>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Purchase Orders
  async getPurchaseOrders() {
    return this.request<{ purchaseOrders: any[] }>('/purchase-orders');
  }

  async createPurchaseOrder(data: any) {
    return this.request<{ purchaseOrder: any }>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Transfers
  async getTransfers() {
    return this.request<{ transfers: any[] }>('/transfers');
  }

  async createTransfer(data: any) {
    return this.request<{ transfer: any }>('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Allocations
  async getAllocations() {
    return this.request<{ allocations: any[] }>('/allocations');
  }

  async createAllocation(data: any) {
    return this.request<{ allocation: any }>('/allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Analytics
  async getAnalytics(type: 'receipts' | 'transfers' | 'allocations') {
    return this.request<any>(`/analytics/${type}`);
  }

  // Suppliers
  async getSuppliers(params?: PaginationParams & SearchParams) {
    const queryString = params ? this.buildQueryString(params) : '';
    return this.request<ApiResponse<{ suppliers: any[]; pagination?: any }>>(`/suppliers${queryString ? `?${queryString}` : ''}`);
  }

  async getSupplier(id: string) {
    return this.request<ApiResponse<{ supplier: any }>>(`/suppliers/${id}`);
  }

  async createSupplier(data: any) {
    return this.request<ApiResponse<{ supplier: any }>>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupplier(id: string, data: any) {
    return this.request<ApiResponse<{ supplier: any }>>(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSupplier(id: string) {
    return this.request<ApiResponse<{ message: string }>>(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  // Purchase Orders (Enhanced)
  async getPurchaseOrder(id: string) {
    return this.request<ApiResponse<{ purchaseOrder: any }>>(`/purchase-orders/${id}`);
  }

  async updatePurchaseOrder(id: string, data: any) {
    return this.request<ApiResponse<{ purchaseOrder: any }>>(`/purchase-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async approvePurchaseOrder(id: string) {
    return this.request<ApiResponse<{ purchaseOrder: any }>>(`/purchase-orders/${id}/approve`, {
      method: 'POST',
    });
  }

  async addPOLineItem(poId: string, data: any) {
    return this.request<ApiResponse<{ lineItem: any }>>(`/purchase-orders/${poId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Transfers (Enhanced)
  async getTransfer(id: string) {
    return this.request<ApiResponse<{ transfer: any }>>(`/transfers/${id}`);
  }

  async updateTransfer(id: string, data: any) {
    return this.request<ApiResponse<{ transfer: any }>>(`/transfers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async approveTransfer(id: string) {
    return this.request<ApiResponse<{ transfer: any }>>(`/transfers/${id}/approve`, {
      method: 'POST',
    });
  }

  // Allocations (Enhanced)
  async getAllocation(id: string) {
    return this.request<ApiResponse<{ allocation: any }>>(`/allocations/${id}`);
  }

  async updateAllocation(id: string, data: any) {
    return this.request<ApiResponse<{ allocation: any }>>(`/allocations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Receipt Processing
  async uploadReceipt(file: File, options?: any) {
    const formData = new FormData();
    formData.append('receipt', file);
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request<ApiResponse<{ job: any }>>('/receipts/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async getReceiptJob(jobId: string) {
    return this.request<ApiResponse<{ job: any }>>(`/receipts/jobs/${jobId}`);
  }

  async getReceipt(id: string) {
    return this.request<ApiResponse<{ receipt: any }>>(`/receipts/${id}`);
  }

  async verifyReceipt(id: string, data: any) {
    return this.request<ApiResponse<{ receipt: any }>>(`/receipts/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();