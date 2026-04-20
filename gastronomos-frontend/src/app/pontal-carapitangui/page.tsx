'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/theme-context';

export default function PontalCarapitanguiLanding() {
  const { palette } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');

  const features = [
    {
      icon: '📱',
      title: 'Menu Digital QR',
      description: 'Clientes acessam o cardápio via QR code. Sem contato, sem papel, sempre atualizado.',
    },
    {
      icon: '👨‍💼',
      title: 'Painel do Garçom',
      description: 'Gerenciamento eficiente de pedidos com rastreamento em tempo real e comissões automáticas.',
    },
    {
      icon: '🍳',
      title: 'Display da Cozinha',
      description: 'Visualização clara dos pedidos com priorização automática e status em tempo real.',
    },
    {
      icon: '💳',
      title: 'Painel do Caixa',
      description: 'Processamento de pagamentos seguro com suporte a Pix, cartão e múltiplas formas de pagamento.',
    },
    {
      icon: '📊',
      title: 'Dashboard Analítico',
      description: 'Relatórios de vendas, desempenho e análises para decisões estratégicas.',
    },
    {
      icon: '📦',
      title: 'Gestão de Estoque',
      description: 'Controle de inventário em tempo real com alertas de baixo estoque.',
    },
  ];

  const benefits = [
    'Aumento de 40% na eficiência operacional',
    'Redução de erros de pedidos em 95%',
    'Melhor experiência do cliente',
    'Rastreamento completo de vendas',
    'Integração com sistemas de pagamento',
    'Relatórios detalhados e em tempo real',
  ];

  return (
    <div style={{ backgroundColor: palette.background, color: palette.text, minHeight: '100vh' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: palette.primary,
          color: '#ffffff',
          padding: '2rem 1rem',
          textAlign: 'center',
          borderBottom: `4px solid ${palette.accent}`,
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Pontal Carapitangui
          </h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.9 }}>
            Sistema Inteligente de Gestão para Clubes de Praia
          </p>
          <p style={{ fontSize: '0.95rem', opacity: 0.8, marginTop: '0.5rem' }}>
            Barra Grande, Maraú - BA
          </p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav
        style={{
          backgroundColor: palette.surface,
          borderBottom: `1px solid ${palette.textSecondary}20`,
          padding: '0 1rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          flexWrap: 'wrap',
        }}
      >
        {['overview', 'features', 'benefits', 'technical'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '1rem 1.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              color: activeTab === tab ? palette.primary : palette.textSecondary,
              borderBottom: activeTab === tab ? `3px solid ${palette.accent}` : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <section>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: palette.primary }}>
              Visão Geral do Sistema
            </h2>
            <div
              style={{
                backgroundColor: palette.surface,
                padding: '2rem',
                borderRadius: '0.5rem',
                border: `1px solid ${palette.textSecondary}20`,
                lineHeight: '1.8',
              }}
            >
              <p style={{ marginBottom: '1rem' }}>
                O <strong>Pontal Stock</strong> é uma solução completa de gestão de estoque para estabelecimentos de
                alimentação e bebidas, especialmente desenvolvida para clubes de praia como o Pontal
                Carapitangui.
              </p>
              <p style={{ marginBottom: '1rem' }}>
                Nosso sistema integra todas as operações do seu estabelecimento em uma única plataforma:
                desde o atendimento ao cliente até a gestão financeira, passando por controle de estoque
                e análises de desempenho.
              </p>
              <p style={{ marginBottom: '1rem' }}>
                Com a tecnologia de <strong>Menu Digital via QR Code</strong>, seus clientes podem fazer
                pedidos diretamente de suas mesas, reduzindo o tempo de atendimento e melhorando a
                experiência.
              </p>
              <p>
                Tudo funciona em <strong>tempo real</strong>, com sincronização automática entre cozinha,
                garçons, caixa e gerência.
              </p>
            </div>
          </section>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <section>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: palette.primary }}>
              Funcionalidades Principais
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {features.map((feature, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: palette.surface,
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${palette.textSecondary}20`,
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 4px 12px ${palette.primary}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{feature.icon}</div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: palette.primary }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: palette.textSecondary, lineHeight: '1.6' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <section>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: palette.primary }}>
              Benefícios para Pontal Carapitangui
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
              }}
            >
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: palette.surface,
                    padding: '1.5rem',
                    borderRadius: '0.5rem',
                    border: `2px solid ${palette.accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.5rem',
                      color: palette.accent,
                      fontWeight: 'bold',
                    }}
                  >
                    ✓
                  </div>
                  <p style={{ fontSize: '1rem' }}>{benefit}</p>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '2rem',
                backgroundColor: palette.primary,
                color: '#ffffff',
                padding: '2rem',
                borderRadius: '0.5rem',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                Impacto Direto no Seu Negócio
              </h3>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
                Com o Pontal Stock, você terá controle total sobre suas operações, reduzirá custos
                operacionais, aumentará a satisfação dos clientes e terá dados precisos para tomar
                decisões estratégicas.
              </p>
            </div>
          </section>
        )}

        {/* Technical Tab */}
        {activeTab === 'technical' && (
          <section>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: palette.primary }}>
              Especificações Técnicas
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
              }}
            >
              <div
                style={{
                  backgroundColor: palette.surface,
                  padding: '1.5rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${palette.textSecondary}20`,
                }}
              >
                <h3 style={{ color: palette.primary, marginBottom: '1rem' }}>Infraestrutura</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Cloudflare Workers (Backend)</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Next.js (Frontend)</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Cloudflare D1 (Banco de Dados)</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ 99.9% de Uptime</li>
                </ul>
              </div>

              <div
                style={{
                  backgroundColor: palette.surface,
                  padding: '1.5rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${palette.textSecondary}20`,
                }}
              >
                <h3 style={{ color: palette.primary, marginBottom: '1rem' }}>Segurança</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Autenticação JWT</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Criptografia SSL/TLS</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Controle de Acesso por Função</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Auditoria Completa</li>
                </ul>
              </div>

              <div
                style={{
                  backgroundColor: palette.surface,
                  padding: '1.5rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${palette.textSecondary}20`,
                }}
              >
                <h3 style={{ color: palette.primary, marginBottom: '1rem' }}>Integrações</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Mercado Pago</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Pix</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Múltiplas Formas de Pagamento</li>
                  <li style={{ marginBottom: '0.5rem' }}>✓ Sincronização em Tempo Real</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                marginTop: '2rem',
                backgroundColor: palette.surface,
                padding: '2rem',
                borderRadius: '0.5rem',
                border: `1px solid ${palette.textSecondary}20`,
              }}
            >
              <h3 style={{ color: palette.primary, marginBottom: '1rem' }}>URLs de Acesso</h3>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.8' }}>
                <p>
                  <strong>Frontend:</strong>{' '}
                  <code style={{ backgroundColor: palette.primary + '20', padding: '0.25rem 0.5rem' }}>
                    https://pontal-stock.clubemkt.digital
                  </code>
                </p>
                <p>
                  <strong>API:</strong>{' '}
                  <code style={{ backgroundColor: palette.primary + '20', padding: '0.25rem 0.5rem' }}>
                    https://api.pontal-stock.clubemkt.digital
                  </code>
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* CTA Section */}
      <section
        style={{
          backgroundColor: palette.primary,
          color: '#ffffff',
          padding: '3rem 1rem',
          textAlign: 'center',
          marginTop: '2rem',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Pronto para Transformar Seu Negócio?</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', opacity: 0.9 }}>
            Entre em contato conosco para uma demonstração personalizada do Pontal Stock.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              style={{
                backgroundColor: palette.accent,
                color: palette.primary,
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Solicitar Demonstração
            </button>
            <button
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                border: `2px solid ${palette.accent}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = palette.accent;
                e.currentTarget.style.color = palette.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#ffffff';
              }}
            >
              Saiba Mais
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: palette.primary,
          color: '#ffffff',
          padding: '2rem 1rem',
          textAlign: 'center',
          borderTop: `1px solid ${palette.accent}`,
          opacity: 0.8,
        }}
      >
        <p>© 2026 Pontal Stock - Solução Inteligente para Gestão de Estoque</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Desenvolvido com tecnologia de ponta para o Pontal Carapitangui
        </p>
      </footer>
    </div>
  );
}
