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
    service: 'frontend-worker-enhanced',
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

// Build enhanced login page
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
    ${getEnhancedLoginStyles()}
  </style>
</head>
<body class="h-full">
  <div class="min-h-screen bg-gradient flex items-center justify-center p-4">
    <!-- Animated background elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="floating-element floating-1"></div>
      <div class="floating-element floating-2"></div>
      <div class="floating-element floating-3"></div>
    </div>
    
    <div class="w-full max-w-md relative z-10">
      <!-- Logo -->
      <div class="text-center mb-8 animate-fade-in">
        <div class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-orange shadow-xl mb-4 animate-scale-bounce">
          <svg class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2v6a6 6 0 0 0 12 0V2"></path>
            <path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path>
            <path d="M14 2v4"></path><path d="M16 2v4"></path>
            <path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path>
          </svg>
        </div>
        <h1 class="text-3xl font-bold bg-gradient-orange bg-clip-text text-transparent animate-text-shimmer">GastronomOS</h1>
        <p class="text-slate-600 text-sm mt-2 animate-fade-in-delay">O Sistema Operacional do seu Restaurante</p>
      </div>

      <!-- Login Card -->
      <div class="card py-8 animate-slide-up-bounce backdrop-blur-xl">
        <div class="text-center pb-6 px-6">
          <h2 class="text-2xl font-semibold text-slate-900 mb-2">Bem-vindo de volta</h2>
          <p class="text-sm text-slate-600">Entre na sua conta para continuar</p>
        </div>
        <div class="px-6">
          <form class="space-y-5" onsubmit="handleLogin(event)">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="email">E-mail</label>
              <div class="relative">
                <input type="email" id="email" placeholder="seu@email.com" required class="form-input-enhanced" />
                <div class="input-focus-ring"></div>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="password">Senha</label>
              <div class="relative">
                <input type="password" id="password" placeholder="••••••••" required class="form-input-enhanced pr-12" />
                <button type="button" class="absolute right-0 top-0 h-12 px-4 bg-transparent border-0 cursor-pointer hover-scale" onclick="togglePassword()">
                  <svg class="h-5 w-5 text-slate-400 transition-colors hover:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <div class="input-focus-ring"></div>
              </div>
            </div>
            
            <div class="flex items-center justify-between text-sm">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" class="checkbox-enhanced">
                <span class="text-slate-600">Lembrar de mim</span>
              </label>
              <a href="#" class="text-orange-600 hover:text-orange-700 font-medium transition-colors">Esqueceu a senha?</a>
            </div>
            
            <button type="submit" class="btn-primary-enhanced w-full group">
              <div class="flex items-center justify-center space-x-2">
                <span class="transition-transform group-hover:translate-x-1">Entrar</span>
                <svg class="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
                </svg>
              </div>
            </button>
            
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t border-slate-200"></span>
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="bg-white px-3 text-slate-500 font-medium">ou continue com</span>
              </div>
            </div>
            
            <button type="button" class="btn-demo-enhanced w-full group" onclick="handleDemoLogin()">
              <div class="flex items-center justify-center space-x-2">
                <svg class="h-5 w-5 text-orange-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
                </svg>
                <span class="transition-transform group-hover:scale-105">Testar Conta Demo</span>
              </div>
            </button>
          </form>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="text-center mt-8 animate-fade-in-delay-2">
        <p class="text-xs text-slate-500">
          Ao continuar, você concorda com nossos 
          <a href="#" class="text-orange-600 hover:text-orange-700">Termos de Uso</a> e 
          <a href="#" class="text-orange-600 hover:text-orange-700">Política de Privacidade</a>
        </p>
      </div>
    </div>
  </div>
  
  <script>
    ${getEnhancedLoginScript()}
  </script>
</body>
</html>`;
}

// Build enhanced dashboard
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
    ${getEnhancedDashboardStyles()}
  </style>
</head>
<body class="h-full antialiased">
  <div class="flex h-screen bg-slate-50 overflow-hidden">
    ${buildEnhancedSidebar(route)}
    ${buildEnhancedMainContent(route)}
  </div>
  
  <!-- Notification Container -->
  <div id="notification-container" class="fixed top-4 right-4 z-50 space-y-2"></div>
  
  <!-- Loading Overlay -->
  <div id="loading-overlay" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden items-center justify-center">
    <div class="bg-white rounded-xl p-6 shadow-2xl">
      <div class="flex items-center space-x-3">
        <div class="animate-spin h-6 w-6 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        <span class="text-slate-700 font-medium">Carregando...</span>
      </div>
    </div>
  </div>
  
  <script>
    ${getEnhancedDashboardScript()}
  </script>
</body>
</html>`;
}

