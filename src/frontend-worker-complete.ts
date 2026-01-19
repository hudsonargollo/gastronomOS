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

// Debug endpoint to check KV storage and dashboard file
app.get('/debug/dashboard', async (c) => {
  try {
    const staticContent = c.env.__STATIC_CONTENT as KVNamespace;
    const manifestString = (c.env.__STATIC_CONTENT_MANIFEST as string) || '{}';
    const manifest = JSON.parse(manifestString);
    
    if (!staticContent) {
      return c.json({ error: 'KV namespace not available' });
    }
    
    // Try to get the dashboard file
    const dashboardKey = 'dashboard\\index.html';
    const dashboardFile = await staticContent.get(dashboardKey, { type: 'text' });
    
    return c.json({
      kvAvailable: !!staticContent,
      manifestAvailable: !!manifestString,
      manifestKeysCount: Object.keys(manifest).length,
      dashboardKeyExists: !!dashboardFile,
      dashboardFileSize: dashboardFile ? dashboardFile.length : 0,
      sampleManifestKeys: Object.keys(manifest).filter(k => k.includes('dashboard')).slice(0, 5),
      allDashboardKeys: Object.keys(manifest).filter(k => k.includes('dashboard'))
    });
  } catch (error) {
    return c.json({ error: 'Debug failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test endpoint to try accessing a specific file
app.get('/debug/test-css', async (c) => {
  try {
    const staticContent = c.env.__STATIC_CONTENT as KVNamespace;
    const manifestString = (c.env.__STATIC_CONTENT_MANIFEST as string) || '{}';
    const manifest = JSON.parse(manifestString);
    
    // Try to find the CSS file
    const cssPath = '_next/static/chunks/d75cdfeb2cebbca0.css';
    const possibleKeys = [
      cssPath,
      cssPath.replace(/\//g, '\\'),
      `_next\\static\\chunks\\d75cdfeb2cebbca0.css`,
      ...Object.keys(manifest).filter(k => k.includes('d75cdfeb'))
    ];
    
    const results = [];
    for (const key of possibleKeys) {
      try {
        const file = await staticContent.get(key, { type: 'text' });
        if (file) {
          results.push({ key, found: true, size: file.length });
        } else {
          results.push({ key, found: false });
        }
      } catch (error) {
        results.push({ key, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    return c.json({ results, manifestKeys: Object.keys(manifest).filter(k => k.includes('d75cdfeb')) });
  } catch (error) {
    return c.json({ error: 'Test failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
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
    const staticContent = c.env.__STATIC_CONTENT as KVNamespace;
    if (staticContent) {
      try {
        // Parse the manifest to get the correct file key
        const manifestString = (c.env.__STATIC_CONTENT_MANIFEST as string) || '{}';
        const manifest = JSON.parse(manifestString);
        
        console.log('Requesting file:', pathname);
        console.log('Manifest available:', !!manifestString);
        console.log('Manifest keys sample:', Object.keys(manifest).slice(0, 5)); // Log first 5 keys for debugging
        
        // Try different key formats based on how Wrangler uploads files
        const possibleKeys = [
          pathname.slice(1), // Remove leading slash: "_next/static/chunks/file.css"
          pathname, // Keep leading slash: "/_next/static/chunks/file.css"
          manifest[pathname], // Direct manifest lookup
          manifest[pathname.slice(1)], // Manifest lookup without leading slash
          // Try with backslashes (Windows-style paths that Wrangler might use)
          pathname.slice(1).replace(/\//g, '\\'),
          pathname.replace(/\//g, '\\'),
          // Try the reverse mapping - look for values in manifest that match our path
          ...Object.keys(manifest).filter(key => {
            const value = manifest[key];
            return value === pathname || value === pathname.slice(1) || 
                   key.replace(/\\/g, '/') === pathname || 
                   key.replace(/\\/g, '/') === pathname.slice(1);
          })
        ].filter(Boolean);
        
        console.log('Trying keys:', possibleKeys);
        
        for (const key of possibleKeys) {
          try {
            const file = await staticContent.get(key, { type: 'arrayBuffer' });
            if (file) {
              console.log('Found file with key:', key);
              const contentType = getContentType(pathname);
              return new Response(file, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': pathname.includes('/_next/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
                  'Access-Control-Allow-Origin': '*',
                },
              });
            }
          } catch (keyError) {
            console.log('Failed to get file with key:', key, keyError);
          }
        }
        
        // If we still can't find it, try listing some keys to debug
        console.log('File not found, available keys sample:', Object.keys(manifest).slice(0, 20));
        
      } catch (error) {
        console.error('Error accessing static content:', error);
      }
    }
    // If we can't find the file and it's the root, serve the login page
    if (pathname === '/index.html' || pathname === '/') {
      return new Response(buildLoginPage(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // Handle dashboard and other app routes - serve the dynamic worker-generated pages
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/inventory') || 
        pathname.startsWith('/purchasing') || 
        pathname.startsWith('/analytics') || 
        pathname.startsWith('/locations') || 
        pathname.startsWith('/transfers') || 
        pathname.startsWith('/allocations') || 
        pathname.startsWith('/users') || 
        pathname.startsWith('/settings')) {
      
      // Serve dynamic worker-generated content with full functionality
      return new Response(buildCompleteDashboardForRoute(pathname), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
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
// Build the complete login page with all original features
function buildLoginPage(): string {
  const parts = [];
  
  // DOCTYPE and HTML opening
  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="pt-BR" class="h-full">');
  
  // Head section
  parts.push('<head>');
  parts.push('<meta charset="utf-8"/>');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1"/>');
  parts.push('<title>GastronomOS - O Sistema Operacional do seu Restaurante</title>');
  parts.push('<meta name="description" content="O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises"/>');
  parts.push('<meta name="keywords" content="restaurante,gestão,estoque,PDV,gastronomia"/>');
  parts.push('<style>');
  parts.push(getLoginStyles());
  parts.push('</style>');
  parts.push('</head>');
  
  // Body section
  parts.push('<body class="h-full">');
  parts.push(getLoginBody());
  parts.push(getLoginScript());
  parts.push('</body>');
  parts.push('</html>');
  
  return parts.join('\n');
}

// Get login page styles
function getLoginStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: Inter, system-ui, -apple-system, sans-serif; }
    .min-h-screen { min-height: 100vh; }
    .bg-gradient { background: linear-gradient(135deg, #f8fafc 0%, #fff7ed 50%, #fef2f2 100%); }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .p-4 { padding: 1rem; }
    .relative { position: relative; }
    .z-10 { z-index: 10; }
    .w-full { width: 100%; }
    .max-w-md { max-width: 28rem; }
    .text-center { text-align: center; }
    .mb-8 { margin-bottom: 2rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-8 { margin-top: 2rem; }
    .inline-flex { display: inline-flex; }
    .h-16 { height: 4rem; }
    .w-16 { width: 4rem; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .h-4 { height: 1rem; }
    .w-4 { width: 1rem; }
    .h-11 { height: 2.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-full { border-radius: 9999px; }
    .bg-gradient-orange { background: linear-gradient(135deg, #f97316, #dc2626); }
    .bg-white { background-color: white; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-orange-100 { background-color: #ffedd5; }
    .bg-blue-100 { background-color: #dbeafe; }
    .bg-green-100 { background-color: #dcfce7; }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    .text-white { color: white; }
    .text-2xl { font-size: 1.5rem; }
    .text-xl { font-size: 1.25rem; }
    .text-sm { font-size: 0.875rem; }
    .text-xs { font-size: 0.75rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-600 { color: #475569; }
    .text-slate-700 { color: #334155; }
    .text-orange-600 { color: #ea580c; }
    .text-red-600 { color: #dc2626; }
    .text-blue-600 { color: #2563eb; }
    .text-green-600 { color: #16a34a; }
    .text-orange-500 { color: #f97316; }
    .bg-clip-text { background-clip: text; -webkit-background-clip: text; }
    .text-transparent { color: transparent; }
    .backdrop-blur { backdrop-filter: blur(4px); }
    .bg-opacity-80 { background-color: rgba(255, 255, 255, 0.8); }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .grid { display: grid; }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .gap-4 { gap: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .pr-10 { padding-right: 2.5rem; }
    .pb-6 { padding-bottom: 1.5rem; }
    .border { border: 1px solid #e2e8f0; }
    .border-0 { border: none; }
    .border-slate-200 { border-color: #e2e8f0; }
    .border-t { border-top: 1px solid #e2e8f0; }
    .rounded { border-radius: 0.25rem; }
    .outline-none { outline: none; }
    .focus\\:border-orange-500:focus { border-color: #f97316; }
    .focus\\:ring-orange-500:focus { box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1); }
    .hover\\:bg-slate-50:hover { background-color: #f8fafc; }
    .hover\\:from-orange-600:hover { background: linear-gradient(135deg, #ea580c, #b91c1c); }
    .transition-all { transition: all 0.2s; }
    .duration-200 { transition-duration: 200ms; }
    .cursor-pointer { cursor: pointer; }
    .disabled\\:opacity-50:disabled { opacity: 0.5; }
    .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed; }
    .absolute { position: absolute; }
    .right-0 { right: 0; }
    .top-0 { top: 0; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .animate-blob { animation: blob 7s infinite; }
    .animation-delay-2000 { animation-delay: 2s; }
    .animation-delay-4000 { animation-delay: 4s; }
    @keyframes blob { 
      0% { transform: translate(0px, 0px) scale(1); } 
      33% { transform: translate(30px, -50px) scale(1.1); } 
      66% { transform: translate(-20px, 20px) scale(0.9); } 
      100% { transform: translate(0px, 0px) scale(1); } 
    }
    .overflow-hidden { overflow: hidden; }
    .pointer-events-none { pointer-events: none; }
    .opacity-70 { opacity: 0.7; }
    .filter { filter: blur(24px); }
    .mix-blend-multiply { mix-blend-mode: multiply; }
    .-top-40 { top: -10rem; }
    .-right-40 { right: -10rem; }
    .-bottom-40 { bottom: -10rem; }
    .-left-40 { left: -10rem; }
    .top-40 { top: 10rem; }
    .left-40 { left: 10rem; }
    .w-80 { width: 20rem; }
    .h-80 { height: 20rem; }
    .bg-orange-200 { background-color: #fed7aa; }
    .bg-red-200 { background-color: #fecaca; }
    .bg-yellow-200 { background-color: #fef08a; }
    input, button { font-family: inherit; }
    input { 
      width: 100%; 
      padding: 0.75rem; 
      border: 1px solid #e2e8f0; 
      border-radius: 0.375rem; 
      outline: none; 
      transition: all 0.2s;
    }
    input:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1); }
    button { 
      padding: 0.75rem 1rem; 
      border-radius: 0.375rem; 
      font-weight: 500; 
      cursor: pointer; 
      transition: all 0.2s;
      border: none;
    }
    .btn-primary { 
      background: linear-gradient(135deg, #f97316, #dc2626); 
      color: white; 
    }
    .btn-primary:hover { 
      background: linear-gradient(135deg, #ea580c, #b91c1c); 
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
    }
    .btn-secondary { 
      background: white; 
      border: 1px solid #e2e8f0; 
      color: #374151; 
    }
    .btn-secondary:hover { background-color: #f8fafc; }
    .card { 
      background: rgba(255, 255, 255, 0.8); 
      backdrop-filter: blur(4px); 
      border-radius: 0.75rem; 
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); 
      border: none;
    }
  `;
}
// Get login page body
function getLoginBody(): string {
  return `
  <div class="min-h-screen bg-gradient flex items-center justify-center p-4">
    <!-- Background decorations -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter opacity-70 animate-blob"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-red-200 rounded-full mix-blend-multiply filter opacity-70 animate-blob animation-delay-2000"></div>
      <div class="absolute top-40 left-40 w-80 h-80 bg-yellow-200 rounded-full mix-blend-multiply filter opacity-70 animate-blob animation-delay-4000"></div>
    </div>

    <div class="w-full max-w-md relative z-10">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-orange shadow-lg mb-4">
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
      <div class="card py-6">
        <div class="text-center pb-6 px-6">
          <h2 class="text-xl font-semibold text-slate-900">Bem-vindo de volta</h2>
          <p class="text-sm text-slate-600">Entre na sua conta para continuar</p>
        </div>
        <div class="px-6">
          <form class="space-y-4" onsubmit="handleLogin(event)">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="email">E-mail</label>
              <input type="email" id="email" placeholder="seu@email.com" required />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="password">Senha</label>
              <div class="relative">
                <input type="password" id="password" placeholder="••••••••" required style="padding-right: 2.5rem;" />
                <button type="button" class="absolute right-0 top-0 h-11 px-3 bg-white border-0 cursor-pointer" onclick="togglePassword()">
                  <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" class="w-full h-11 btn-primary font-medium">
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
            <button type="button" class="w-full h-11 btn-secondary font-medium" onclick="handleDemoLogin()">
              <div class="flex items-center justify-center space-x-2">
                <svg class="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path>
                  <path d="M20 2v4"></path><path d="M22 4h-4"></path>
                  <circle cx="4" cy="20" r="2"></circle>
                </svg>
                <span>Testar Conta Demo</span>
              </div>
            </button>
          </form>
        </div>
      </div>

      <!-- Features -->
      <div class="mt-8 text-center">
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
  `;
}

// Get login page script
function getLoginScript(): string {
  return `
  <script>
    // Notification system for login page
    function showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = \`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 \${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-blue-500 text-white'
      }\`;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    function togglePassword() {
      const passwordInput = document.getElementById('password');
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
    }
    
    function handleDemoLogin() {
      document.getElementById('email').value = 'demo@gastronomos.com';
      document.getElementById('password').value = 'demo123';
      showNotification('Credenciais de demonstração preenchidas!', 'info');
    }
    
    async function handleLogin(event) {
      event.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      const submitButton = event.target.querySelector('button[type="submit"]');
      const originalContent = submitButton.innerHTML;
      submitButton.innerHTML = '<div class="flex items-center justify-center space-x-2"><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Entrando...</span></div>';
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
          showNotification('Login realizado com sucesso! Redirecionando...', 'success');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        } else {
          const error = await response.json();
          showNotification('Erro no login: ' + (error.message || 'Credenciais inválidas'), 'error');
        }
      } catch (error) {
        showNotification('Erro de conexão: ' + error.message, 'error');
      } finally {
        submitButton.innerHTML = originalContent;
        submitButton.disabled = false;
      }
    }
  </script>
  `;
}
// Build the complete dashboard with all original features including Framer Motion animations
function buildCompleteDashboard(): string {
  return buildCompleteDashboardForRoute('/dashboard');
}

// Build dashboard for specific route
function buildCompleteDashboardForRoute(route: string): string {
  const parts = [];
  
  // DOCTYPE and HTML opening with Next.js comment
  parts.push('<!DOCTYPE html><!--_c7oY09Je_xs_Q91o9S9O-->');
  parts.push('<html lang="pt-BR" class="h-full">');
  
  // Head section with all original meta tags and scripts
  parts.push('<head>');
  parts.push('<meta charSet="utf-8"/>');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1"/>');
  parts.push('<title>GastronomOS - O Sistema Operacional do seu Restaurante</title>');
  parts.push('<meta name="description" content="O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises"/>');
  parts.push('<meta name="keywords" content="restaurante,gestão,estoque,PDV,gastronomia"/>');
  parts.push('<link rel="icon" href="/favicon.ico" sizes="256x256" type="image/x-icon"/>');
  
  // Add complete CSS styles
  parts.push('<style>');
  parts.push(getCompleteDashboardStyles());
  parts.push('</style>');
  
  parts.push('</head>');
  
  // Body with original classes
  parts.push('<body class="inter_5972bc34-module__OU16Qa__className h-full antialiased">');
  parts.push('<div hidden=""><!--$--><!--/$--></div>');
  
  // Main layout
  parts.push('<div class="flex h-screen bg-slate-50 overflow-hidden">');
  
  // Sidebar with active route
  parts.push(buildSidebarForRoute(route));
  
  // Main content area with route-specific content
  parts.push(buildMainContentForRoute(route));
  
  parts.push('</div>'); // Close main layout
  
  // Add JavaScript for functionality
  parts.push(buildDashboardScript());
  
  parts.push('</body>');
  parts.push('</html>');
  
  return parts.join('\n');
}
// Build the complete sidebar with all navigation items
function buildSidebar(): string {
  return buildSidebarForRoute('/dashboard');
}

// Build sidebar for specific route
function buildSidebarForRoute(currentRoute: string): string {
  const parts = [];
  
  parts.push('<div class="relative sidebar-container" style="opacity:0;transform:translateX(-100%)">');
  parts.push('<div class="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl relative w-64 sm:w-72">');
  
  // Header
  parts.push('<div class="flex h-14 sm:h-16 items-center justify-center border-b border-slate-700/50 bg-slate-900/50 px-3">');
  parts.push('<div class="flex items-center space-x-3 w-full">');
  parts.push('<div class="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shrink-0">');
  parts.push('<svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">');
  parts.push('<path d="M6 2v6a6 6 0 0 0 12 0V2"></path>');
  parts.push('<path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path>');
  parts.push('<path d="M14 2v4"></path><path d="M16 2v4"></path>');
  parts.push('<path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path>');
  parts.push('</svg>');
  parts.push('</div>');
  parts.push('<div class="min-w-0 flex-1">');
  parts.push('<h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent truncate">GastronomOS</h1>');
  parts.push('<p class="text-xs text-slate-400 truncate">Gestão de Restaurante</p>');
  parts.push('</div>');
  parts.push('</div>');
  parts.push('</div>');
  
  // Navigation
  parts.push('<nav class="flex-1 space-y-1 p-3 sm:p-4 overflow-y-auto">');
  
  // Navigation items with proper hrefs
  const navItems = [
    { name: 'Painel', href: '/dashboard', icon: 'house' },
    { name: 'Estoque', href: '/inventory', icon: 'package', hasSubmenu: true, submenu: [
      { name: 'Produtos', href: '/inventory/products' },
      { name: 'Categorias', href: '/inventory/categories' },
      { name: 'Estoque', href: '/inventory/stock' }
    ]},
    { name: 'Compras', href: '/purchasing', icon: 'shopping-cart', hasSubmenu: true, submenu: [
      { name: 'Pedidos', href: '/purchasing/orders' },
      { name: 'Recebimentos', href: '/purchasing/receipts' }
    ]},
    { name: 'Transferências', href: '/transfers', icon: 'arrow-right-left' },
    { name: 'Alocações', href: '/allocations', icon: 'allocations', hasSubmenu: true, submenu: [
      { name: 'Alocações Atuais', href: '/allocations/current' }
    ]},
    { name: 'Análises', href: '/analytics', icon: 'chart-column' },
    { name: 'Locais', href: '/locations', icon: 'map-pin' },
    { name: 'Usuários', href: '/users', icon: 'users' },
    { name: 'Configurações', href: '/settings', icon: 'settings' }
  ];
  
  navItems.forEach((item, index) => {
    const isActive = currentRoute === item.href || currentRoute.startsWith(item.href + '/');
    
    parts.push(`<div class="nav-item" style="opacity:0;transform:translateX(-20px);animation-delay:${(index + 1) * 100}ms"><div tabindex="0">`);
    
    const activeClass = isActive 
      ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 shadow-lg shadow-orange-500/10'
      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white';
    
    parts.push(`<a class="nav-link group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] ${activeClass}" href="${item.href}" data-route="${item.href}">`);
    
    // Add icon
    parts.push(getNavigationIcon(item.icon, isActive));
    
    parts.push(`<span class="ml-3 flex-1 truncate">${item.name}</span>`);
    
    // Add chevron if has submenu
    if (item.hasSubmenu) {
      const submenuOpen = currentRoute.startsWith(item.href + '/');
      parts.push(`<div class="ml-auto submenu-chevron transition-transform duration-200 ${submenuOpen ? 'rotate-90' : ''}">`);
      parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4 text-slate-400" aria-hidden="true">');
      parts.push('<path d="m9 18 6-6-6-6"></path>');
      parts.push('</svg>');
      parts.push('</div>');
    }
    
    parts.push('</a>');
    
    // Add submenu if exists
    if (item.hasSubmenu && item.submenu) {
      const submenuOpen = currentRoute.startsWith(item.href + '/');
      const maxHeight = submenuOpen ? `${item.submenu.length * 40}px` : '0px';
      parts.push(`<div class="submenu ml-6 mt-1 space-y-1 overflow-hidden transition-all duration-300" style="max-height: ${maxHeight}">`);
      item.submenu.forEach(subItem => {
        const subActive = currentRoute === subItem.href;
        const subActiveClass = subActive ? 'text-orange-300 bg-slate-700/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/30';
        parts.push(`<a href="${subItem.href}" data-route="${subItem.href}" class="nav-link block px-3 py-2 text-sm ${subActiveClass} rounded-lg transition-colors duration-200">${subItem.name}</a>`);
      });
      parts.push('</div>');
    }
    
    parts.push('</div></div>');
  });
  
  parts.push('</nav>');
  
  // User profile section
  parts.push('<div class="border-t border-slate-700/50 p-3 sm:p-4">');
  parts.push('<div class="flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 transition-colors hover:bg-slate-700/50 cursor-pointer min-h-[52px]" tabindex="0">');
  parts.push('<div class="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">');
  parts.push('<span class="text-sm font-semibold text-white">JS</span>');
  parts.push('</div>');
  parts.push('<div class="flex-1 min-w-0">');
  parts.push('<p class="text-sm font-medium text-white truncate">João Silva</p>');
  parts.push('<p class="text-xs text-slate-400 truncate">Gerente de Restaurante</p>');
  parts.push('</div>');
  parts.push('</div>');
  parts.push('</div>');
  
  parts.push('</div>'); // Close sidebar
  parts.push('</div>'); // Close relative wrapper
  
  return parts.join('\n');
}
// Get navigation icons
function getNavigationIcon(iconName: string, active: boolean = false): string {
  const baseClass = active 
    ? 'h-5 w-5 flex-shrink-0 transition-colors text-orange-400'
    : 'h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white';
  
  const icons: Record<string, string> = {
    'house': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house ${baseClass}" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>`,
    'package': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package ${baseClass}" aria-hidden="true"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><path d="m7.5 4.27 9 5.15"></path></svg>`,
    'shopping-cart': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart ${baseClass}" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>`,
    'arrow-right-left': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-left ${baseClass}" aria-hidden="true"><path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path></svg>`,
    'allocations': `<svg class="${baseClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11V7a4 4 0 0 0-8 0v4"></path><path d="M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9"></path><path d="M16 11c2.5 2.5 2.5 6.5 0 9s-6.5 2.5-9 0-2.5-6.5 0-9"></path></svg>`,
    'chart-column': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-column ${baseClass}" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>`,
    'map-pin': `<svg class="${baseClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    'users': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users ${baseClass}" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>`,
    'settings': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings ${baseClass}" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg>`
  };
  
  return icons[iconName] || '';
}

// Build the main content area with header and dashboard content
function buildMainContent(): string {
  return buildMainContentForRoute('/dashboard');
}

// Build main content for specific route
function buildMainContentForRoute(route: string): string {
  const parts = [];
  
  parts.push('<div class="flex flex-1 flex-col overflow-hidden min-w-0">');
  
  // Get route configuration
  const routeConfig = getRouteConfig(route);
  
  // Header
  parts.push('<header class="header-container flex h-14 sm:h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-3 sm:px-6 shadow-sm" style="opacity:0;transform:translateY(-20px)">');
  
  // Left side of header
  parts.push('<div class="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">');
  
  // Mobile menu button
  parts.push('<button id="mobile-menu-btn" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] hover:bg-accent hover:text-accent-foreground rounded-md gap-1.5 lg:hidden h-9 w-9 p-0 shrink-0">');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">');
  parts.push('<path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path>');
  parts.push('</svg>');
  parts.push('</button>');
  
  // Page title (route-specific)
  parts.push('<div class="min-w-0 flex-1">');
  parts.push(`<h1 id="page-title" class="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 truncate">${routeConfig.title}</h1>`);
  parts.push(`<p id="page-subtitle" class="text-xs sm:text-sm text-slate-500 hidden sm:block truncate">${routeConfig.subtitle}</p>`);
  parts.push('</div>');
  parts.push('</div>');
  
  // Search bar (hidden on mobile)
  parts.push('<div class="hidden lg:flex flex-1 max-w-md mx-8">');
  parts.push('<div class="relative w-full">');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true">');
  parts.push('<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>');
  parts.push('</svg>');
  parts.push('<input id="search-input" class="h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors" placeholder="Buscar produtos, pedidos, transferências..."/>');
  parts.push('</div>');
  parts.push('</div>');
  
  // Right side of header with buttons
  parts.push(buildHeaderButtons());
  
  parts.push('</header>');
  
  // Main dashboard content
  parts.push('<main class="flex-1 overflow-y-auto">');
  parts.push('<div id="main-content" class="h-full content-container" style="opacity:0;transform:translateY(20px)">');
  parts.push('<div class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">');
  
  // Route-specific content
  parts.push('<div id="dynamic-content">');
  parts.push(routeConfig.content);
  parts.push('</div>');
  
  parts.push('</div>'); // Close container
  parts.push('</div>'); // Close main content wrapper
  parts.push('</main>');
  
  parts.push('</div>'); // Close main content area
  
  return parts.join('\n');
}

// Get route configuration
function getRouteConfig(route: string): { title: string; subtitle: string; content: string } {
  const routes: Record<string, { title: string; subtitle: string; content: string }> = {
    '/dashboard': {
      title: 'Painel',
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
    '/purchasing/orders': {
      title: 'Pedidos de Compra',
      subtitle: 'Crie e acompanhe pedidos de compra',
      content: buildOrdersContent()
    },
    '/purchasing/receipts': {
      title: 'Recebimentos',
      subtitle: 'Registre recebimentos de mercadorias',
      content: buildReceiptsContent()
    },
    '/transfers': {
      title: 'Transferências',
      subtitle: 'Transfira produtos entre locais',
      content: buildTransfersContent()
    },
    '/allocations': {
      title: 'Alocações',
      subtitle: 'Gerencie alocações de produtos',
      content: buildAllocationsContent()
    },
    '/allocations/current': {
      title: 'Alocações Atuais',
      subtitle: 'Visualize alocações em andamento',
      content: buildCurrentAllocationsContent()
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
// Build header buttons (search, theme, notifications, user menu)
function buildHeaderButtons(): string {
  const parts = [];
  
  parts.push('<div class="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 shrink-0">');
  
  // Mobile search button
  parts.push('<button data-slot="button" data-variant="ghost" data-size="sm" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[>svg]:px-2.5 lg:hidden h-9 w-9 p-0">');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search h-4 w-4" aria-hidden="true">');
  parts.push('<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>');
  parts.push('</svg>');
  parts.push('</button>');
  
  // Theme toggle button
  parts.push('<button data-slot="button" data-variant="ghost" data-size="sm" class="items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[>svg]:px-2.5 hidden sm:flex h-9 w-9 p-0">');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-4 w-4" aria-hidden="true">');
  parts.push('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>');
  parts.push('</svg>');
  parts.push('</button>');
  
  // Notifications button with badge
  parts.push('<button data-slot="dropdown-menu-trigger" data-variant="ghost" data-size="sm" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[>svg]:px-2.5 relative h-9 w-9 p-0" type="button" id="radix-_R_3sllfivb_" aria-haspopup="menu" aria-expanded="false" data-state="closed">');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell h-4 w-4" aria-hidden="true">');
  parts.push('<path d="M10.268 21a2 2 0 0 0 3.464 0"></path>');
  parts.push('<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>');
  parts.push('</svg>');
  parts.push('<span data-slot="badge" class="border font-medium whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 text-xs flex items-center justify-center">3</span>');
  parts.push('</button>');
  
  // User menu button
  parts.push('<button data-slot="dropdown-menu-trigger" data-variant="ghost" data-size="default" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 px-4 py-2 has-[>svg]:px-3 relative h-8 w-8 sm:h-auto sm:w-auto sm:px-2 rounded-full sm:rounded-md" type="button" id="radix-_R_4sllfivb_" aria-haspopup="menu" aria-expanded="false" data-state="closed">');
  parts.push('<div class="flex items-center space-x-2">');
  parts.push('<span class="relative flex shrink-0 overflow-hidden rounded-full h-7 w-7 sm:h-8 sm:w-8">');
  parts.push('<span class="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs sm:text-sm">JD</span>');
  parts.push('</span>');
  parts.push('<div class="hidden xl:block text-left">');
  parts.push('<p class="text-sm font-medium text-slate-900">John Doe</p>');
  parts.push('<p class="text-xs text-slate-500">Manager</p>');
  parts.push('</div>');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-3 w-3 text-slate-400 hidden sm:block" aria-hidden="true">');
  parts.push('<path d="m6 9 6 6 6-6"></path>');
  parts.push('</svg>');
  parts.push('</div>');
  parts.push('</button>');
  
  parts.push('</div>');
  
  return parts.join('\n');
}

// Build welcome banner with animations
function buildWelcomeBanner(): string {
  const parts = [];
  
  parts.push('<div class="welcome-banner bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden" style="opacity:0;transform:translateY(20px)">');
  parts.push('<div class="relative z-10">');
  parts.push('<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Bem-vindo de volta, João! 👋</h1>');
  parts.push('<p class="text-orange-100 text-sm sm:text-base lg:text-lg">Aqui está o que está acontecendo com suas operações do restaurante hoje.</p>');
  parts.push('</div>');
  
  // Background decorations
  parts.push('<div class="absolute -right-4 -top-4 sm:-right-8 sm:-top-8 h-20 w-20 sm:h-32 sm:w-32 rounded-full bg-white/10"></div>');
  parts.push('<div class="absolute -right-8 -bottom-8 sm:-right-16 sm:-bottom-16 h-32 w-32 sm:h-48 sm:w-48 rounded-full bg-white/5"></div>');
  
  // Restaurant icon
  parts.push('<svg class="absolute right-4 top-4 sm:right-8 sm:top-8 h-8 w-8 sm:h-16 sm:w-16 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">');
  parts.push('<path d="M6 2v6a6 6 0 0 0 12 0V2"></path>');
  parts.push('<path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path>');
  parts.push('<path d="M14 2v4"></path><path d="M16 2v4"></path>');
  parts.push('<path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path>');
  parts.push('</svg>');
  
  parts.push('</div>');
  
  return parts.join('\n');
}
// Build the complete stats grid with all original styling and animations
function buildStatsGrid(): string {
  const parts = [];
  
  parts.push('<div class="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">');
  
  // Stats data
  const stats = [
    {
      title: 'Total de Produtos',
      value: '2.847',
      change: '+12%',
      trend: '↗ vs mês passado',
      color: 'blue',
      secondaryColor: 'cyan',
      icon: 'package',
      positive: true
    },
    {
      title: 'Pedidos Ativos', 
      value: '156',
      change: '+8%',
      trend: '↗ vs semana passada',
      color: 'green',
      secondaryColor: 'emerald',
      icon: 'shopping-cart',
      positive: true
    },
    {
      title: 'Transferências Pendentes',
      value: '23', 
      change: '-15%',
      trend: '↘ vs ontem',
      color: 'orange',
      secondaryColor: 'red',
      icon: 'arrow-right-left',
      positive: false
    },
    {
      title: 'Receita Mensal',
      value: 'R$ 47.892',
      change: '+23%', 
      trend: '↗ vs mês passado',
      color: 'purple',
      secondaryColor: 'indigo',
      icon: 'dollar-sign',
      positive: true
    }
  ];
  
  stats.forEach(stat => {
    parts.push('<div style="opacity:0;transform:translateY(20px)">');
    parts.push('<div tabindex="0">');
    parts.push('<div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 relative overflow-hidden border-0 shadow-lg">');
    parts.push('<div data-slot="card-content" class="p-6">');
    
    // Background gradient
    parts.push(`<div class="absolute inset-0 bg-gradient-to-br opacity-5 from-${stat.color}-500 to-${stat.secondaryColor}-500"></div>`);
    
    // Header with icon and badge
    parts.push('<div class="flex items-center justify-between mb-4">');
    parts.push(`<div class="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-${stat.color}-500 to-${stat.secondaryColor}-500">`);
    parts.push(getStatIcon(stat.icon));
    parts.push('</div>');
    
    // Change badge
    const badgeClass = stat.positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    parts.push(`<span data-slot="badge" class="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent [a&]:hover:bg-secondary/90 font-medium ${badgeClass}">${stat.change}</span>`);
    parts.push('</div>');
    
    // Content
    parts.push('<div class="space-y-2">');
    parts.push(`<h3 class="text-sm font-medium text-slate-600">${stat.title}</h3>`);
    parts.push('<div class="flex items-baseline space-x-2">');
    parts.push(`<span class="text-3xl font-bold text-slate-900">${stat.value}</span>`);
    parts.push('</div>');
    parts.push(`<p class="text-xs text-slate-500">${stat.trend}</p>`);
    parts.push('</div>');
    
    // Background decorations
    parts.push('<div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent"></div>');
    parts.push('<div class="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-tl from-white/10 to-transparent"></div>');
    
    parts.push('</div>'); // Close card-content
    parts.push('</div>'); // Close card
    parts.push('</div>'); // Close tabindex wrapper
    parts.push('</div>'); // Close animation wrapper
  });
  
  parts.push('</div>'); // Close grid
  
  return parts.join('\n');
}

// Get stat icons for dashboard cards
function getStatIcon(iconName: string): string {
  const icons: Record<string, string> = {
    'package': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package h-6 w-6 text-white" aria-hidden="true"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><path d="m7.5 4.27 9 5.15"></path></svg>',
    'shopping-cart': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart h-6 w-6 text-white" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>',
    'arrow-right-left': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-left h-6 w-6 text-white" aria-hidden="true"><path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path></svg>',
    'dollar-sign': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dollar-sign h-6 w-6 text-white" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>'
  };
  
  return icons[iconName] || '';
}

// Build dashboard content (default view)
function buildDashboardContent(): string {
  const parts = [];
  
  // Welcome banner
  parts.push(buildWelcomeBanner());
  
  // Stats grid
  parts.push(buildStatsGrid());
  
  // Recent activity section
  parts.push('<div class="activity-section bg-white rounded-xl shadow-lg p-6" style="opacity:0;transform:translateY(20px)">');
  parts.push('<h2 class="text-lg font-semibold text-slate-900 mb-4">Atividade Recente</h2>');
  parts.push('<div class="space-y-3">');
  
  const activities = [
    { type: 'order', message: 'Novo pedido #1234 recebido', time: '2 min atrás', icon: 'shopping-cart' },
    { type: 'transfer', message: 'Transferência para Filial Centro concluída', time: '15 min atrás', icon: 'arrow-right-left' },
    { type: 'product', message: '5 produtos adicionados ao estoque', time: '1 hora atrás', icon: 'package' },
    { type: 'user', message: 'Novo usuário cadastrado: Maria Santos', time: '2 horas atrás', icon: 'users' }
  ];
  
  activities.forEach(activity => {
    parts.push('<div class="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">');
    parts.push(`<div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">`);
    parts.push(getActivityIcon(activity.icon));
    parts.push('</div>');
    parts.push('<div class="flex-1 min-w-0">');
    parts.push(`<p class="text-sm font-medium text-slate-900">${activity.message}</p>`);
    parts.push(`<p class="text-xs text-slate-500">${activity.time}</p>`);
    parts.push('</div>');
    parts.push('</div>');
  });
  
  parts.push('</div>');
  parts.push('</div>');
  
  return parts.join('\n');
}

// Build inventory content
function buildInventoryContent(): string {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="window.location.href='/inventory/products'">
        <div class="flex items-center space-x-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
              <path d="M12 22V12"></path>
              <polyline points="3.29 7 12 12 20.71 7"></polyline>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Produtos</h3>
            <p class="text-sm text-slate-600">Gerencie seu catálogo</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="window.location.href='/inventory/categories'">
        <div class="flex items-center space-x-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <svg class="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
              <path d="M8 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2H8V5z"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Categorias</h3>
            <p class="text-sm text-slate-600">Organize por categorias</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="window.location.href='/inventory/stock'">
        <div class="flex items-center space-x-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
            <svg class="h-6 w-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
              <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
              <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Controle de Estoque</h3>
            <p class="text-sm text-slate-600">Monitore níveis</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildProductsContent(): string {
  return `
    <div class="card card-gradient">
      <div class="flex items-center justify-between p-6 border-b border-slate-200">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Lista de Produtos</h2>
          <p class="text-sm text-slate-600 mt-1">Gerencie seu catálogo de produtos</p>
        </div>
        <button onclick="openProductModal()" class="btn btn-primary hover-glow">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14m-7-7h14"></path>
          </svg>
          <span>Adicionar Produto</span>
        </button>
      </div>
      
      <!-- Search and filters -->
      <div class="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1 relative">
            <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>
            </svg>
            <input type="text" id="product-search" placeholder="Buscar produtos por nome, SKU ou categoria..." 
                   class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all">
          </div>
          <select id="category-filter" class="px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm min-w-[200px]">
            <option value="">Todas as categorias</option>
          </select>
          <button onclick="loadProducts()" class="btn btn-secondary hover-lift">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18l-2 13H5L3 6z"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Filtrar
          </button>
        </div>
      </div>
      
      <!-- Products table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <tr>
              <th class="text-left py-4 px-6 font-semibold text-slate-700">
                <div class="flex items-center space-x-2">
                  <span>Produto</span>
                  <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 9l4-4 4 4"></path><path d="M16 15l-4 4-4-4"></path>
                  </svg>
                </div>
              </th>
              <th class="text-left py-4 px-6 font-semibold text-slate-700">Categoria</th>
              <th class="text-left py-4 px-6 font-semibold text-slate-700">Preço</th>
              <th class="text-left py-4 px-6 font-semibold text-slate-700">Estoque</th>
              <th class="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
              <th class="text-right py-4 px-6 font-semibold text-slate-700">Ações</th>
            </tr>
          </thead>
          <tbody id="products-table-body" class="divide-y divide-slate-100">
            <tr>
              <td colspan="6" class="text-center py-16 text-slate-500">
                <div class="flex flex-col items-center animate-pulse">
                  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-6"></div>
                  <p class="text-lg font-medium">Carregando produtos...</p>
                  <p class="text-sm">Aguarde enquanto buscamos seus dados</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Enhanced Pagination -->
      <div id="products-pagination" class="p-6 border-t border-slate-200 bg-gradient-to-r from-white to-slate-50">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-sm text-slate-600">
            Mostrando <span id="products-showing" class="font-semibold text-slate-900">0</span> de <span id="products-total" class="font-semibold text-slate-900">0</span> produtos
          </div>
          <div class="flex items-center space-x-2">
            <button id="products-prev" onclick="changePage(-1)" class="btn btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"></path>
              </svg>
              Anterior
            </button>
            <div class="flex items-center space-x-1">
              <span class="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-md font-medium" id="current-page">1</span>
            </div>
            <button id="products-next" onclick="changePage(1)" class="btn btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed">
              Próximo
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Enhanced Product Modal -->
    <div id="product-modal" class="fixed inset-0 bg-black/60 backdrop-blur-sm hidden z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="card card-gradient max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div class="p-6 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-red-50">
          <div class="flex items-center justify-between">
            <div>
              <h3 id="product-modal-title" class="text-xl font-semibold text-slate-900">Adicionar Produto</h3>
              <p class="text-sm text-slate-600 mt-1">Preencha as informações do produto</p>
            </div>
            <button onclick="closeProductModal()" class="btn btn-ghost p-2 hover:bg-red-100 hover:text-red-600 rounded-full">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <form id="product-form" class="p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-slate-700">Nome do Produto *</label>
              <input type="text" id="product-name" required 
                     class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all"
                     placeholder="Ex: Hambúrguer Artesanal">
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-slate-700">SKU</label>
              <input type="text" id="product-sku" 
                     class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all"
                     placeholder="Ex: HAMB-001">
            </div>
          </div>
          
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-slate-700">Descrição</label>
            <textarea id="product-description" rows="3" 
                      class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all resize-none"
                      placeholder="Descreva o produto..."></textarea>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-slate-700">Categoria *</label>
              <select id="product-category" required 
                      class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all">
                <option value="">Selecione uma categoria</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-slate-700">Preço (R$)</label>
              <input type="number" id="product-price" step="0.01" min="0" 
                     class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all"
                     placeholder="0,00">
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-slate-700">Unidade</label>
              <select id="product-unit" 
                      class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm transition-all">
                <option value="un">Unidade</option>
                <option value="kg">Quilograma</option>
                <option value="g">Grama</option>
                <option value="l">Litro</option>
                <option value="ml">Mililitro</option>
              </select>
            </div>
          </div>
          
          <div class="flex items-center space-x-4 p-4 bg-slate-50 rounded-lg">
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" id="product-active" checked 
                     class="rounded border-slate-300 text-orange-500 focus:ring-orange-500 focus:ring-2">
              <span class="ml-3 text-sm font-medium text-slate-700">Produto ativo</span>
            </label>
          </div>
          
          <div class="flex justify-end space-x-3 pt-6 border-t border-slate-200">
            <button type="button" onclick="closeProductModal()" class="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary hover-glow">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17,21 17,13 7,13 7,21"></polyline>
                <polyline points="7,3 7,8 15,8"></polyline>
              </svg>
              <span id="product-submit-text">Salvar Produto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function buildCategoriesContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg">
      <div class="flex items-center justify-between p-6 border-b border-slate-200">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Categorias de Produtos</h2>
          <p class="text-sm text-slate-600 mt-1">Organize seus produtos por categorias</p>
        </div>
        <button onclick="openCategoryModal()" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14m-7-7h14"></path>
          </svg>
          <span>Nova Categoria</span>
        </button>
      </div>
      
      <!-- Categories grid -->
      <div id="categories-grid" class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="flex items-center justify-center p-8 text-slate-500">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-4 mx-auto"></div>
              <p>Carregando categorias...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Category Modal -->
    <div id="category-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl max-w-md w-full">
        <div class="p-6 border-b border-slate-200">
          <div class="flex items-center justify-between">
            <h3 id="category-modal-title" class="text-lg font-semibold text-slate-900">Nova Categoria</h3>
            <button onclick="closeCategoryModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <form id="category-form" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Nome da Categoria</label>
            <input type="text" id="category-name" required class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Descrição</label>
            <textarea id="category-description" rows="3" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Categoria Pai</label>
            <select id="category-parent" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
              <option value="">Nenhuma (categoria principal)</option>
            </select>
          </div>
          
          <div class="flex items-center space-x-4">
            <label class="flex items-center">
              <input type="checkbox" id="category-active" checked class="rounded border-slate-300 text-orange-500 focus:ring-orange-500">
              <span class="ml-2 text-sm text-slate-700">Categoria ativa</span>
            </label>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button type="button" onclick="closeCategoryModal()" class="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
              <span id="category-submit-text">Salvar Categoria</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function buildStockContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-6">Controle de Estoque</h2>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
        <p>Monitore seus níveis de estoque aqui.</p>
      </div>
    </div>
  `;
}

function buildPurchasingContent(): string {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="window.location.href='/purchasing/orders'">
        <div class="flex items-center space-x-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <svg class="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Pedidos</h3>
            <p class="text-sm text-slate-600">Gerencie pedidos de compra</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="window.location.href='/purchasing/receipts'">
        <div class="flex items-center space-x-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <svg class="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Recebimentos</h3>
            <p class="text-sm text-slate-600">Registre recebimentos</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildOrdersContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-slate-900">Pedidos de Compra</h2>
        <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
          Novo Pedido
        </button>
      </div>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="8" cy="21" r="1"></circle>
          <circle cx="19" cy="21" r="1"></circle>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
        </svg>
        <p>Nenhum pedido de compra ainda.</p>
      </div>
    </div>
  `;
}

function buildReceiptsContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-6">Recebimentos</h2>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
        <p>Nenhum recebimento registrado.</p>
      </div>
    </div>
  `;
}

function buildTransfersContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-slate-900">Transferências</h2>
        <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
          Nova Transferência
        </button>
      </div>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m16 3 4 4-4 4"></path>
          <path d="M20 7H4"></path>
          <path d="m8 21-4-4 4-4"></path>
          <path d="M4 17h16"></path>
        </svg>
        <p>Nenhuma transferência em andamento.</p>
      </div>
    </div>
  `;
}

function buildAllocationsContent(): string {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="window.location.href='/allocations/current'">
        <div class="flex items-center space-x-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <svg class="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 11V7a4 4 0 0 0-8 0v4"></path>
              <path d="M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Alocações Atuais</h3>
            <p class="text-sm text-slate-600">Visualize alocações ativas</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildCurrentAllocationsContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-6">Alocações Atuais</h2>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 11V7a4 4 0 0 0-8 0v4"></path>
          <path d="M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9"></path>
        </svg>
        <p>Nenhuma alocação ativa no momento.</p>
      </div>
    </div>
  `;
}

function buildAnalyticsContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-6">Análises e Relatórios</h2>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v16a2 2 0 0 0 2 2h16"></path>
          <path d="M18 17V9"></path>
          <path d="M13 17V5"></path>
          <path d="M8 17v-3"></path>
        </svg>
        <p>Relatórios e métricas em desenvolvimento.</p>
      </div>
    </div>
  `;
}

function buildLocationsContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-slate-900">Locais</h2>
        <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
          Adicionar Local
        </button>
      </div>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <p>Nenhum local cadastrado ainda.</p>
      </div>
    </div>
  `;
}

function buildUsersContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-slate-900">Usuários</h2>
        <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
          Adicionar Usuário
        </button>
      </div>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <p>Gerencie usuários e permissões do sistema.</p>
      </div>
    </div>
  `;
}

function buildSettingsContent(): string {
  return `
    <div class="bg-white rounded-xl shadow-lg p-6">
      <h2 class="text-xl font-semibold text-slate-900 mb-6">Configurações do Sistema</h2>
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <p>Configurações do sistema em desenvolvimento.</p>
      </div>
    </div>
  `;
}

// Build JavaScript functionality for the dashboard
function buildDashboardScript(): string {
  return `
<script>
// API Client for backend integration with demo data fallback
class APIClient {
  constructor() {
    this.baseURL = '/api/v1';
    this.token = localStorage.getItem('auth_token');
    this.demoMode = false;
    this.initializeDemoData();
  }

  initializeDemoData() {
    // Demo products data
    this.demoProducts = [
      {
        id: '1',
        name: 'Hambúrguer Artesanal',
        sku: 'HAMB-001',
        description: 'Hambúrguer artesanal com carne bovina, queijo cheddar e molho especial',
        categoryId: '1',
        category: { id: '1', name: 'Hambúrgueres' },
        price: 25.90,
        unit: 'un',
        stock: 15,
        active: true
      },
      {
        id: '2',
        name: 'Pizza Margherita',
        sku: 'PIZZA-001',
        description: 'Pizza tradicional com molho de tomate, mussarela e manjericão',
        categoryId: '2',
        category: { id: '2', name: 'Pizzas' },
        price: 32.50,
        unit: 'un',
        stock: 8,
        active: true
      },
      {
        id: '3',
        name: 'Refrigerante Cola',
        sku: 'REF-001',
        description: 'Refrigerante sabor cola 350ml',
        categoryId: '3',
        category: { id: '3', name: 'Bebidas' },
        price: 4.50,
        unit: 'un',
        stock: 45,
        active: true
      },
      {
        id: '4',
        name: 'Batata Frita',
        sku: 'ACOMP-001',
        description: 'Porção de batata frita crocante',
        categoryId: '4',
        category: { id: '4', name: 'Acompanhamentos' },
        price: 12.00,
        unit: 'un',
        stock: 3,
        active: true
      },
      {
        id: '5',
        name: 'Salada Caesar',
        sku: 'SAL-001',
        description: 'Salada com alface, croutons, parmesão e molho caesar',
        categoryId: '5',
        category: { id: '5', name: 'Saladas' },
        price: 18.90,
        unit: 'un',
        stock: 0,
        active: false
      }
    ];

    // Demo categories data
    this.demoCategories = [
      { id: '1', name: 'Hambúrgueres', description: 'Hambúrgueres artesanais', active: true, productCount: 1 },
      { id: '2', name: 'Pizzas', description: 'Pizzas tradicionais e especiais', active: true, productCount: 1 },
      { id: '3', name: 'Bebidas', description: 'Refrigerantes, sucos e águas', active: true, productCount: 1 },
      { id: '4', name: 'Acompanhamentos', description: 'Batatas, anéis de cebola e outros', active: true, productCount: 1 },
      { id: '5', name: 'Saladas', description: 'Saladas frescas e saudáveis', active: true, productCount: 1 }
    ];
  }

  async request(endpoint, options = {}) {
    const url = \`\${this.baseURL}\${endpoint}\`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = \`Bearer \${this.token}\`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        // If API is not available, switch to demo mode
        if (response.status >= 500 || !navigator.onLine) {
          console.log('API not available, switching to demo mode');
          this.demoMode = true;
          return this.handleDemoRequest(endpoint, options);
        }
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }

      return await response.json();
    } catch (error) {
      // If network error, switch to demo mode
      console.log('Network error, switching to demo mode:', error);
      this.demoMode = true;
      return this.handleDemoRequest(endpoint, options);
    }
  }

  handleDemoRequest(endpoint, options) {
    // Simulate API delay
    return new Promise((resolve) => {
      setTimeout(() => {
        if (endpoint.includes('/products')) {
          if (options.method === 'POST') {
            const newProduct = {
              id: Date.now().toString(),
              ...JSON.parse(options.body),
              category: this.demoCategories.find(c => c.id === JSON.parse(options.body).categoryId)
            };
            this.demoProducts.push(newProduct);
            resolve({ data: { product: newProduct } });
          } else if (options.method === 'PUT') {
            const productId = endpoint.split('/').pop();
            const productIndex = this.demoProducts.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
              this.demoProducts[productIndex] = { ...this.demoProducts[productIndex], ...JSON.parse(options.body) };
              resolve({ data: { product: this.demoProducts[productIndex] } });
            }
          } else if (options.method === 'DELETE') {
            const productId = endpoint.split('/').pop();
            this.demoProducts = this.demoProducts.filter(p => p.id !== productId);
            resolve({ data: { message: 'Product deleted' } });
          } else {
            // GET request
            const params = new URLSearchParams(endpoint.split('?')[1] || '');
            let products = [...this.demoProducts];
            
            // Apply search filter
            const search = params.get('search');
            if (search) {
              products = products.filter(p => 
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
              );
            }
            
            // Apply category filter
            const categoryId = params.get('categoryId');
            if (categoryId) {
              products = products.filter(p => p.categoryId === categoryId);
            }
            
            resolve({ 
              data: { 
                products,
                pagination: {
                  page: 1,
                  limit: 10,
                  total: products.length,
                  totalPages: Math.ceil(products.length / 10)
                }
              } 
            });
          }
        } else if (endpoint.includes('/categories')) {
          if (options.method === 'POST') {
            const newCategory = {
              id: Date.now().toString(),
              ...JSON.parse(options.body),
              productCount: 0
            };
            this.demoCategories.push(newCategory);
            resolve({ data: { category: newCategory } });
          } else if (options.method === 'PUT') {
            const categoryId = endpoint.split('/').pop();
            const categoryIndex = this.demoCategories.findIndex(c => c.id === categoryId);
            if (categoryIndex !== -1) {
              this.demoCategories[categoryIndex] = { ...this.demoCategories[categoryIndex], ...JSON.parse(options.body) };
              resolve({ data: { category: this.demoCategories[categoryIndex] } });
            }
          } else if (options.method === 'DELETE') {
            const categoryId = endpoint.split('/').pop();
            this.demoCategories = this.demoCategories.filter(c => c.id !== categoryId);
            resolve({ data: { message: 'Category deleted' } });
          } else {
            resolve({ data: { categories: this.demoCategories } });
          }
        } else {
          resolve({ data: {} });
        }
      }, 300 + Math.random() * 500); // Simulate realistic API delay
    });
  }

  // Products API
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(\`/products\${queryString ? '?' + queryString : ''}\`);
  }

  async createProduct(data) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProduct(id, data) {
    return this.request(\`/products/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteProduct(id) {
    return this.request(\`/products/\${id}\`, {
      method: 'DELETE'
    });
  }

  // Categories API
  async getCategories(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(\`/categories\${queryString ? '?' + queryString : ''}\`);
  }

  async createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCategory(id, data) {
    return this.request(\`/categories/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCategory(id) {
    return this.request(\`/categories/\${id}\`, {
      method: 'DELETE'
    });
  }

  // Inventory API
  async getInventory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(\`/inventory\${queryString ? '?' + queryString : ''}\`);
  }

  // Users API
  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(\`/users\${queryString ? '?' + queryString : ''}\`);
  }

  async createUser(data) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Locations API
  async getLocations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(\`/locations\${queryString ? '?' + queryString : ''}\`);
  }

  async createLocation(data) {
    return this.request('/locations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

// Global API client instance
const api = new APIClient();

// Global state
let currentPage = 1;
let currentProducts = [];
let currentCategories = [];
let editingProductId = null;
let editingCategoryId = null;

// Notification system
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = \`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 \${
    type === 'success' ? 'bg-green-500 text-white' : 
    type === 'error' ? 'bg-red-500 text-white' : 
    'bg-blue-500 text-white'
  }\`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Products Management
async function loadProducts() {
  try {
    const searchTerm = document.getElementById('product-search')?.value || '';
    const categoryFilter = document.getElementById('category-filter')?.value || '';
    
    const params = {
      page: currentPage,
      limit: 10,
      ...(searchTerm && { search: searchTerm }),
      ...(categoryFilter && { categoryId: categoryFilter })
    };

    const response = await api.getProducts(params);
    currentProducts = response.data?.products || [];
    
    renderProductsTable();
    updateProductsPagination(response.data?.pagination);
  } catch (error) {
    console.error('Failed to load products:', error);
    showNotification('Erro ao carregar produtos', 'error');
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  if (currentProducts.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="6" class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
            <path d="M12 22V12"></path>
            <polyline points="3.29 7 12 12 20.71 7"></polyline>
          </svg>
          <p>Nenhum produto encontrado</p>
          <p class="text-sm">Adicione produtos ou ajuste os filtros</p>
        </td>
      </tr>
    \`;
    return;
  }

  tbody.innerHTML = currentProducts.map(product => \`
    <tr class="hover:bg-slate-50">
      <td class="py-4 px-6">
        <div>
          <div class="font-medium text-slate-900">\${product.name}</div>
          <div class="text-sm text-slate-500">\${product.sku || 'Sem SKU'}</div>
        </div>
      </td>
      <td class="py-4 px-6">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          \${product.category?.name || 'Sem categoria'}
        </span>
      </td>
      <td class="py-4 px-6">
        <span class="font-medium">R$ \${(product.price || 0).toFixed(2)}</span>
      </td>
      <td class="py-4 px-6">
        <span class="text-sm text-slate-600">\${product.stock || 0} \${product.unit || 'un'}</span>
      </td>
      <td class="py-4 px-6">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${
          product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }">
          \${product.active ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td class="py-4 px-6 text-right">
        <div class="flex items-center justify-end space-x-2">
          <button onclick="editProduct('\${product.id}')" class="text-blue-600 hover:text-blue-800 p-1">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button onclick="deleteProduct('\${product.id}')" class="text-red-600 hover:text-red-800 p-1">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  \`).join('');
}

function updateProductsPagination(pagination) {
  if (!pagination) return;
  
  const showingEl = document.getElementById('products-showing');
  const totalEl = document.getElementById('products-total');
  const prevBtn = document.getElementById('products-prev');
  const nextBtn = document.getElementById('products-next');
  
  if (showingEl) showingEl.textContent = \`\${(pagination.page - 1) * pagination.limit + 1}-\${Math.min(pagination.page * pagination.limit, pagination.total)}\`;
  if (totalEl) totalEl.textContent = pagination.total;
  if (prevBtn) prevBtn.disabled = pagination.page <= 1;
  if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;
}

function changePage(direction) {
  currentPage += direction;
  loadProducts();
}

function openProductModal(productId = null) {
  editingProductId = productId;
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const submitText = document.getElementById('product-submit-text');
  
  if (productId) {
    title.textContent = 'Editar Produto';
    submitText.textContent = 'Atualizar Produto';
    
    // Load product data
    const product = currentProducts.find(p => p.id === productId);
    if (product) {
      document.getElementById('product-name').value = product.name || '';
      document.getElementById('product-sku').value = product.sku || '';
      document.getElementById('product-description').value = product.description || '';
      document.getElementById('product-category').value = product.categoryId || '';
      document.getElementById('product-price').value = product.price || '';
      document.getElementById('product-unit').value = product.unit || 'un';
      document.getElementById('product-active').checked = product.active !== false;
    }
  } else {
    title.textContent = 'Adicionar Produto';
    submitText.textContent = 'Salvar Produto';
    document.getElementById('product-form').reset();
  }
  
  modal.classList.remove('hidden');
  loadCategoriesForSelect();
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
  editingProductId = null;
}

async function loadCategoriesForSelect() {
  try {
    const response = await api.getCategories();
    const categories = response.data?.categories || [];
    
    const selects = ['product-category', 'category-filter'];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        const currentValue = select.value;
        select.innerHTML = selectId === 'category-filter' ? 
          '<option value="">Todas as categorias</option>' : 
          '<option value="">Selecione uma categoria</option>';
        
        categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.name;
          select.appendChild(option);
        });
        
        select.value = currentValue;
      }
    });
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

async function saveProduct(event) {
  event.preventDefault();
  
  const formData = {
    name: document.getElementById('product-name').value,
    sku: document.getElementById('product-sku').value,
    description: document.getElementById('product-description').value,
    categoryId: document.getElementById('product-category').value || null,
    price: parseFloat(document.getElementById('product-price').value) || 0,
    unit: document.getElementById('product-unit').value,
    active: document.getElementById('product-active').checked
  };

  try {
    if (editingProductId) {
      await api.updateProduct(editingProductId, formData);
      showNotification('Produto atualizado com sucesso!');
    } else {
      await api.createProduct(formData);
      showNotification('Produto criado com sucesso!');
    }
    
    closeProductModal();
    loadProducts();
  } catch (error) {
    console.error('Failed to save product:', error);
    showNotification('Erro ao salvar produto', 'error');
  }
}

async function editProduct(productId) {
  openProductModal(productId);
}

async function duplicateProduct(productId) {
  try {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) {
      showNotification('Produto não encontrado', 'error');
      return;
    }
    
    const duplicatedProduct = {
      ...product,
      name: \`\${product.name} (Cópia)\`,
      sku: product.sku ? \`\${product.sku}-COPY\` : null,
      id: undefined // Remove ID so a new one is generated
    };
    
    await api.createProduct(duplicatedProduct);
    showNotification('Produto duplicado com sucesso!');
    loadProducts();
  } catch (error) {
    console.error('Failed to duplicate product:', error);
    showNotification('Erro ao duplicar produto', 'error');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  
  try {
    await api.deleteProduct(productId);
    showNotification('Produto excluído com sucesso!');
    loadProducts();
  } catch (error) {
    console.error('Failed to delete product:', error);
    showNotification('Erro ao excluir produto', 'error');
  }
}

// Categories Management
async function loadCategories() {
  try {
    const response = await api.getCategories();
    currentCategories = response.data?.categories || [];
    renderCategoriesGrid();
  } catch (error) {
    console.error('Failed to load categories:', error);
    showNotification('Erro ao carregar categorias', 'error');
  }
}

function renderCategoriesGrid() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  if (currentCategories.length === 0) {
    grid.innerHTML = \`
      <div class="text-center py-12 text-slate-500">
        <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
          <path d="M8 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2H8V5z"></path>
        </svg>
        <p>Nenhuma categoria encontrada</p>
        <p class="text-sm">Crie sua primeira categoria</p>
      </div>
    \`;
    return;
  }

  grid.innerHTML = \`
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      \${currentCategories.map(category => \`
        <div class="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-medium text-slate-900">\${category.name}</h3>
            <div class="flex space-x-1">
              <button onclick="editCategory('\${category.id}')" class="text-blue-600 hover:text-blue-800 p-1">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button onclick="deleteCategory('\${category.id}')" class="text-red-600 hover:text-red-800 p-1">
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          \${category.description ? \`<p class="text-sm text-slate-600 mb-3">\${category.description}</p>\` : ''}
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${
              category.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }">
              \${category.active ? 'Ativa' : 'Inativa'}
            </span>
            <span class="text-xs text-slate-500">\${category.productCount || 0} produtos</span>
          </div>
        </div>
      \`).join('')}
    </div>
  \`;
}

function openCategoryModal(categoryId = null) {
  editingCategoryId = categoryId;
  const modal = document.getElementById('category-modal');
  const title = document.getElementById('category-modal-title');
  const submitText = document.getElementById('category-submit-text');
  
  if (categoryId) {
    title.textContent = 'Editar Categoria';
    submitText.textContent = 'Atualizar Categoria';
    
    const category = currentCategories.find(c => c.id === categoryId);
    if (category) {
      document.getElementById('category-name').value = category.name || '';
      document.getElementById('category-description').value = category.description || '';
      document.getElementById('category-parent').value = category.parentId || '';
      document.getElementById('category-active').checked = category.active !== false;
    }
  } else {
    title.textContent = 'Nova Categoria';
    submitText.textContent = 'Salvar Categoria';
    document.getElementById('category-form').reset();
  }
  
  modal.classList.remove('hidden');
  loadCategoriesForParentSelect();
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.add('hidden');
  editingCategoryId = null;
}

async function loadCategoriesForParentSelect() {
  try {
    const response = await api.getCategories();
    const categories = response.data?.categories || [];
    
    const select = document.getElementById('category-parent');
    if (select) {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Nenhuma (categoria principal)</option>';
      
      categories.forEach(category => {
        if (category.id !== editingCategoryId) { // Don't allow self-reference
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.name;
          select.appendChild(option);
        }
      });
      
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Failed to load categories for parent select:', error);
  }
}

async function saveCategory(event) {
  event.preventDefault();
  
  const formData = {
    name: document.getElementById('category-name').value,
    description: document.getElementById('category-description').value,
    parentId: document.getElementById('category-parent').value || null,
    active: document.getElementById('category-active').checked
  };

  try {
    if (editingCategoryId) {
      await api.updateCategory(editingCategoryId, formData);
      showNotification('Categoria atualizada com sucesso!');
    } else {
      await api.createCategory(formData);
      showNotification('Categoria criada com sucesso!');
    }
    
    closeCategoryModal();
    loadCategories();
  } catch (error) {
    console.error('Failed to save category:', error);
    showNotification('Erro ao salvar categoria', 'error');
  }
}

async function editCategory(categoryId) {
  openCategoryModal(categoryId);
}

async function deleteCategory(categoryId) {
  if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
  
  try {
    await api.deleteCategory(categoryId);
    showNotification('Categoria excluída com sucesso!');
    loadCategories();
  } catch (error) {
    console.error('Failed to delete category:', error);
    showNotification('Erro ao excluir categoria', 'error');
  }
}

// Router and navigation system
class GastronomOSRouter {
  constructor() {
    this.currentRoute = window.location.pathname;
    this.init();
  }

  init() {
    // Initialize animations
    this.initAnimations();
    
    // Setup navigation
    this.setupNavigation();
    
    // Setup mobile menu
    this.setupMobileMenu();
    
    // Setup search
    this.setupSearch();
    
    // Setup form handlers
    this.setupFormHandlers();
    
    // Load initial route
    this.loadRoute(this.currentRoute);
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      this.loadRoute(window.location.pathname, false);
    });
  }

  setupFormHandlers() {
    // Product form handler
    const productForm = document.getElementById('product-form');
    if (productForm) {
      productForm.addEventListener('submit', saveProduct);
    }
    
    // Category form handler
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', saveCategory);
    }
    
    // Search handlers
    const productSearch = document.getElementById('product-search');
    if (productSearch) {
      productSearch.addEventListener('input', debounce(() => {
        currentPage = 1;
        loadProducts();
      }, 500));
    }
  }

  initAnimations() {
    // Animate sidebar
    setTimeout(() => {
      const sidebar = document.querySelector('.sidebar-container');
      if (sidebar) {
        sidebar.style.opacity = '1';
        sidebar.style.transform = 'translateX(0)';
        sidebar.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    }, 100);

    // Animate header
    setTimeout(() => {
      const header = document.querySelector('.header-container');
      if (header) {
        header.style.opacity = '1';
        header.style.transform = 'translateY(0)';
        header.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s';
      }
    }, 200);

    // Animate main content
    setTimeout(() => {
      const content = document.querySelector('.content-container');
      if (content) {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
        content.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s';
      }
    }, 400);

    // Animate navigation items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item, index) => {
      setTimeout(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateX(0)';
        item.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      }, 600 + (index * 100));
    });

    // Animate content sections
    setTimeout(() => {
      const sections = document.querySelectorAll('.welcome-banner, .stats-grid > div, .activity-section');
      sections.forEach((section, index) => {
        setTimeout(() => {
          section.style.opacity = '1';
          section.style.transform = 'translateY(0)';
          section.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        }, index * 150);
      });
    }, 800);
  }

  setupNavigation() {
    // Handle navigation clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.navigateTo(route);
      }

      // Handle submenu toggles
      const navLink = e.target.closest('.nav-link');
      if (navLink && navLink.parentElement.querySelector('.submenu')) {
        const submenu = navLink.parentElement.querySelector('.submenu');
        const chevron = navLink.querySelector('.submenu-chevron');
        
        if (submenu.style.maxHeight === '0px' || !submenu.style.maxHeight) {
          submenu.style.maxHeight = submenu.scrollHeight + 'px';
          if (chevron) chevron.style.transform = 'rotate(90deg)';
        } else {
          submenu.style.maxHeight = '0px';
          if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
      }
    });
  }

  setupMobileMenu() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar-container');
    
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }
  }

  setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        // Implement global search functionality here
        console.log('Searching for:', query);
      });
    }
  }

  navigateTo(route) {
    if (route === this.currentRoute) return;
    
    this.currentRoute = route;
    history.pushState(null, '', route);
    this.loadRoute(route);
  }

  loadRoute(route, animate = true) {
    // Update active navigation
    this.updateActiveNav(route);
    
    // Update page title and content
    this.updatePageContent(route, animate);
    
    // Load route-specific data
    this.loadRouteData(route);
  }

  loadRouteData(route) {
    // Load data based on current route
    if (route === '/inventory/products') {
      loadProducts();
      loadCategoriesForSelect();
    } else if (route === '/inventory/categories') {
      loadCategories();
    }
  }

  updateActiveNav(route) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('bg-gradient-to-r', 'from-orange-500/20', 'to-red-500/20', 'text-orange-300', 'shadow-lg', 'shadow-orange-500/10');
      link.classList.add('text-slate-300', 'hover:bg-slate-700/50', 'hover:text-white');
    });

    // Add active class to current route
    const activeLink = document.querySelector(\`a[data-route="\${route}"]\`);
    if (activeLink) {
      activeLink.classList.remove('text-slate-300', 'hover:bg-slate-700/50', 'hover:text-white');
      activeLink.classList.add('bg-gradient-to-r', 'from-orange-500/20', 'to-red-500/20', 'text-orange-300', 'shadow-lg', 'shadow-orange-500/10');
    }

    // Handle parent menu highlighting for submenu items
    const parentRoutes = {
      '/inventory/products': '/inventory',
      '/inventory/categories': '/inventory',
      '/inventory/stock': '/inventory',
      '/purchasing/orders': '/purchasing',
      '/purchasing/receipts': '/purchasing',
      '/allocations/current': '/allocations'
    };

    const parentRoute = parentRoutes[route];
    if (parentRoute) {
      const parentLink = document.querySelector(\`a[data-route="\${parentRoute}"]\`);
      if (parentLink) {
        parentLink.classList.remove('text-slate-300', 'hover:bg-slate-700/50', 'hover:text-white');
        parentLink.classList.add('bg-gradient-to-r', 'from-orange-500/20', 'to-red-500/20', 'text-orange-300', 'shadow-lg', 'shadow-orange-500/10');
      }
    }
  }

  updatePageContent(route, animate = true) {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const contentEl = document.getElementById('dynamic-content');

    if (animate) {
      contentEl.style.opacity = '0';
      contentEl.style.transform = 'translateY(20px)';
    }

    setTimeout(() => {
      const routeConfig = this.getRouteConfig(route);
      
      if (titleEl) titleEl.textContent = routeConfig.title;
      if (subtitleEl) subtitleEl.textContent = routeConfig.subtitle;
      
      contentEl.innerHTML = routeConfig.content;

      if (animate) {
        setTimeout(() => {
          contentEl.style.opacity = '1';
          contentEl.style.transform = 'translateY(0)';
          contentEl.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        }, 50);
      }
    }, animate ? 200 : 0);
  }

  getRouteConfig(route) {
    const routes = {
      '/dashboard': {
        title: 'Painel',
        subtitle: 'Bem-vindo de volta, gerencie suas operações do restaurante',
        content: \`${buildDashboardContent().replace(/`/g, '\\`')}\`
      },
      '/inventory': {
        title: 'Estoque',
        subtitle: 'Gerencie produtos, categorias e níveis de estoque',
        content: this.buildInventoryContent()
      },
      '/inventory/products': {
        title: 'Produtos',
        subtitle: 'Cadastre e gerencie produtos do seu restaurante',
        content: this.buildProductsContent()
      },
      '/inventory/categories': {
        title: 'Categorias',
        subtitle: 'Organize produtos por categorias',
        content: this.buildCategoriesContent()
      },
      '/inventory/stock': {
        title: 'Controle de Estoque',
        subtitle: 'Monitore níveis e movimentações de estoque',
        content: this.buildStockContent()
      },
      '/purchasing': {
        title: 'Compras',
        subtitle: 'Gerencie pedidos e fornecedores',
        content: this.buildPurchasingContent()
      },
      '/purchasing/orders': {
        title: 'Pedidos de Compra',
        subtitle: 'Crie e acompanhe pedidos de compra',
        content: this.buildOrdersContent()
      },
      '/purchasing/receipts': {
        title: 'Recebimentos',
        subtitle: 'Registre recebimentos de mercadorias',
        content: this.buildReceiptsContent()
      },
      '/transfers': {
        title: 'Transferências',
        subtitle: 'Transfira produtos entre locais',
        content: this.buildTransfersContent()
      },
      '/allocations': {
        title: 'Alocações',
        subtitle: 'Gerencie alocações de produtos',
        content: this.buildAllocationsContent()
      },
      '/allocations/current': {
        title: 'Alocações Atuais',
        subtitle: 'Visualize alocações em andamento',
        content: this.buildCurrentAllocationsContent()
      },
      '/analytics': {
        title: 'Análises',
        subtitle: 'Relatórios e métricas do seu negócio',
        content: this.buildAnalyticsContent()
      },
      '/locations': {
        title: 'Locais',
        subtitle: 'Gerencie filiais e pontos de venda',
        content: this.buildLocationsContent()
      },
      '/users': {
        title: 'Usuários',
        subtitle: 'Gerencie usuários e permissões',
        content: this.buildUsersContent()
      },
      '/settings': {
        title: 'Configurações',
        subtitle: 'Configurações do sistema',
        content: this.buildSettingsContent()
      }
    };

    return routes[route] || routes['/dashboard'];
  }

  buildInventoryContent() {
    return \`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="router.navigateTo('/inventory/products')">
          <div class="flex items-center space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <svg class="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path>
                <path d="M12 22V12"></path>
                <polyline points="3.29 7 12 12 20.71 7"></polyline>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Produtos</h3>
              <p class="text-sm text-slate-600">Gerencie seu catálogo</p>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="router.navigateTo('/inventory/categories')">
          <div class="flex items-center space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <svg class="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"></path>
                <path d="M8 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2H8V5z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Categorias</h3>
              <p class="text-sm text-slate-600">Organize por categorias</p>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="router.navigateTo('/inventory/stock')">
          <div class="flex items-center space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
              <svg class="h-6 w-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Controle de Estoque</h3>
              <p class="text-sm text-slate-600">Monitore níveis</p>
            </div>
          </div>
        </div>
      </div>
    \`;
  }

  buildProductsContent() {
    return \`${buildProductsContent().replace(/`/g, '\\`')}\`;
  }

  buildCategoriesContent() {
    return \`${buildCategoriesContent().replace(/`/g, '\\`')}\`;
  }

  buildStockContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-6">Controle de Estoque</h2>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <p>Monitore seus níveis de estoque aqui.</p>
        </div>
      </div>
    \`;
  }

  buildPurchasingContent() {
    return \`
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="router.navigateTo('/purchasing/orders')">
          <div class="flex items-center space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <svg class="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="8" cy="21" r="1"></circle>
                <circle cx="19" cy="21" r="1"></circle>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Pedidos</h3>
              <p class="text-sm text-slate-600">Gerencie pedidos de compra</p>
            </div>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="router.navigateTo('/purchasing/receipts')">
          <div class="flex items-center space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <svg class="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Recebimentos</h3>
              <p class="text-sm text-slate-600">Registre recebimentos</p>
            </div>
          </div>
        </div>
      </div>
    \`;
  }

  buildOrdersContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900">Pedidos de Compra</h2>
          <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
            Novo Pedido
          </button>
        </div>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="8" cy="21" r="1"></circle>
            <circle cx="19" cy="21" r="1"></circle>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
          </svg>
          <p>Nenhum pedido de compra ainda.</p>
        </div>
      </div>
    \`;
  }

  buildReceiptsContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-6">Recebimentos</h2>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <p>Nenhum recebimento registrado.</p>
        </div>
      </div>
    \`;
  }

  buildTransfersContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900">Transferências</h2>
          <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
            Nova Transferência
          </button>
        </div>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m16 3 4 4-4 4"></path>
            <path d="M20 7H4"></path>
            <path d="m8 21-4-4 4-4"></path>
            <path d="M4 17h16"></path>
          </svg>
          <p>Nenhuma transferência em andamento.</p>
        </div>
      </div>
    \`;
  }

  buildAllocationsContent() {
    return \`
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer" onclick="router.navigateTo('/allocations/current')">
          <div class="flex items-center space-x-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <svg class="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 11V7a4 4 0 0 0-8 0v4"></path>
                <path d="M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Alocações Atuais</h3>
              <p class="text-sm text-slate-600">Visualize alocações ativas</p>
            </div>
          </div>
        </div>
      </div>
    \`;
  }

  buildCurrentAllocationsContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-6">Alocações Atuais</h2>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 11V7a4 4 0 0 0-8 0v4"></path>
            <path d="M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9"></path>
          </svg>
          <p>Nenhuma alocação ativa no momento.</p>
        </div>
      </div>
    \`;
  }

  buildAnalyticsContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-6">Análises e Relatórios</h2>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v16a2 2 0 0 0 2 2h16"></path>
            <path d="M18 17V9"></path>
            <path d="M13 17V5"></path>
            <path d="M8 17v-3"></path>
          </svg>
          <p>Relatórios e métricas em desenvolvimento.</p>
        </div>
      </div>
    \`;
  }

  buildLocationsContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900">Locais</h2>
          <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
            Adicionar Local
          </button>
        </div>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <p>Nenhum local cadastrado ainda.</p>
        </div>
      </div>
    \`;
  }

  buildUsersContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-slate-900">Usuários</h2>
          <button class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
            Adicionar Usuário
          </button>
        </div>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p>Gerencie usuários e permissões do sistema.</p>
        </div>
      </div>
    \`;
  }

  buildSettingsContent() {
    return \`
      <div class="bg-white rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-slate-900 mb-6">Configurações do Sistema</h2>
        <div class="text-center py-12 text-slate-500">
          <svg class="mx-auto h-12 w-12 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <p>Configurações do sistema em desenvolvimento.</p>
        </div>
      </div>
    \`;
  }
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize router when DOM is loaded
let router;
document.addEventListener('DOMContentLoaded', () => {
  try {
    router = new GastronomOSRouter();
    console.log('GastronomOS Router initialized successfully');
  } catch (error) {
    console.error('Failed to initialize router:', error);
  }
});

// Also try to initialize on window load as backup
window.addEventListener('load', () => {
  if (!router) {
    try {
      router = new GastronomOSRouter();
      console.log('GastronomOS Router initialized on window load');
    } catch (error) {
      console.error('Failed to initialize router on window load:', error);
    }
  }
});

// Proper login handling without alerts
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalContent = submitButton.innerHTML;
  submitButton.innerHTML = '<div class="flex items-center justify-center space-x-2"><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Entrando...</span></div>';
  submitButton.disabled = true;
  
  try {
    // Try real API login first
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
      showNotification('Login realizado com sucesso! Redirecionando...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } else {
      // Fallback to demo login for development
      if (email === 'demo@gastronomos.com' || email.includes('demo')) {
        localStorage.setItem('auth_token', 'demo_token_' + Date.now());
        showNotification('Login demo realizado com sucesso! Redirecionando...', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        const error = await response.json();
        showNotification('Erro no login: ' + (error.message || 'Credenciais inválidas'), 'error');
      }
    }
  } catch (error) {
    // Fallback to demo login if API is not available
    if (email === 'demo@gastronomos.com' || email.includes('demo')) {
      localStorage.setItem('auth_token', 'demo_token_' + Date.now());
      showNotification('Login demo realizado com sucesso! Redirecionando...', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } else {
      showNotification('Erro de conexão. Tente novamente ou use as credenciais demo.', 'error');
    }
  } finally {
    submitButton.innerHTML = originalContent;
    submitButton.disabled = false;
  }
}

function handleDemoLogin() {
  document.getElementById('email').value = 'demo@gastronomos.com';
  document.getElementById('password').value = 'demo123';
  showNotification('Credenciais de demonstração preenchidas! Clique em "Entrar" para continuar.', 'info');
}

// Add mobile menu styles
const mobileStyles = \`
  @media (max-width: 1024px) {
    .sidebar-container {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 50;
      transform: translateX(-100%);
      transition: transform 0.3s ease-in-out;
    }
    
    .sidebar-container.mobile-open {
      transform: translateX(0);
    }
    
    .sidebar-container.mobile-open + .flex {
      margin-left: 0;
    }
  }
\`;

// Add mobile styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = mobileStyles;
document.head.appendChild(styleSheet);
</script>
  `;
}

// Get activity icons
function getActivityIcon(iconName: string): string {
  const icons: Record<string, string> = {
    'shopping-cart': '<svg class="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>',
    'arrow-right-left': '<svg class="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path></svg>',
    'package': '<svg class="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><polyline points="3.29 7 12 12 20.71 7"></polyline></svg>',
    'users': '<svg class="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
  };
  
  return icons[iconName] || '';
}
// Complete dashboard styles with all Tailwind classes and ShadCN-style components
function getCompleteDashboardStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: Inter, system-ui, -apple-system, sans-serif; }
    
    /* Base Layout Classes */
    .h-full { height: 100%; }
    .h-screen { height: 100vh; }
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .min-w-0 { min-width: 0; }
    .shrink-0 { flex-shrink: 0; }
    
    /* Colors - Modern ShadCN palette */
    .bg-background { background-color: #ffffff; }
    .bg-muted { background-color: #f8fafc; }
    .bg-card { background-color: #ffffff; }
    .bg-primary { background-color: #f97316; }
    .bg-secondary { background-color: #f1f5f9; }
    .bg-accent { background-color: #f8fafc; }
    .bg-destructive { background-color: #ef4444; }
    
    .text-foreground { color: #0f172a; }
    .text-muted-foreground { color: #64748b; }
    .text-primary { color: #f97316; }
    .text-primary-foreground { color: #ffffff; }
    .text-secondary-foreground { color: #0f172a; }
    .text-accent-foreground { color: #0f172a; }
    .text-destructive { color: #ef4444; }
    .text-destructive-foreground { color: #ffffff; }
    
    /* Specific color utilities */
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-900 { background-color: #0f172a; }
    .bg-slate-800 { background-color: #1e293b; }
    .bg-slate-700 { background-color: #334155; }
    .bg-white { background-color: white; }
    .text-white { color: white; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-600 { color: #475569; }
    .text-slate-500 { color: #64748b; }
    .text-slate-400 { color: #94a3b8; }
    .text-slate-300 { color: #cbd5e1; }
    .text-orange-400 { color: #fb923c; }
    .text-orange-300 { color: #fdba74; }
    .text-red-400 { color: #f87171; }
    .text-orange-100 { color: #ffedd5; }
    
    /* Layout */
    .overflow-hidden { overflow: hidden; }
    .overflow-y-auto { overflow-y: auto; }
    .overflow-x-auto { overflow-x-auto; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .z-10 { z-index: 10; }
    .z-50 { z-index: 50; }
    
    /* Sizing */
    .w-64 { width: 16rem; }
    .w-72 { width: 18rem; }
    .w-full { width: 100%; }
    .w-9 { width: 2.25rem; }
    .w-10 { width: 2.5rem; }
    .w-5 { width: 1.25rem; }
    .w-6 { width: 1.5rem; }
    .w-4 { width: 1rem; }
    .w-3 { width: 0.75rem; }
    .w-8 { width: 2rem; }
    .w-7 { width: 1.75rem; }
    .w-12 { width: 3rem; }
    .w-24 { width: 6rem; }
    .w-32 { width: 8rem; }
    .w-fit { width: fit-content; }
    .max-w-md { max-width: 28rem; }
    .max-w-2xl { max-width: 42rem; }
    .max-w-7xl { max-width: 80rem; }
    
    .h-14 { height: 3.5rem; }
    .h-16 { height: 4rem; }
    .h-9 { height: 2.25rem; }
    .h-10 { height: 2.5rem; }
    .h-11 { height: 2.75rem; }
    .h-5 { height: 1.25rem; }
    .h-6 { height: 1.5rem; }
    .h-4 { height: 1rem; }
    .h-3 { height: 0.75rem; }
    .h-8 { height: 2rem; }
    .h-7 { height: 1.75rem; }
    .h-12 { height: 3rem; }
    .h-24 { height: 6rem; }
    .h-32 { height: 8rem; }
    .h-20 { height: 5rem; }
    .h-48 { height: 12rem; }
    .max-h-\\[90vh\\] { max-height: 90vh; }
    
    /* Border Radius - ShadCN style */
    .rounded { border-radius: 0.375rem; }
    .rounded-md { border-radius: 0.375rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-full { border-radius: 9999px; }
    
    /* Shadows - ShadCN style */
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    
    /* Borders */
    .border { border-width: 1px; }
    .border-0 { border-width: 0; }
    .border-b { border-bottom-width: 1px; }
    .border-t { border-top-width: 1px; }
    .border-r { border-right-width: 1px; }
    .border-l { border-left-width: 1px; }
    .border-slate-200 { border-color: #e2e8f0; }
    .border-slate-300 { border-color: #cbd5e1; }
    .border-input { border-color: #e2e8f0; }
    .border-ring { border-color: #f97316; }
    .border-destructive { border-color: #ef4444; }
    .border-transparent { border-color: transparent; }
    .divide-y > * + * { border-top-width: 1px; }
    .divide-slate-200 > * + * { border-top-color: #e2e8f0; }
    
    /* Spacing */
    .p-0 { padding: 0; }
    .p-1 { padding: 0.25rem; }
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
    .pl-10 { padding-left: 2.5rem; }
    .pr-10 { padding-right: 2.5rem; }
    
    .m-0 { margin: 0; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .mx-8 { margin-left: 2rem; margin-right: 2rem; }
    .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
    .mt-8 { margin-top: 2rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .ml-2 { margin-left: 0.5rem; }
    .ml-3 { margin-left: 0.75rem; }
    .ml-auto { margin-left: auto; }
    .mr-2 { margin-right: 0.5rem; }
    .mr-4 { margin-right: 1rem; }
    .-top-1 { top: -0.25rem; }
    .-right-1 { right: -0.25rem; }
    .-right-4 { right: -1rem; }
    .-top-4 { top: -1rem; }
    .-right-8 { right: -2rem; }
    .-bottom-8 { bottom: -2rem; }
    .right-4 { right: 1rem; }
    .top-4 { top: 1rem; }
    .left-3 { left: 0.75rem; }
    .top-1\\/2 { top: 50%; }
    .-translate-y-1\\/2 { transform: translateY(-50%); }
    
    .space-x-1 > * + * { margin-left: 0.25rem; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-x-3 > * + * { margin-left: 0.75rem; }
    .space-x-4 > * + * { margin-left: 1rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .space-y-6 > * + * { margin-top: 1.5rem; }
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    .gap-6 { gap: 1.5rem; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-base { font-size: 1rem; line-height: 1.5rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
    .text-2xl { font-size: 1.5rem; line-height: 2rem; }
    .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .whitespace-nowrap { white-space: nowrap; }
    
    /* Grid */
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    
    /* Flexbox utilities */
    .inline-flex { display: inline-flex; }
    .items-baseline { align-items: baseline; }
    .justify-end { justify-content: flex-end; }
    
    /* Gradients */
    .bg-gradient-to-b { background-image: linear-gradient(to bottom, var(--tw-gradient-stops)); }
    .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
    .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
    .from-slate-900 { --tw-gradient-from: #0f172a; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(15, 23, 42, 0)); }
    .via-slate-800 { --tw-gradient-stops: var(--tw-gradient-from), #1e293b, var(--tw-gradient-to, rgba(30, 41, 59, 0)); }
    .to-slate-900 { --tw-gradient-to: #0f172a; }
    .from-orange-500 { --tw-gradient-from: #f97316; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(249, 115, 22, 0)); }
    .to-red-600 { --tw-gradient-to: #dc2626; }
    .from-orange-400 { --tw-gradient-from: #fb923c; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(251, 146, 60, 0)); }
    .to-red-400 { --tw-gradient-to: #f87171; }
    .via-red-500 { --tw-gradient-stops: var(--tw-gradient-from), #ef4444, var(--tw-gradient-to, rgba(239, 68, 68, 0)); }
    .to-pink-500 { --tw-gradient-to: #ec4899; }
    .bg-clip-text { background-clip: text; -webkit-background-clip: text; }
    .text-transparent { color: transparent; }
    
    /* Interactive states */
    .cursor-pointer { cursor: pointer; }
    .cursor-not-allowed { cursor: not-allowed; }
    .pointer-events-none { pointer-events: none; }
    .select-none { user-select: none; }
    
    /* Transitions and animations */
    .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-shadow { transition-property: box-shadow; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .duration-200 { transition-duration: 200ms; }
    .duration-300 { transition-duration: 300ms; }
    
    /* Hover states */
    .hover\\:bg-accent:hover { background-color: #f8fafc; }
    .hover\\:bg-slate-50:hover { background-color: #f8fafc; }
    .hover\\:bg-slate-700\\/50:hover { background-color: rgba(51, 65, 85, 0.5); }
    .hover\\:text-white:hover { color: white; }
    .hover\\:text-accent-foreground:hover { color: #0f172a; }
    .hover\\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .hover\\:shadow-xl:hover { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    .group-hover\\:text-white:hover { color: white; }
    
    /* Focus states */
    .focus\\:bg-white:focus { background-color: white; }
    .focus\\:ring-2:focus { box-shadow: 0 0 0 2px var(--tw-ring-color); }
    .focus\\:ring-orange-500:focus { --tw-ring-color: #f97316; }
    .focus\\:border-orange-500:focus { border-color: #f97316; }
    .focus-visible\\:outline-none:focus-visible { outline: none; }
    .focus-visible\\:ring-2:focus-visible { box-shadow: 0 0 0 2px var(--tw-ring-color); }
    .focus-visible\\:ring-ring:focus-visible { --tw-ring-color: #f97316; }
    
    /* Disabled states */
    .disabled\\:opacity-50:disabled { opacity: 0.5; }
    .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed; }
    .disabled\\:pointer-events-none:disabled { pointer-events: none; }
    
    /* Opacity */
    .opacity-0 { opacity: 0; }
    .opacity-50 { opacity: 0.5; }
    .opacity-70 { opacity: 0.7; }
    
    /* Transform */
    .transform { transform: var(--tw-transform); }
    .rotate-90 { transform: rotate(90deg); }
    .scale-105 { transform: scale(1.05); }
    
    /* Backdrop */
    .backdrop-blur { backdrop-filter: blur(4px); }
    .backdrop-blur-sm { backdrop-filter: blur(4px); }
    .bg-black\\/50 { background-color: rgba(0, 0, 0, 0.5); }
    .bg-white\\/80 { background-color: rgba(255, 255, 255, 0.8); }
    .bg-slate-800\\/50 { background-color: rgba(30, 41, 59, 0.5); }
    .bg-slate-700\\/50 { background-color: rgba(51, 65, 85, 0.5); }
    .bg-orange-500\\/20 { background-color: rgba(249, 115, 22, 0.2); }
    .bg-red-500\\/20 { background-color: rgba(239, 68, 68, 0.2); }
    .shadow-orange-500\\/10 { box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.1); }
    
    /* Status colors */
    .bg-green-100 { background-color: #dcfce7; }
    .text-green-700 { color: #15803d; }
    .text-green-800 { color: #166534; }
    .bg-red-100 { background-color: #fecaca; }
    .text-red-700 { color: #b91c1c; }
    .text-red-800 { color: #991b1b; }
    .bg-blue-100 { background-color: #dbeafe; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-700 { color: #1d4ed8; }
    .text-blue-800 { color: #1e40af; }
    .bg-orange-100 { background-color: #ffedd5; }
    .text-orange-600 { color: #ea580c; }
    .text-orange-800 { color: #9a3412; }
    .bg-purple-100 { background-color: #f3e8ff; }
    .text-purple-600 { color: #9333ea; }
    .text-purple-800 { color: #6b21a8; }
    
    /* Animations */
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    
    .animate-bounce { animation: bounce 1s infinite; }
    @keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); } }
    
    /* Custom animations for Framer Motion-like effects */
    .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .animate-slide-in-left { animation: slideInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-100px); } to { opacity: 1; transform: translateX(0); } }
    
    .animate-slide-in-right { animation: slideInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
    
    .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    
    .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    
    .animate-stagger { animation: stagger 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    @keyframes stagger { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    /* Enhanced hover effects */
    .hover-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    
    .hover-glow { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .hover-glow:hover { box-shadow: 0 0 20px rgba(249, 115, 22, 0.3); }
    
    /* Modern glass morphism effects */
    .glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
    .glass-dark { background: rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
    
    /* Form elements */
    input, textarea, select {
      font-family: inherit;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      transition: all 0.2s;
      background-color: white;
      color: #0f172a;
    }
    
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #f97316;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
    }
    
    input:disabled, textarea:disabled, select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: #f8fafc;
    }
    
    /* Button styles - Modern ShadCN inspired */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      border: none;
      text-decoration: none;
      gap: 0.5rem;
      outline: none;
      position: relative;
      overflow: hidden;
    }
    
    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    
    .btn:hover::before {
      left: 100%;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: white;
      padding: 0.625rem 1.25rem;
      box-shadow: 0 2px 4px rgba(249, 115, 22, 0.2);
    }
    
    .btn-primary:hover {
      background: linear-gradient(135deg, #ea580c, #dc2626);
      box-shadow: 0 8px 25px rgba(249, 115, 22, 0.3);
      transform: translateY(-1px);
    }
    
    .btn-primary:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(249, 115, 22, 0.2);
    }
    
    .btn-secondary {
      background-color: #f8fafc;
      color: #0f172a;
      padding: 0.625rem 1.25rem;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    
    .btn-secondary:hover {
      background-color: #f1f5f9;
      border-color: #cbd5e1;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
    
    .btn-ghost {
      background-color: transparent;
      color: #64748b;
      padding: 0.625rem 1.25rem;
      border: 1px solid transparent;
    }
    
    .btn-ghost:hover {
      background-color: #f8fafc;
      color: #0f172a;
      border-color: #e2e8f0;
    }
    
    .btn-destructive {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      padding: 0.625rem 1.25rem;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
    }
    
    .btn-destructive:hover {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);
      transform: translateY(-1px);
    }
    
    .btn-sm {
      padding: 0.5rem 1rem;
      font-size: 0.8125rem;
    }
    
    .btn-lg {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
    }
    
    /* Table styles */
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      text-align: left;
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }
    
    th {
      background-color: #f8fafc;
      font-weight: 500;
      color: #475569;
      font-size: 0.875rem;
    }
    
    tbody tr:hover {
      background-color: #f8fafc;
    }
    
    /* Card styles - Modern ShadCN inspired */
    .card {
      background-color: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      border: 1px solid #f1f5f9;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .card:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      transform: translateY(-2px);
    }
    
    .card-interactive {
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .card-interactive:hover {
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      transform: translateY(-4px);
      border-color: #f97316;
    }
    
    .card-gradient {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid rgba(249, 115, 22, 0.1);
    }
    
    /* Badge styles */
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 9999px;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1;
    }
    
    .badge-success {
      background-color: #dcfce7;
      color: #166534;
    }
    
    .badge-error {
      background-color: #fecaca;
      color: #991b1b;
    }
    
    .badge-warning {
      background-color: #fef3c7;
      color: #92400e;
    }
    
    .badge-info {
      background-color: #dbeafe;
      color: #1e40af;
    }
    
    /* Mobile responsive */
    @media (max-width: 640px) {
      .sm\\:flex { display: flex; }
      .sm\\:hidden { display: none; }
      .sm\\:block { display: block; }
      .sm\\:w-72 { width: 18rem; }
      .sm\\:h-16 { height: 4rem; }
      .sm\\:text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .sm\\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .sm\\:space-x-4 > * + * { margin-left: 1rem; }
    }
    
    @media (max-width: 768px) {
      .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .md\\:flex-row { flex-direction: row; }
    }
    
    @media (max-width: 1024px) {
      .lg\\:hidden { display: none; }
      .lg\\:flex { display: flex; }
      .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .lg\\:text-2xl { font-size: 1.5rem; line-height: 2rem; }
      .lg\\:space-x-4 > * + * { margin-left: 1rem; }
      
      .sidebar-container {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 50;
        transform: translateX(-100%);
        transition: transform 0.3s ease-in-out;
      }
      
      .sidebar-container.mobile-open {
        transform: translateX(0);
      }
    }
    
    @media (min-width: 1280px) {
      .xl\\:block { display: block; }
    }
    
    /* Utility classes */
    .hidden { display: none; }
    .block { display: block; }
    .inline { display: inline; }
    .inline-block { display: inline-block; }
    
    /* Custom component animations */
    .sidebar-container {
      opacity: 0;
      transform: translateX(-100%);
    }
    
    .header-container {
      opacity: 0;
      transform: translateY(-20px);
    }
    
    .content-container {
      opacity: 0;
      transform: translateY(20px);
    }
    
    .nav-item {
      opacity: 0;
      transform: translateX(-20px);
    }
    
    .welcome-banner, .stats-grid > div, .activity-section {
      opacity: 0;
      transform: translateY(20px);
    }
    
    /* Loading states */
    .loading-skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
    }
    
    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
}

export default app;