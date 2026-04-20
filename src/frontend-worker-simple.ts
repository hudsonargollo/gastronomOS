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

// Landing page for Pontal Carapitangui
app.get('/pontal-carapitangui-static', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pontal Carapitangui - GastronomOS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f8f8f8; }
    .header { background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 3rem 1rem; text-align: center; border-bottom: 4px solid #f97316; }
    .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; font-weight: 700; }
    .header p { font-size: 1.25rem; opacity: 0.95; margin-bottom: 0.5rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
    h2 { font-size: 2rem; color: #ea580c; margin-bottom: 1.5rem; }
    .content-box { background: white; padding: 2rem; border-radius: 0.5rem; border: 1px solid #eee; line-height: 1.8; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .content-box p { margin-bottom: 1rem; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .feature-card { background: white; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #eee; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .feature-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2); }
    .feature-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .feature-card h3 { font-size: 1.25rem; color: #ea580c; margin-bottom: 0.5rem; }
    .feature-card p { color: #666; font-size: 0.95rem; }
    .benefits-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .benefit-item { background: white; padding: 1.5rem; border-radius: 0.5rem; border: 2px solid #f97316; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .benefit-item strong { color: #f97316; margin-right: 0.5rem; }
    .tech-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .tech-card { background: white; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .tech-card h3 { color: #ea580c; margin-bottom: 1rem; }
    .tech-card ul { list-style: none; padding: 0; }
    .tech-card li { padding: 0.5rem 0; color: #666; }
    .tech-card li:before { content: "✓ "; color: #f97316; font-weight: bold; margin-right: 0.5rem; }
    .cta-section { background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 3rem 1rem; text-align: center; margin-top: 2rem; border-radius: 0.5rem; }
    .cta-section h2 { color: white; }
    .cta-section p { font-size: 1.1rem; margin-bottom: 2rem; opacity: 0.95; }
    .btn { padding: 0.75rem 2rem; font-size: 1rem; font-weight: 600; border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.3s ease; margin: 0 0.5rem; }
    .btn-primary { background: #f97316; color: #ea580c; }
    .btn-primary:hover { background: #fb923c; transform: scale(1.05); }
    .btn-secondary { background: transparent; color: white; border: 2px solid #f97316; }
    .btn-secondary:hover { background: #f97316; color: #ea580c; }
    footer { background: #ea580c; color: white; padding: 2rem 1rem; text-align: center; border-top: 1px solid #f97316; opacity: 0.9; margin-top: 2rem; }
    footer p { margin: 0.5rem 0; }
  </style>
</head>
<body>
  <header class="header">
    <h1>🍽️ Pontal Carapitangui</h1>
    <p>Sistema Inteligente de Gestão para Clubes de Praia</p>
    <p>Barra Grande, Maraú - BA</p>
  </header>
  
  <div class="container">
    <section>
      <h2>Visão Geral do Sistema</h2>
      <div class="content-box">
        <p>O <strong>GastronomOS</strong> é uma solução completa de gestão para estabelecimentos de alimentação e bebidas, especialmente desenvolvida para clubes de praia como o Pontal Carapitangui.</p>
        <p>Nosso sistema integra todas as operações do seu estabelecimento em uma única plataforma: desde o atendimento ao cliente até a gestão financeira, passando por controle de estoque e análises de desempenho.</p>
        <p>Com a tecnologia de <strong>Menu Digital via QR Code</strong>, seus clientes podem fazer pedidos diretamente de suas mesas, reduzindo o tempo de atendimento e melhorando a experiência.</p>
        <p>Tudo funciona em <strong>tempo real</strong>, com sincronização automática entre cozinha, garçons, caixa e gerência.</p>
      </div>
    </section>
    
    <section>
      <h2>Funcionalidades Principais</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3>Menu Digital QR</h3>
          <p>Clientes acessam o cardápio via QR code. Sem contato, sem papel, sempre atualizado.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">👨‍💼</div>
          <h3>Painel do Garçom</h3>
          <p>Gerenciamento eficiente de pedidos com rastreamento em tempo real e comissões automáticas.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🍳</div>
          <h3>Display da Cozinha</h3>
          <p>Visualização clara dos pedidos com priorização automática e status em tempo real.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💳</div>
          <h3>Painel do Caixa</h3>
          <p>Processamento de pagamentos seguro com suporte a Pix, cartão e múltiplas formas de pagamento.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Dashboard Analítico</h3>
          <p>Relatórios de vendas, desempenho e análises para decisões estratégicas.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📦</div>
          <h3>Gestão de Estoque</h3>
          <p>Controle de inventário em tempo real com alertas de baixo estoque.</p>
        </div>
      </div>
    </section>
    
    <section>
      <h2>Benefícios para Pontal Carapitangui</h2>
      <div class="benefits-list">
        <div class="benefit-item"><strong>✓</strong> Aumento de 40% na eficiência operacional</div>
        <div class="benefit-item"><strong>✓</strong> Redução de erros de pedidos em 95%</div>
        <div class="benefit-item"><strong>✓</strong> Melhor experiência do cliente</div>
        <div class="benefit-item"><strong>✓</strong> Rastreamento completo de vendas</div>
        <div class="benefit-item"><strong>✓</strong> Integração com sistemas de pagamento</div>
        <div class="benefit-item"><strong>✓</strong> Relatórios detalhados e em tempo real</div>
      </div>
    </section>
    
    <section>
      <h2>Especificações Técnicas</h2>
      <div class="tech-grid">
        <div class="tech-card">
          <h3>Infraestrutura</h3>
          <ul>
            <li>Cloudflare Workers (Backend)</li>
            <li>Next.js (Frontend)</li>
            <li>Cloudflare D1 (Banco de Dados)</li>
            <li>99.9% de Uptime</li>
          </ul>
        </div>
        <div class="tech-card">
          <h3>Segurança</h3>
          <ul>
            <li>Autenticação JWT</li>
            <li>Criptografia SSL/TLS</li>
            <li>Controle de Acesso por Função</li>
            <li>Auditoria Completa</li>
          </ul>
        </div>
        <div class="tech-card">
          <h3>Integrações</h3>
          <ul>
            <li>Mercado Pago</li>
            <li>Pix</li>
            <li>Múltiplas Formas de Pagamento</li>
            <li>Sincronização em Tempo Real</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
  
  <section class="cta-section">
    <div class="container">
      <h2>Pronto para Transformar Seu Negócio?</h2>
      <p>Entre em contato conosco para uma demonstração personalizada do GastronomOS.</p>
      <button class="btn btn-primary">Solicitar Demonstração</button>
      <button class="btn btn-secondary">Saiba Mais</button>
    </div>
  </section>
  
  <footer>
    <p>© 2026 GastronomOS - Solução Inteligente para Gestão de Estabelecimentos</p>
    <p>Desenvolvido com tecnologia de ponta para o Pontal Carapitangui</p>
  </footer>
</body>
</html>`);
});

// Root route with instructions
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GastronomOS - Sistema de Gestão</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .container { background: white; border-radius: 1rem; padding: 3rem; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    h1 { color: #ea580c; margin-bottom: 1rem; font-size: 2.5rem; }
    p { color: #666; line-height: 1.8; margin-bottom: 1.5rem; }
    .info-box { background: #f0f0f0; padding: 1.5rem; border-radius: 0.5rem; margin: 1.5rem 0; border-left: 4px solid #ea580c; }
    .info-box strong { color: #ea580c; }
    code { background: #f5f5f5; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace; }
    .button-group { display: flex; gap: 1rem; margin-top: 2rem; flex-wrap: wrap; }
    a { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; transition: all 0.3s ease; }
    .btn-primary { background: #ea580c; color: white; }
    .btn-primary:hover { background: #f97316; transform: scale(1.05); }
    .btn-secondary { background: #f0f0f0; color: #ea580c; border: 2px solid #ea580c; }
    .btn-secondary:hover { background: #ea580c; color: white; }
    ul { margin-left: 1.5rem; color: #666; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🍽️ GastronomOS</h1>
    <p>Sistema Inteligente de Gestão para Estabelecimentos de Alimentação e Bebidas</p>
    
    <div class="info-box">
      <strong>ℹ️ Informação:</strong> Para acessar o dashboard completo e interativo, execute o servidor localmente.
    </div>
    
    <p>O GastronomOS é uma solução completa que integra:</p>
    <ul>
      <li>📱 Menu Digital via QR Code</li>
      <li>👨‍💼 Painel do Garçom</li>
      <li>🍳 Display da Cozinha</li>
      <li>💳 Painel do Caixa</li>
      <li>📊 Dashboard Analítico</li>
      <li>📦 Gestão de Estoque</li>
    </ul>
    
    <div class="info-box">
      <strong>🚀 Para executar localmente:</strong><br>
      <code>cd gastronomos-frontend && npm run dev</code><br>
      Acesse: <code>http://localhost:3000</code>
    </div>
    
    <div class="button-group">
      <a href="/pontal-carapitangui-static" class="btn-primary">Ver Apresentação Pontal</a>
    </div>
  </div>
</body>
</html>`);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'frontend-worker' });
});

// Admin dashboard
app.get('/admin', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard - GastronomOS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: white; padding: 1.5rem; }
    .header h1 { font-size: 1.5rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1.5rem; }
    .nav { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .nav a { padding: 0.75rem 1.5rem; background: #f0f0f0; border-radius: 0.375rem; text-decoration: none; color: #333; transition: all 0.3s ease; }
    .nav a:hover { background: #ea580c; color: white; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-label { color: #666; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #ea580c; }
    .content { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h2 { color: #ea580c; margin-bottom: 1rem; }
    ul { margin: 1rem 0 0 2rem; color: #666; line-height: 1.8; }
    li { margin-bottom: 0.5rem; }
    code { background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🍽️ GastronomOS - Dashboard</h1>
  </div>
  
  <div class="container">
    <div class="alert">
      <strong>⚠️ Nota:</strong> Este é um painel de demonstração. Para acessar o dashboard completo com todas as funcionalidades, execute o servidor localmente com <code>npm run dev</code>.
    </div>
    
    <div class="nav">
      <a href="/admin">Dashboard</a>
      <a href="#inventory">Estoque</a>
      <a href="#purchasing">Compras</a>
      <a href="#analytics">Análises</a>
      <a href="#settings">Configurações</a>
      <a href="#logout">Sair</a>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Total de Produtos</div>
        <div class="stat-value">2,847</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pedidos Ativos</div>
        <div class="stat-value">156</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Transferências Pendentes</div>
        <div class="stat-value">23</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Receita Mensal</div>
        <div class="stat-value">R$ 47,892</div>
      </div>
    </div>
    
    <div class="content">
      <h2>Bem-vindo ao GastronomOS</h2>
      <p style="color: #666; line-height: 1.6; margin-bottom: 1rem;">
        Este é o painel administrativo do GastronomOS. Para acessar todas as funcionalidades completas, incluindo:
      </p>
      <ul>
        <li>Gerenciamento de Menu Digital QR</li>
        <li>Painel do Garçom com rastreamento de pedidos</li>
        <li>Display da Cozinha em tempo real</li>
        <li>Painel do Caixa com processamento de pagamentos</li>
        <li>Análises e relatórios detalhados</li>
        <li>Gestão completa de estoque</li>
        <li>Gerenciamento de transferências</li>
        <li>Controle de usuários e permissões</li>
      </ul>
      <p style="color: #666; margin-top: 1.5rem;">
        Execute o servidor localmente com <code>npm run dev</code> na pasta <code>gastronomos-frontend</code>.
      </p>
    </div>
  </div>
</body>
</html>`);
});

// Catch-all for other routes
app.get('*', (c) => {
  return c.text('404 Not Found', 404);
});

export default app;
