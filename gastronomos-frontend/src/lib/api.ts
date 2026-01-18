const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787/api/v1';

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

  // Health check
  async healthCheck() {
    return this.request<{ status: string; timestamp: string; environment: string }>('/health');
  }

  // Tenants
  async getTenants() {
    return this.request<{ tenants: any[] }>('/tenants');
  }

  // Products
  async getProducts() {
    return this.request<{ products: any[] }>('/products');
  }

  async createProduct(data: any) {
    return this.request<{ product: any }>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
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
}

export const apiClient = new ApiClient();