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
    
    // If we can't find the file and it's the root, serve the actual Next.js login page content
    if (pathname === '/index.html' || pathname === '/') {
      return new Response(getLoginPageContent(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // Handle dashboard and other app routes - serve the actual Next.js pages
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/inventory') || 
        pathname.startsWith('/purchasing') || 
        pathname.startsWith('/analytics') || 
        pathname.startsWith('/locations') || 
        pathname.startsWith('/transfers') || 
        pathname.startsWith('/allocations') || 
        pathname.startsWith('/users') || 
        pathname.startsWith('/settings')) {
      
      // Try to serve the actual Next.js built page
      const staticContent = c.env.__STATIC_CONTENT as KVNamespace;
      if (staticContent) {
        try {
          const manifestString = (c.env.__STATIC_CONTENT_MANIFEST as string) || '{}';
          const manifest = JSON.parse(manifestString);
          
          // Map the route to the correct HTML file (using Windows-style paths as seen in deployment)
          let htmlKey = '';
          if (pathname.startsWith('/dashboard')) {
            htmlKey = 'dashboard\\index.html';
          } else if (pathname.startsWith('/inventory')) {
            if (pathname.includes('/products')) {
              htmlKey = 'inventory\\products\\index.html';
            } else if (pathname.includes('/categories')) {
              htmlKey = 'inventory\\categories\\index.html';
            } else if (pathname.includes('/stock')) {
              htmlKey = 'inventory\\stock\\index.html';
            } else {
              htmlKey = 'inventory\\index.html';
            }
          } else if (pathname.startsWith('/purchasing')) {
            if (pathname.includes('/orders')) {
              htmlKey = 'purchasing\\orders\\index.html';
            } else if (pathname.includes('/receipts')) {
              htmlKey = 'purchasing\\receipts\\index.html';
            } else {
              htmlKey = 'purchasing\\index.html';
            }
          } else if (pathname.startsWith('/analytics')) {
            htmlKey = 'analytics\\index.html';
          } else if (pathname.startsWith('/locations')) {
            htmlKey = 'locations\\index.html';
          } else if (pathname.startsWith('/transfers')) {
            htmlKey = 'transfers\\index.html';
          } else if (pathname.startsWith('/allocations')) {
            if (pathname.includes('/current')) {
              htmlKey = 'allocations\\current\\index.html';
            } else {
              htmlKey = 'allocations\\index.html';
            }
          } else if (pathname.startsWith('/users')) {
            htmlKey = 'users\\index.html';
          } else if (pathname.startsWith('/settings')) {
            htmlKey = 'settings\\index.html';
          }
          
          console.log('Looking for HTML file with key:', htmlKey);
          
          // Try to get the file directly
          try {
            const file = await staticContent.get(htmlKey, { type: 'text' });
            if (file) {
              console.log('Found HTML file with key:', htmlKey);
              return new Response(file, {
                headers: {
                  'Content-Type': 'text/html; charset=utf-8',
                  'Cache-Control': 'public, max-age=3600',
                },
              });
            } else {
              console.log('HTML file not found with key:', htmlKey);
            }
          } catch (keyError) {
            console.log('Failed to get HTML file with key:', htmlKey, keyError);
          }
          
        } catch (error) {
          console.error('Error serving Next.js page:', error);
        }
      }
      
      // Fallback to basic dashboard if Next.js files not found
      return new Response(getDashboardPageContent(), {
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

// Helper function to get login page content
function getLoginPageContent(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>GastronomOS - O Sistema Operacional do seu Restaurante</title>
  <meta name="description" content="O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises"/>
  <meta name="keywords" content="restaurante,gestão,estoque,PDV,gastronomia"/>
  <style>
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
  </script>
</body>
</html>`;
}

// Helper function to get dashboard page content - returns the actual Next.js dashboard
function getDashboardPageContent(): string {
  return `<!DOCTYPE html><!--_c7oY09Je_xs_Q91o9S9O--><html lang="pt-BR" class="h-full"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="preload" href="/_next/static/media/83afe278b6a6bb3c-s.p.3a6ba036.woff2" as="font" crossorigin="" type="font/woff2"/><link rel="stylesheet" href="/_next/static/chunks/d75cdfeb2cebbca0.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/43c09a0f3b518e18.js"/><script src="/_next/static/chunks/0f94adcdd45354d1.js" async=""></script><script src="/_next/static/chunks/59b0cdc1cb5e9a3e.js" async=""></script><script src="/_next/static/chunks/964bb40aeb50325b.js" async=""></script><script src="/_next/static/chunks/turbopack-921c773a0b302f4c.js" async=""></script><script src="/_next/static/chunks/91f1628386242910.js" async=""></script><script src="/_next/static/chunks/aae562da308fa0ed.js" async=""></script><script src="/_next/static/chunks/1fa725e0a787855e.js" async=""></script><script src="/_next/static/chunks/49e614a8b39e78e9.js" async=""></script><script src="/_next/static/chunks/2c6f297a82092b22.js" async=""></script><script src="/_next/static/chunks/92a46899715db81f.js" async=""></script><meta name="next-size-adjust" content=""/><title>GastronomOS - O Sistema Operacional do seu Restaurante</title><meta name="description" content="O Sistema Operacional completo do seu restaurante para estoque, compras, transferências e análises"/><meta name="keywords" content="restaurante,gestão,estoque,PDV,gastronomia"/><link rel="icon" href="/favicon.ico?favicon.0b3bf435.ico" sizes="256x256" type="image/x-icon"/><script src="/_next/static/chunks/a6dad97d9634a72d.js" noModule=""></script></head><body class="inter_5972bc34-module__OU16Qa__className h-full antialiased"><div hidden=""><!--$--><!--/$--></div><div class="flex h-screen bg-slate-50 overflow-hidden"><div class="relative" style="opacity:1;transform:none"><div class="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl relative w-64 sm:w-72"><div class="flex h-14 sm:h-16 items-center justify-center border-b border-slate-700/50 bg-slate-900/50 px-3"><div class="flex items-center space-x-3 w-full"><div class="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shrink-0"><svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v6a6 6 0 0 0 12 0V2"></path><path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path><path d="M14 2v4"></path><path d="M16 2v4"></path><path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path></svg></div><div class="min-w-0 flex-1"><h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent truncate">GastronomOS</h1><p class="text-xs text-slate-400 truncate">Gestão de Restaurante</p></div></div></div><nav class="flex-1 space-y-1 p-3 sm:p-4 overflow-y-auto"><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 shadow-lg shadow-orange-500/10" href="/dashboard/"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house h-5 w-5 flex-shrink-0 transition-colors text-orange-400" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg><span class="ml-3 flex-1 truncate">Painel</span></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="#"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" aria-hidden="true"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><path d="m7.5 4.27 9 5.15"></path></svg><span class="ml-3 flex-1 truncate">Estoque</span><div class="ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4 text-slate-400" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></div></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="#"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg><span class="ml-3 flex-1 truncate">Compras</span><div class="ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4 text-slate-400" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></div></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="#"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-left h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" aria-hidden="true"><path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path></svg><span class="ml-3 flex-1 truncate">Transferências</span><div class="ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4 text-slate-400" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></div></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="#"><svg class="h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11V7a4 4 0 0 0-8 0v4"></path><path d="M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9"></path><path d="M16 11c2.5 2.5 2.5 6.5 0 9s-6.5 2.5-9 0-2.5-6.5 0-9"></path></svg><span class="ml-3 flex-1 truncate">Alocações</span><div class="ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4 text-slate-400" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></div></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="#"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-column h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg><span class="ml-3 flex-1 truncate">Análises</span><div class="ml-auto"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right h-4 w-4 text-slate-400" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></div></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="/locations/"><svg class="h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg><span class="ml-3 flex-1 truncate">Locais</span></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="/users/"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg><span class="ml-3 flex-1 truncate">Usuários</span></a></div></div><div><div tabindex="0"><a class="group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative min-h-[44px] text-slate-300 hover:bg-slate-700/50 hover:text-white" href="/settings/"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings h-5 w-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-white" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg><span class="ml-3 flex-1 truncate">Configurações</span></a></div></div></nav><div class="border-t border-slate-700/50 p-3 sm:p-4"><div class="flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 transition-colors hover:bg-slate-700/50 cursor-pointer min-h-[52px]" tabindex="0"><div class="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0"><span class="text-sm font-semibold text-white">JD</span></div><div class="flex-1 min-w-0"><p class="text-sm font-medium text-white truncate">João Silva</p><p class="text-xs text-slate-400 truncate">Gerente de Restaurante</p></div></div></div></div></div><div class="flex flex-1 flex-col overflow-hidden min-w-0"><header class="flex h-14 sm:h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-3 sm:px-6 shadow-sm" style="opacity:0;transform:translateY(-20px)"><div class="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0"><button data-slot="button" data-variant="ghost" data-size="sm" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[&gt;svg]:px-2.5 lg:hidden h-9 w-9 p-0 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu h-5 w-5" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg></button><div class="min-w-0 flex-1"><h1 class="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 truncate">Painel</h1><p class="text-xs sm:text-sm text-slate-500 hidden sm:block truncate">Bem-vindo de volta, gerencie suas operações do restaurante</p></div></div><div class="hidden lg:flex flex-1 max-w-md mx-8"><div class="relative w-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg><input data-slot="input" class="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors" placeholder="Buscar produtos, pedidos, transferências..."/></div></div><div class="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 shrink-0"><button data-slot="button" data-variant="ghost" data-size="sm" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[&gt;svg]:px-2.5 lg:hidden h-9 w-9 p-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search h-4 w-4" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg></button><button data-slot="button" data-variant="ghost" data-size="sm" class="items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[&gt;svg]:px-2.5 hidden sm:flex h-9 w-9 p-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-4 w-4" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path></svg></button><button data-slot="dropdown-menu-trigger" data-variant="ghost" data-size="sm" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md gap-1.5 has-[&gt;svg]:px-2.5 relative h-9 w-9 p-0" type="button" id="radix-_R_3sllfivb_" aria-haspopup="menu" aria-expanded="false" data-state="closed"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell h-4 w-4" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg><span data-slot="badge" class="border font-medium whitespace-nowrap shrink-0 [&amp;&gt;svg]:size-3 gap-1 [&amp;&gt;svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent bg-destructive text-white [a&amp;]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 text-xs flex items-center justify-center">3</span></button><button data-slot="dropdown-menu-trigger" data-variant="ghost" data-size="default" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*=&#x27;size-&#x27;])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 px-4 py-2 has-[&gt;svg]:px-3 relative h-8 w-8 sm:h-auto sm:w-auto sm:px-2 rounded-full sm:rounded-md" type="button" id="radix-_R_4sllfivb_" aria-haspopup="menu" aria-expanded="false" data-state="closed"><div class="flex items-center space-x-2"><span class="relative flex shrink-0 overflow-hidden rounded-full h-7 w-7 sm:h-8 sm:w-8"><span class="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white text-xs sm:text-sm">JD</span></span><div class="hidden xl:block text-left"><p class="text-sm font-medium text-slate-900">John Doe</p><p class="text-xs text-slate-500">Manager</p></div><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-3 w-3 text-slate-400 hidden sm:block" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></div></button></div></header><main class="flex-1 overflow-y-auto"><div class="h-full" style="opacity:0;transform:translateY(20px)"><div class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto"><div class="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden" style="opacity:0;transform:translateY(20px)"><div class="relative z-10"><h1 class="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">Bem-vindo de volta, João! 👋</h1><p class="text-orange-100 text-sm sm:text-base lg:text-lg">Aqui está o que está acontecendo com suas operações do restaurante hoje.</p></div><div class="absolute -right-4 -top-4 sm:-right-8 sm:-top-8 h-20 w-20 sm:h-32 sm:w-32 rounded-full bg-white/10"></div><div class="absolute -right-8 -bottom-8 sm:-right-16 sm:-bottom-16 h-32 w-32 sm:h-48 sm:w-48 rounded-full bg-white/5"></div><svg class="absolute right-4 top-4 sm:right-8 sm:top-8 h-8 w-8 sm:h-16 sm:w-16 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v6a6 6 0 0 0 12 0V2"></path><path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path><path d="M14 2v4"></path><path d="M16 2v4"></path><path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path></svg></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"><div style="opacity:0;transform:translateY(20px)"><div tabindex="0"><div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 relative overflow-hidden border-0 shadow-lg"><div data-slot="card-content" class="p-6"><div class="absolute inset-0 bg-gradient-to-br opacity-5 from-blue-500 to-cyan-500"></div><div class="flex items-center justify-between mb-4"><div class="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-blue-500 to-cyan-500"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package h-6 w-6 text-white" aria-hidden="true"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><path d="m7.5 4.27 9 5.15"></path></svg></div><span data-slot="badge" class="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&amp;&gt;svg]:size-3 gap-1 [&amp;&gt;svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent [a&amp;]:hover:bg-secondary/90 font-medium bg-green-100 text-green-700">+<!-- -->12<!-- -->%</span></div><div class="space-y-2"><h3 class="text-sm font-medium text-slate-600">Total de Produtos</h3><div class="flex items-baseline space-x-2"><span class="text-3xl font-bold text-slate-900">2.847</span></div><p class="text-xs text-slate-500">↗<!-- --> <!-- -->vs mês passado</p></div><div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent"></div><div class="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-tl from-white/10 to-transparent"></div></div></div></div></div><div style="opacity:0;transform:translateY(20px)"><div tabindex="0"><div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 relative overflow-hidden border-0 shadow-lg"><div data-slot="card-content" class="p-6"><div class="absolute inset-0 bg-gradient-to-br opacity-5 from-green-500 to-emerald-500"></div><div class="flex items-center justify-between mb-4"><div class="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-green-500 to-emerald-500"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart h-6 w-6 text-white" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg></div><span data-slot="badge" class="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&amp;&gt;svg]:size-3 gap-1 [&amp;&gt;svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent [a&amp;]:hover:bg-secondary/90 font-medium bg-green-100 text-green-700">+<!-- -->8<!-- -->%</span></div><div class="space-y-2"><h3 class="text-sm font-medium text-slate-600">Pedidos Ativos</h3><div class="flex items-baseline space-x-2"><span class="text-3xl font-bold text-slate-900">156</span></div><p class="text-xs text-slate-500">↗<!-- --> <!-- -->vs semana passada</p></div><div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent"></div><div class="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-tl from-white/10 to-transparent"></div></div></div></div></div><div style="opacity:0;transform:translateY(20px)"><div tabindex="0"><div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 relative overflow-hidden border-0 shadow-lg"><div data-slot="card-content" class="p-6"><div class="absolute inset-0 bg-gradient-to-br opacity-5 from-orange-500 to-red-500"></div><div class="flex items-center justify-between mb-4"><div class="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-orange-500 to-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-left h-6 w-6 text-white" aria-hidden="true"><path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path></svg></div><span data-slot="badge" class="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&amp;&gt;svg]:size-3 gap-1 [&amp;&gt;svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent [a&amp;]:hover:bg-secondary/90 font-medium bg-red-100 text-red-700">-<!-- -->15<!-- -->%</span></div><div class="space-y-2"><h3 class="text-sm font-medium text-slate-600">Transferências Pendentes</h3><div class="flex items-baseline space-x-2"><span class="text-3xl font-bold text-slate-900">23</span></div><p class="text-xs text-slate-500">↘<!-- --> <!-- -->vs ontem</p></div><div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent"></div><div class="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-tl from-white/10 to-transparent"></div></div></div></div></div><div style="opacity:0;transform:translateY(20px)"><div tabindex="0"><div data-slot="card" class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 relative overflow-hidden border-0 shadow-lg"><div data-slot="card-content" class="p-6"><div class="absolute inset-0 bg-gradient-to-br opacity-5 from-purple-500 to-indigo-500"></div><div class="flex items-center justify-between mb-4"><div class="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg bg-gradient-to-br from-purple-500 to-indigo-500"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-dollar-sign h-6 w-6 text-white" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div><span data-slot="badge" class="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs w-fit whitespace-nowrap shrink-0 [&amp;&gt;svg]:size-3 gap-1 [&amp;&gt;svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent [a&amp;]:hover:bg-secondary/90 font-medium bg-green-100 text-green-700">+<!-- -->23<!-- -->%</span></div><div class="space-y-2"><h3 class="text-sm font-medium text-slate-600">Receita Mensal</h3><div class="flex items-baseline space-x-2"><span class="text-3xl font-bold text-slate-900">R$ 47.892</span></div><p class="text-xs text-slate-500">↗<!-- --> <!-- -->vs mês passado</p></div><div class="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent"></div><div class="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-tl from-white/10 to-transparent"></div></div></div></div></div></div></div></div></main></div></div></body></html>`;
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: Inter, system-ui, -apple-system, sans-serif; }
    .min-h-screen { min-height: 100vh; }
    .bg-slate-50 { background-color: #f8fafc; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .p-6 { padding: 1.5rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-8 { margin-bottom: 2rem; }
    .ml-3 { margin-left: 0.75rem; }
    .ml-4 { margin-left: 1rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .w-full { width: 100%; }
    .max-w-6xl { max-width: 72rem; }
    .text-3xl { font-size: 1.875rem; }
    .text-xl { font-size: 1.25rem; }
    .text-lg { font-size: 1.125rem; }
    .text-sm { font-size: 0.875rem; }
    .text-2xl { font-size: 1.5rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-slate-900 { color: #0f172a; }
    .text-slate-600 { color: #475569; }
    .text-white { color: white; }
    .text-orange-600 { color: #ea580c; }
    .text-red-600 { color: #dc2626; }
    .text-blue-600 { color: #2563eb; }
    .text-green-600 { color: #16a34a; }
    .bg-white { background-color: white; }
    .bg-gradient-orange { background: linear-gradient(135deg, #f97316, #dc2626); }
    .bg-orange-100 { background-color: #ffedd5; }
    .bg-blue-100 { background-color: #dbeafe; }
    .bg-green-100 { background-color: #dcfce7; }
    .bg-red-100 { background-color: #fee2e2; }
    .rounded-lg { border-radius: 0.5rem; }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .border { border: 1px solid #e2e8f0; }
    .border-b { border-bottom: 1px solid #e2e8f0; }
    .grid { display: grid; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .gap-6 { gap: 1.5rem; }
    .gap-4 { gap: 1rem; }
    .h-12 { height: 3rem; }
    .w-12 { width: 3rem; }
    .h-8 { height: 2rem; }
    .w-8 { width: 2rem; }
    .h-6 { height: 1.5rem; }
    .w-6 { width: 1.5rem; }
    .h-5 { height: 1.25rem; }
    .w-5 { width: 1.25rem; }
    .h-2 { height: 0.5rem; }
    .w-2 { width: 0.5rem; }
    .inline-flex { display: inline-flex; }
    .cursor-pointer { cursor: pointer; }
    .hover\\:bg-slate-100:hover { background-color: #f1f5f9; }
    .hover\\:text-slate-900:hover { color: #0f172a; }
    .transition-colors { transition: color 0.2s, background-color 0.2s; }
    .text-center { text-align: center; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .mr-3 { margin-right: 0.75rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .bg-green-500 { background-color: #22c55e; }
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-orange-500 { background-color: #f97316; }
    .bg-red-500 { background-color: #ef4444; }
    .rounded-full { border-radius: 9999px; }
    @media (min-width: 768px) {
      .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
  </style>
</head>
<body class="min-h-screen bg-slate-50">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-6xl mx-auto px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-orange">
            <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2v6a6 6 0 0 0 12 0V2"></path>
              <path d="M8 2v4"></path><path d="M10 2v4"></path><path d="M12 2v4"></path>
              <path d="M14 2v4"></path><path d="M16 2v4"></path>
              <path d="M6 8v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path>
            </svg>
          </div>
          <h1 class="text-xl font-bold text-slate-900 ml-3">GastronomOS</h1>
        </div>
        <button onclick="logout()" class="text-sm text-slate-600 hover:text-slate-900 cursor-pointer transition-colors">
          Sair
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto p-6">
    <!-- Welcome Section -->
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-slate-900 mb-2">Dashboard</h2>
      <p class="text-slate-600">Bem-vindo ao seu sistema operacional de restaurante</p>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <svg class="h-6 w-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"></path>
              <path d="M6 18h12"></path><path d="M6 14h12"></path><path d="m12 6 0 12"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Produtos em Estoque</p>
            <p class="text-2xl font-bold text-slate-900">1,234</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg class="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Pedidos Pendentes</p>
            <p class="text-2xl font-bold text-slate-900">23</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20m8-10H4"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Vendas Hoje</p>
            <p class="text-2xl font-bold text-slate-900">R$ 5,678</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex items-center">
          <div class="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
            <svg class="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Alertas</p>
            <p class="text-2xl font-bold text-slate-900">5</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Ações Rápidas</h3>
        <div class="grid grid-cols-2 gap-4">
          <button onclick="navigateTo('/inventory')" class="p-4 text-center border rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="h-8 w-8 text-orange-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"></path>
            </svg>
            <p class="text-sm font-medium">Estoque</p>
          </button>
          <button onclick="navigateTo('/purchasing')" class="p-4 text-center border rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="h-8 w-8 text-blue-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path>
            </svg>
            <p class="text-sm font-medium">Compras</p>
          </button>
          <button onclick="navigateTo('/analytics')" class="p-4 text-center border rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="h-8 w-8 text-green-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            <p class="text-sm font-medium">Análises</p>
          </button>
          <button onclick="navigateTo('/settings')" class="p-4 text-center border rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <svg class="h-8 w-8 text-slate-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <p class="text-sm font-medium">Configurações</p>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Atividade Recente</h3>
        <div class="space-y-3">
          <div class="flex items-center text-sm">
            <div class="h-2 w-2 bg-green-500 rounded-full mr-3"></div>
            <span class="text-slate-600">Produto "Tomate" adicionado ao estoque</span>
          </div>
          <div class="flex items-center text-sm">
            <div class="h-2 w-2 bg-blue-500 rounded-full mr-3"></div>
            <span class="text-slate-600">Pedido #1234 processado</span>
          </div>
          <div class="flex items-center text-sm">
            <div class="h-2 w-2 bg-orange-500 rounded-full mr-3"></div>
            <span class="text-slate-600">Estoque baixo: Cebola</span>
          </div>
          <div class="flex items-center text-sm">
            <div class="h-2 w-2 bg-red-500 rounded-full mr-3"></div>
            <span class="text-slate-600">Alerta: Produto vencendo</span>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    // Check if user is authenticated
    function checkAuth() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/';
        return false;
      }
      return true;
    }

    // Logout function
    function logout() {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }

    // Navigation function
    function navigateTo(path) {
      window.location.href = path;
    }

    // Check authentication on page load
    if (!checkAuth()) {
      // Will redirect to login if not authenticated
    }
  </script>
</body>
</html>`;
}

export default app;