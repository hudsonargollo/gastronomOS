# Pontal Stock - Guia de Implementação

## 🎯 Objetivo

Transformar o sistema em uma solução funcional de gestão de estoque para Pontal Carapitangui, com foco em:
- Gestão de estoque em tempo real
- Agendamento e rastreamento de pagamentos
- Alertas de estoque configuráveis
- Dashboard analítico com métricas financeiras

---

## 📋 Checklist de Implementação

### Fase 1: Backend (API)

#### 1.1 Endpoints de Compras
- [ ] `POST /api/v1/purchase-orders` - Criar compra
- [ ] `GET /api/v1/purchase-orders` - Listar compras
- [ ] `GET /api/v1/purchase-orders/:id` - Obter detalhes
- [ ] `PUT /api/v1/purchase-orders/:id` - Atualizar compra
- [ ] `DELETE /api/v1/purchase-orders/:id` - Deletar compra

#### 1.2 Endpoints de Agendamento de Pagamentos
- [ ] `POST /api/v1/payment-schedules` - Criar agendamento
- [ ] `GET /api/v1/payment-schedules` - Listar agendamentos
- [ ] `GET /api/v1/payment-schedules/:id` - Obter detalhes
- [ ] `PUT /api/v1/payment-schedules/:id` - Atualizar agendamento
- [ ] `PUT /api/v1/payment-schedules/:id/mark-paid` - Marcar como pago
- [ ] `PUT /api/v1/payment-schedules/:id/send-reminder` - Enviar lembrete

#### 1.3 Endpoints de Alertas de Estoque
- [ ] `POST /api/v1/stock-alert-configs` - Criar configuração
- [ ] `GET /api/v1/stock-alert-configs` - Listar configurações
- [ ] `PUT /api/v1/stock-alert-configs/:id` - Atualizar configuração
- [ ] `DELETE /api/v1/stock-alert-configs/:id` - Deletar configuração
- [ ] `GET /api/v1/stock-alerts` - Listar alertas ativos
- [ ] `PUT /api/v1/stock-alerts/:id/acknowledge` - Reconhecer alerta

#### 1.4 Endpoints de Dashboard
- [ ] `GET /api/v1/dashboard/metrics` - Obter métricas principais
- [ ] `GET /api/v1/dashboard/stock-alerts` - Obter alertas de estoque
- [ ] `GET /api/v1/dashboard/payments-due` - Obter pagamentos pendentes
- [ ] `GET /api/v1/dashboard/inventory-value` - Obter valor em estoque

### Fase 2: Frontend (UI)

#### 2.1 Componentes
- [x] `PaymentScheduler` - Agendador de pagamentos
- [x] `StockAlertConfig` - Configurador de alertas
- [x] Dashboard Pontal - Painel principal
- [ ] `PaymentsList` - Lista de pagamentos
- [ ] `StockAlertsList` - Lista de alertas
- [ ] `PurchaseOrderForm` - Formulário de compra (integração)

#### 2.2 Páginas
- [x] `/dashboard` - Dashboard principal
- [ ] `/purchasing/orders` - Gestão de compras
- [ ] `/purchasing/payments` - Gestão de pagamentos
- [ ] `/inventory/alerts` - Gestão de alertas
- [ ] `/analytics/payments` - Análise de pagamentos
- [ ] `/analytics/inventory` - Análise de estoque

#### 2.3 Integrações
- [ ] Integrar `PaymentScheduler` no formulário de compra
- [ ] Integrar `StockAlertConfig` na página de produtos
- [ ] Conectar dashboard com API
- [ ] Implementar notificações em tempo real

### Fase 3: Banco de Dados

#### 3.1 Migrações
- [x] Adicionar campos a `purchase_orders`
- [x] Criar tabela `payment_schedules`
- [x] Criar tabela `stock_alert_configs`
- [x] Criar tabela `stock_alerts`
- [ ] Criar índices para performance
- [ ] Criar triggers para alertas automáticos

#### 3.2 Dados Iniciais
- [ ] Configurações padrão de alertas
- [ ] Histórico de pagamentos existentes
- [ ] Migração de dados legados

