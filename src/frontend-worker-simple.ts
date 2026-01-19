import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Environment bindings interface
interface Env {
  ENVIRONMENT?: string;
  __STATIC_CONTENT: KVNamespace;
  __STATIC_CONTENT_MANIFEST: string;
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
        ...Object.fromEntries(c.req.header()),
        'Origin': 'https://gastronomos.clubemkt.digital',
        'Referer': 'https://gastronomos.clubemkt.digital'
      },
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip headers that might cause issues
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Ensure CORS headers are set
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
      message: error instanceof Error ? error.message : 'Unknown error',
      backend: 'gastronomos-production.hudsonargollo2.workers.dev'
    }, 500);
  }
});

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'frontend-worker',
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || 'development'
  });
});

// Static file serving with proper fallback
app.get('*', async (c) => {
  try {
    const url = new URL(c.req.url);
    let pathname = url.pathname;
    
    // Handle root path
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // Try to get the static file from KV storage
    const staticContent = c.env.__STATIC_CONTENT;
    if (staticContent) {
      try {
        // Parse the manifest to get the correct file key
        const manifest = JSON.parse(c.env.__STATIC_CONTENT_MANIFEST || '{}');
        
        // Try different key formats
        const possibleKeys = [
          pathname.slice(1), // Remove leading slash
          pathname,
          manifest[pathname],
          manifest[pathname.slice(1)]
        ].filter(Boolean);
        
        for (const key of possibleKeys) {
          const file = await staticContent.get(key, { type: 'arrayBuffer' });
          if (file) {
            const contentType = getContentType(pathname);
            return new Response(file, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': pathname.includes('/_next/') ? 'public, max-age=31536000' : 'public, max-age=3600',
              },
            });
          }
        }
      } catch (error) {
        console.error('Error accessing static content:', error);
      }
    }
    
    // If we can't find the file and it's the root, serve the actual Next.js login page content
    if (pathname === '/index.html' || pathname === '/') {
      // Return the actual Next.js login page HTML content
      const loginPageContent = `<!DOCTYPE html><!--iiC_874fykOOmTdYEwvKJ--><html lang="pt-BR" class="h-full"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="preload" href="/_next/static/media/83afe278b6a6bb3c-s.p.3a6ba036.woff2" as="font" crossorigin="" type="font/woff2"/><link rel="stylesheet" href="/_next/static/chunks/d75cdfeb2cebbca0.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/43c09a0f3b518e18.js"/><script src="/_next/static/chunks/0f94adcdd45354d1.js" async=""></script><script src="/_next/static/chunks/59b0cdc1cb5e9a3e.js" async=""></script><script src="/_next/static/chunks/964bb40aeb50325b.js" async=""></script><script src="/_next/static/chunks/turbopack-921c773a0b302f4c.js" async=""></script><script src="/_next/static/chunks/91f1628386242910.js" async=""></script><script src="/_next/static/chunks/aae562da308fa0ed.js" async=""></script><script src="/_next/static/chunks/1fa725e0a787855e.js" async=""></script><script src="/_next/static/chunks/a6f34cf80318bbee.js" async=""></script><script src="/_next/static/chunks/e9874ebb5c3d97f6.js" async=""></script><meta name="next-size-adjust" content=""/><title>GastronomOS - O Sistema Operacional do seu Restaurante</title><meta name="description" content="O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises"/><meta name="keywords" content="restaurante,gestão,estoque,PDV,gastronomia"/><link rel="icon" href="/favicon.ico?favicon.0b3bf435.ico" sizes="256x256" type="image/x-icon"/><script src="/_next/static/chunks/a6dad97d9634a72d.js" noModule=""></script></head><body class="inter_5972bc34-module__OU16Qa__className h-full antialiased"><div hidden=""><!--$--><!--/$--></div><div class="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-50 flex items-center justify-center p-3 sm:p-4"><div class="absolute inset-0 overflow-hidden pointer-events-none"><div class="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div><div class="absolute -bottom-40 -left-40 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div><div class="absolute top-40 left-40 w-80 h-80 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div></div><div class="w-full max-w-md relative z-10"><div style="opacity:0;transform:translateY(20px)"><div class="text-center mb-8"><div class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg mb-4" tabindex="0"><svg class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v6a6 6 0 0 0 12 0V2"></path><path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path><path d="M14 2v4"></path><path d="M16 2v4"></path><path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path></svg></div><h1 class="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">GastronomOS</h1><p class="text-slate-600 text-sm mt-1">O Sistema Operacional do seu Restaurante</p></div><div data-slot="card" class="text-card-foreground flex flex-col gap-6 rounded-xl py-6 shadow-xl border-0 bg-white/80 backdrop-blur-sm"><div data-slot="card-header" class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6 text-center pb-6"><div data-slot="card-title" class="text-xl font-semibold text-slate-900">Bem-vindo de volta</div><div data-slot="card-description" class="text-sm text-slate-600">Entre na sua conta para continuar</div></div><div data-slot="card-content" class="px-6"><form class="space-y-4" onsubmit="handleLogin(event)"><div class="space-y-2"><label data-slot="label" class="flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm font-medium text-slate-700" for="email">E-mail</label><input type="email" data-slot="input" class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-11 bg-white border-slate-200 focus:border-orange-500 focus:ring-orange-500" id="email" placeholder="seu@email.com" required="" value=""/></div><div class="space-y-2"><label data-slot="label" class="flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-sm font-medium text-slate-700" for="password">Senha</label><div class="relative"><input type="password" data-slot="input" class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-11 bg-white border-slate-200 focus:border-orange-500 focus:ring-orange-500 pr-10" id="password" placeholder="••••••••" required="" value=""/><button data-slot="button" data-variant="ghost" data-size="sm" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[>svg]:px-2.5 absolute right-0 top-0 h-11 px-3 hover:bg-transparent" type="button" onclick="togglePassword()"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye h-4 w-4 text-slate-400" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg></button></div></div><button data-slot="button" data-variant="default" data-size="default" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-primary/90 px-4 py-2 has-[>svg]:px-3 w-full h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200" type="submit"><div class="flex items-center space-x-2"><span>Entrar</span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right h-4 w-4" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></div></button><div class="relative"><div class="absolute inset-0 flex items-center"><span class="w-full border-t border-slate-200"></span></div><div class="relative flex justify-center text-xs uppercase"><span class="bg-white px-2 text-slate-500">ou</span></div></div><button data-slot="button" data-variant="outline" data-size="default" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 px-4 py-2 has-[>svg]:px-3 w-full h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium" type="button" onclick="handleDemoLogin()"><div class="flex items-center space-x-2"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles h-4 w-4 text-orange-500" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg><span>Testar Conta Demo</span></div></button></form></div></div><div class="mt-8 text-center"><div class="grid grid-cols-3 gap-4 text-xs text-slate-600"><div class="flex flex-col items-center space-y-1"><div class="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center"><svg class="h-4 w-4 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"></path><path d="M6 18h12"></path><path d="M6 14h12"></path><path d="m12 6 0 12"></path></svg></div><span>Gestão de Estoque</span></div><div class="flex flex-col items-center space-y-1"><div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center"><svg class="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg></div><span>Compras</span></div><div class="flex flex-col items-center space-y-1"><div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center"><svg class="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg></div><span>Análises</span></div></div></div></div></div></div>
<style>
  .animate-blob { animation: blob 7s infinite; }
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
  @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
  .inter_5972bc34-module__OU16Qa__className { font-family: Inter, sans-serif; }
  .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
  .from-slate-50 { --tw-gradient-from: #f8fafc; --tw-gradient-to: rgb(248 250 252 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
  .via-orange-50 { --tw-gradient-to: rgb(255 247 237 / 0); --tw-gradient-stops: var(--tw-gradient-from), #fff7ed, var(--tw-gradient-to); }
  .to-red-50 { --tw-gradient-to: #fef2f2; }
  .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
  .from-orange-500 { --tw-gradient-from: #f97316; --tw-gradient-to: rgb(249 115 22 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
  .to-red-600 { --tw-gradient-to: #dc2626; }
  .from-orange-600 { --tw-gradient-from: #ea580c; --tw-gradient-to: rgb(234 88 12 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
  .to-red-700 { --tw-gradient-to: #b91c1c; }
  .bg-clip-text { background-clip: text; }
  .text-transparent { color: transparent; }
  .backdrop-blur-sm { backdrop-filter: blur(4px); }
  .mix-blend-multiply { mix-blend-mode: multiply; }
  .filter { filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow); }
  .blur-xl { --tw-blur: blur(24px); filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow); }
</style>
<script>
  function togglePassword() {
    const passwordInput = document.getElementById('password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
  }
  
  function handleDemoLogin() {
    document.getElementById('email').value = 'demo@gastronomos.com';
    document.getElementById('password').value = 'demo123';
    alert('Credenciais de demonstração preenchidas!');
  }
  
  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalContent = submitButton.innerHTML;
    submitButton.innerHTML = '<div class="flex items-center space-x-2"><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Entrando...</span></div>';
    submitButton.disabled = true;
    
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        alert('Login realizado com sucesso! Redirecionando...');
        window.location.href = '/dashboard';
      } else {
        const error = await response.json();
        alert('Erro no login: ' + (error.message || 'Credenciais inválidas'));
      }
    } catch (error) {
      alert('Erro de conexão: ' + error.message);
    } finally {
      submitButton.innerHTML = originalContent;
      submitButton.disabled = false;
    }
  }
  
  // Add some basic animations
  setTimeout(() => {
    const elements = document.querySelectorAll('[style*="opacity:0"]');
    elements.forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0px)';
      el.style.transition = 'all 0.5s ease-out';
    });
  }, 100);
</script>
</body></html>`;
      
      return new Response(loginPageContent, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // 404 for other files
    return c.html(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GastronomOS - Arquivo não encontrado</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; text-align: center; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; }
          .error { background: #fee; padding: 15px; border-radius: 4px; margin: 20px 0; color: #c33; }
          .btn { background: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🍽️ GastronomOS</h1>
          <div class="error">
            <strong>Arquivo não encontrado:</strong> ${pathname}
          </div>
          <p>O arquivo solicitado não foi encontrado.</p>
          <a href="/" class="btn">← Voltar ao Início</a>
        </div>
      </body>
      </html>
    `, 404);
    
  } catch (error) {
    console.error('Static file serving error:', error);
    return c.html(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GastronomOS - Erro</title>
      </head>
      <body>
        <h1>Erro no servidor</h1>
        <p>Ocorreu um erro ao servir os arquivos estáticos.</p>
        <p><a href="/">Tentar novamente</a></p>
      </body>
      </html>
    `, 500);
  }
});

// Helper function to determine content type
function getContentType(pathname: string): string {
  const ext = pathname.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return 'text/html; charset=utf-8';
    case 'css': return 'text/css';
    case 'js': return 'application/javascript';
    case 'json': return 'application/json';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'ico': return 'image/x-icon';
    case 'woff': return 'font/woff';
    case 'woff2': return 'font/woff2';
    case 'ttf': return 'font/ttf';
    case 'eot': return 'application/vnd.ms-fontobject';
    case 'txt': return 'text/plain';
    default: return 'application/octet-stream';
  }
}

export default app;