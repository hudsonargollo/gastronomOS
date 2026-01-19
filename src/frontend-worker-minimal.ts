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
        
        // Try different key formats based on how Wrangler uploads files
        const possibleKeys = [
          pathname.slice(1), // Remove leading slash
          pathname, // Keep leading slash
          manifest[pathname], // Direct manifest lookup
          manifest[pathname.slice(1)], // Manifest lookup without leading slash
          pathname.slice(1).replace(/\//g, '\\'), // Windows-style paths
          pathname.replace(/\//g, '\\'),
        ].filter(Boolean);
        
        for (const key of possibleKeys) {
          try {
            const file = await staticContent.get(key, { type: 'arrayBuffer' });
            if (file) {
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
            // Continue to next key
          }
        }
      } catch (error) {
        console.error('Error accessing static content:', error);
      }
    }
    
    // Serve simple fallback pages
    if (pathname === '/index.html' || pathname === '/') {
      return new Response(getSimpleLoginPage(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // Handle dashboard and other app routes
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/inventory') || 
        pathname.startsWith('/purchasing') || 
        pathname.startsWith('/analytics') || 
        pathname.startsWith('/locations') || 
        pathname.startsWith('/transfers') || 
        pathname.startsWith('/allocations') || 
        pathname.startsWith('/users') || 
        pathname.startsWith('/settings')) {
      
      return new Response(getSimpleDashboard(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // 404 for other files
    return new Response(get404Page(), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
    
  } catch (error) {
    console.error('Static file serving error:', error);
    return new Response(getErrorPage(), {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
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

// Simple login page without complex template literals
function getSimpleLoginPage(): string {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>GastronomOS - Login</title>',
    '<style>',
    'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }',
    '.container { max-width: 400px; margin: 50px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }',
    '.logo { text-align: center; margin-bottom: 30px; }',
    '.logo h1 { color: #ff6b35; margin: 0; }',
    '.form-group { margin-bottom: 20px; }',
    'label { display: block; margin-bottom: 5px; font-weight: bold; }',
    'input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }',
    'button { width: 100%; padding: 12px; background: #ff6b35; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }',
    'button:hover { background: #e55a2b; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '<div class="logo">',
    '<h1>🍽️ GastronomOS</h1>',
    '<p>Sistema de Gestão de Restaurante</p>',
    '</div>',
    '<form onsubmit="handleLogin(event)">',
    '<div class="form-group">',
    '<label for="email">E-mail:</label>',
    '<input type="email" id="email" required>',
    '</div>',
    '<div class="form-group">',
    '<label for="password">Senha:</label>',
    '<input type="password" id="password" required>',
    '</div>',
    '<button type="submit">Entrar</button>',
    '</form>',
    '</div>',
    '<script>',
    'async function handleLogin(event) {',
    'event.preventDefault();',
    'const email = document.getElementById("email").value;',
    'const password = document.getElementById("password").value;',
    'try {',
    'const response = await fetch("/api/v1/auth/login", {',
    'method: "POST",',
    'headers: { "Content-Type": "application/json" },',
    'body: JSON.stringify({ email, password })',
    '});',
    'if (response.ok) {',
    'const data = await response.json();',
    'localStorage.setItem("auth_token", data.token);',
    'window.location.href = "/dashboard";',
    '} else {',
    'alert("Erro no login");',
    '}',
    '} catch (error) {',
    'alert("Erro de conexão");',
    '}',
    '}',
    '</script>',
    '</body>',
    '</html>'
  ];
  
  return html.join('\n');
}

// Simple dashboard page
function getSimpleDashboard(): string {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>GastronomOS - Dashboard</title>',
    '<style>',
    'body { font-family: Arial, sans-serif; margin: 0; background: #f5f5f5; }',
    '.header { background: #ff6b35; color: white; padding: 20px; text-align: center; }',
    '.container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }',
    '.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }',
    '.stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }',
    '.stat-title { font-size: 14px; color: #666; margin-bottom: 10px; }',
    '.stat-value { font-size: 32px; font-weight: bold; color: #333; }',
    '.nav { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }',
    '.nav-item { display: inline-block; margin-right: 20px; padding: 10px 15px; background: #f0f0f0; border-radius: 4px; text-decoration: none; color: #333; }',
    '.nav-item:hover { background: #e0e0e0; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="header">',
    '<h1>🍽️ GastronomOS</h1>',
    '<p>Painel de Controle</p>',
    '</div>',
    '<div class="container">',
    '<div class="nav">',
    '<a href="/dashboard" class="nav-item">Painel</a>',
    '<a href="/inventory" class="nav-item">Estoque</a>',
    '<a href="/purchasing" class="nav-item">Compras</a>',
    '<a href="/analytics" class="nav-item">Análises</a>',
    '<a href="/settings" class="nav-item">Configurações</a>',
    '</div>',
    '<div class="stats">',
    '<div class="stat-card">',
    '<div class="stat-title">Total de Produtos</div>',
    '<div class="stat-value">2,847</div>',
    '</div>',
    '<div class="stat-card">',
    '<div class="stat-title">Pedidos Ativos</div>',
    '<div class="stat-value">156</div>',
    '</div>',
    '<div class="stat-card">',
    '<div class="stat-title">Transferências Pendentes</div>',
    '<div class="stat-value">23</div>',
    '</div>',
    '<div class="stat-card">',
    '<div class="stat-title">Receita Mensal</div>',
    '<div class="stat-value">R$ 47,892</div>',
    '</div>',
    '</div>',
    '</div>',
    '</body>',
    '</html>'
  ];
  
  return html.join('\n');
}

// Simple 404 page
function get404Page(): string {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>GastronomOS - Página não encontrada</title>',
    '<style>',
    'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; text-align: center; }',
    '.container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 8px; }',
    'h1 { color: #ff6b35; }',
    '.btn { background: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '<h1>🍽️ GastronomOS</h1>',
    '<h2>Página não encontrada</h2>',
    '<p>A página solicitada não foi encontrada.</p>',
    '<a href="/" class="btn">Voltar ao Início</a>',
    '</div>',
    '</body>',
    '</html>'
  ];
  
  return html.join('\n');
}

// Simple error page
function getErrorPage(): string {
  const html = [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>GastronomOS - Erro</title>',
    '<style>',
    'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; text-align: center; }',
    '.container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 8px; }',
    'h1 { color: #ff6b35; }',
    '.btn { background: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }',
    '</style>',
    '</head>',
    '<body>',
    '<div class="container">',
    '<h1>🍽️ GastronomOS</h1>',
    '<h2>Erro no servidor</h2>',
    '<p>Ocorreu um erro interno. Tente novamente mais tarde.</p>',
    '<a href="/" class="btn">Voltar ao Início</a>',
    '</div>',
    '</body>',
    '</html>'
  ];
  
  return html.join('\n');
}

export default app;