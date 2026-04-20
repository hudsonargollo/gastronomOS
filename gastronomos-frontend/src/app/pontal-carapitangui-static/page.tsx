export default function PontalCarapitanguiLanding() {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pontal Carapitangui - GastronomOS</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          
          .header {
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            color: white;
            padding: 3rem 1rem;
            text-align: center;
            border-bottom: 4px solid #f97316;
          }
          
          .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
          }
          
          .header p {
            font-size: 1.25rem;
            opacity: 0.95;
            margin-bottom: 0.5rem;
          }
          
          .header .location {
            font-size: 0.95rem;
            opacity: 0.85;
          }
          
          .nav {
            background: white;
            padding: 1rem;
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
            border-bottom: 1px solid #eee;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          
          .nav button {
            background: none;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            cursor: pointer;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
            font-weight: 500;
          }
          
          .nav button.active {
            color: #ea580c;
            border-bottom-color: #f97316;
            font-weight: 600;
          }
          
          .nav button:hover {
            color: #ea580c;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 1rem;
          }
          
          .section {
            display: none;
          }
          
          .section.active {
            display: block;
          }
          
          h2 {
            font-size: 2rem;
            color: #ea580c;
            margin-bottom: 1.5rem;
          }
          
          .content-box {
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            border: 1px solid #eee;
            line-height: 1.8;
            margin-bottom: 2rem;
          }
          
          .content-box p {
            margin-bottom: 1rem;
          }
          
          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }
          
          .feature-card {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            border: 1px solid #eee;
            transition: all 0.3s ease;
          }
          
          .feature-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2);
          }
          
          .feature-icon {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
          }
          
          .feature-card h3 {
            font-size: 1.25rem;
            color: #ea580c;
            margin-bottom: 0.5rem;
          }
          
          .feature-card p {
            color: #666;
            font-size: 0.95rem;
          }
          
          .benefits-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
          }
          
          .benefit-item {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            border: 2px solid #f97316;
            display: flex;
            gap: 1rem;
            align-items: flex-start;
          }
          
          .benefit-check {
            color: #f97316;
            font-weight: bold;
            font-size: 1.5rem;
            flex-shrink: 0;
          }
          
          .tech-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }
          
          .tech-card {
            background: white;
            padding: 1.5rem;
            border-radius: 0.5rem;
            border: 1px solid #eee;
          }
          
          .tech-card h3 {
            color: #ea580c;
            margin-bottom: 1rem;
          }
          
          .tech-card ul {
            list-style: none;
            padding: 0;
          }
          
          .tech-card li {
            padding: 0.5rem 0;
            color: #666;
          }
          
          .tech-card li:before {
            content: "✓ ";
            color: #f97316;
            font-weight: bold;
            margin-right: 0.5rem;
          }
          
          .cta-section {
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            color: white;
            padding: 3rem 1rem;
            text-align: center;
            margin-top: 2rem;
            border-radius: 0.5rem;
          }
          
          .cta-section h2 {
            color: white;
            margin-bottom: 1rem;
          }
          
          .cta-section p {
            font-size: 1.1rem;
            margin-bottom: 2rem;
            opacity: 0.95;
          }
          
          .cta-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          .btn {
            padding: 0.75rem 2rem;
            font-size: 1rem;
            font-weight: 600;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          .btn-primary {
            background: #f97316;
            color: #ea580c;
          }
          
          .btn-primary:hover {
            background: #fb923c;
            transform: scale(1.05);
          }
          
          .btn-secondary {
            background: transparent;
            color: white;
            border: 2px solid #f97316;
          }
          
          .btn-secondary:hover {
            background: #f97316;
            color: #ea580c;
          }
          
          footer {
            background: #ea580c;
            color: white;
            padding: 2rem 1rem;
            text-align: center;
            border-top: 1px solid #f97316;
            opacity: 0.9;
            margin-top: 2rem;
          }
          
          footer p {
            margin: 0.5rem 0;
          }
          
          code {
            background: #f5f5f5;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
          }
        `}</style>
      </head>
      <body>
        <header className="header">
          <h1>🍽️ Pontal Carapitangui</h1>
          <p>Sistema Inteligente de Gestão para Clubes de Praia</p>
          <p className="location">Barra Grande, Maraú - BA</p>
        </header>

        <nav className="nav">
          <button className="nav-btn active" data-tab="overview">Overview</button>
          <button className="nav-btn" data-tab="features">Features</button>
          <button className="nav-btn" data-tab="benefits">Benefits</button>
          <button className="nav-btn" data-tab="technical">Technical</button>
        </nav>

        <div className="container">
          {/* Overview Section */}
          <section id="overview" className="section active">
            <h2>Visão Geral do Sistema</h2>
            <div className="content-box">
              <p>
                O <strong>GastronomOS</strong> é uma solução completa de gestão para estabelecimentos de alimentação e bebidas, especialmente desenvolvida para clubes de praia como o Pontal Carapitangui.
              </p>
              <p>
                Nosso sistema integra todas as operações do seu estabelecimento em uma única plataforma: desde o atendimento ao cliente até a gestão financeira, passando por controle de estoque e análises de desempenho.
              </p>
              <p>
                Com a tecnologia de <strong>Menu Digital via QR Code</strong>, seus clientes podem fazer pedidos diretamente de suas mesas, reduzindo o tempo de atendimento e melhorando a experiência.
              </p>
              <p>
                Tudo funciona em <strong>tempo real</strong>, com sincronização automática entre cozinha, garçons, caixa e gerência.
              </p>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="section">
            <h2>Funcionalidades Principais</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>Menu Digital QR</h3>
                <p>Clientes acessam o cardápio via QR code. Sem contato, sem papel, sempre atualizado.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">👨‍💼</div>
                <h3>Painel do Garçom</h3>
                <p>Gerenciamento eficiente de pedidos com rastreamento em tempo real e comissões automáticas.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🍳</div>
                <h3>Display da Cozinha</h3>
                <p>Visualização clara dos pedidos com priorização automática e status em tempo real.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💳</div>
                <h3>Painel do Caixa</h3>
                <p>Processamento de pagamentos seguro com suporte a Pix, cartão e múltiplas formas de pagamento.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3>Dashboard Analítico</h3>
                <p>Relatórios de vendas, desempenho e análises para decisões estratégicas.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📦</div>
                <h3>Gestão de Estoque</h3>
                <p>Controle de inventário em tempo real com alertas de baixo estoque.</p>
              </div>
            </div>
          </section>

          {/* Benefits Section */}
          <section id="benefits" className="section">
            <h2>Benefícios para Pontal Carapitangui</h2>
            <div className="benefits-list">
              <div className="benefit-item">
                <div className="benefit-check">✓</div>
                <div>Aumento de 40% na eficiência operacional</div>
              </div>
              <div className="benefit-item">
                <div className="benefit-check">✓</div>
                <div>Redução de erros de pedidos em 95%</div>
              </div>
              <div className="benefit-item">
                <div className="benefit-check">✓</div>
                <div>Melhor experiência do cliente</div>
              </div>
              <div className="benefit-item">
                <div className="benefit-check">✓</div>
                <div>Rastreamento completo de vendas</div>
              </div>
              <div className="benefit-item">
                <div className="benefit-check">✓</div>
                <div>Integração com sistemas de pagamento</div>
              </div>
              <div className="benefit-item">
                <div className="benefit-check">✓</div>
                <div>Relatórios detalhados e em tempo real</div>
              </div>
            </div>

            <div className="cta-section" style={{ marginTop: '2rem' }}>
              <h2>Impacto Direto no Seu Negócio</h2>
              <p>
                Com o GastronomOS, você terá controle total sobre suas operações, reduzirá custos operacionais, aumentará a satisfação dos clientes e terá dados precisos para tomar decisões estratégicas.
              </p>
            </div>
          </section>

          {/* Technical Section */}
          <section id="technical" className="section">
            <h2>Especificações Técnicas</h2>
            <div className="tech-grid">
              <div className="tech-card">
                <h3>Infraestrutura</h3>
                <ul>
                  <li>Cloudflare Workers (Backend)</li>
                  <li>Next.js (Frontend)</li>
                  <li>Cloudflare D1 (Banco de Dados)</li>
                  <li>99.9% de Uptime</li>
                </ul>
              </div>
              <div className="tech-card">
                <h3>Segurança</h3>
                <ul>
                  <li>Autenticação JWT</li>
                  <li>Criptografia SSL/TLS</li>
                  <li>Controle de Acesso por Função</li>
                  <li>Auditoria Completa</li>
                </ul>
              </div>
              <div className="tech-card">
                <h3>Integrações</h3>
                <ul>
                  <li>Mercado Pago</li>
                  <li>Pix</li>
                  <li>Múltiplas Formas de Pagamento</li>
                  <li>Sincronização em Tempo Real</li>
                </ul>
              </div>
            </div>

            <div className="content-box">
              <h3 style={{ color: '#ea580c', marginBottom: '1rem' }}>URLs de Acesso</h3>
              <p><strong>Frontend:</strong> <code>https://gastronomos.clubemkt.digital</code></p>
              <p><strong>API:</strong> <code>https://api.gastronomos.clubemkt.digital</code></p>
            </div>
          </section>
        </div>

        <section className="cta-section">
          <div className="container">
            <h2>Pronto para Transformar Seu Negócio?</h2>
            <p>Entre em contato conosco para uma demonstração personalizada do GastronomOS.</p>
            <div className="cta-buttons">
              <button className="btn btn-primary">Solicitar Demonstração</button>
              <button className="btn btn-secondary">Saiba Mais</button>
            </div>
          </div>
        </section>

        <footer>
          <p>© 2026 GastronomOS - Solução Inteligente para Gestão de Estabelecimentos</p>
          <p>Desenvolvido com tecnologia de ponta para o Pontal Carapitangui</p>
        </footer>

        <script>{`
          document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              const tab = this.dataset.tab;
              
              // Hide all sections
              document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
              
              // Remove active from all buttons
              document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
              
              // Show selected section
              document.getElementById(tab).classList.add('active');
              
              // Mark button as active
              this.classList.add('active');
            });
          });
        `}</script>
      </body>
    </html>
  );
}
