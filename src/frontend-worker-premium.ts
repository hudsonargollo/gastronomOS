import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  ENVIRONMENT?: string;
  __STATIC_CONTENT: KVNamespace;
  __STATIC_CONTENT_MANIFEST: string;
  [key: string]: any;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// API proxy
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

app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'frontend-worker-premium',
    timestamp: new Date().toISOString()
  });
});

// Main route handler
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  
  if (pathname === '/' || pathname === '/index.html') {
    return new Response(buildLoginPage(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
  
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
  
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Page Not Found</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        h1 { color: #1e293b; margin-bottom: 1rem; }
        a { color: #f97316; text-decoration: none; font-weight: 600; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 - Página não encontrada</h1>
        <p>A página que você está procurando não existe.</p>
        <a href="/">← Voltar ao início</a>
      </div>
    </body>
    </html>
  `, 404);
});

// Build premium login page
function buildLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GastronomOS - O Sistema Operacional do seu Restaurante</title>
  <meta name="description" content="O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍽️</text></svg>">
  <style>
    ${getLoginStyles()}
  </style>
</head>
<body class="h-full">
  <div class="min-h-screen bg-gradient flex items-center justify-center p-4">
    <!-- Background decorations -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter opacity-70 animate-blob"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply filter opacity-70 animate-blob animation-delay-2000"></div>
      <div class="absolute top-40 left-40 w-80 h-80 bg-yellow-200 rounded-full mix-blend-multiply filter opacity-70 animate-blob animation-delay-4000"></div>
    </div>

    <div class="w-full max-w-md relative z-10">
      <!-- Logo -->
      <div class="text-center mb-8 animate-fade-in">
        <div class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-orange shadow-lg mb-4 animate-scale-in">
          <svg class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2v6a6 6 0 0 0 12 0V2"></path>
            <path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path>
            <path d="M14 2v4"></path><path d="M16 2v4"></path>
            <path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path>
          </svg>
        </div>
        <h1 class="text-2xl font-bold bg-gradient-orange bg-clip-text text-transparent">GastronomOS</h1>
        <p class="text-slate-600 text-sm mt-1">O Sistema Operacional do seu Restaurante</p>
      </div>

      <!-- Login Card -->
      <div class="card py-6 animate-slide-up">
        <div class="text-center pb-6 px-6">
          <h2 class="text-xl font-semibold text-slate-900">Bem-vindo de volta</h2>
          <p class="text-sm text-slate-600">Entre na sua conta para continuar</p>
        </div>
        <div class="px-6">
          <form class="space-y-4" onsubmit="handleLogin(event)">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="email">E-mail</label>
              <input type="email" id="email" placeholder="seu@email.com" required class="form-input" />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="password">Senha</label>
              <div class="relative">
                <input type="password" id="password" placeholder="••••••••" required class="form-input pr-10" />
                <button type="button" class="absolute right-0 top-0 h-11 px-3 bg-transparent border-0 cursor-pointer" onclick="togglePassword()">
                  <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" class="btn-primary w-full">
              <div class="flex items-center justify-center space-x-2">
                <span>Entrar</span>
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
                </svg>
              </div>
            </button>
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t border-slate-200"></span>
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="bg-white px-2 text-slate-500">ou</span>
              </div>
            </div>
            <button type="button" class="btn-secondary w-full" onclick="handleDemoLogin()">
              <div class="flex items-center justify-center space-x-2">
                <svg class="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
                </svg>
                <span>Testar Conta Demo</span>
              </div>
            </button>
          </form>
        </div>
      </div>

      <!-- Features -->
      <div class="mt-8 text-center animate-fade-in-delay">
        <div class="grid grid-cols-3 gap-4 text-xs text-slate-600">
          <div class="flex flex-col items-center space-y-1">
            <div class="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
              <svg class="h-4 w-4 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"></path>
                <path d="M6 18h12"></path><path d="M6 14h12"></path><path d="m12 6 0 12"></path>
              </svg>
            </div>
            <span>Gestão de Estoque</span>
          </div>
          <div class="flex flex-col items-center space-y-1">
            <div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg class="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path>
              </svg>
            </div>
            <span>Compras</span>
          </div>
          <div class="flex flex-col items-center space-y-1">
            <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
            </div>
            <span>Análises</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    ${getLoginScript()}
  </script>
</body>
</html>`;
}

// Build premium dashboard
function buildDashboard(route: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GastronomOS - Dashboard</title>
  <meta name="description" content="Dashboard do GastronomOS - Sistema de Gestão para Restaurantes">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍽️</text></svg>">
  <style>
    ${getDashboardStyles()}
  </style>
</head>
<body class="h-full antialiased">
  <div class="flex h-screen bg-slate-50 overflow-hidden">
    ${buildSidebar(route)}
    ${buildMainContent(route)}
  </div>
  
  <script>
    ${getDashboardScript()}
  </script>
</body>
</html>`;
}

// Build premium sidebar
function buildSidebar(currentRoute: string): string {
  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: 'home',
      description: 'Visão geral e métricas'
    },
    {
      name: 'Estoque',
      href: '/inventory',
      icon: 'package',
      description: 'Gestão de produtos',
      children: [
        { name: 'Produtos', href: '/inventory/products', icon: 'apple' },
        { name: 'Categorias', href: '/inventory/categories', icon: 'tag' },
        { name: 'Níveis de Estoque', href: '/inventory/stock', icon: 'warehouse' }
      ]
    },
    {
      name: 'Compras',
      href: '/purchasing',
      icon: 'shopping-cart',
      description: 'Pedidos e fornecedores',
      children: [
        { name: 'Pedidos de Compra', href: '/purchasing/orders', icon: 'file-text' },
        { name: 'Fornecedores', href: '/purchasing/suppliers', icon: 'building' },
        { name: 'Recebimentos', href: '/purchasing/receipts', icon: 'receipt' }
      ]
    },
    {
      name: 'Transferências',
      href: '/transfers',
      icon: 'arrow-right-left',
      description: 'Transferências entre locais',
      children: [
        { name: 'Transferências Ativas', href: '/transfers/active', icon: 'truck' },
        { name: 'Histórico', href: '/transfers/history', icon: 'file-text' },
        { name: 'Emergenciais', href: '/transfers/emergency', icon: 'timer' }
      ]
    },
    {
      name: 'Alocações',
      href: '/allocations',
      icon: 'scale',
      description: 'Alocação de recursos',
      children: [
        { name: 'Alocações Atuais', href: '/allocations/current', icon: 'chart-pie' },
        { name: 'Templates', href: '/allocations/templates', icon: 'file-text' },
        { name: 'Não Alocados', href: '/allocations/unallocated', icon: 'package' }
      ]
    },
    {
      name: 'Análises',
      href: '/analytics',
      icon: 'bar-chart-3',
      description: 'Relatórios e insights',
      children: [
        { name: 'Performance', href: '/analytics/performance', icon: 'trending-up' },
        { name: 'Análise de Custos', href: '/analytics/costs', icon: 'chart-pie' },
        { name: 'Relatórios de Variação', href: '/analytics/variance', icon: 'bar-chart-3' }
      ]
    },
    {
      name: 'Locais',
      href: '/locations',
      icon: 'map-pin',
      description: 'Locais do restaurante'
    },
    {
      name: 'Usuários',
      href: '/users',
      icon: 'users',
      description: 'Gestão de usuários'
    },
    {
      name: 'Configurações',
      href: '/settings',
      icon: 'settings',
      description: 'Configurações do sistema'
    }
  ];

  return `
    <div class="sidebar-container">
      <div class="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl relative w-64 sm:w-72">
        <!-- Header -->
        <div class="flex h-14 sm:h-16 items-center justify-center border-b border-slate-700/50 bg-slate-900/50 px-3">
          <div class="flex items-center space-x-3 w-full">
            <div class="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shrink-0">
              ${getIcon('chef', 'h-5 w-5 sm:h-6 sm:w-6 text-white')}
            </div>
            <div class="min-w-0 flex-1">
              <h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent truncate">GastronomOS</h1>
              <p class="text-xs text-slate-400 truncate">Gestão de Restaurante</p>
            </div>
          </div>
        </div>
        
        <!-- Navigation -->
        <nav class="flex-1 space-y-1 p-3 sm:p-4 overflow-y-auto">
          ${navigation.map((item, index) => {
            const isActive = currentRoute === item.href || currentRoute.startsWith(item.href + '/');
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = hasChildren && currentRoute.startsWith(item.href + '/');
            
            return `
              <div class="nav-item" style="animation-delay: ${(index + 1) * 100}ms">
                <div tabindex="0">
                  <a class="nav-link group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] ${
                    isActive 
                      ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 shadow-lg shadow-orange-500/10'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }" href="${item.href}" onclick="navigateTo('${item.href}', event)">
                    ${getIcon(item.icon, `h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-orange-400' : 'text-slate-400 group-hover:text-white'}`)}
                    <span class="ml-3 flex-1 truncate">${item.name}</span>
                    ${hasChildren ? `
                      <div class="ml-auto submenu-chevron transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}">
                        ${getIcon('chevron-right', 'h-4 w-4 text-slate-400')}
                      </div>
                    ` : ''}
                  </a>
                  
                  ${hasChildren ? `
                    <div class="submenu ml-6 mt-1 space-y-1 overflow-hidden transition-all duration-300" style="max-height: ${isExpanded ? `${item.children.length * 40}px` : '0px'}">
                      ${item.children.map(subItem => {
                        const subActive = currentRoute === subItem.href;
                        return `
                          <a href="${subItem.href}" onclick="navigateTo('${subItem.href}', event)" class="nav-link block px-3 py-2 text-sm ${subActive ? 'text-orange-300 bg-slate-700/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'} rounded-lg transition-colors duration-200">
                            ${getIcon(subItem.icon, 'h-4 w-4 inline mr-2')}
                            ${subItem.name}
                          </a>
                        `;
                      }).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </nav>
        
        <!-- User Profile -->
        <div class="border-t border-slate-700/50 p-3 sm:p-4">
          <div class="flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 transition-colors hover:bg-slate-700/50 cursor-pointer min-h-[52px]" tabindex="0">
            <div class="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">
              <span class="text-sm font-semibold text-white">JS</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">João Silva</p>
              <p class="text-xs text-slate-400 truncate">Gerente de Restaurante</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Build main content
function buildMainContent(route: string): string {
  const routeConfig = getRouteConfig(route);
  
  return `
    <div class="flex flex-1 flex-col overflow-hidden min-w-0">
      <!-- Header -->
      <header class="header-container flex h-14 sm:h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-3 sm:px-6 shadow-sm">
        <div class="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
          <button id="mobile-menu-btn" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none hover:bg-accent hover:text-accent-foreground rounded-md gap-1.5 lg:hidden h-9 w-9 p-0 shrink-0">
            ${getIcon('menu', 'h-5 w-5')}
          </button>
          
          <div class="min-w-0 flex-1">
            <h1 class="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 truncate">${routeConfig.title}</h1>
            <p class="text-xs sm:text-sm text-slate-500 hidden sm:block truncate">${routeConfig.subtitle}</p>
          </div>
        </div>
        
        <div class="hidden lg:flex flex-1 max-w-md mx-8">
          <div class="relative w-full">
            ${getIcon('search', 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400')}
            <input id="search-input" class="h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors" placeholder="Buscar produtos, pedidos, transferências..."/>
          </div>
        </div>
        
        <div class="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 shrink-0">
          <button class="btn-ghost p-2 lg:hidden">
            ${getIcon('search', 'h-4 w-4')}
          </button>
          
          <button class="btn-ghost p-2 hidden sm:flex">
            ${getIcon('moon', 'h-4 w-4')}
          </button>
          
          <button class="btn-ghost p-2 relative">
            ${getIcon('bell', 'h-4 w-4')}
            <span class="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">3</span>
          </button>
          
          <button class="btn-ghost p-2 sm:px-2 relative">
            <div class="flex items-center space-x-2">
              <span class="relative flex shrink-0 overflow-hidden rounded-full h-7 w-7 sm:h-8 sm:w-8">
                <span class="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs sm:text-sm">JD</span>
              </span>
              <div class="hidden xl:block text-left">
                <p class="text-sm font-medium text-slate-900">John Doe</p>
                <p class="text-xs text-slate-500">Manager</p>
              </div>
              ${getIcon('chevron-down', 'h-3 w-3 text-slate-400 hidden sm:block')}
            </div>
          </button>
        </div>
      </header>
      
      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto">
        <div class="content-container h-full">
          <div class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
            ${routeConfig.content}
          </div>
        </div>
      </main>
    </div>
  `;
}

// Get route configuration
function getRouteConfig(route: string): { title: string; subtitle: string; content: string } {
  const routes: Record<string, { title: string; subtitle: string; content: string }> = {
    '/dashboard': {
      title: 'Dashboard',
      subtitle: 'Bem-vindo de volta, gerencie suas operações do restaurante',
      content: buildDashboardContent()
    },
    '/inventory': {
      title: 'Estoque',
      subtitle: 'Gerencie produtos, categorias e níveis de estoque',
      content: buildInventoryContent()
    },
    '/inventory/products': {
      title: 'Produtos',
      subtitle: 'Cadastre e gerencie produtos do seu restaurante',
      content: buildProductsContent()
    },
    '/inventory/categories': {
      title: 'Categorias',
      subtitle: 'Organize produtos por categorias',
      content: buildCategoriesContent()
    },
    '/inventory/stock': {
      title: 'Controle de Estoque',
      subtitle: 'Monitore níveis e movimentações de estoque',
      content: buildStockContent()
    },
    '/purchasing': {
      title: 'Compras',
      subtitle: 'Gerencie pedidos e fornecedores',
      content: buildPurchasingContent()
    },
    '/analytics': {
      title: 'Análises',
      subtitle: 'Relatórios e métricas do seu negócio',
      content: buildAnalyticsContent()
    },
    '/locations': {
      title: 'Locais',
      subtitle: 'Gerencie filiais e pontos de venda',
      content: buildLocationsContent()
    },
    '/users': {
      title: 'Usuários',
      subtitle: 'Gerencie usuários e permissões',
      content: buildUsersContent()
    },
    '/settings': {
      title: 'Configurações',
      subtitle: 'Configurações do sistema',
      content: buildSettingsContent()
    }
  };

  return routes[route] || routes['/dashboard'];
}

// Login styles
function getLoginStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .bg-gradient {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      background-attachment: fixed;
    }

    .bg-gradient-orange {
      background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
    }

    .bg-clip-text {
      -webkit-background-clip: text;
      background-clip: text;
    }

    .text-transparent {
      color: transparent;
    }

    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .form-input {
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.2s ease;
      background: #f8fafc;
    }

    .form-input:focus {
      outline: none;
      border-color: #f97316;
      background: white;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
    }

    .btn-primary {
      width: 100%;
      height: 44px;
      background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.4);
    }

    .btn-secondary {
      width: 100%;
      height: 44px;
      background: white;
      color: #64748b;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-secondary:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .animate-blob {
      animation: blob 7s infinite;
    }

    .animation-delay-2000 {
      animation-delay: 2s;
    }

    .animation-delay-4000 {
      animation-delay: 4s;
    }

    .animate-fade-in {
      animation: fadeIn 0.8s ease-out;
    }

    .animate-fade-in-delay {
      animation: fadeIn 0.8s ease-out 0.3s both;
    }

    .animate-scale-in {
      animation: scaleIn 0.5s ease-out 0.2s both;
    }

    .animate-slide-up {
      animation: slideUp 0.6s ease-out 0.1s both;
    }

    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .grid {
      display: grid;
    }

    .grid-cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .gap-4 {
      gap: 1rem;
    }

    .text-xs {
      font-size: 0.75rem;
      line-height: 1rem;
    }

    .text-sm {
      font-size: 0.875rem;
      line-height: 1.25rem;
    }

    .text-xl {
      font-size: 1.25rem;
      line-height: 1.75rem;
    }

    .text-2xl {
      font-size: 1.5rem;
      line-height: 2rem;
    }

    .font-bold {
      font-weight: 700;
    }

    .font-semibold {
      font-weight: 600;
    }

    .font-medium {
      font-weight: 500;
    }

    .text-slate-600 {
      color: #475569;
    }

    .text-slate-900 {
      color: #0f172a;
    }

    .flex {
      display: flex;
    }

    .flex-col {
      flex-direction: column;
    }

    .items-center {
      align-items: center;
    }

    .justify-center {
      justify-content: center;
    }

    .space-x-2 > * + * {
      margin-left: 0.5rem;
    }

    .space-y-1 > * + * {
      margin-top: 0.25rem;
    }

    .space-y-2 > * + * {
      margin-top: 0.5rem;
    }

    .space-y-4 > * + * {
      margin-top: 1rem;
    }

    .h-4 {
      height: 1rem;
    }

    .w-4 {
      width: 1rem;
    }

    .h-8 {
      height: 2rem;
    }

    .w-8 {
      width: 2rem;
    }

    .h-16 {
      height: 4rem;
    }

    .w-16 {
      width: 4rem;
    }

    .rounded-full {
      border-radius: 9999px;
    }

    .rounded-2xl {
      border-radius: 1rem;
    }

    .bg-orange-100 {
      background-color: #fed7aa;
    }

    .bg-blue-100 {
      background-color: #dbeafe;
    }

    .bg-green-100 {
      background-color: #dcfce7;
    }

    .text-orange-600 {
      color: #ea580c;
    }

    .text-blue-600 {
      color: #2563eb;
    }

    .text-green-600 {
      color: #16a34a;
    }

    .shadow-lg {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }

    .mb-4 {
      margin-bottom: 1rem;
    }

    .mb-8 {
      margin-bottom: 2rem;
    }

    .mt-1 {
      margin-top: 0.25rem;
    }

    .mt-8 {
      margin-top: 2rem;
    }

    .text-center {
      text-align: center;
    }

    .relative {
      position: relative;
    }

    .absolute {
      position: absolute;
    }

    .inset-0 {
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
    }

    .overflow-hidden {
      overflow: hidden;
    }

    .pointer-events-none {
      pointer-events: none;
    }

    .z-10 {
      z-index: 10;
    }

    .w-full {
      width: 100%;
    }

    .max-w-md {
      max-width: 28rem;
    }

    .min-h-screen {
      min-height: 100vh;
    }

    .p-4 {
      padding: 1rem;
    }

    .px-6 {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }

    .py-6 {
      padding-top: 1.5rem;
      padding-bottom: 1.5rem;
    }

    .pb-6 {
      padding-bottom: 1.5rem;
    }

    .pr-10 {
      padding-right: 2.5rem;
    }

    .px-2 {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }

    .px-3 {
      padding-left: 0.75rem;
      padding-right: 0.75rem;
    }

    .right-0 {
      right: 0;
    }

    .top-0 {
      top: 0;
    }

    .h-11 {
      height: 2.75rem;
    }

    .bg-transparent {
      background-color: transparent;
    }

    .border-0 {
      border-width: 0;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .border-t {
      border-top-width: 1px;
    }

    .border-slate-200 {
      border-color: #e2e8f0;
    }

    .bg-white {
      background-color: white;
    }

    .text-slate-500 {
      color: #64748b;
    }

    .inline-flex {
      display: inline-flex;
    }

    .-top-40 {
      top: -10rem;
    }

    .-right-40 {
      right: -10rem;
    }

    .-bottom-40 {
      bottom: -10rem;
    }

    .-left-40 {
      left: -10rem;
    }

    .top-40 {
      top: 10rem;
    }

    .left-40 {
      left: 10rem;
    }

    .w-80 {
      width: 20rem;
    }

    .h-80 {
      height: 20rem;
    }

    .bg-orange-200 {
      background-color: #fed7aa;
    }

    .bg-red-200 {
      background-color: #fecaca;
    }

    .bg-yellow-200 {
      background-color: #fef08a;
    }

    .mix-blend-multiply {
      mix-blend-mode: multiply;
    }

    .filter {
      filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);
    }

    .opacity-70 {
      opacity: 0.7;
    }
  `;
}

// Login script
function getLoginScript(): string {
  return `
    function togglePassword() {
      const passwordInput = document.getElementById('password');
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
    }

    async function handleLogin(event) {
      event.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      if (!email || !password) {
        showNotification('Por favor, preencha todos os campos', 'error');
        return;
      }

      const submitButton = event.target.querySelector('button[type="submit"]');
      const originalText = submitButton.innerHTML;
      
      try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<div class="flex items-center justify-center space-x-2"><div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div><span>Entrando...</span></div>';
        
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok && data.token) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          showNotification('Login realizado com sucesso!', 'success');
          
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        } else {
          throw new Error(data.message || 'Credenciais inválidas');
        }
      } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message || 'Erro ao fazer login. Tente novamente.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    }

    function handleDemoLogin() {
      localStorage.setItem('auth_token', 'demo_token_123');
      localStorage.setItem('user', JSON.stringify({
        id: 'demo_user',
        name: 'João Silva',
        email: 'demo@gastronomos.com',
        role: 'manager'
      }));
      
      showNotification('Entrando na conta demo...', 'success');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    }

    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = \`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full \${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
      }\`;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.remove('translate-x-full');
      }, 100);
      
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
    }

    // Add loading animation styles
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .animate-spin {
        animation: spin 1s linear infinite;
      }
      .translate-x-full {
        transform: translateX(100%);
      }
    \`;
    document.head.appendChild(style);
  `;
}