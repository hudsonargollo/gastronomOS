import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Environment bindings interface
interface Env {
  ENVIRONMENT?: string;
  __STATIC_CONTENT: KVNamespace;
  __STATIC_CONTENT_MANIFEST: string;
  [key: string]: any;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// API proxy - forward all /api requests to the backend worker
app.all('/api/*', async (c) => {
  const url = new URL(c.req.url);
  const backendUrl = `https://gastronomos-production.hudsonargollo2.workers.dev${url.pathname}${url.search}`;
  
  try {
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(Object.entries(c.req.header())),
        'Origin': 'https://gastronomos.clubemkt.digital',
        'Referer': 'https://gastronomos.clubemkt.digital'
      },
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return c.json({ 
      error: 'API proxy failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'frontend-worker',
    timestamp: new Date().toISOString()
  });
});

// Main route handler
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  
  // Handle root path - serve login page
  if (pathname === '/' || pathname === '/index.html') {
    return new Response(buildLoginPage(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
  
  // Handle dashboard routes - serve dynamic dashboard
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/inventory') || 
      pathname.startsWith('/purchasing') || 
      pathname.startsWith('/analytics') || 
      pathname.startsWith('/locations') || 
      pathname.startsWith('/transfers') || 
      pathname.startsWith('/allocations') || 
      pathname.startsWith('/users') || 
      pathname.startsWith('/settings')) {
    
    return new Response(buildDashboard(pathname), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
  
  // 404 for other routes
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Page Not Found</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go back to home</a>
      </div>
    </body>
    </html>
  `, 404);
});
// Build login page
function buildLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GastronomOS - Login</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    
    .logo {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .logo h1 {
      color: #333;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .logo p {
      color: #666;
      font-size: 0.9rem;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #333;
      font-weight: 500;
    }
    
    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.3s;
    }
    
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .btn {
      width: 100%;
      padding: 0.75rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
      margin-bottom: 1rem;
    }
    
    .btn:hover {
      transform: translateY(-2px);
    }
    
    .btn-demo {
      background: #f8f9fa;
      color: #333;
      border: 2px solid #e1e5e9;
    }
    
    .btn-demo:hover {
      background: #e9ecef;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">
      <h1>🍽️ GastronomOS</h1>
      <p>Sistema de Gestão para Restaurantes</p>
    </div>
    
    <form onsubmit="handleLogin(event)">
      <div class="form-group">
        <label for="email">E-mail</label>
        <input type="email" id="email" required>
      </div>
      
      <div class="form-group">
        <label for="password">Senha</label>
        <input type="password" id="password" required>
      </div>
      
      <button type="submit" class="btn">Entrar</button>
      <button type="button" class="btn btn-demo" onclick="handleDemoLogin()">Usar Conta Demo</button>
    </form>
  </div>
  
  <script>
    function handleDemoLogin() {
      document.getElementById('email').value = 'demo@gastronomos.com';
      document.getElementById('password').value = 'demo123';
    }
    
    function handleLogin(event) {
      event.preventDefault();
      localStorage.setItem('auth_token', 'demo_token_' + Date.now());
      window.location.href = '/dashboard';
    }
  </script>
</body>
</html>`;
}
// Build dashboard
function buildDashboard(route: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GastronomOS - Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #334155;
    }
    
    .dashboard-container {
      display: flex;
      min-height: 100vh;
    }
    
    /* Sidebar Styles */
    .sidebar {
      width: 280px;
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      color: white;
      padding: 1.5rem;
      box-shadow: 4px 0 12px rgba(0,0,0,0.1);
    }
    
    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    .sidebar-header .logo {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #f97316, #dc2626);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    
    .sidebar-header h1 {
      font-size: 1.25rem;
      font-weight: 700;
    }
    
    .nav-menu {
      list-style: none;
    }
    
    .nav-item {
      margin-bottom: 0.5rem;
    }
    
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      color: #cbd5e1;
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.2s;
    }
    
    .nav-link:hover,
    .nav-link.active {
      background: rgba(248, 113, 22, 0.2);
      color: #fbbf24;
    }
    
    .nav-icon {
      width: 20px;
      height: 20px;
    }
    
    /* Main Content Styles */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      background: white;
      padding: 1rem 2rem;
      border-bottom: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .header h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1e293b;
    }
    
    .content {
      flex: 1;
      padding: 2rem;
    }
    
    /* Card Styles */
    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      transition: transform 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .stat-header {
      display: flex;
      justify-content: between;
      align-items: center;
      margin-bottom: 1rem;
    }
    
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.5rem;
    }
    
    .stat-label {
      color: #64748b;
      font-size: 0.875rem;
    }
    
    /* Button Styles */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #f97316, #dc2626);
      color: white;
    }
    
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(248, 113, 22, 0.4);
    }
    
    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    
    /* Table Styles */
    .table-container {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
    }
    
    .table-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 1rem 1.5rem;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
    }
    
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    
    tr:hover {
      background: #f8fafc;
    }
    
    /* Form Styles */
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #374151;
    }
    
    .form-input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }
    
    .form-input:focus {
      outline: none;
      border-color: #f97316;
    }
    
    /* Modal Styles */
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    
    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6b7280;
    }
    
    .close-btn:hover {
      color: #374151;
    }
    
    /* Utility Classes */
    .hidden { display: none !important; }
    .text-center { text-align: center; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mt-4 { margin-top: 1rem; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-4 { gap: 1rem; }
    
    /* Responsive */
    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        position: fixed;
        top: 0;
        left: -100%;
        height: 100vh;
        z-index: 999;
        transition: left 0.3s;
      }
      
      .sidebar.open {
        left: 0;
      }
      
      .main-content {
        margin-left: 0;
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="dashboard-container">
    ${buildSidebar(route)}
    ${buildMainContent(route)}
  </div>
  
  ${buildDashboardScript()}
</body>
</html>`;
}
// Build sidebar
function buildSidebar(currentRoute: string): string {
  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Produtos', path: '/inventory/products', icon: '📦' },
    { name: 'Categorias', path: '/inventory/categories', icon: '🏷️' },
    { name: 'Estoque', path: '/inventory/stock', icon: '📋' },
    { name: 'Compras', path: '/purchasing', icon: '🛒' },
    { name: 'Transferências', path: '/transfers', icon: '🔄' },
    { name: 'Análises', path: '/analytics', icon: '📈' },
    { name: 'Locais', path: '/locations', icon: '📍' },
    { name: 'Usuários', path: '/users', icon: '👥' },
    { name: 'Configurações', path: '/settings', icon: '⚙️' }
  ];

  return `
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="logo">🍽️</div>
        <div>
          <h1>GastronomOS</h1>
          <p style="font-size: 0.8rem; opacity: 0.7;">Sistema de Gestão</p>
        </div>
      </div>
      
      <nav>
        <ul class="nav-menu">
          ${menuItems.map(item => `
            <li class="nav-item">
              <a href="${item.path}" class="nav-link ${currentRoute === item.path ? 'active' : ''}" onclick="navigateTo('${item.path}')">
                <span class="nav-icon">${item.icon}</span>
                ${item.name}
              </a>
            </li>
          `).join('')}
        </ul>
      </nav>
    </div>
  `;
}

// Build main content
function buildMainContent(route: string): string {
  const routeConfig = getRouteConfig(route);
  
  return `
    <div class="main-content">
      <div class="header">
        <h2>${routeConfig.title}</h2>
      </div>
      
      <div class="content">
        ${routeConfig.content}
      </div>
    </div>
  `;
}

// Get route configuration
function getRouteConfig(route: string): { title: string; content: string } {
  switch (route) {
    case '/dashboard':
      return {
        title: 'Dashboard',
        content: buildDashboardContent()
      };
    case '/inventory/products':
      return {
        title: 'Produtos',
        content: buildProductsContent()
      };
    case '/inventory/categories':
      return {
        title: 'Categorias',
        content: buildCategoriesContent()
      };
    case '/inventory/stock':
      return {
        title: 'Controle de Estoque',
        content: buildStockContent()
      };
    default:
      return {
        title: 'Página',
        content: `<div class="card"><p>Conteúdo em desenvolvimento para: ${route}</p></div>`
      };
  }
}
// Build dashboard content
function buildDashboardContent(): string {
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">📦</div>
        </div>
        <div class="stat-value">2,847</div>
        <div class="stat-label">Total de Produtos</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">🛒</div>
        </div>
        <div class="stat-value">156</div>
        <div class="stat-label">Pedidos Ativos</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">🔄</div>
        </div>
        <div class="stat-value">23</div>
        <div class="stat-label">Transferências Pendentes</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">💰</div>
        </div>
        <div class="stat-value">R$ 47.892</div>
        <div class="stat-label">Receita Mensal</div>
      </div>
    </div>
    
    <div class="card">
      <h3 class="mb-4">Atividade Recente</h3>
      <div style="space-y: 1rem;">
        <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
          <strong>Novo pedido #1234 recebido</strong>
          <div style="color: #64748b; font-size: 0.875rem;">2 min atrás</div>
        </div>
        <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
          <strong>Transferência para Filial Centro concluída</strong>
          <div style="color: #64748b; font-size: 0.875rem;">15 min atrás</div>
        </div>
        <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; margin-bottom: 0.5rem;">
          <strong>5 produtos adicionados ao estoque</strong>
          <div style="color: #64748b; font-size: 0.875rem;">1 hora atrás</div>
        </div>
      </div>
    </div>
  `;
}

// Build products content
function buildProductsContent(): string {
  return `
    <div class="table-container">
      <div class="table-header">
        <h3>Lista de Produtos</h3>
        <button class="btn btn-primary" onclick="openProductModal()">
          ➕ Adicionar Produto
        </button>
      </div>
      
      <div style="padding: 1rem;">
        <div class="flex gap-4 mb-4">
          <input type="text" id="product-search" placeholder="Buscar produtos..." class="form-input" style="flex: 1;">
          <button class="btn btn-secondary" onclick="loadProducts()">🔍 Buscar</button>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="products-table">
          <tr>
            <td colspan="6" class="text-center" style="padding: 2rem;">
              <div id="loading-products">Carregando produtos...</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Product Modal -->
    <div id="product-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Adicionar Produto</h3>
          <button class="close-btn" onclick="closeProductModal()">&times;</button>
        </div>
        
        <form onsubmit="saveProduct(event)">
          <div class="form-group">
            <label class="form-label">Nome do Produto</label>
            <input type="text" id="product-name" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select id="product-category" class="form-input" required>
              <option value="">Selecione uma categoria</option>
              <option value="1">Hambúrgueres</option>
              <option value="2">Pizzas</option>
              <option value="3">Bebidas</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Preço (R$)</label>
            <input type="number" id="product-price" class="form-input" step="0.01" min="0">
          </div>
          
          <div class="form-group">
            <label class="form-label">Estoque</label>
            <input type="number" id="product-stock" class="form-input" min="0">
          </div>
          
          <div class="flex gap-4 mt-4">
            <button type="button" class="btn btn-secondary" onclick="closeProductModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Produto</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
// Build categories content
function buildCategoriesContent(): string {
  return `
    <div class="table-container">
      <div class="table-header">
        <h3>Categorias de Produtos</h3>
        <button class="btn btn-primary" onclick="openCategoryModal()">
          ➕ Nova Categoria
        </button>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Descrição</th>
            <th>Produtos</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="categories-table">
          <tr>
            <td colspan="5" class="text-center" style="padding: 2rem;">
              <div id="loading-categories">Carregando categorias...</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Category Modal -->
    <div id="category-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Nova Categoria</h3>
          <button class="close-btn" onclick="closeCategoryModal()">&times;</button>
        </div>
        
        <form onsubmit="saveCategory(event)">
          <div class="form-group">
            <label class="form-label">Nome da Categoria</label>
            <input type="text" id="category-name" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <textarea id="category-description" class="form-input" rows="3"></textarea>
          </div>
          
          <div class="flex gap-4 mt-4">
            <button type="button" class="btn btn-secondary" onclick="closeCategoryModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar Categoria</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Build stock content
function buildStockContent(): string {
  return `
    <div class="card">
      <h3 class="mb-4">Controle de Estoque</h3>
      <p>Funcionalidade de controle de estoque em desenvolvimento.</p>
    </div>
  `;
}
// Build dashboard script
function buildDashboardScript(): string {
  return `
  <script>
    // Demo data
    let products = [
      { id: 1, name: 'Hambúrguer Artesanal', category: 'Hambúrgueres', price: 25.90, stock: 15, active: true },
      { id: 2, name: 'Pizza Margherita', category: 'Pizzas', price: 32.50, stock: 8, active: true },
      { id: 3, name: 'Refrigerante Cola', category: 'Bebidas', price: 4.50, stock: 45, active: true },
      { id: 4, name: 'Batata Frita', category: 'Acompanhamentos', price: 12.00, stock: 3, active: true },
      { id: 5, name: 'Salada Caesar', category: 'Saladas', price: 18.90, stock: 0, active: false }
    ];
    
    let categories = [
      { id: 1, name: 'Hambúrgueres', description: 'Hambúrgueres artesanais', products: 1, active: true },
      { id: 2, name: 'Pizzas', description: 'Pizzas tradicionais e especiais', products: 1, active: true },
      { id: 3, name: 'Bebidas', description: 'Refrigerantes, sucos e águas', products: 1, active: true },
      { id: 4, name: 'Acompanhamentos', description: 'Batatas, anéis de cebola', products: 1, active: true },
      { id: 5, name: 'Saladas', description: 'Saladas frescas e saudáveis', products: 1, active: true }
    ];
    
    let editingProductId = null;
    let editingCategoryId = null;
    
    // Navigation
    function navigateTo(path) {
      event.preventDefault();
      window.location.href = path;
    }
    
    // Load products
    function loadProducts() {
      const tbody = document.getElementById('products-table');
      if (!tbody) return;
      
      const searchTerm = document.getElementById('product-search')?.value.toLowerCase() || '';
      const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.category.toLowerCase().includes(searchTerm)
      );
      
      if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;">Nenhum produto encontrado</td></tr>';
        return;
      }
      
      tbody.innerHTML = filteredProducts.map(product => \`
        <tr>
          <td><strong>\${product.name}</strong></td>
          <td>\${product.category}</td>
          <td>R$ \${product.price.toFixed(2)}</td>
          <td>\${product.stock}</td>
          <td>
            <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; background: \${product.active ? '#dcfce7; color: #166534' : '#fecaca; color: #991b1b'};">
              \${product.active ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.5rem; margin-right: 0.5rem;" onclick="editProduct(\${product.id})">✏️</button>
            <button class="btn btn-secondary" style="padding: 0.5rem; background: #fecaca; color: #991b1b;" onclick="deleteProduct(\${product.id})">🗑️</button>
          </td>
        </tr>
      \`).join('');
    }
    
    // Load categories
    function loadCategories() {
      const tbody = document.getElementById('categories-table');
      if (!tbody) return;
      
      tbody.innerHTML = categories.map(category => \`
        <tr>
          <td><strong>\${category.name}</strong></td>
          <td>\${category.description}</td>
          <td>\${category.products}</td>
          <td>
            <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; background: \${category.active ? '#dcfce7; color: #166534' : '#fecaca; color: #991b1b'};">
              \${category.active ? 'Ativa' : 'Inativa'}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.5rem; margin-right: 0.5rem;" onclick="editCategory(\${category.id})">✏️</button>
            <button class="btn btn-secondary" style="padding: 0.5rem; background: #fecaca; color: #991b1b;" onclick="deleteCategory(\${category.id})">🗑️</button>
          </td>
        </tr>
      \`).join('');
    }
    
    // Product modal functions
    function openProductModal(productId = null) {
      editingProductId = productId;
      const modal = document.getElementById('product-modal');
      const title = document.querySelector('#product-modal .modal-title');
      
      if (productId) {
        const product = products.find(p => p.id === productId);
        title.textContent = 'Editar Produto';
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock;
      } else {
        title.textContent = 'Adicionar Produto';
        document.getElementById('product-name').value = '';
        document.getElementById('product-price').value = '';
        document.getElementById('product-stock').value = '';
      }
      
      modal.classList.remove('hidden');
    }
    
    function closeProductModal() {
      document.getElementById('product-modal').classList.add('hidden');
      editingProductId = null;
    }
    
    function saveProduct(event) {
      event.preventDefault();
      
      const name = document.getElementById('product-name').value;
      const categoryId = document.getElementById('product-category').value;
      const price = parseFloat(document.getElementById('product-price').value);
      const stock = parseInt(document.getElementById('product-stock').value);
      
      const categoryName = categories.find(c => c.id == categoryId)?.name || 'Sem categoria';
      
      if (editingProductId) {
        const index = products.findIndex(p => p.id === editingProductId);
        products[index] = { ...products[index], name, category: categoryName, price, stock };
      } else {
        const newId = Math.max(...products.map(p => p.id)) + 1;
        products.push({ id: newId, name, category: categoryName, price, stock, active: true });
      }
      
      closeProductModal();
      loadProducts();
    }
    
    function editProduct(id) {
      openProductModal(id);
    }
    
    function deleteProduct(id) {
      if (confirm('Tem certeza que deseja excluir este produto?')) {
        products = products.filter(p => p.id !== id);
        loadProducts();
      }
    }
    
    // Category modal functions
    function openCategoryModal(categoryId = null) {
      editingCategoryId = categoryId;
      const modal = document.getElementById('category-modal');
      const title = document.querySelector('#category-modal .modal-title');
      
      if (categoryId) {
        const category = categories.find(c => c.id === categoryId);
        title.textContent = 'Editar Categoria';
        document.getElementById('category-name').value = category.name;
        document.getElementById('category-description').value = category.description;
      } else {
        title.textContent = 'Nova Categoria';
        document.getElementById('category-name').value = '';
        document.getElementById('category-description').value = '';
      }
      
      modal.classList.remove('hidden');
    }
    
    function closeCategoryModal() {
      document.getElementById('category-modal').classList.add('hidden');
      editingCategoryId = null;
    }
    
    function saveCategory(event) {
      event.preventDefault();
      
      const name = document.getElementById('category-name').value;
      const description = document.getElementById('category-description').value;
      
      if (editingCategoryId) {
        const index = categories.findIndex(c => c.id === editingCategoryId);
        categories[index] = { ...categories[index], name, description };
      } else {
        const newId = Math.max(...categories.map(c => c.id)) + 1;
        categories.push({ id: newId, name, description, products: 0, active: true });
      }
      
      closeCategoryModal();
      loadCategories();
    }
    
    function editCategory(id) {
      openCategoryModal(id);
    }
    
    function deleteCategory(id) {
      if (confirm('Tem certeza que deseja excluir esta categoria?')) {
        categories = categories.filter(c => c.id !== id);
        loadCategories();
      }
    }
    
    // Initialize page
    document.addEventListener('DOMContentLoaded', function() {
      // Load data based on current page
      if (window.location.pathname.includes('/products')) {
        loadProducts();
      } else if (window.location.pathname.includes('/categories')) {
        loadCategories();
      }
    });
  </script>
  `;
}

export default app;