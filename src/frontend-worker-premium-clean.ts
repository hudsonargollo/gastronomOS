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

// Login styles
function getLoginStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .h-full { height: 100%; }
    .min-h-screen { min-height: 100vh; }
    .bg-gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .bg-gradient-orange { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); }
    .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
    .text-transparent { color: transparent; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .p-4 { padding: 1rem; }
    .w-full { width: 100%; }
    .max-w-md { max-width: 28rem; }
    .relative { position: relative; }
    .z-10 { z-index: 10; }
    .text-center { text-align: center; }
    .mb-8 { margin-bottom: 2rem; }
    .animate-fade-in { animation: fadeIn 0.8s ease-out; }
    .inline-flex { display: inline-flex; }
    .h-16 { height: 4rem; }
    .w-16 { width: 4rem; }
    .rounded-2xl { border-radius: 1rem; }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .mb-4 { margin-bottom: 1rem; }
    .animate-scale-in { animation: scaleIn 0.5s ease-out 0.2s both; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .text-white { color: white; }
    .text-2xl { font-size: 1.5rem; }
    .font-bold { font-weight: 700; }
    .text-slate-600 { color: #475569; }
    .text-sm { font-size: 0.875rem; }
    .mt-1 { margin-top: 0.25rem; }
    .card { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.2); }
    .py-6 { padding: 1.5rem 0; }
    .animate-slide-up { animation: slideUp 0.6s ease-out 0.1s both; }
    .pb-6 { padding-bottom: 1.5rem; }
    .px-6 { padding: 0 1.5rem; }
    .text-xl { font-size: 1.25rem; }
    .font-semibold { font-weight: 600; }
    .text-slate-900 { color: #0f172a; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .font-medium { font-weight: 500; }
    .text-slate-700 { color: #334155; }
    .form-input { width: 100%; height: 44px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; background: #f8fafc; }
    .form-input:focus { outline: none; border-color: #f97316; background: white; box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1); }
    .pr-10 { padding-right: 2.5rem; }
    .absolute { position: absolute; }
    .right-0 { right: 0; }
    .top-0 { top: 0; }
    .h-11 { height: 2.75rem; }
    .px-3 { padding: 0 0.75rem; }
    .bg-transparent { background-color: transparent; }
    .border-0 { border-width: 0; }
    .cursor-pointer { cursor: pointer; }
    .h-4 { height: 1rem; }
    .w-4 { width: 1rem; }
    .text-slate-400 { color: #94a3b8; }
    .btn-primary { width: 100%; height: 44px; background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.4); }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .border-t { border-top-width: 1px; }
    .border-slate-200 { border-color: #e2e8f0; }
    .text-xs { font-size: 0.75rem; }
    .bg-white { background-color: white; }
    .px-2 { padding: 0 0.5rem; }
    .text-slate-500 { color: #64748b; }
    .btn-secondary { width: 100%; height: 44px; background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-weight: 500; font-size: 14px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
    .btn-secondary:hover { background: #f8fafc; }
    .text-orange-500 { color: #f97316; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
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
      notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ' + 
        (type === 'success' ? 'bg-green-500 text-white' :
         type === 'error' ? 'bg-red-500 text-white' :
         'bg-blue-500 text-white');
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.remove('translate-x-full');
      }, 100);
      
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }

    const style = document.createElement('style');
    style.textContent = \`
      @keyframes spin { to { transform: rotate(360deg); } }
      .animate-spin { animation: spin 1s linear infinite; }
      .translate-x-full { transform: translateX(100%); }
      .fixed { position: fixed; }
      .top-4 { top: 1rem; }
      .right-4 { right: 1rem; }
      .z-50 { z-index: 50; }
      .p-4 { padding: 1rem; }
      .rounded-lg { border-radius: 0.5rem; }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
      .transition-all { transition: all 0.3s ease; }
      .duration-300 { transition-duration: 300ms; }
      .transform { transform: translateZ(0); }
      .bg-green-500 { background-color: #22c55e; }
      .bg-red-500 { background-color: #ef4444; }
      .bg-blue-500 { background-color: #3b82f6; }
    \`;
    document.head.appendChild(style);
  `;
}
// Dashboard styles
function getDashboardStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
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
    .bg-slate-900 { background-color: #0f172a; }
    .bg-slate-800 { background-color: #1e293b; }
    .bg-slate-700 { background-color: #334155; }
    .bg-white { background-color: white; }
    .text-white { color: white; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-500 { color: #64748b; }
    .text-slate-400 { color: #94a3b8; }
    .text-slate-300 { color: #cbd5e1; }
    .text-orange-300 { color: #fdba74; }
    .text-orange-400 { color: #fb923c; }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .relative { position: relative; }
    .w-64 { width: 16rem; }
    .w-72 { width: 18rem; }
    .bg-gradient-to-b { background: linear-gradient(to bottom, #0f172a, #1e293b, #0f172a); }
    .bg-gradient-to-r { background: linear-gradient(to right, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.2)); }
    .bg-gradient-to-br { background: linear-gradient(to bottom right, #f97316, #dc2626); }
    .bg-clip-text { -webkit-background-clip: text; background-clip: text; }
    .text-transparent { color: transparent; }
    .h-14 { height: 3.5rem; }
    .h-16 { height: 4rem; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .border-b { border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
    .border-slate-200 { border-color: #e2e8f0; }
    .px-3 { padding: 0 0.75rem; }
    .px-6 { padding: 0 1.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .space-x-3 > * + * { margin-left: 0.75rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-x-4 > * + * { margin-left: 1rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-6 > * + * { margin-top: 1.5rem; }
    .h-9 { height: 2.25rem; }
    .w-9 { width: 2.25rem; }
    .h-10 { height: 2.5rem; }
    .w-10 { width: 2.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .shrink-0 { flex-shrink: 0; }
    .text-lg { font-size: 1.125rem; }
    .text-xl { font-size: 1.25rem; }
    .text-2xl { font-size: 1.5rem; }
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .nav-item { opacity: 0; animation: slideInLeft 0.5s ease-out forwards; }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    .nav-link { text-decoration: none; display: block; transition: all 0.2s ease; }
    .nav-link:hover { text-decoration: none; }
    .group:hover .group-hover-text-white { color: white; }
    .py-2-5 { padding: 0.625rem 0; }
    .py-3 { padding: 0.75rem 0; }
    .transition-all { transition: all 0.2s ease; }
    .min-h-44 { min-height: 44px; }
    .min-h-52 { min-height: 52px; }
    .bg-slate-700-50 { background-color: rgba(51, 65, 85, 0.5); }
    .bg-slate-800-50 { background-color: rgba(30, 41, 59, 0.5); }
    .bg-slate-700-30 { background-color: rgba(51, 65, 85, 0.3); }
    .shadow-orange-500-10 { box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.1); }
    .ml-3 { margin-left: 0.75rem; }
    .ml-6 { margin-left: 1.5rem; }
    .ml-auto { margin-left: auto; }
    .mt-1 { margin-top: 0.25rem; }
    .mr-2 { margin-right: 0.5rem; }
    .h-4 { height: 1rem; }
    .w-4 { width: 1rem; }
    .h-5 { height: 1.25rem; }
    .w-5 { width: 1.25rem; }
    .h-6 { height: 1.5rem; }
    .w-6 { width: 1.5rem; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .flex-shrink-0 { flex-shrink: 0; }
    .transition-colors { transition: color 0.2s ease, background-color 0.2s ease; }
    .transition-transform { transition: transform 0.2s ease; }
    .rotate-90 { transform: rotate(90deg); }
    .submenu { overflow: hidden; transition: max-height 0.3s ease; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-full { border-radius: 9999px; }
    .inline { display: inline; }
    .block { display: block; }
    .py-2 { padding: 0.5rem 0; }
    .border-t { border-top: 1px solid rgba(51, 65, 85, 0.5); }
    .cursor-pointer { cursor: pointer; }
    .hover-bg-slate-700-50:hover { background-color: rgba(51, 65, 85, 0.5); }
    .hover-bg-slate-700-30:hover { background-color: rgba(51, 65, 85, 0.3); }
    .hover-text-white:hover { color: white; }
    .bg-white-80 { background-color: rgba(255, 255, 255, 0.8); }
    .backdrop-blur-sm { backdrop-filter: blur(4px); }
    .inline-flex { display: inline-flex; }
    .whitespace-nowrap { white-space: nowrap; }
    .outline-none { outline: none; }
    .rounded-md { border-radius: 0.375rem; }
    .gap-1-5 { gap: 0.375rem; }
    .lg-hidden { display: none; }
    @media (min-width: 1024px) { .lg-hidden { display: none; } .lg-flex { display: flex; } .lg-text-2xl { font-size: 1.5rem; } }
    @media (min-width: 640px) { .sm-h-16 { height: 4rem; } .sm-w-72 { width: 18rem; } .sm-text-xl { font-size: 1.25rem; } .sm-p-4 { padding: 1rem; } .sm-px-6 { padding: 0 1.5rem; } .sm-block { display: block; } .sm-flex { display: flex; } }
    .max-w-md { max-width: 28rem; }
    .max-w-7xl { max-width: 80rem; }
    .mx-auto { margin: 0 auto; }
    .mx-8 { margin: 0 2rem; }
    .w-full { width: 100%; }
    .left-3 { left: 0.75rem; }
    .top-1-2 { top: 50%; }
    .translate-y-1-2 { transform: translateY(-50%); }
    .absolute { position: absolute; }
    .pl-10 { padding-left: 2.5rem; }
    .focus-bg-white:focus { background-color: white; }
    .border { border: 1px solid #e2e8f0; }
    .py-1 { padding: 0.25rem 0; }
    .text-base { font-size: 1rem; }
    .shadow-xs { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .btn-ghost { background: transparent; border: none; cursor: pointer; transition: all 0.2s ease; border-radius: 0.375rem; }
    .btn-ghost:hover { background-color: #f1f5f9; }
    .p-2 { padding: 0.5rem; }
    .hidden { display: none; }
    .top-neg-1 { top: -0.25rem; }
    .right-neg-1 { right: -0.25rem; }
    .bg-red-500 { background-color: #ef4444; }
    .h-7 { height: 1.75rem; }
    .w-7 { width: 1.75rem; }
    .text-left { text-align: left; }
    .xl-block { display: none; }
    @media (min-width: 1280px) { .xl-block { display: block; } }
    .h-3 { height: 0.75rem; }
    .w-3 { width: 0.75rem; }
    .content-container { background: #f8fafc; }
    .card { background: white; border-radius: 0.75rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .card-header { padding: 1.5rem 1.5rem 0 1.5rem; }
    .card-content { padding: 1.5rem; }
    .card-title { font-size: 1.125rem; font-weight: 600; color: #0f172a; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; transition: all 0.2s ease; cursor: pointer; border: none; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; padding: 0.5rem 1rem; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4); }
    .btn-secondary { background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 0.5rem 1rem; }
    .btn-secondary:hover { background: #f8fafc; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    .col-span-2 { grid-column: span 2 / span 2; }
    .rounded-2xl { border-radius: 1rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .text-orange-100 { color: #fed7aa; }
    .right-neg-4 { right: -1rem; }
    .top-neg-4 { top: -1rem; }
    .right-neg-8 { right: -2rem; }
    .top-neg-8 { top: -2rem; }
    .h-20 { height: 5rem; }
    .w-20 { width: 5rem; }
    .h-32 { height: 8rem; }
    .w-32 { width: 8rem; }
    .bg-white-10 { background-color: rgba(255, 255, 255, 0.1); }
    .bg-white-5 { background-color: rgba(255, 255, 255, 0.05); }
    .text-white-20 { color: rgba(255, 255, 255, 0.2); }
    .right-4 { right: 1rem; }
    .top-4 { top: 1rem; }
    .right-8 { right: 2rem; }
    .top-8 { top: 2rem; }
    .h-16 { height: 4rem; }
    .w-16 { width: 4rem; }
    .animate-fade-in { animation: fadeIn 0.6s ease-out; }
    .animate-slide-up { animation: slideUp 0.6s ease-out; }
    .animate-scale-in { animation: scaleIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .form-input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; font-size: 0.875rem; transition: all 0.2s ease; background: #f8fafc; }
    .form-input:focus { outline: none; border-color: #f97316; background: white; box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1); }
    .opacity-0 { opacity: 0; }
    .translate-x-full { transform: translateX(100%); }
    .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5); }
    .fixed { position: fixed; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .z-50 { z-index: 50; }
    .bg-black { background-color: black; }
    .overflow-x-auto { overflow-x: auto; }
    .table { width: 100%; }
    .thead { }
    .tbody { }
    .tr { border-bottom: 1px solid #f1f5f9; }
    .tr:hover { background-color: #f8fafc; }
    .th { text-align: left; padding: 0.75rem 1rem; font-weight: 500; color: #64748b; }
    .td { padding: 0.75rem 1rem; color: #0f172a; }
    .text-right { text-align: right; }
    .justify-end { justify-content: flex-end; }
  `;
}

// Dashboard script
function getDashboardScript(): string {
  return `
    // Global state
    let currentData = {
      products: [],
      categories: [],
      locations: [],
      users: [],
      inventory: [],
      purchaseOrders: [],
      transfers: [],
      allocations: []
    };

    // API client
    class ApiClient {
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
            throw new Error('HTTP ' + response.status);
          }

          return await response.json();
        } catch (error) {
          console.error('API request failed:', error);
          throw error;
        }
      }

      // CRUD operations
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
    }

    const api = new ApiClient();

    // Navigation
    function navigateTo(path, event) {
      if (event) {
        event.preventDefault();
      }
      
      if (path === '#') {
        return;
      }
      
      window.history.pushState({}, '', path);
      window.location.reload();
    }

    // Notification system
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ' + 
        (type === 'success' ? 'bg-green-500 text-white' :
         type === 'error' ? 'bg-red-500 text-white' :
         type === 'warning' ? 'bg-yellow-500 text-white' :
         'bg-blue-500 text-white');
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.remove('translate-x-full');
      }, 100);
      
      setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }

    // Initialize dashboard
    document.addEventListener('DOMContentLoaded', () => {
      // Check authentication
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/';
        return;
      }

      // Setup search
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase();
          console.log('Searching for:', query);
        });
      }

      // Setup mobile menu
      const mobileMenuBtn = document.getElementById('mobile-menu-btn');
      if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
          console.log('Toggle mobile menu');
        });
      }
    });

    // Add notification styles
    const style = document.createElement('style');
    style.textContent = \`
      .bg-green-500 { background-color: #22c55e; }
      .bg-red-500 { background-color: #ef4444; }
      .bg-yellow-500 { background-color: #eab308; }
      .bg-blue-500 { background-color: #3b82f6; }
      .duration-300 { transition-duration: 300ms; }
    \`;
    document.head.appendChild(style);
  `;
}

// Build sidebar
function buildSidebar(currentRoute: string): string {
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: 'home' },
    { name: 'Estoque', href: '/inventory', icon: 'package', children: [
      { name: 'Produtos', href: '/inventory/products', icon: 'apple' },
      { name: 'Categorias', href: '/inventory/categories', icon: 'tag' }
    ]},
    { name: 'Compras', href: '/purchasing', icon: 'shopping-cart' },
    { name: 'Análises', href: '/analytics', icon: 'bar-chart-3' },
    { name: 'Locais', href: '/locations', icon: 'map-pin' },
    { name: 'Usuários', href: '/users', icon: 'users' },
    { name: 'Configurações', href: '/settings', icon: 'settings' }
  ];

  return `
    <div class="sidebar-container">
      <div class="flex h-full flex-col bg-gradient-to-b text-white shadow-2xl relative w-64 sm-w-72">
        <!-- Header -->
        <div class="flex h-14 sm-h-16 items-center justify-center border-b px-3">
          <div class="flex items-center space-x-3 w-full">
            <div class="flex h-9 w-9 sm-h-10 sm-w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg shrink-0">
              ${getIcon('chef', 'h-5 w-5 sm-h-6 sm-w-6 text-white')}
            </div>
            <div class="min-w-0 flex-1">
              <h1 class="text-lg sm-text-xl font-bold bg-gradient-to-r bg-clip-text text-transparent truncate">GastronomOS</h1>
              <p class="text-xs text-slate-400 truncate">Gestão de Restaurante</p>
            </div>
          </div>
        </div>
        
        <!-- Navigation -->
        <nav class="flex-1 space-y-1 p-3 sm-p-4 overflow-y-auto">
          ${navigation.map((item, index) => {
            const isActive = currentRoute === item.href || currentRoute.startsWith(item.href + '/');
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = hasChildren && currentRoute.startsWith(item.href + '/');
            
            return `
              <div class="nav-item" style="animation-delay: ${(index + 1) * 100}ms">
                <a class="nav-link group flex items-center rounded-xl px-3 py-2-5 sm-py-3 text-sm font-medium transition-all min-h-44 ${
                  isActive 
                    ? 'bg-gradient-to-r text-orange-300 shadow-lg shadow-orange-500-10'
                    : 'text-slate-300 hover-bg-slate-700-50 hover-text-white'
                }" href="${item.href}" onclick="navigateTo('${item.href}', event)">
                  ${getIcon(item.icon, `h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-orange-400' : 'text-slate-400 group-hover-text-white'}`)}
                  <span class="ml-3 flex-1 truncate">${item.name}</span>
                  ${hasChildren ? `
                    <div class="ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}">
                      ${getIcon('chevron-right', 'h-4 w-4 text-slate-400')}
                    </div>
                  ` : ''}
                </a>
                
                ${hasChildren && isExpanded ? `
                  <div class="submenu ml-6 mt-1 space-y-1" style="max-height: ${item.children.length * 40}px">
                    ${item.children.map(subItem => {
                      const subActive = currentRoute === subItem.href;
                      return `
                        <a href="${subItem.href}" onclick="navigateTo('${subItem.href}', event)" class="nav-link block px-3 py-2 text-sm ${subActive ? 'text-orange-300 bg-slate-700-30' : 'text-slate-400 hover-text-white hover-bg-slate-700-30'} rounded-lg transition-colors">
                          ${getIcon(subItem.icon, 'h-4 w-4 inline mr-2')}
                          ${subItem.name}
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
        <div class="border-t p-3 sm-p-4">
          <div class="flex items-center space-x-3 rounded-xl bg-slate-800-50 p-3 transition-colors hover-bg-slate-700-50 cursor-pointer min-h-52">
            <div class="h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0">
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
      <header class="flex h-14 sm-h-16 items-center justify-between border-b border-slate-200 bg-white-80 backdrop-blur-sm px-3 sm-px-6 shadow-sm">
        <div class="flex items-center space-x-2 sm-space-x-4 flex-1 min-w-0">
          <button id="mobile-menu-btn" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all outline-none rounded-md gap-1-5 lg-hidden h-9 w-9 p-0 shrink-0">
            ${getIcon('menu', 'h-5 w-5')}
          </button>
          
          <div class="min-w-0 flex-1">
            <h1 class="text-lg sm-text-xl lg-text-2xl font-bold text-slate-900 truncate">${routeConfig.title}</h1>
            <p class="text-xs sm-text-sm text-slate-500 hidden sm-block truncate">${routeConfig.subtitle}</p>
          </div>
        </div>
        
        <div class="hidden lg-flex flex-1 max-w-md mx-8">
          <div class="relative w-full">
            ${getIcon('search', 'absolute left-3 top-1-2 h-4 w-4 translate-y-1-2 text-slate-400')}
            <input id="search-input" class="h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none pl-10 bg-slate-50 border-slate-200 focus-bg-white transition-colors" placeholder="Buscar produtos, pedidos, transferências..."/>
          </div>
        </div>
        
        <div class="flex items-center space-x-1 sm-space-x-2 lg-space-x-4 shrink-0">
          <button class="btn-ghost p-2 lg-hidden">
            ${getIcon('search', 'h-4 w-4')}
          </button>
          
          <button class="btn-ghost p-2 hidden sm-flex">
            ${getIcon('moon', 'h-4 w-4')}
          </button>
          
          <button class="btn-ghost p-2 relative">
            ${getIcon('bell', 'h-4 w-4')}
            <span class="absolute top-neg-1 right-neg-1 h-4 w-4 sm-h-5 sm-w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">3</span>
          </button>
          
          <button class="btn-ghost p-2 sm-px-2 relative">
            <div class="flex items-center space-x-2">
              <span class="relative flex shrink-0 overflow-hidden rounded-full h-7 w-7 sm-h-8 sm-w-8">
                <span class="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br text-white text-xs sm-text-sm">JD</span>
              </span>
              <div class="hidden xl-block text-left">
                <p class="text-sm font-medium text-slate-900">John Doe</p>
                <p class="text-xs text-slate-500">Manager</p>
              </div>
              ${getIcon('chevron-down', 'h-3 w-3 text-slate-400 hidden sm-block')}
            </div>
          </button>
        </div>
      </header>
      
      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto">
        <div class="content-container h-full">
          <div class="p-3 sm-p-6 space-y-4 sm-space-y-6 max-w-7xl mx-auto">
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

// Icon helper function
function getIcon(name: string, className: string = 'h-5 w-5'): string {
  const icons: Record<string, string> = {
    'home': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9,22 9,12 15,12 15,22"></polyline></svg>`,
    'package': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    'shopping-cart': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
    'bar-chart-3': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>`,
    'map-pin': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    'users': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    'settings': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    'chef': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v6a6 6 0 0 0 12 0V2"></path><path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path><path d="M14 2v4"></path><path d="M16 2v4"></path><path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path></svg>`,
    'apple': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path><path d="M10 2c1 .5 2 2 2 5"></path></svg>`,
    'tag': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><path d="M7 7h.01"></path></svg>`,
    'chevron-right': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"></polyline></svg>`,
    'chevron-down': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"></polyline></svg>`,
    'menu': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>`,
    'search': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`,
    'moon': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    'bell': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`,
    'plus': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    'trending-up': `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"></polyline><polyline points="16,7 22,7 22,13"></polyline></svg>`
  };

  return icons[name] || `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
}
// Content builders
function buildDashboardContent(): string {
  return `
    <!-- Welcome Section -->
    <div class="bg-gradient-to-r rounded-2xl p-4 sm-p-6 text-white relative overflow-hidden animate-fade-in" style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);">
      <div class="relative z-10">
        <h1 class="text-xl sm-text-2xl font-bold mb-2">Bem-vindo de volta!</h1>
        <p class="text-orange-100 text-sm sm-text-base">
          Gerencie suas operações do restaurante com eficiência
        </p>
      </div>
      
      <!-- Decorative elements -->
      <div class="absolute right-neg-4 top-neg-4 h-20 w-20 rounded-full bg-white-10"></div>
      <div class="absolute right-neg-8 top-neg-8 h-32 w-32 rounded-full bg-white-5"></div>
      ${getIcon('chef', 'absolute right-4 top-4 h-8 w-8 text-white-20')}
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm-grid-cols-2 lg-grid-cols-4 gap-3 sm-gap-4 lg-gap-6">
      ${buildStatsCard('Produtos Totais', '2.847', '+12%', 'package', 'blue')}
      ${buildStatsCard('Pedidos Ativos', '156', '+8%', 'shopping-cart', 'green')}
      ${buildStatsCard('Transferências Pendentes', '23', '-15%', 'trending-up', 'orange')}
      ${buildStatsCard('Receita Mensal', 'R$ 47.892', '+23%', 'trending-up', 'purple')}
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 xl-grid-cols-3 gap-4 sm-gap-6">
      <!-- Quick Actions -->
      <div class="xl-col-span-1 animate-slide-up">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Ações Rápidas</h3>
          </div>
          <div class="card-content space-y-2 sm-space-y-3">
            ${buildQuickAction('Criar Pedido de Compra', 'Novo pedido para fornecedores', 'shopping-cart', 'bg-blue-500', '/purchasing/orders/new')}
            ${buildQuickAction('Processar Recebimento', 'Registrar produtos recebidos', 'package', 'bg-green-500', '/purchasing/receipts/new')}
            ${buildQuickAction('Criar Transferência', 'Transferir entre locais', 'trending-up', 'bg-orange-500', '/transfers/new')}
            ${buildQuickAction('Ver Análises', 'Relatórios e métricas', 'trending-up', 'bg-purple-500', '/analytics')}
          </div>
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="xl-col-span-2 animate-slide-up">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Atividades Recentes</h3>
          </div>
          <div class="card-content space-y-3 sm-space-y-4">
            ${buildActivityItem('Pedido PO-123 aprovado', 'Enviado ao fornecedor ABC Ltda', '5 min atrás', 'success')}
            ${buildActivityItem('Transferência TR-001 concluída', 'Entregue no Local Centro', '10 min atrás', 'info')}
            ${buildActivityItem('Estoque baixo: Tomates', 'Apenas 5 unidades restantes', '15 min atrás', 'warning')}
            ${buildActivityItem('Novo usuário cadastrado', 'Maria Silva - Gerente', '1 hora atrás', 'info')}
            ${buildActivityItem('Relatório mensal gerado', 'Análise de performance disponível', '2 horas atrás', 'success')}
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Overview -->
    <div class="grid grid-cols-1 lg-grid-cols-2 gap-4 sm-gap-6">
      <!-- System Alerts -->
      <div class="animate-fade-in">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title flex items-center space-x-2">
              ${getIcon('bell', 'h-5 w-5 text-orange-500')}
              <span>Alertas do Sistema</span>
            </h3>
          </div>
          <div class="card-content space-y-3 sm-space-y-4">
            ${buildAlert('Alerta de Estoque Baixo', 'Tomates com estoque baixo no Local Centro', '5 minutos atrás', 'warning')}
            ${buildAlert('Transferência Concluída', 'TR-001 entregue com sucesso no Local Oeste', '10 minutos atrás', 'info')}
            ${buildAlert('Pedido Aprovado', 'PO-123 aprovado e enviado ao fornecedor', '15 minutos atrás', 'success')}
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
          <div class="card-content space-y-4 sm-space-y-6">
            ${buildPerformanceMetric('Cumprimento de Pedidos', '98,5%', 'green')}
            ${buildPerformanceMetric('Precisão do Estoque', '94,2%', 'blue')}
            ${buildPerformanceMetric('Eficiência de Custos', '87,8%', 'orange')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildInventoryContent(): string {
  return `
    <div class="space-y-6">
      <!-- Header Actions -->
      <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Gestão de Estoque</h2>
          <p class="text-slate-600">Gerencie produtos, categorias e níveis de estoque</p>
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
      <div class="grid grid-cols-1 sm-grid-cols-3 gap-4">
        ${buildStatsCard('Total de Produtos', '2.847', '+12%', 'package', 'blue')}
        ${buildStatsCard('Estoque Baixo', '23', '-5%', 'trending-up', 'orange')}
        ${buildStatsCard('Categorias', '156', '+3%', 'tag', 'green')}
      </div>

      <!-- Products Table -->
      <div class="card">
        <div class="card-header">
          <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
            <h3 class="card-title">Produtos</h3>
            <div class="flex space-x-3">
              <div class="relative">
                ${getIcon('search', 'absolute left-3 top-1-2 h-4 w-4 translate-y-1-2 text-slate-400')}
                <input type="text" placeholder="Buscar produtos..." class="form-input pl-10 w-64">
              </div>
              <select class="form-input w-40">
                <option>Todas as categorias</option>
                <option>Vegetais</option>
                <option>Carnes</option>
                <option>Laticínios</option>
              </select>
            </div>
          </div>
        </div>
        <div class="card-content">
          <div class="overflow-x-auto">
            ${buildProductsTable()}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildProductsContent(): string {
  return `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Produtos</h2>
          <p class="text-slate-600">Cadastre e gerencie produtos do seu restaurante</p>
        </div>
        <button class="btn btn-primary" onclick="showCreateProductModal()">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Produto
        </button>
      </div>

      <!-- Products Grid -->
      <div class="grid grid-cols-1 sm-grid-cols-2 lg-grid-cols-3 xl-grid-cols-4 gap-4">
        ${buildProductCard('Tomate Italiano', 'VEG-001', 'R$ 8,50/kg', '15 kg', 'low')}
        ${buildProductCard('Cebola Branca', 'VEG-002', 'R$ 4,20/kg', '45 kg', 'good')}
        ${buildProductCard('Azeite Extra Virgem', 'OIL-001', 'R$ 25,90/L', '8 L', 'low')}
        ${buildProductCard('Farinha de Trigo', 'GRA-001', 'R$ 12,50/saco', '25 sacos', 'good')}
      </div>
    </div>
  `;
}

function buildPurchasingContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Compras</h2>
          <p class="text-slate-600">Gerencie pedidos e fornecedores</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Pedido
        </button>
      </div>
      
      <div class="card">
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

function buildAnalyticsContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Análises</h2>
          <p class="text-slate-600">Relatórios e métricas do seu negócio</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('trending-up', 'h-4 w-4')}
          Exportar Relatório
        </button>
      </div>
      
      <div class="card">
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

function buildLocationsContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Locais</h2>
          <p class="text-slate-600">Gerencie filiais e pontos de venda</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Local
        </button>
      </div>
      
      <div class="card">
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

function buildUsersContent(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-col sm-flex-row sm-items-center sm-justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Usuários</h2>
          <p class="text-slate-600">Gerencie usuários e permissões</p>
        </div>
        <button class="btn btn-primary">
          ${getIcon('plus', 'h-4 w-4')}
          Novo Usuário
        </button>
      </div>
      
      <div class="card">
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

function buildSettingsContent(): string {
  return `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Configurações</h2>
        <p class="text-slate-600">Configurações do sistema</p>
      </div>
      
      <div class="card">
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

// Helper functions for building components
function buildStatsCard(title: string, value: string, change: string, icon: string, color: string): string {
  const isPositive = change.startsWith('+');
  
  return `
    <div class="card relative overflow-hidden animate-scale-in">
      <div class="card-content">
        <!-- Icon -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg" style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);">
            ${getIcon(icon, 'h-6 w-6 text-white')}
          </div>
          
          <div class="px-2 py-1 rounded-full text-xs font-medium ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
            ${change}
          </div>
        </div>

        <!-- Content -->
        <div class="space-y-2">
          <h3 class="text-sm font-medium text-slate-600">${title}</h3>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-bold text-slate-900">${value}</span>
          </div>
          <p class="text-xs text-slate-500">
            ${isPositive ? '↗' : '↘'} vs mês anterior
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildQuickAction(title: string, description: string, icon: string, colorClass: string, href: string): string {
  return `
    <a href="${href}" onclick="navigateTo('${href}', event)" class="block">
      <div class="flex items-center space-x-3 w-full p-3 hover-bg-slate-50 min-h-44 group transition-all rounded-lg cursor-pointer border border-transparent hover-border-slate-200">
        <div class="h-10 w-10 rounded-lg ${colorClass} flex items-center justify-center shrink-0 transition-all group-hover-scale-110">
          ${getIcon(icon, 'h-5 w-5 text-white')}
        </div>
        <div class="text-left min-w-0 flex-1">
          <h4 class="font-medium text-slate-900 text-sm truncate group-hover-text-slate-700">${title}</h4>
          <p class="text-xs text-slate-500 group-hover-text-slate-600">${description}</p>
        </div>
        <div class="opacity-0 group-hover-opacity-100 transition-opacity">
          ${getIcon('chevron-right', 'h-4 w-4 text-slate-400')}
        </div>
      </div>
    </a>
  `;
}

function buildActivityItem(title: string, description: string, time: string, type: string): string {
  const typeColors = {
    success: 'bg-green-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };
  
  return `
    <div class="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 hover-bg-slate-100 transition-colors cursor-pointer">
      <div class="h-2 w-2 rounded-full mt-2 shrink-0 ${typeColors[type as keyof typeof typeColors] || typeColors.info}"></div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium text-slate-900 truncate">${title}</h4>
        <p class="text-sm text-slate-600">${description}</p>
        <p class="text-xs text-slate-400 mt-1">${time}</p>
      </div>
    </div>
  `;
}

function buildAlert(title: string, message: string, time: string, type: string): string {
  const typeColors = {
    warning: 'bg-yellow-500',
    success: 'bg-green-500',
    info: 'bg-blue-500',
    error: 'bg-red-500'
  };
  
  return `
    <div class="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 hover-bg-slate-100 transition-colors cursor-pointer">
      <div class="h-2 w-2 rounded-full mt-2 shrink-0 ${typeColors[type as keyof typeof typeColors] || typeColors.info}"></div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium text-slate-900 truncate">${title}</h4>
        <p class="text-sm text-slate-600">${message}</p>
        <p class="text-xs text-slate-400 mt-1">${time}</p>
      </div>
    </div>
  `;
}

function buildPerformanceMetric(label: string, value: string, color: string): string {
  const percentage = parseFloat(value.replace('%', ''));
  
  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-slate-600">${label}</span>
        <div class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">${value}</div>
      </div>
      <div class="w-full bg-slate-200 rounded-full h-2">
        <div class="h-2 rounded-full transition-all" style="width: ${percentage}%; background: linear-gradient(to right, #22c55e, #10b981);"></div>
      </div>
    </div>
  `;
}

function buildProductCard(name: string, sku: string, price: string, stock: string, level: string): string {
  const levelColors = {
    good: 'border-green-200 bg-green-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-red-200 bg-red-50'
  };
  
  return `
    <div class="card hover-shadow-lg transition-shadow cursor-pointer">
      <div class="card-content">
        <div class="flex items-start justify-between mb-3">
          <div class="h-12 w-12 rounded-lg bg-gradient-to-br flex items-center justify-center" style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);">
            ${getIcon('package', 'h-6 w-6 text-white')}
          </div>
          <div class="px-2 py-1 rounded-full text-xs font-medium ${levelColors[level as keyof typeof levelColors]}">
            ${level === 'good' ? 'OK' : level === 'medium' ? 'Médio' : 'Baixo'}
          </div>
        </div>
        <h4 class="font-semibold text-slate-900 mb-1">${name}</h4>
        <p class="text-sm text-slate-600 mb-2">SKU: ${sku}</p>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-slate-900">${price}</span>
          <span class="text-sm text-slate-600">${stock}</span>
        </div>
        <div class="mt-3 flex space-x-2">
          <button class="btn btn-secondary text-xs flex-1">Editar</button>
          <button class="btn btn-secondary text-xs">
            ${getIcon('trending-up', 'h-3 w-3')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function buildProductsTable(): string {
  return `
    <table class="w-full">
      <thead>
        <tr class="border-b border-slate-200">
          <th class="text-left py-3 px-4 font-medium text-slate-600">Produto</th>
          <th class="text-left py-3 px-4 font-medium text-slate-600">SKU</th>
          <th class="text-left py-3 px-4 font-medium text-slate-600">Categoria</th>
          <th class="text-left py-3 px-4 font-medium text-slate-600">Preço</th>
          <th class="text-left py-3 px-4 font-medium text-slate-600">Estoque</th>
          <th class="text-right py-3 px-4 font-medium text-slate-600">Ações</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-slate-100 hover-bg-slate-50">
          <td class="py-3 px-4 text-slate-900">Tomate Italiano</td>
          <td class="py-3 px-4 text-slate-900">VEG-001</td>
          <td class="py-3 px-4 text-slate-900">Vegetais</td>
          <td class="py-3 px-4 text-slate-900">R$ 8,50</td>
          <td class="py-3 px-4 text-slate-900">15 kg</td>
          <td class="py-3 px-4 text-right">
            <div class="flex space-x-2 justify-end">
              <button class="btn btn-secondary text-xs">Editar</button>
              <button class="btn btn-secondary text-xs">Excluir</button>
            </div>
          </td>
        </tr>
        <tr class="border-b border-slate-100 hover-bg-slate-50">
          <td class="py-3 px-4 text-slate-900">Cebola Branca</td>
          <td class="py-3 px-4 text-slate-900">VEG-002</td>
          <td class="py-3 px-4 text-slate-900">Vegetais</td>
          <td class="py-3 px-4 text-slate-900">R$ 4,20</td>
          <td class="py-3 px-4 text-slate-900">45 kg</td>
          <td class="py-3 px-4 text-right">
            <div class="flex space-x-2 justify-end">
              <button class="btn btn-secondary text-xs">Editar</button>
              <button class="btn btn-secondary text-xs">Excluir</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

export default app;