### Fase 4: Testes

#### 4.1 Testes Unitários
- [ ] Validação de agendamentos
- [ ] Cálculo de alertas
- [ ] Formatação de valores

#### 4.2 Testes de Integração
- [ ] Fluxo completo de compra
- [ ] Agendamento de pagamentos
- [ ] Disparo de alertas

#### 4.3 Testes de Aceitação
- [ ] Criar compra com pagamento parcelado
- [ ] Configurar alertas de estoque
- [ ] Visualizar dashboard
- [ ] Receber lembretes

---

## 🔧 Guia de Desenvolvimento

### Estrutura de Pastas

```
gastronomos-frontend/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx (novo)
│   │   │   └── page-pontal.tsx (novo)
│   │   ├── purchasing/
│   │   │   ├── orders/
│   │   │   ├── payments/ (novo)
│   │   │   └── suppliers/
│   │   ├── inventory/
│   │   │   ├── products/
│   │   │   ├── alerts/ (novo)
│   │   │   └── categories/
│   │   └── analytics/
│   │       ├── payments/ (novo)
│   │       └── inventory/ (novo)
│   ├── components/
│   │   ├── purchasing/
│   │   │   ├── purchase-order-form.tsx
│   │   │   ├── payment-scheduler.tsx (novo)
│   │   │   └── payments-list.tsx (novo)
│   │   ├── inventory/
│   │   │   ├── stock-alert-config.tsx (novo)
│   │   │   └── stock-alerts-list.tsx (novo)
│   │   └── dashboard/
│   │       └── metrics-card.tsx (novo)
│   └── lib/
│       └── api.ts (atualizar)
```

### Implementação Passo a Passo

#### Passo 1: Criar Endpoints de API

**Arquivo**: `src/lib/api.ts`