// Enhanced login styles
function getEnhancedLoginStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; -webkit-font-smoothing: antialiased; }
    
    /* Layout */
    .h-full { height: 100%; }
    .min-h-screen { min-height: 100vh; }
    .bg-gradient { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      background-size: 400% 400%;
      animation: gradientShift 15s ease infinite;
    }
    .bg-gradient-orange { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); }
    .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
    .text-transparent { color: transparent; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .p-4 { padding: 1rem; }
    .w-full { width: 100%; }
    .max-w-md { max-width: 28rem; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .overflow-hidden { overflow: hidden; }
    .pointer-events-none { pointer-events: none; }
    .z-10 { z-index: 10; }
    
    /* Typography */
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .text-2xl { font-size: 1.5rem; line-height: 2rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-white { color: white; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-700 { color: #334155; }
    .text-slate-600 { color: #475569; }
    .text-slate-500 { color: #64748b; }
    .text-slate-400 { color: #94a3b8; }
    .text-orange-600 { color: #ea580c; }
    .text-orange-700 { color: #c2410c; }
    
    /* Spacing */
    .mb-8 { margin-bottom: 2rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-8 { margin-top: 2rem; }
    .space-y-5 > * + * { margin-top: 1.25rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-x-3 > * + * { margin-left: 0.75rem; }
    .py-8 { padding: 1.5rem 0; }
    .pb-6 { padding-bottom: 1.5rem; }
    .px-6 { padding: 0 1.5rem; }
    .px-3 { padding: 0  0.75rem; }
    .px-4 { padding: 0 1rem; }
    .pr-12 { padding-right: 3rem; }
    
    /* Dimensions */
    .h-16 { height: 4rem; }
    .w-16 { width: 4rem; }
    .h-12 { height: 3rem; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .h-6 { height: 1.5rem; }
    .w-6 { width: 1.5rem; }
    .h-5 { height: 1.25rem; }
    .w-5 { width: 1.25rem; }
    .h-4 { height: 1rem; }
    .w-4 { width: 1rem; }
    
    /* Layout utilities */
    .inline-flex { display: inline-flex; }
    .block { display: block; }
    .cursor-pointer { cursor: pointer; }
    .right-0 { right: 0; }
    .top-0 { top: 0; }
    .bg-transparent { background-color: transparent; }
    .border-0 { border-width: 0; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    
    /* Floating background elements */
    .floating-element {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
    }
    .floating-1 {
      width: 200px;
      height: 200px;
      top: 10%;
      left: 10%;
      animation: float 20s ease-in-out infinite;
    }
    .floating-2 {
      width: 150px;
      height: 150px;
      top: 60%;
      right: 15%;
      animation: float 25s ease-in-out infinite reverse;
    }
    .floating-3 {
      width: 100px;
      height: 100px;
      bottom: 20%;
      left: 20%;
      animation: float 30s ease-in-out infinite;
    }
    
    /* Enhanced card */
    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.2);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    }
    
    /* Enhanced form inputs */
    .form-input-enhanced {
      width: 100%;
      height: 48px;
      padding: 0 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: #f8fafc;
      position: relative;
    }
    .form-input-enhanced:focus {
      outline: none;
      border-color: #f97316;
      background: white;
      transform: translateY(-1px);
      box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.2);
    }
    
    .input-focus-ring {
      position: absolute;
      inset: -2px;
      border-radius: 14px;
      padding: 2px;
      background: linear-gradient(135deg, #f97316, #dc2626);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .form-input-enhanced:focus + .input-focus-ring {
      opacity: 1;
    }
    .input-focus-ring::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: white;
    }
    
    /* Enhanced checkbox */
    .checkbox-enhanced {
      width: 18px;
      height: 18px;
      border: 2px solid #e2e8f0;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .checkbox-enhanced:checked {
      background: linear-gradient(135deg, #f97316, #dc2626);
      border-color: #f97316;
    }
    
    /* Enhanced buttons */
    .btn-primary-enhanced {
      width: 100%;
      height: 48px;
      background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .btn-primary-enhanced::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #ea580c, #b91c1c);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .btn-primary-enhanced:hover::before {
      opacity: 1;
    }
    .btn-primary-enhanced:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 40px -10px rgba(249, 115, 22, 0.4);
    }
    .btn-primary-enhanced:active {
      transform: translateY(0);
    }
    
    .btn-demo-enhanced {
      width: 100%;
      height: 48px;
      background: white;
      color: #64748b;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-weight: 500;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-demo-enhanced:hover {
      background: #f8fafc;
      border-color: #f97316;
      transform: translateY(-1px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    /* Hover effects */
    .hover-scale:hover { transform: scale(1.05); }
    .hover:text-orange-700:hover { color: #c2410c; }
    .transition-colors { transition: color 0.2s ease, background-color 0.2s ease; }
    .transition-transform { transition: transform 0.2s ease; }
    .group:hover .group-hover\\:translate-x-1 { transform: translateX(0.25rem); }
    .group:hover .group-hover\\:scale-105 { transform: scale(1.05); }
    
    /* Animations */
    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      33% { transform: translateY(-30px) rotate(120deg); }
      66% { transform: translateY(20px) rotate(240deg); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(50px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes bounce {
      0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
      40%, 43% { transform: translate3d(0, -30px, 0); }
      70% { transform: translate3d(0, -15px, 0); }
      90% { transform: translate3d(0, -4px, 0); }
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    .animate-fade-in { animation: fadeIn 0.8s ease-out; }
    .animate-fade-in-delay { animation: fadeIn 0.8s ease-out 0.2s both; }
    .animate-fade-in-delay-2 { animation: fadeIn 0.8s ease-out 0.4s both; }
    .animate-scale-bounce { animation: scaleIn 0.6s ease-out, bounce 2s ease-in-out 0.6s infinite; }
    .animate-slide-up-bounce { animation: slideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    .animate-text-shimmer { 
      background: linear-gradient(90deg, #f97316, #dc2626, #f97316);
      background-size: 200% 100%;
      animation: shimmer 3s ease-in-out infinite;
      -webkit-background-clip: text;
      background-clip: text;
    }
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      .text-3xl { font-size: 1.5rem; line-height: 2rem; }
      .text-2xl { font-size: 1.25rem; line-height: 1.75rem; }
      .px-6 { padding: 0 1rem; }
      .py-8 { padding: 1rem 0; }
    }
  `;
}

// Enhanced login script
function getEnhancedLoginScript(): string {
  return `
    // Enhanced notification system
    function showNotification(message, type = 'info', duration = 4000) {
      const notification = document.createElement('div');
      notification.className = 'notification-toast notification-' + type;
      
      const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
      
      notification.innerHTML = \`
        <div class="notification-content">
          <div class="notification-icon">\${icon}</div>
          <div class="notification-message">\${message}</div>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      \`;
      
      document.body.appendChild(notification);
      
      // Animate in
      requestAnimationFrame(() => {
        notification.classList.add('notification-show');
      });
      
      // Auto remove
      setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, duration);
    }

    function togglePassword() {
      const passwordInput = document.getElementById('password');
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      // Add visual feedback
      const button = passwordInput.nextElementSibling;
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 150);
    }

    async function handleLogin(event) {
      event.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      if (!email || !password) {
        showNotification('Por favor, preencha todos os campos', 'warning');
        return;
      }

      const submitButton = event.target.querySelector('button[type="submit"]');
      const originalContent = submitButton.innerHTML;
      
      try {
        submitButton.disabled = true;
        submitButton.innerHTML = \`
          <div class="flex items-center justify-center space-x-2">
            <div class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            <span>Entrando...</span>
          </div>
        \`;
        
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
          showNotification('Login realizado com sucesso! Redirecionando...', 'success');
          
          // Add success animation
          submitButton.classList.add('btn-success-animation');
          
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
        } else {
          throw new Error(data.message || 'Credenciais inválidas');
        }
      } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message || 'Erro ao fazer login. Tente novamente.', 'error');
        
        // Add error shake animation
        submitButton.classList.add('btn-error-shake');
        setTimeout(() => {
          submitButton.classList.remove('btn-error-shake');
        }, 500);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalContent;
      }
    }

    function handleDemoLogin() {
      const demoUser = {
        id: 'demo_user_' + Date.now(),
        name: 'João Silva',
        email: 'demo@gastronomos.com',
        role: 'manager',
        avatar: 'JS'
      };
      
      localStorage.setItem('auth_token', 'demo_token_' + Date.now());
      localStorage.setItem('user', JSON.stringify(demoUser));
      
      showNotification('Entrando na conta demo...', 'success');
      
      // Add demo animation
      const button = event.target;
      button.style.transform = 'scale(0.95)';
      
      setTimeout(() => {
        button.style.transform = 'scale(1)';
        window.location.href = '/dashboard';
      }, 1000);
    }

    // Add enhanced styles for notifications and animations
    const style = document.createElement('style');
    style.textContent = \`
      .notification-toast {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        min-width: 300px;
        max-width: 400px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border: 1px solid #e2e8f0;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
      }
      
      .notification-show {
        transform: translateX(0);
        opacity: 1;
      }
      
      .notification-hide {
        transform: translateX(100%);
        opacity: 0;
      }
      
      .notification-content {
        display: flex;
        align-items: center;
        padding: 1rem;
        gap: 0.75rem;
      }
      
      .notification-icon {
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 1rem;
        flex-shrink: 0;
      }
      
      .notification-success .notification-icon {
        background: #dcfce7;
        color: #166534;
      }
      
      .notification-error .notification-icon {
        background: #fecaca;
        color: #dc2626;
      }
      
      .notification-warning .notification-icon {
        background: #fef3c7;
        color: #d97706;
      }
      
      .notification-info .notification-icon {
        background: #dbeafe;
        color: #2563eb;
      }
      
      .notification-message {
        flex: 1;
        font-size: 0.875rem;
        color: #374151;
        font-weight: 500;
      }
      
      .notification-close {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #9ca3af;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: all 0.2s ease;
      }
      
      .notification-close:hover {
        background: #f3f4f6;
        color: #374151;
      }
      
      .btn-success-animation {
        background: linear-gradient(135deg, #22c55e, #16a34a) !important;
        transform: scale(1.05);
      }
      
      .btn-error-shake {
        animation: shake 0.5s ease-in-out;
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      .animate-spin {
        animation: spin 1s linear infinite;
      }
    \`;
    document.head.appendChild(style);

    // Add form validation enhancements
    document.addEventListener('DOMContentLoaded', () => {
      const inputs = document.querySelectorAll('.form-input-enhanced');
      
      inputs.forEach(input => {
        input.addEventListener('focus', () => {
          input.parentElement.classList.add('input-focused');
        });
        
        input.addEventListener('blur', () => {
          input.parentElement.classList.remove('input-focused');
        });
        
        input.addEventListener('input', () => {
          if (input.value) {
            input.classList.add('input-has-value');
          } else {
            input.classList.remove('input-has-value');
          }
        });
      });
    });
  `;
}

// Enhanced dashboard styles
function getEnhancedDashboardStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; -webkit-font-smoothing: antialiased; }
    
    /* Base layout */
    .antialiased { -webkit-font-smoothing: antialiased; }
    .h-full { height: 100%; }
    .h-screen { height: 100vh; }
    .flex { display: flex; }
    .flex-1 { flex: 1 1 0%; }
    .flex-col { flex-direction: column; }
    .overflow-hidden { overflow: hidden; }
    .overflow-y-auto { overflow-y: auto; }
    .min-w-0 { min-width: 0; }
    .bg-slate-50 { background-color: #f8fafc; }
    
    /* Sidebar styles */
    .sidebar-container { position: relative; }
    .sidebar-gradient {
      background: linear-gradient(180deg, #0f172a 0%, #1e293b 25%, #334155 50%, #1e293b 75%, #0f172a 100%);
      position: relative;
    }
    .sidebar-gradient::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%);
      pointer-events: none;
    }
    .sidebar-gradient::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 1px;
      height: 100%;
      background: linear-gradient(180deg, transparent 0%, rgba(249, 115, 22, 0.3) 50%, transparent 100%);
    }
    
    /* Enhanced sidebar navigation */
    .nav-item {
      opacity: 0;
      transform: translateX(-20px);
      animation: slideInLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .nav-item:nth-child(1) { animation-delay: 0.1s; }
    .nav-item:nth-child(2) { animation-delay: 0.2s; }
    .nav-item:nth-child(3) { animation-delay: 0.3s; }
    .nav-item:nth-child(4) { animation-delay: 0.4s; }
    .nav-item:nth-child(5) { animation-delay: 0.5s; }
    .nav-item:nth-child(6) { animation-delay: 0.6s; }
    .nav-item:nth-child(7) { animation-delay: 0.7s; }
    .nav-item:nth-child(8) { animation-delay: 0.8s; }
    .nav-item:nth-child(9) { animation-delay: 0.9s; }
    
    .nav-link {
      text-decoration: none;
      display: block;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    .nav-link::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(220, 38, 38, 0.2));
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .nav-link:hover::before { opacity: 1; }
    .nav-link.active::before { opacity: 1; }
    
    .nav-link-active {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(220, 38, 38, 0.2));
      color: #fdba74;
      box-shadow: 0 8px 25px -5px rgba(249, 115, 22, 0.2);
    }
    
    /* Enhanced main content */
    .content-container {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      min-height: 100%;
    }
    
    /* Enhanced cards */
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(226, 232, 240, 0.8);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(249, 115, 22, 0.3), transparent);
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
    
    .card-header { padding: 1.5rem 1.5rem 0 1.5rem; }
    .card-content { padding: 1.5rem; }
    .card-title { 
      font-size: 1.125rem; 
      font-weight: 600; 
      color: #0f172a; 
      margin-bottom: 0.5rem;
    }
    
    /* Enhanced stats cards */
    .stats-card {
      background: white;
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(226, 232, 240, 0.8);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    .stats-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #f97316, #dc2626);
    }
    .stats-card:hover {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    /* Enhanced buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      border: none;
      text-decoration: none;
      position: relative;
      overflow: hidden;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
      color: white;
      padding: 0.75rem 1.5rem;
      box-shadow: 0 4px 14px 0 rgba(249, 115, 22, 0.3);
    }
    .btn-primary::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #ea580c, #b91c1c);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .btn-primary:hover::before { opacity: 1; }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 40px -10px rgba(249, 115, 22, 0.4);
    }
    
    .btn-secondary {
      background: white;
      color: #64748b;
      border: 2px solid #e2e8f0;
      padding: 0.75rem 1.5rem;
    }
    .btn-secondary:hover {
      background: #f8fafc;
      border-color: #f97316;
      color: #f97316;
      transform: translateY(-1px);
    }
    
    .btn-ghost {
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      border-radius: 8px;
      padding: 0.5rem;
    }
    .btn-ghost:hover {
      background-color: #f1f5f9;
      transform: scale(1.05);
    }
    
    /* Enhanced form inputs */
    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 0.875rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: #f8fafc;
    }
    .form-input:focus {
      outline: none;
      border-color: #f97316;
      background: white;
      transform: translateY(-1px);
      box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.2);
    }
    
    /* Enhanced tables */
    .table-container {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table th {
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .table td {
      padding: 1rem;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .table tr:hover {
      background: linear-gradient(135deg, #fef7f0, #fef3e2);
    }
    
    /* Grid layouts */
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    
    /* Spacing utilities */
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .px-3 { padding: 0 0.75rem; }
    .px-4 { padding: 0 1rem; }
    .px-6 { padding: 0 1.5rem; }
    .py-2 { padding: 0.5rem 0; }
    .py-3 { padding: 0.75rem 0; }
    .py-4 { padding: 1rem 0; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-6 > * + * { margin-top: 1.5rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-x-3 > * + * { margin-left: 0.75rem; }
    .space-x-4 > * + * { margin-left: 1rem; }
    
    /* Dimensions */
    .w-64 { width: 16rem; }
    .w-72 { width: 18rem; }
    .h-14 { height: 3.5rem; }
    .h-16 { height: 4rem; }
    .h-9 { height: 2.25rem; }
    .w-9 { width: 2.25rem; }
    .h-10 { height: 2.5rem; }
    .w-10 { width: 2.5rem; }
    .h-12 { height: 3rem; }
    .w-12 { width: 3rem; }
    .h-5 { height: 1.25rem; }
    .w-5 { width: 1.25rem; }
    .h-4 { height: 1rem; }
    .w-4 { width: 1rem; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .h-6 { height: 1.5rem; }
    .w-6 { width: 1.5rem; }
    
    /* Colors */
    .text-white { color: white; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-700 { color: #334155; }
    .text-slate-600 { color: #475569; }
    .text-slate-500 { color: #64748b; }
    .text-slate-400 { color: #94a3b8; }
    .text-slate-300 { color: #cbd5e1; }
    .text-orange-300 { color: #fdba74; }
    .text-orange-400 { color: #fb923c; }
    .text-orange-500 { color: #f97316; }
    .text-green-500 { color: #22c55e; }
    .text-blue-500 { color: #3b82f6; }
    .text-red-500 { color: #ef4444; }
    
    .bg-white { background-color: white; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-100 { background-color: #f1f5f9; }
    .bg-slate-800 { background-color: #1e293b; }
    .bg-slate-900 { background-color: #0f172a; }
    .bg-orange-500 { background-color: #f97316; }
    .bg-green-500 { background-color: #22c55e; }
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-red-500 { background-color: #ef4444; }
    .bg-yellow-500 { background-color: #eab308; }
    
    /* Layout utilities */
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .top-4 { top: 1rem; }
    .right-4 { right: 1rem; }
    .z-50 { z-index: 50; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-sm { font-size: 0.875rem; }
    .text-base { font-size: 1rem; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-full { border-radius: 9999px; }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    .border { border: 1px solid #e2e8f0; }
    .border-b { border-bottom: 1px solid #e2e8f0; }
    .border-slate-200 { border-color: #e2e8f0; }
    .cursor-pointer { cursor: pointer; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .shrink-0 { flex-shrink: 0; }
    .inline-flex { display: inline-flex; }
    .hidden { display: none; }
    .block { display: block; }
    .max-w-7xl { max-width: 80rem; }
    .mx-auto { margin: 0 auto; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .ml-3 { margin-left: 0.75rem; }
    .ml-auto { margin-left: auto; }
    .mt-1 { margin-top: 0.25rem; }
    .mr-2 { margin-right: 0.5rem; }
    
    /* Animations */
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
    .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
    .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .animate-spin { animation: spin 1s linear infinite; }
    
    /* Hover effects */
    .hover\\:bg-slate-50:hover { background-color: #f8fafc; }
    .hover\\:bg-slate-100:hover { background-color: #f1f5f9; }
    .hover\\:text-white:hover { color: white; }
    .hover\\:text-orange-700:hover { color: #c2410c; }
    .hover\\:border-slate-200:hover { border-color: #e2e8f0; }
    .hover\\:border-orange-500:hover { border-color: #f97316; }
    .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .hover\\:scale-105:hover { transform: scale(1.05); }
    .hover\\:scale-110:hover { transform: scale(1.1); }
    .hover\\:-translate-y-1:hover { transform: translateY(-0.25rem); }
    
    /* Group hover effects */
    .group:hover .group-hover\\:text-white { color: white; }
    .group:hover .group-hover\\:text-slate-700 { color: #334155; }
    .group:hover .group-hover\\:text-slate-600 { color: #475569; }
    .group:hover .group-hover\\:scale-110 { transform: scale(1.1); }
    .group:hover .group-hover\\:opacity-100 { opacity: 1; }
    
    /* Transitions */
    .transition-all { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .transition-colors { transition: color 0.2s ease, background-color 0.2s ease; }
    .transition-transform { transition: transform 0.2s ease; }
    .transition-opacity { transition: opacity 0.2s ease; }
    
    /* Responsive design */
    @media (min-width: 640px) {
      .sm\\:p-6 { padding: 1.5rem; }
      .sm\\:px-6 { padding: 0 1.5rem; }
      .sm\\:text-xl { font-size: 1.25rem; }
      .sm\\:text-2xl { font-size: 1.5rem; }
      .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .sm\\:gap-4 { gap: 1rem; }
      .sm\\:gap-6 { gap: 1.5rem; }
      .sm\\:space-y-6 > * + * { margin-top: 1.5rem; }
      .sm\\:w-72 { width: 18rem; }
      .sm\\:h-16 { height: 4rem; }
      .sm\\:block { display: block; }
      .sm\\:flex { display: flex; }
      .sm\\:hidden { display: none; }
    }
    
    @media (min-width: 1024px) {
      .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lg\\:gap-6 { gap: 1.5rem; }
      .lg\\:text-2xl { font-size: 1.5rem; }
      .lg\\:flex { display: flex; }
      .lg\\:hidden { display: none; }
    }
    
    @media (min-width: 1280px) {
      .xl\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .xl\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .xl\\:col-span-1 { grid-column: span 1 / span 1; }
      .xl\\:col-span-2 { grid-column: span 2 / span 2; }
      .xl\\:block { display: block; }
    }
    
    /* Loading states */
    .loading-shimmer {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { 
      background: linear-gradient(135deg, #f97316, #dc2626);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, #ea580c, #b91c1c); }
  `;
}

// Build enhanced sidebar
function buildEnhancedSidebar(currentRoute: string): string {
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: 'home', description: 'Visão geral e métricas' },
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
        { name: 'Pedidos', href: '/purchasing/orders', icon: 'file-text' },
        { name: 'Fornecedores', href: '/purchasing/suppliers', icon: 'building' },
        { name: 'Recebimentos', href: '/purchasing/receipts', icon: 'receipt' }
      ]
    },
    { 
      name: 'Transferências', 
      href: '/transfers', 
      icon: 'arrow-right-left', 
      description: 'Movimentação entre locais',
      children: [
        { name: 'Ativas', href: '/transfers/active', icon: 'truck' },
        { name: 'Histórico', href: '/transfers/history', icon: 'file-text' },
        { name: 'Emergenciais', href: '/transfers/emergency', icon: 'timer' }
      ]
    },
    { 
      name: 'Alocações', 
      href: '/allocations', 
      icon: 'scale', 
      description: 'Distribuição de recursos',
      children: [
        { name: 'Atuais', href: '/allocations/current', icon: 'chart-pie' },
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
        { name: 'Custos', href: '/analytics/costs', icon: 'chart-pie' },
        { name: 'Variações', href: '/analytics/variance', icon: 'bar-chart-3' }
      ]
    },
    { name: 'Locais', href: '/locations', icon: 'map-pin', description: 'Filiais e pontos' },
    { name: 'Usuários', href: '/users', icon: 'users', description: 'Gestão de usuários' },
    { name: 'Configurações', href: '/settings', icon: 'settings', description: 'Configurações do sistema' }
  ];

  return `
    <div class="sidebar-container">
      <div class="flex h-full flex-col sidebar-gradient text-white shadow-2xl relative w-64 sm:w-72">
        <!-- Header -->
        <div class="flex h-14 sm:h-16 items-center justify-center border-b border-slate-700/50 px-4">
          <div class="flex items-center space-x-3 w-full">
            <div class="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-xl shrink-0 animate-scale-in">
              ${getIcon('chef', 'h-6 w-6 sm:h-7 sm:w-7 text-white')}
            </div>
            <div class="min-w-0 flex-1">
              <h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent truncate animate-fade-in">
                GastronomOS
              </h1>
              <p class="text-xs text-slate-400 truncate animate-fade-in">Sistema de Gestão</p>
            </div>
          </div>
        </div>
        
        <!-- Navigation -->
        <nav class="flex-1 space-y-2 p-4 overflow-y-auto">
          ${navigation.map((item, index) => {
            const isActive = currentRoute === item.href || currentRoute.startsWith(item.href + '/');
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = hasChildren && currentRoute.startsWith(item.href + '/');
            
            return `
              <div class="nav-item" style="animation-delay: ${(index + 1) * 100}ms">
                <a class="nav-link group flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all relative overflow-hidden ${
                  isActive 
                    ? 'nav-link-active'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }" href="${item.children ? '#' : item.href}" onclick="navigateTo('${item.href}', event, ${!!item.children})">
                  
                  ${getIcon(item.icon, `h-5 w-5 flex-shrink-0 transition-all ${isActive ? 'text-orange-400' : 'text-slate-400 group-hover:text-white'}`)}
                  
                  <div class="ml-3 flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <span class="truncate">${item.name}</span>
                      ${hasChildren ? `
                        <div class="ml-2 transition-transform ${isExpanded ? 'rotate-90' : ''}">
                          ${getIcon('chevron-right', 'h-4 w-4 text-slate-400')}
                        </div>
                      ` : ''}
                    </div>
                    <p class="text-xs text-slate-500 truncate mt-0.5">${item.description}</p>
                  </div>
                </a>
                
                ${hasChildren && isExpanded ? `
                  <div class="submenu ml-8 mt-2 space-y-1 animate-slide-up">
                    ${item.children.map(subItem => {
                      const subActive = currentRoute === subItem.href;
                      return `
                        <a href="${subItem.href}" onclick="navigateTo('${subItem.href}', event)" class="nav-link flex items-center px-3 py-2 text-sm ${subActive ? 'text-orange-300 bg-slate-700/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/30'} rounded-lg transition-all">
                          ${getIcon(subItem.icon, 'h-4 w-4 mr-3 flex-shrink-0')}
                          <span class="truncate">${subItem.name}</span>
                        </a>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </nav>
        
        <!-- User Profile -->
        <div class="border-t border-slate-700/50 p-4">
          <div class="flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 transition-all hover:bg-slate-700/50 cursor-pointer group">
            <div class="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span class="text-sm font-semibold text-white">JS</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">João Silva</p>
              <p class="text-xs text-slate-400 truncate">Gerente de Restaurante</p>
            </div>
            <div class="opacity-0 group-hover:opacity-100 transition-opacity">
              ${getIcon('chevron-right', 'h-4 w-4 text-slate-400')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Build enhanced main content
function buildEnhancedMainContent(route: string): string {
  const routeConfig = getEnhancedRouteConfig(route);
  
  return `
    <div class="flex flex-1 flex-col overflow-hidden min-w-0">
      <!-- Enhanced Header -->
      <header class="flex h-14 sm:h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:px-6 shadow-sm">
        <div class="flex items-center space-x-4 flex-1 min-w-0">
          <button id="mobile-menu-btn" class="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden transition-colors">
            ${getIcon('menu', 'h-5 w-5')}
          </button>
          
          <div class="min-w-0 flex-1">
            <h1 class="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 truncate animate-fade-in">${routeConfig.title}</h1>
            <p class="text-xs sm:text-sm text-slate-500 hidden sm:block truncate animate-fade-in">${routeConfig.subtitle}</p>
          </div>
        </div>
        
        <div class="hidden lg:flex flex-1 max-w-md mx-8">
          <div class="relative w-full">
            ${getIcon('search', 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400')}
            <input id="search-input" class="form-input pl-10 w-full" placeholder="Buscar produtos, pedidos, transferências..."/>
          </div>
        </div>
        
        <div class="flex items-center space-x-2 lg:space-x-4 shrink-0">
          <button class="btn-ghost lg:hidden">
            ${getIcon('search', 'h-4 w-4')}
          </button>
          
          <button class="btn-ghost hidden sm:flex">
            ${getIcon('moon', 'h-4 w-4')}
          </button>
          
          <button class="btn-ghost relative">
            ${getIcon('bell', 'h-4 w-4')}
            <span class="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-pulse">3</span>
          </button>
          
          <button class="btn-ghost relative group">
            <div class="flex items-center space-x-2">
              <div class="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <span class="text-xs font-semibold text-white">JS</span>
              </div>
              <div class="hidden xl:block text-left">
                <p class="text-sm font-medium text-slate-900">João Silva</p>
                <p class="text-xs text-slate-500">Gerente</p>
              </div>
              ${getIcon('chevron-down', 'h-3 w-3 text-slate-400 hidden sm:block group-hover:rotate-180 transition-transform')}
            </div>
          </button>
        </div>
      </header>
      
      <!-- Enhanced Main Content -->
      <main class="flex-1 overflow-y-auto">
        <div class="content-container h-full">
          <div class="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto animate-fade-in">
            ${routeConfig.content}
          </div>
        </div>
      </main>
    </div>
  `;
}
// Get enhanced route configuration
function getEnhancedRouteConfig(route: string): { title: string; subtitle: string; content: string } {
  const routes: Record<string, { title: string; subtitle: string; content: string }> = {
    '/dashboard': {
      title: 'Dashboard',
      subtitle: 'Bem-vindo de volta! Gerencie suas operações do restaurante com eficiência',
      content: buildEnhancedDashboardContent()
    },
    '/inventory': {
      title: 'Gestão de Estoque',
      subtitle: 'Gerencie produtos, categorias e níveis de estoque em tempo real',
      content: buildEnhancedInventoryContent()
    },
    '/inventory/products': {
      title: 'Produtos',
      subtitle: 'Cadastre e gerencie todos os produtos do seu restaurante',
      content: buildEnhancedProductsContent()
    },
    '/inventory/categories': {
      title: 'Categorias',
      subtitle: 'Organize seus produtos em categorias para melhor gestão',
      content: buildEnhancedCategoriesContent()
    },
    '/purchasing': {
      title: 'Gestão de Compras',
      subtitle: 'Gerencie pedidos de compra, fornecedores e recebimentos',
      content: buildEnhancedPurchasingContent()
    },
    '/analytics': {
      title: 'Análises e Relatórios',
      subtitle: 'Insights detalhados sobre performance e métricas do negócio',
      content: buildEnhancedAnalyticsContent()
    },
    '/locations': {
      title: 'Gestão de Locais',
      subtitle: 'Gerencie filiais, pontos de venda e centros de distribuição',
      content: buildEnhancedLocationsContent()
    },
    '/users': {
      title: 'Gestão de Usuários',
      subtitle: 'Gerencie usuários, permissões e controle de acesso',
      content: buildEnhancedUsersContent()
    },
    '/settings': {
      title: 'Configurações do Sistema',
      subtitle: 'Configure preferências, integrações e parâmetros do sistema',
      content: buildEnhancedSettingsContent()
    }
  };

  return routes[route] || routes['/dashboard'];
}

// Enhanced dashboard content
function buildEnhancedDashboardContent(): string {
  return `
    <!-- Welcome Hero Section -->
    <div class="relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 text-white animate-fade-in" style="background: linear-gradient(135deg, #f97316 0%, #dc2626 50%, #b91c1c 100%);">
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">Bem-vindo de volta! 👋</h1>
            <p class="text-orange-100 text-base sm:text-lg lg:text-xl max-w-2xl">
              Gerencie suas operações do restaurante com eficiência e tome decisões baseadas em dados
            </p>
          </div>
          <div class="hidden lg:block">
            <div class="text-right">
              <p class="text-orange-200 text-sm">Última atualização</p>
              <p class="text-white font-semibold" id="last-update">Carregando...</p>
            </div>
          </div>
        </div>
        
        <!-- Quick Stats Row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          ${buildQuickStat('Produtos Ativos', '2.847', 'package')}
          ${buildQuickStat('Pedidos Hoje', '156', 'shopping-cart')}
          ${buildQuickStat('Transferências', '23', 'arrow-right-left')}
          ${buildQuickStat('Receita Mensal', 'R$ 47.892', 'trending-up')}
        </div>
      </div>
      
      <!-- Decorative elements -->
      <div class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 animate-pulse"></div>
      <div class="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-white/5"></div>
      ${getIcon('chef', 'absolute right-8 top-8 h-16 w-16 text-white/20')}
    </div>

    <!-- Main Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      ${buildEnhancedStatsCard('Total de Produtos', '2.847', '+12%', 'package', 'blue', 'vs mês anterior')}
      ${buildEnhancedStatsCard('Pedidos Ativos', '156', '+8%', 'shopping-cart', 'green', 'vs semana anterior')}
      ${buildEnhancedStatsCard('Transferências Pendentes', '23', '-15%', 'arrow-right-left', 'orange', 'vs ontem')}
      ${buildEnhancedStatsCard('Receita Mensal', 'R$ 47.892', '+23%', 'trending-up', 'purple', 'vs mês anterior')}
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Quick Actions -->
      <div class="xl:col-span-1 animate-slide-up">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title flex items-center space-x-2">
              ${getIcon('zap', 'h-5 w-5 text-orange-500')}
              <span>Ações Rápidas</span>
            </h3>
          </div>
          <div class="card-content space-y-3">
            ${buildEnhancedQuickAction('Criar Pedido de Compra', 'Novo pedido para fornecedores', 'shopping-cart', 'bg-blue-500', '/purchasing/orders/new')}
            ${buildEnhancedQuickAction('Processar Recebimento', 'Registrar produtos recebidos', 'package', 'bg-green-500', '/purchasing/receipts/new')}
            ${buildEnhancedQuickAction('Criar Transferência', 'Transferir entre locais', 'arrow-right-left', 'bg-orange-500', '/transfers/new')}
            ${buildEnhancedQuickAction('Ver Análises', 'Relatórios e métricas', 'bar-chart-3', 'bg-purple-500', '/analytics')}
          </div>
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="xl:col-span-2 animate-slide-up">
        <div class="card">
          <div class="card-header">
            <div class="flex items-center justify-between">
              <h3 class="card-title flex items-center space-x-2">
                ${getIcon('activity', 'h-5 w-5 text-green-500')}
                <span>Atividades Recentes</span>
              </h3>
              <button class="btn btn-secondary text-xs">Ver Todas</button>
            </div>
          </div>
          <div class="card-content space-y-4">
            ${buildEnhancedActivityItem('Pedido PO-123 aprovado', 'Enviado ao fornecedor ABC Ltda', '5 min atrás', 'success', 'check-circle')}
            ${buildEnhancedActivityItem('Transferência TR-001 concluída', 'Entregue no Local Centro', '10 min atrás', 'info', 'truck')}
            ${buildEnhancedActivityItem('Estoque baixo: Tomates', 'Apenas 5 unidades restantes', '15 min atrás', 'warning', 'alert-triangle')}
            ${buildEnhancedActivityItem('Novo usuário cadastrado', 'Maria Silva - Gerente', '1 hora atrás', 'info', 'user-plus')}
            ${buildEnhancedActivityItem('Relatório mensal gerado', 'Análise de performance disponível', '2 horas atrás', 'success', 'file-text')}
          </div>
        </div>
      </div>
    </div>

    <!-- Performance and Alerts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- System Alerts -->
      <div class="animate-fade-in">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title flex items-center space-x-2">
              ${getIcon('alert-triangle', 'h-5 w-5 text-orange-500')}
              <span>Alertas do Sistema</span>
              <span class="ml-auto bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">3</span>
            </h3>
          </div>
          <div class="card-content space-y-4">
            ${buildEnhancedAlert('Alerta de Estoque Baixo', 'Tomates com estoque baixo no Local Centro', '5 minutos atrás', 'warning')}
            ${buildEnhancedAlert('Transferência Concluída', 'TR-001 entregue com sucesso no Local Oeste', '10 minutos atrás', 'info')}
            ${buildEnhancedAlert('Pedido Aprovado', 'PO-123 aprovado e enviado ao fornecedor', '15 minutos atrás', 'success')}
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="animate-fade-in">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title flex items-center space-x-2">
              ${getIcon('trending-up', 'h-5 w-5 text-green-500')}
              <span>Performance</span>
            </h3>
          </div>
          <div class="card-content space-y-6">
            ${buildEnhancedPerformanceMetric('Cumprimento de Pedidos', '98.5%', 'green', 98.5)}
            ${buildEnhancedPerformanceMetric('Precisão do Estoque', '94.2%', 'blue', 94.2)}
            ${buildEnhancedPerformanceMetric('Eficiência de Custos', '87.8%', 'orange', 87.8)}
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Orders Table -->
    <div class="animate-slide-up">
      <div class="card">
        <div class="card-header">
          <div class="flex items-center justify-between">
            <h3 class="card-title">Pedidos Recentes</h3>
            <button class="btn btn-primary" onclick="navigateTo('/purchasing/orders', event)">
              ${getIcon('plus', 'h-4 w-4')}
              Novo Pedido
            </button>
          </div>
        </div>
        <div class="card-content">
          <div class="table-container">
            ${buildEnhancedRecentOrdersTable()}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Enhanced inventory content
function buildEnhancedInventoryContent(): string {
  return `
    <!-- Header Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Gestão de Estoque</h2>
        <p class="text-slate-600">Gerencie produtos, categorias e níveis de estoque em tempo real</p>
      </div>
      <div class="flex space-x-3">
        <button class="btn btn-secondary" onclick="navigateTo('/inventory/categories', event)">
          ${getIcon('tag', 'h-4 w-4')}
          Categorias
        </button>
        <button class="btn btn-primary" onclick="navigateTo('/inventory/products', event)">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Produto
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
      ${buildEnhancedStatsCard('Total de Produtos', '2.847', '+12%', 'package', 'blue', 'vs mês anterior')}
      ${buildEnhancedStatsCard('Estoque Baixo', '23', '-5%', 'alert-triangle', 'orange', 'produtos')}
      ${buildEnhancedStatsCard('Categorias', '156', '+3%', 'tag', 'green', 'ativas')}
      ${buildEnhancedStatsCard('Valor Total', 'R$ 284.750', '+18%', 'trending-up', 'purple', 'em estoque')}
    </div>

    <!-- Filters and Search -->
    <div class="card animate-fade-in">
      <div class="card-content">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <div class="relative">
              ${getIcon('search', 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400')}
              <input type="text" placeholder="Buscar produtos..." class="form-input pl-10 w-full">
            </div>
          </div>
          <select class="form-input sm:w-48">
            <option>Todas as categorias</option>
            <option>Vegetais</option>
            <option>Carnes</option>
            <option>Laticínios</option>
            <option>Grãos</option>
          </select>
          <select class="form-input sm:w-40">
            <option>Todos os status</option>
            <option>Estoque OK</option>
            <option>Estoque Baixo</option>
            <option>Sem Estoque</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Products Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-slide-up">
      ${buildEnhancedProductCard('Tomate Italiano', 'VEG-001', 'R$ 8,50/kg', '15 kg', 'low', 'Vegetais')}
      ${buildEnhancedProductCard('Cebola Branca', 'VEG-002', 'R$ 4,20/kg', '45 kg', 'good', 'Vegetais')}
      ${buildEnhancedProductCard('Azeite Extra Virgem', 'OIL-001', 'R$ 25,90/L', '8 L', 'low', 'Óleos')}
      ${buildEnhancedProductCard('Farinha de Trigo', 'GRA-001', 'R$ 12,50/saco', '25 sacos', 'good', 'Grãos')}
      ${buildEnhancedProductCard('Peito de Frango', 'CAR-001', 'R$ 18,90/kg', '32 kg', 'medium', 'Carnes')}
      ${buildEnhancedProductCard('Queijo Mussarela', 'LAT-001', 'R$ 28,50/kg', '12 kg', 'good', 'Laticínios')}
      ${buildEnhancedProductCard('Arroz Branco', 'GRA-002', 'R$ 6,80/kg', '85 kg', 'good', 'Grãos')}
      ${buildEnhancedProductCard('Sal Refinado', 'TEM-001', 'R$ 2,50/kg', '40 kg', 'good', 'Temperos')}
    </div>
  `;
}

// Enhanced products content
function buildEnhancedProductsContent(): string {
  return `
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Produtos</h2>
        <p class="text-slate-600">Cadastre e gerencie todos os produtos do seu restaurante</p>
      </div>
      <button class="btn btn-primary" onclick="showCreateProductModal()">
        ${getIcon('plus', 'h-4 w-4')}
        Novo Produto
      </button>
    </div>

    <!-- Advanced Filters -->
    <div class="card animate-slide-up">
      <div class="card-content">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="relative">
            ${getIcon('search', 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400')}
            <input type="text" placeholder="Buscar produtos..." class="form-input pl-10">
          </div>
          <select class="form-input">
            <option>Todas as categorias</option>
            <option>Vegetais</option>
            <option>Carnes</option>
            <option>Laticínios</option>
          </select>
          <select class="form-input">
            <option>Todos os fornecedores</option>
            <option>ABC Ltda</option>
            <option>XYZ Distribuidora</option>
          </select>
          <select class="form-input">
            <option>Ordenar por nome</option>
            <option>Ordenar por preço</option>
            <option>Ordenar por estoque</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Products Table -->
    <div class="card animate-fade-in">
      <div class="card-header">
        <div class="flex items-center justify-between">
          <h3 class="card-title">Lista de Produtos</h3>
          <div class="flex space-x-2">
            <button class="btn btn-secondary text-xs">
              ${getIcon('download', 'h-4 w-4')}
              Exportar
            </button>
            <button class="btn btn-secondary text-xs">
              ${getIcon('upload', 'h-4 w-4')}
              Importar
            </button>
          </div>
        </div>
      </div>
      <div class="card-content">
        <div class="table-container">
          ${buildEnhancedProductsTable()}
        </div>
      </div>
    </div>
  `;
}

// Enhanced purchasing content
function buildEnhancedPurchasingContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Gestão de Compras</h2>
          <p class="text-slate-600">Gerencie pedidos de compra, fornecedores e recebimentos</p>
        </div>
        <button class="btn btn-primary" onclick="showCreatePurchaseOrderModal()">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Pedido
        </button>
      </div>
      
      <!-- Quick Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        ${buildEnhancedStatsCard('Pedidos Ativos', '156', '+8%', 'shopping-cart', 'blue', 'em andamento')}
        ${buildEnhancedStatsCard('Aguardando Aprovação', '12', '+2%', 'clock', 'orange', 'pedidos')}
        ${buildEnhancedStatsCard('Fornecedores Ativos', '45', '+5%', 'building', 'green', 'cadastrados')}
        ${buildEnhancedStatsCard('Valor Mensal', 'R$ 125.890', '+15%', 'trending-up', 'purple', 'em compras')}
      </div>
      
      <div class="card animate-fade-in">
        <div class="card-header">
          <h3 class="card-title">Pedidos Recentes</h3>
        </div>
        <div class="card-content">
          <p class="text-slate-500">Funcionalidade de compras em desenvolvimento...</p>
        </div>
      </div>
    </div>
  `;
}

// Enhanced analytics content
function buildEnhancedAnalyticsContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Análises e Relatórios</h2>
          <p class="text-slate-600">Insights detalhados sobre performance e métricas do negócio</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('download', 'h-4 w-4')}
          Exportar Relatório
        </button>
      </div>
      
      <!-- Analytics Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        ${buildEnhancedStatsCard('Receita Total', 'R$ 487.250', '+23%', 'trending-up', 'green', 'este mês')}
        ${buildEnhancedStatsCard('Margem de Lucro', '34.5%', '+2.1%', 'percent', 'blue', 'média')}
        ${buildEnhancedStatsCard('Produtos Vendidos', '12.847', '+18%', 'package', 'orange', 'unidades')}
        ${buildEnhancedStatsCard('Ticket Médio', 'R$ 37.90', '+5%', 'credit-card', 'purple', 'por pedido')}
      </div>
      
      <div class="card animate-fade-in">
        <div class="card-header">
          <h3 class="card-title">Métricas de Performance</h3>
        </div>
        <div class="card-content">
          <p class="text-slate-500">Funcionalidade de análises em desenvolvimento...</p>
        </div>
      </div>
    </div>
  `;
}

// Enhanced locations content
function buildEnhancedLocationsContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Gestão de Locais</h2>
          <p class="text-slate-600">Gerencie filiais, pontos de venda e centros de distribuição</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Local
        </button>
      </div>
      
      <div class="card animate-fade-in">
        <div class="card-header">
          <h3 class="card-title">Lista de Locais</h3>
        </div>
        <div class="card-content">
          <p class="text-slate-500">Funcionalidade de locais em desenvolvimento...</p>
        </div>
      </div>
    </div>
  `;
}

// Enhanced users content
function buildEnhancedUsersContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Gestão de Usuários</h2>
          <p class="text-slate-600">Gerencie usuários, permissões e controle de acesso</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Usuário
        </button>
      </div>
      
      <div class="card animate-fade-in">
        <div class="card-header">
          <h3 class="card-title">Lista de Usuários</h3>
        </div>
        <div class="card-content">
          <p class="text-slate-500">Funcionalidade de usuários em desenvolvimento...</p>
        </div>
      </div>
    </div>
  `;
}

// Enhanced categories content
function buildEnhancedCategoriesContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 mb-2">Categorias</h2>
          <p class="text-slate-600">Organize seus produtos em categorias para melhor gestão</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('plus', 'h-4 w-4')}
          Nova Categoria
        </button>
      </div>
      
      <div class="card animate-fade-in">
        <div class="card-header">
          <h3 class="card-title">Lista de Categorias</h3>
        </div>
        <div class="card-content">
          <p class="text-slate-500">Funcionalidade de categorias em desenvolvimento...</p>
        </div>
      </div>
    </div>
  `;
}

// Enhanced settings content
function buildEnhancedSettingsContent(): string {
  return `
    <div class="space-y-6">
      <div class="animate-fade-in">
        <h2 class="text-2xl font-bold text-slate-900 mb-2">Configurações do Sistema</h2>
        <p class="text-slate-600">Configure preferências, integrações e parâmetros do sistema</p>
      </div>
      
      <div class="card animate-fade-in">
        <div class="card-header">
          <h3 class="card-title">Configurações Gerais</h3>
        </div>
        <div class="card-content">
          <p class="text-slate-500">Funcionalidade de configurações em desenvolvimento...</p>
        </div>
      </div>
    </div>
  `;
}
// Helper functions for building enhanced components

function buildQuickStat(title: string, value: string, icon: string): string {
  return `
    <div class="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
      <div class="flex items-center justify-center mb-2">
        ${getIcon(icon, 'h-6 w-6 text-white')}
      </div>
      <div class="text-2xl font-bold text-white mb-1">${value}</div>
      <div class="text-xs text-orange-100">${title}</div>
    </div>
  `;
}

function buildEnhancedStatsCard(title: string, value: string, change: string, icon: string, color: string, period: string): string {
  const isPositive = change.startsWith('+');
  const colorClasses = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-red-500',
    purple: 'from-purple-500 to-pink-500'
  };
  
  return `
    <div class="stats-card group cursor-pointer">
      <div class="flex items-center justify-between mb-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} shadow-lg group-hover:scale-110 transition-transform">
          ${getIcon(icon, 'h-7 w-7 text-white')}
        </div>
        
        <div class="px-3 py-1 rounded-full text-xs font-medium ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
          ${change}
        </div>
      </div>

      <div class="space-y-2">
        <h3 class="text-sm font-medium text-slate-600">${title}</h3>
        <div class="flex items-baseline space-x-2">
          <span class="text-3xl font-bold text-slate-900">${value}</span>
        </div>
        <p class="text-xs text-slate-500 flex items-center">
          ${isPositive ? '↗' : '↘'} ${period}
        </p>
      </div>
    </div>
  `;
}

function buildEnhancedQuickAction(title: string, description: string, icon: string, colorClass: string, href: string): string {
  return `
    <a href="${href}" onclick="navigateTo('${href}', event)" class="block group">
      <div class="flex items-center space-x-4 w-full p-4 hover:bg-slate-50 rounded-xl cursor-pointer border border-transparent hover:border-slate-200 transition-all group-hover:shadow-md">
        <div class="h-12 w-12 rounded-xl ${colorClass} flex items-center justify-center shrink-0 transition-all group-hover:scale-110 shadow-lg">
          ${getIcon(icon, 'h-6 w-6 text-white')}
        </div>
        <div class="text-left min-w-0 flex-1">
          <h4 class="font-semibold text-slate-900 text-sm truncate group-hover:text-slate-700">${title}</h4>
          <p class="text-xs text-slate-500 group-hover:text-slate-600 line-clamp-2">${description}</p>
        </div>
        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
          ${getIcon('chevron-right', 'h-5 w-5 text-slate-400')}
        </div>
      </div>
    </a>
  `;
}

function buildEnhancedActivityItem(title: string, description: string, time: string, type: string, iconName: string): string {
  const typeColors = {
    success: 'bg-green-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };
  
  return `
    <div class="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
      <div class="h-10 w-10 rounded-full ${typeColors[type as keyof typeof typeColors]} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        ${getIcon(iconName, 'h-5 w-5 text-white')}
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-slate-900 truncate">${title}</h4>
        <p class="text-sm text-slate-600 line-clamp-2">${description}</p>
        <p class="text-xs text-slate-400 mt-1">${time}</p>
      </div>
      <div class="opacity-0 group-hover:opacity-100 transition-opacity">
        ${getIcon('external-link', 'h-4 w-4 text-slate-400')}
      </div>
    </div>
  `;
}

function buildEnhancedAlert(title: string, message: string, time: string, type: string): string {
  const typeColors = {
    warning: 'bg-yellow-500',
    success: 'bg-green-500',
    info: 'bg-blue-500',
    error: 'bg-red-500'
  };
  
  const typeIcons = {
    warning: 'alert-triangle',
    success: 'check-circle',
    info: 'info',
    error: 'x-circle'
  };
  
  return `
    <div class="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
      <div class="h-8 w-8 rounded-full ${typeColors[type as keyof typeof typeColors]} flex items-center justify-center shrink-0">
        ${getIcon(typeIcons[type as keyof typeof typeIcons], 'h-4 w-4 text-white')}
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-slate-900 truncate">${title}</h4>
        <p class="text-sm text-slate-600 line-clamp-2">${message}</p>
        <p class="text-xs text-slate-400 mt-1">${time}</p>
      </div>
      <button class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 rounded">
        ${getIcon('x', 'h-4 w-4 text-slate-400')}
      </button>
    </div>
  `;
}

function buildEnhancedPerformanceMetric(label: string, value: string, color: string, percentage: number): string {
  const colorClasses = {
    green: 'from-green-500 to-emerald-500',
    blue: 'from-blue-500 to-cyan-500',
    orange: 'from-orange-500 to-red-500'
  };
  
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-slate-600">${label}</span>
        <div class="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">${value}</div>
      </div>
      <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div class="h-3 rounded-full bg-gradient-to-r ${colorClasses[color as keyof typeof colorClasses]} transition-all duration-1000 ease-out" style="width: ${percentage}%"></div>
      </div>
    </div>
  `;
}

function buildEnhancedProductCard(name: string, sku: string, price: string, stock: string, level: string, category: string): string {
  const levelColors = {
    good: 'border-green-200 bg-green-50 text-green-700',
    medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    low: 'border-red-200 bg-red-50 text-red-700'
  };
  
  const levelText = {
    good: 'Estoque OK',
    medium: 'Estoque Médio',
    low: 'Estoque Baixo'
  };
  
  return `
    <div class="card hover:shadow-xl transition-all cursor-pointer group">
      <div class="card-content">
        <div class="flex items-start justify-between mb-4">
          <div class="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            ${getIcon('package', 'h-7 w-7 text-white')}
          </div>
          <div class="px-2 py-1 rounded-full text-xs font-medium border ${levelColors[level as keyof typeof levelColors]}">
            ${levelText[level as keyof typeof levelText]}
          </div>
        </div>
        
        <div class="space-y-2 mb-4">
          <h4 class="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">${name}</h4>
          <p class="text-sm text-slate-600">SKU: ${sku}</p>
          <p class="text-xs text-slate-500">${category}</p>
        </div>
        
        <div class="flex items-center justify-between mb-4">
          <span class="font-bold text-slate-900">${price}</span>
          <span class="text-sm text-slate-600 font-medium">${stock}</span>
        </div>
        
        <div class="flex space-x-2">
          <button class="btn btn-secondary text-xs flex-1 group-hover:border-orange-500 group-hover:text-orange-600 transition-colors">
            ${getIcon('edit', 'h-3 w-3')}
            Editar
          </button>
          <button class="btn btn-secondary text-xs group-hover:border-orange-500 group-hover:text-orange-600 transition-colors">
            ${getIcon('eye', 'h-3 w-3')}
          </button>
          <button class="btn btn-secondary text-xs group-hover:border-orange-500 group-hover:text-orange-600 transition-colors">
            ${getIcon('more-horizontal', 'h-3 w-3')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function buildEnhancedProductsTable(): string {
  return `
    <table class="table">
      <thead>
        <tr>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">
            <div class="flex items-center space-x-2">
              <input type="checkbox" class="rounded border-slate-300">
              <span>Produto</span>
            </div>
          </th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">SKU</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Categoria</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Preço</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Estoque</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Status</th>
          <th class="text-right py-4 px-6 font-semibold text-slate-600">Ações</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-slate-100 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-colors">
          <td class="py-4 px-6">
            <div class="flex items-center space-x-3">
              <input type="checkbox" class="rounded border-slate-300">
              <div class="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                ${getIcon('apple', 'h-5 w-5 text-white')}
              </div>
              <div>
                <div class="font-semibold text-slate-900">Tomate Italiano</div>
                <div class="text-sm text-slate-500">Produto fresco</div>
              </div>
            </div>
          </td>
          <td class="py-4 px-6 text-slate-900 font-mono">VEG-001</td>
          <td class="py-4 px-6 text-slate-900">Vegetais</td>
          <td class="py-4 px-6 text-slate-900 font-semibold">R$ 8,50</td>
          <td class="py-4 px-6 text-slate-900">15 kg</td>
          <td class="py-4 px-6">
            <span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Estoque Baixo</span>
          </td>
          <td class="py-4 px-6 text-right">
            <div class="flex space-x-2 justify-end">
              <button class="btn btn-secondary text-xs hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-colors">
                ${getIcon('edit', 'h-3 w-3')}
              </button>
              <button class="btn btn-secondary text-xs hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-colors">
                ${getIcon('eye', 'h-3 w-3')}
              </button>
              <button class="btn btn-secondary text-xs hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors">
                ${getIcon('trash-2', 'h-3 w-3')}
              </button>
            </div>
          </td>
        </tr>
        <tr class="border-b border-slate-100 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-colors">
          <td class="py-4 px-6">
            <div class="flex items-center space-x-3">
              <input type="checkbox" class="rounded border-slate-300">
              <div class="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                ${getIcon('apple', 'h-5 w-5 text-white')}
              </div>
              <div>
                <div class="font-semibold text-slate-900">Cebola Branca</div>
                <div class="text-sm text-slate-500">Produto fresco</div>
              </div>
            </div>
          </td>
          <td class="py-4 px-6 text-slate-900 font-mono">VEG-002</td>
          <td class="py-4 px-6 text-slate-900">Vegetais</td>
          <td class="py-4 px-6 text-slate-900 font-semibold">R$ 4,20</td>
          <td class="py-4 px-6 text-slate-900">45 kg</td>
          <td class="py-4 px-6">
            <span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Estoque OK</span>
          </td>
          <td class="py-4 px-6 text-right">
            <div class="flex space-x-2 justify-end">
              <button class="btn btn-secondary text-xs hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-colors">
                ${getIcon('edit', 'h-3 w-3')}
              </button>
              <button class="btn btn-secondary text-xs hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-colors">
                ${getIcon('eye', 'h-3 w-3')}
              </button>
              <button class="btn btn-secondary text-xs hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors">
                ${getIcon('trash-2', 'h-3 w-3')}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

function buildEnhancedRecentOrdersTable(): string {
  return `
    <table class="table">
      <thead>
        <tr>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Pedido</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Fornecedor</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Data</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Valor</th>
          <th class="text-left py-4 px-6 font-semibold text-slate-600">Status</th>
          <th class="text-right py-4 px-6 font-semibold text-slate-600">Ações</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-slate-100 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-colors">
          <td class="py-4 px-6">
            <div class="font-semibold text-slate-900">PO-123</div>
            <div class="text-sm text-slate-500">15 itens</div>
          </td>
          <td class="py-4 px-6 text-slate-900">ABC Ltda</td>
          <td class="py-4 px-6 text-slate-900">19/01/2026</td>
          <td class="py-4 px-6 text-slate-900 font-semibold">R$ 2.450,00</td>
          <td class="py-4 px-6">
            <span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Aprovado</span>
          </td>
          <td class="py-4 px-6 text-right">
            <div class="flex space-x-2 justify-end">
              <button class="btn btn-secondary text-xs">Ver</button>
              <button class="btn btn-secondary text-xs">Editar</button>
            </div>
          </td>
        </tr>
        <tr class="border-b border-slate-100 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-colors">
          <td class="py-4 px-6">
            <div class="font-semibold text-slate-900">PO-124</div>
            <div class="text-sm text-slate-500">8 itens</div>
          </td>
          <td class="py-4 px-6 text-slate-900">XYZ Distribuidora</td>
          <td class="py-4 px-6 text-slate-900">18/01/2026</td>
          <td class="py-4 px-6 text-slate-900 font-semibold">R$ 1.890,00</td>
          <td class="py-4 px-6">
            <span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pendente</span>
          </td>
          <td class="py-4 px-6 text-right">
            <div class="flex space-x-2 justify-end">
              <button class="btn btn-secondary text-xs">Ver</button>
              <button class="btn btn-secondary text-xs">Editar</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

// Enhanced icon helper function
function getIcon(name: string, className: string = 'h-5 w-5'): string {
  const icons: Record<string, string> = {
    'home': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9,22 9,12 15,12 15,22"></polyline></svg>`,
    'package': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    'shopping-cart': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    'bar-chart-3': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>`,
    'trending-up': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"></polyline><polyline points="16,7 22,7 22,13"></polyline></svg>`,
    'arrow-right-left': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 11h4l-4-4"></path><path d="M7 11H3l4-4"></path><path d="M17 13h4l-4 4"></path><path d="M7 13H3l4 4"></path></svg>`,
    'map-pin': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    'users': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    'settings': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    'chef': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v6a6 6 0 0 0 12 0V2"></path><path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path><path d="M14 2v4"></path><path d="M16 2v4"></path><path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path></svg>`,
    'apple': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path><path d="M10 2c1 .5 2 2 2 5"></path></svg>`,
    'tag': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><path d="M7 7h.01"></path></svg>`,
    'warehouse': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"></path><path d="M6 18h12"></path><path d="M6 14h12"></path><rect width="12" height="12" x="6" y="10"></rect></svg>`,
    'scale': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 11V7a4 4 0 0 0-8 0v4"></path><path d="M8 11l-2 9h12l-2-9"></path><path d="M12 11V7"></path></svg>`,
    'chevron-right': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"></polyline></svg>`,
    'chevron-down': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"></polyline></svg>`,
    'menu': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`,
    'search': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`,
    'moon': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    'bell': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`,
    'plus': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    'zap': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"></polygon></svg>`,
    'activity': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline></svg>`,
    'alert-triangle': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    'check-circle': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline></svg>`,
    'info': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    'x-circle': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    'truck': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>`,
    'user-plus': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>`,
    'file-text': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>`,
    'external-link': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15,3 21,3 21,9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
    'x': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    'edit': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    'eye': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    'more-horizontal': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`,
    'trash-2': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c-1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    'download': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7,10 12,15 17,10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    'upload': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17,8 12,3 7,8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
    'clock': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg>`,
    'building': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v8h4"></path><path d="M18 9h2a2 2 0 0 1 2 2v11h-4"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>`,
    'receipt': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg>`,
    'timer': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="2" x2="14" y2="2"></line><line x1="12" y1="14" x2="15" y2="11"></line><circle cx="12" cy="14" r="8"></circle></svg>`,
    'chart-pie': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>`,
    'percent': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>`,
    'credit-card': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`
  };

  return icons[name] || `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
}

// Enhanced dashboard script
function getEnhancedDashboardScript(): string {
  return `
    // Enhanced API client with proper error handling and loading states
    class EnhancedApiClient {
      constructor() {
        this.baseUrl = '/api/v1';
        this.token = localStorage.getItem('auth_token');
      }

      async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const headers = {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };

        if (this.token) {
          headers['Authorization'] = 'Bearer ' + this.token;
        }

        try {
          const response = await fetch(url, {
            ...options,
            headers
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'HTTP ' + response.status);
          }

          return await response.json();
        } catch (error) {
          console.error('API request failed:', error);
          throw error;
        }
      }

      // CRUD operations with enhanced error handling
      async getProducts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('/products' + (queryString ? '?' + queryString : ''));
      }

      async createProduct(data) {
        return this.request('/products', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }

      async updateProduct(id, data) {
        return this.request('/products/' + id, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }

      async deleteProduct(id) {
        return this.request('/products/' + id, {
          method: 'DELETE'
        });
      }

      async getCategories(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('/categories' + (queryString ? '?' + queryString : ''));
      }

      async getPurchaseOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request('/purchase-orders' + (queryString ? '?' + queryString : ''));
      }

      async getAnalytics(type) {
        return this.request('/analytics/' + type);
      }
    }

    const api = new EnhancedApiClient();

    // Enhanced notification system
    function showNotification(message, type = 'info', duration = 4000) {
      const container = document.getElementById('notification-container');
      if (!container) return;

      const notification = document.createElement('div');
      notification.className = 'notification-toast notification-' + type;
      
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };
      
      notification.innerHTML = \`
        <div class="notification-content">
          <div class="notification-icon">\${icons[type] || icons.info}</div>
          <div class="notification-message">\${message}</div>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      \`;
      
      container.appendChild(notification);
      
      // Animate in
      requestAnimationFrame(() => {
        notification.classList.add('notification-show');
      });
      
      // Auto remove
      setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => {
          if (container.contains(notification)) {
            container.removeChild(notification);
          }
        }, 300);
      }, duration);
    }

    // Enhanced navigation with loading states
    function navigateTo(path, event, hasChildren = false) {
      if (event) {
        event.preventDefault();
      }
      
      if (path === '#' || hasChildren) {
        return;
      }
      
      // Show loading state
      showLoadingOverlay();
      
      // Simulate navigation delay for better UX
      setTimeout(() => {
        window.history.pushState({}, '', path);
        window.location.reload();
      }, 300);
    }

    // Loading overlay functions
    function showLoadingOverlay() {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
      }
    }

    function hideLoadingOverlay() {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
      }
    }

    // Enhanced modal functions
    function showCreateProductModal() {
      showNotification('Abrindo formulário de criação de produto...', 'info');
      // TODO: Implement modal
    }

    function showCreatePurchaseOrderModal() {
      showNotification('Abrindo formulário de pedido de compra...', 'info');
      // TODO: Implement modal
    }

    // Initialize dashboard
    document.addEventListener('DOMContentLoaded', () => {
      // Check authentication
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/';
        return;
      }

      // Update last update time
      const lastUpdateElement = document.getElementById('last-update');
      if (lastUpdateElement) {
        const now = new Date();
        lastUpdateElement.textContent = now.toLocaleTimeString('pt-BR');
      }

      // Setup search functionality
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            const query = e.target.value.toLowerCase();
            if (query.length > 2) {
              performSearch(query);
            }
          }, 300);
        });
      }

      // Setup mobile menu
      const mobileMenuBtn = document.getElementById('mobile-menu-btn');
      if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
          showNotification('Menu mobile em desenvolvimento', 'info');
        });
      }

      // Load initial data
      loadDashboardData();

      // Hide loading overlay
      hideLoadingOverlay();
    });

    // Enhanced search function
    async function performSearch(query) {
      try {
        showNotification('Buscando por: ' + query, 'info', 2000);
        
        // TODO: Implement actual search
        const results = await api.getProducts({ search: query, limit: 5 });
        
        if (results.data && results.data.products) {
          showNotification(\`Encontrados \${results.data.products.length} produtos\`, 'success');
        }
      } catch (error) {
        console.error('Search error:', error);
        showNotification('Erro na busca: ' + error.message, 'error');
      }
    }

    // Load dashboard data
    async function loadDashboardData() {
      try {
        // Load products count
        const productsResponse = await api.getProducts({ limit: 1 });
        console.log('Products loaded:', productsResponse);

        // Load other dashboard data
        // TODO: Load actual dashboard metrics
        
      } catch (error) {
        console.error('Dashboard data loading error:', error);
        // Don't show error notification for demo mode
        if (!localStorage.getItem('auth_token')?.startsWith('demo_token')) {
          showNotification('Erro ao carregar dados do dashboard', 'warning');
        }
      }
    }

    // Add enhanced notification styles
    const style = document.createElement('style');
    style.textContent = \`
      .notification-toast {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        min-width: 320px;
        max-width: 420px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        border: 1px solid #e2e8f0;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        backdrop-filter: blur(20px);
      }
      
      .notification-show {
        transform: translateX(0);
        opacity: 1;
      }
      
      .notification-hide {
        transform: translateX(100%);
        opacity: 0;
      }
      
      .notification-content {
        display: flex;
        align-items: center;
        padding: 1rem 1.25rem;
        gap: 0.75rem;
      }
      
      .notification-icon {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 1rem;
        flex-shrink: 0;
      }
      
      .notification-success .notification-icon {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
      }
      
      .notification-error .notification-icon {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
      }
      
      .notification-warning .notification-icon {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
      }
      
      .notification-info .notification-icon {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
      }
      
      .notification-message {
        flex: 1;
        font-size: 0.875rem;
        color: #374151;
        font-weight: 500;
        line-height: 1.4;
      }
      
      .notification-close {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #9ca3af;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 6px;
        transition: all 0.2s ease;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .notification-close:hover {
        background: #f3f4f6;
        color: #374151;
        transform: scale(1.1);
      }
      
      /* Enhanced loading overlay */
      #loading-overlay {
        backdrop-filter: blur(8px);
        background: rgba(0, 0, 0, 0.3);
      }
      
      #loading-overlay > div {
        background: white;
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      /* Enhanced animations */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .animate-fade-in-up {
        animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Enhanced hover effects */
      .hover-lift:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      
      .hover-glow:hover {
        box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
      }
    \`;
    document.head.appendChild(style);

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }
      
      // Escape to close modals/overlays
      if (e.key === 'Escape') {
        hideLoadingOverlay();
      }
    });
  `;
}

export default app;