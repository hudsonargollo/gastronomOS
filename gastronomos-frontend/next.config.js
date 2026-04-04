/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // Main routes
      { source: '/dashboard', destination: '/painel', permanent: true },
      { source: '/inventory', destination: '/estoque', permanent: true },
      { source: '/inventory/products', destination: '/estoque/produtos', permanent: true },
      { source: '/inventory/categories', destination: '/estoque/categorias', permanent: true },
      { source: '/inventory/stock', destination: '/estoque/niveis', permanent: true },
      { source: '/purchasing', destination: '/compras', permanent: true },
      { source: '/purchasing/orders', destination: '/compras/pedidos', permanent: true },
      { source: '/purchasing/suppliers', destination: '/compras/fornecedores', permanent: true },
      { source: '/purchasing/receipts', destination: '/compras/recibos', permanent: true },
      { source: '/transfers', destination: '/transferencias', permanent: true },
      { source: '/transfers/active', destination: '/transferencias/ativas', permanent: true },
      { source: '/transfers/history', destination: '/transferencias/historico', permanent: true },
      { source: '/transfers/emergency', destination: '/transferencias/emergencia', permanent: true },
      { source: '/allocations', destination: '/alocacoes', permanent: true },
      { source: '/allocations/current', destination: '/alocacoes/atuais', permanent: true },
      { source: '/allocations/templates', destination: '/alocacoes/modelos', permanent: true },
      { source: '/allocations/unallocated', destination: '/alocacoes/nao-alocados', permanent: true },
      { source: '/analytics', destination: '/analises', permanent: true },
      { source: '/analytics/performance', destination: '/analises/desempenho', permanent: true },
      { source: '/analytics/costs', destination: '/analises/custos', permanent: true },
      { source: '/analytics/variance', destination: '/analises/variacao', permanent: true },
      { source: '/locations', destination: '/locais', permanent: true },
      { source: '/users', destination: '/usuarios', permanent: true },
      { source: '/settings', destination: '/configuracoes', permanent: true },
      { source: '/waiter-panel', destination: '/painel-garcom', permanent: true },
      { source: '/kitchen-display', destination: '/painel-cozinha', permanent: true },
      { source: '/kitchen-display/enhanced', destination: '/painel-cozinha/avancado', permanent: true },
      { source: '/cashier-panel', destination: '/painel-caixa', permanent: true },
      { source: '/qr-menu', destination: '/menu-qr', permanent: true },
    ];
  },
};

module.exports = nextConfig;