```typescript
// Adicionar métodos ao ApiClient

// Payment Schedules
async createPaymentSchedule(data: any) {
  return this.request('/payment-schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async getPaymentSchedules(params?: any) {
  const queryString = params ? this.buildQueryString(params) : '';
  return this.request(`/payment-schedules${queryString ? `?${queryString}` : ''}`);
}

async updatePaymentSchedule(id: string, data: any) {
  return this.request(`/payment-schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async markPaymentAsPaid(id: string, data: any) {
  return this.request(`/payment-schedules/${id}/mark-paid`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Stock Alert Configs
async createStockAlertConfig(data: any) {
  return this.request('/stock-alert-configs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async getStockAlertConfigs(params?: any) {
  const queryString = params ? this.buildQueryString(params) : '';
  return this.request(`/stock-alert-configs${queryString ? `?${queryString}` : ''}`);
}

async updateStockAlertConfig(id: string, data: any) {
  return this.request(`/stock-alert-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Stock Alerts
async getStockAlerts(params?: any) {
  const queryString = params ? this.buildQueryString(params) : '';
  return this.request(`/stock-alerts${queryString ? `?${queryString}` : ''}`);
}

async acknowledgeStockAlert(id: string) {
  return this.request(`/stock-alerts/${id}/acknowledge`, {
    method: 'PUT',
  });
}

// Dashboard
async getDashboardMetrics() {
  return this.request('/dashboard/metrics');
}

async getPaymentsDue() {
  return this.request('/dashboard/payments-due');
}

async getInventoryValue() {
  return this.request('/dashboard/inventory-value');
}
```

#### Passo 2: Integrar Payment Scheduler

**Arquivo**: `src/components/purchasing/purchase-order-form.tsx`

```typescript
import { PaymentScheduler } from './payment-scheduler';

// Adicionar ao formulário
const [paymentSchedules, setPaymentSchedules] = useState([]);
const [isRecurring, setIsRecurring] = useState(false);

// No JSX
<PaymentScheduler
  totalAmountCents={totalAmount * 100}
  onScheduleChange={setPaymentSchedules}
  isRecurring={isRecurring}
/>

// No handleSubmit
const formData = {
  supplier,
  invoiceNumber,
  date,
  items,
  notes,
  totalAmount,
  paymentSchedules, // Novo
  isRecurring, // Novo
};
```

#### Passo 3: Integrar Stock Alert Config

**Arquivo**: `src/app/inventory/products/page.tsx`

```typescript
import { StockAlertConfig } from '@/components/inventory/stock-alert-config';

// Adicionar modal ou drawer para configurar alertas
<StockAlertConfig
  productId={product.id}
  productName={product.name}
  maxStock={product.maxStock}
  currentStock={product.quantity}
  onSave={handleSaveAlertConfig}
/>
```

#### Passo 4: Conectar Dashboard com API

**Arquivo**: `src/app/dashboard/page-pontal.tsx`

```typescript
const loadDashboardMetrics = async () => {
  try {
    setLoading(true);
    const response = await apiClient.getDashboardMetrics();
    if (response.success) {
      setMetrics(response.data);
    }
  } catch (error) {
    console.error('Failed to load dashboard metrics:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 📊 Exemplos de Dados

### Exemplo 1: Criar Compra com Agendamento

```json
{
  "supplierId": "supplier-123",
  "poNumber": "PO-2026-001",
  "items": [
    {
      "productId": "prod-vodka",
      "quantityOrdered": 50,
      "unitPriceCents": 8000
    }
  ],
  "isRecurring": false,
  "paymentSchedules": [
    {
      "dueDate": "2026-04-30",
      "amountCents": 275000,
      "reminderDays": 3,
      "notes": "Primeira parcela"
    },
    {
      "dueDate": "2026-05-30",
      "amountCents": 125000,
      "reminderDays": 3,
      "notes": "Segunda parcela"
    }
  ]
}
```

### Exemplo 2: Configurar Alerta de Estoque

```json
{
  "productId": "prod-vodka",
  "locationId": "loc-main",
  "alertThresholdPercent": 20,
  "alertThresholdQuantity": 20,
  "isActive": true
}
```

### Exemplo 3: Resposta do Dashboard

```json
{
  "success": true,
  "data": {
    "inventoryValue": {
      "totalValueCents": 125000000,
      "productCount": 247,
      "lowStockCount": 12
    },
    "paymentsDue": [
      {
        "id": "payment-1",
        "supplierName": "Distribuidor Premium",
        "amountCents": 45000000,
        "dueDate": "2026-04-25",
        "daysUntilDue": 5,
        "status": "PENDING"
      }
    ],
    "stockAlerts": [
      {
        "id": "alert-1",
        "productName": "Vodka Premium",
        "currentQuantity": 8,
        "thresholdQuantity": 40,
        "severity": "CRITICAL",
        "unit": "garrafas"
      }
    ],
    "totalPaymentsPendingCents": 57500000
  }
}
```

---

## 🚀 Deployment

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Banco de dados SQLite configurado

### Passos

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Executar migrações**
   ```bash
   npm run db:migrate
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Iniciar servidor**
   ```bash
   npm start
   ```

---

## 📝 Notas Importantes

### Segurança
- Validar todos os inputs no backend
- Usar autenticação JWT
- Implementar rate limiting
- Criptografar dados sensíveis

### Performance
- Usar índices no banco de dados
- Implementar cache com Redis
- Paginar resultados grandes
- Usar lazy loading no frontend

### Manutenção
- Documentar todas as APIs
- Manter logs de auditoria
- Fazer backups regulares
- Monitorar performance

---

## 🆘 Troubleshooting

### Problema: Alertas não aparecem no dashboard
**Solução**: Verificar se `stock_alert_configs` está configurado e `is_active = true`

### Problema: Pagamentos não aparecem na lista
**Solução**: Verificar se `payment_schedules` foi criado corretamente com `status = PENDING`

### Problema: Dashboard carrega lentamente
**Solução**: Adicionar índices nas tabelas e implementar cache

---

## 📞 Contato

Para dúvidas ou problemas, contate o time de desenvolvimento.

---

**Versão**: 1.0.0  
**Data**: Abril 2026  
**Autor**: Pontal Stock Team
