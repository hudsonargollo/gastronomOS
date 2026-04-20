# Pontal Stock - Especificação de API

## 📋 Visão Geral

Esta documentação descreve todos os endpoints necessários para implementar as funcionalidades de Pontal Stock.

---

## 🔐 Autenticação

Todos os endpoints requerem autenticação via Bearer Token:

```
Authorization: Bearer <token>
```

---

## 📦 Payment Schedules (Agendamentos de Pagamento)

### 1. Criar Agendamento de Pagamento

**Endpoint**: `POST /api/v1/payment-schedules`

**Request**:
```json
{
  "purchaseOrderId": "po-123",
  "dueDate": "2026-04-30",
  "amountCents": 275000,
  "reminderDays": 3,
  "notes": "Primeira parcela"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "ps-001",
    "purchaseOrderId": "po-123",
    "dueDate": "2026-04-30",
    "amountCents": 275000,
    "status": "PENDING",
    "reminderDays": 3,
    "reminderSentAt": null,
    "reminderCount": 0,
    "notes": "Primeira parcela",
    "createdAt": 1713571200,
    "updatedAt": 1713571200
  }
}
```

### 2. Listar Agendamentos de Pagamento

**Endpoint**: `GET /api/v1/payment-schedules`

**Query Parameters**:
- `tenantId` (required): ID do tenant
- `status` (optional): PENDING, PAID, OVERDUE, CANCELLED
- `page` (optional): Número da página (padrão: 1)
- `limit` (optional): Itens por página (padrão: 20)
- `sortBy` (optional): Campo para ordenação (padrão: dueDate)
- `sortOrder` (optional): asc ou desc (padrão: asc)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "ps-001",
        "purchaseOrderId": "po-123",
        "dueDate": "2026-04-30",
        "amountCents": 275000,
        "status": "PENDING",
        "reminderDays": 3,
        "notes": "Primeira parcela",
        "createdAt": 1713571200
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### 3. Obter Detalhes do Agendamento

**Endpoint**: `GET /api/v1/payment-schedules/:id`

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "ps-001",
    "purchaseOrderId": "po-123",
    "dueDate": "2026-04-30",
    "amountCents": 275000,
    "status": "PENDING",
    "reminderDays": 3,
    "reminderSentAt": null,
    "reminderCount": 0,
    "notes": "Primeira parcela",
    "createdAt": 1713571200,
    "updatedAt": 1713571200
  }
}
```

### 4. Atualizar Agendamento

**Endpoint**: `PUT /api/v1/payment-schedules/:id`

**Request**:
```json
{
  "dueDate": "2026-05-05",
  "amountCents": 280000,
  "reminderDays": 5,
  "notes": "Ajustado"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "ps-001",
    "purchaseOrderId": "po-123",
    "dueDate": "2026-05-05",
    "amountCents": 280000,
    "status": "PENDING",
    "reminderDays": 5,
    "notes": "Ajustado",
    "updatedAt": 1713657600
  }
}
```

### 5. Marcar Pagamento como Pago

**Endpoint**: `PUT /api/v1/payment-schedules/:id/mark-paid`

**Request**:
```json
{
  "paidAt": 1713571200,
  "paidAmount": 275000,
  "notes": "Pago via PIX"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "ps-001",
    "status": "PAID",
    "paidAt": 1713571200,
    "paidAmount": 275000,
    "notes": "Pago via PIX",
    "updatedAt": 1713571200
  }
}
```

### 6. Enviar Lembrete

**Endpoint**: `PUT /api/v1/payment-schedules/:id/send-reminder`

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "ps-001",
    "reminderSentAt": 1713571200,
    "reminderCount": 1,
    "message": "Lembrete enviado com sucesso"
  }
}
```

### 7. Deletar Agendamento

**Endpoint**: `DELETE /api/v1/payment-schedules/:id`

**Response** (200):
```json
{
  "success": true,
  "message": "Agendamento deletado com sucesso"
}
```

---

## 🚨 Stock Alert Configs (Configurações de Alertas)

### 1. Criar Configuração de Alerta

**Endpoint**: `POST /api/v1/stock-alert-configs`

**Request**:
```json
{
  "productId": "prod-vodka",
  "locationId": "loc-main",
  "alertThresholdPercent": 20,
  "alertThresholdQuantity": 20,
  "isActive": true
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "sac-001",
    "productId": "prod-vodka",
    "locationId": "loc-main",
    "alertThresholdPercent": 20,
    "alertThresholdQuantity": 20,
    "isActive": true,
    "createdAt": 1713571200,
    "updatedAt": 1713571200
  }
}
```

### 2. Listar Configurações de Alertas

**Endpoint**: `GET /api/v1/stock-alert-configs`

**Query Parameters**:
- `tenantId` (required): ID do tenant
- `productId` (optional): Filtrar por produto
- `locationId` (optional): Filtrar por localização
- `isActive` (optional): true/false
- `page` (optional): Número da página
- `limit` (optional): Itens por página

**Response** (200):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "sac-001",
        "productId": "prod-vodka",
        "locationId": "loc-main",
        "alertThresholdPercent": 20,
        "alertThresholdQuantity": 20,
        "isActive": true,
        "createdAt": 1713571200
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

### 3. Atualizar Configuração

**Endpoint**: `PUT /api/v1/stock-alert-configs/:id`

**Request**:
```json
{
  "alertThresholdPercent": 25,
  "alertThresholdQuantity": 25,
  "isActive": true
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "sac-001",
    "alertThresholdPercent": 25,
    "alertThresholdQuantity": 25,
    "isActive": true,
    "updatedAt": 1713657600
  }
}
```

### 4. Deletar Configuração

**Endpoint**: `DELETE /api/v1/stock-alert-configs/:id`

**Response** (200):
```json
{
  "success": true,
  "message": "Configuração deletada com sucesso"
}
```

---

## 🔔 Stock Alerts (Alertas de Estoque)

### 1. Listar Alertas Ativos

**Endpoint**: `GET /api/v1/stock-alerts`

**Query Parameters**:
- `tenantId` (required): ID do tenant
- `status` (optional): ACTIVE, ACKNOWLEDGED, RESOLVED
- `severity` (optional): CRITICAL, HIGH, MEDIUM, LOW
- `page` (optional): Número da página
- `limit` (optional): Itens por página

**Response** (200):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "sa-001",
        "productId": "prod-vodka",
        "locationId": "loc-main",
        "currentQuantity": 8,
        "thresholdQuantity": 20,
        "severity": "CRITICAL",
        "status": "ACTIVE",
        "acknowledgedBy": null,
        "acknowledgedAt": null,
        "createdAt": 1713571200
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

### 2. Reconhecer Alerta

**Endpoint**: `PUT /api/v1/stock-alerts/:id/acknowledge`

**Request**:
```json
{
  "acknowledgedBy": "user-123",
  "notes": "Reposição agendada"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "sa-001",
    "status": "ACKNOWLEDGED",
    "acknowledgedBy": "user-123",
    "acknowledgedAt": 1713571200,
    "notes": "Reposição agendada"
  }
}
```

### 3. Resolver Alerta

**Endpoint**: `PUT /api/v1/stock-alerts/:id/resolve`

**Request**:
```json
{
  "resolvedBy": "user-123",
  "notes": "Reposição realizada"
}
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "sa-001",
    "status": "RESOLVED",
    "resolvedAt": 1713571200,
    "notes": "Reposição realizada"
  }
}
```

---

## 📊 Dashboard Endpoints

### 1. Obter Métricas do Dashboard

**Endpoint**: `GET /api/v1/dashboard/metrics`

**Query Parameters**:
- `tenantId` (required): ID do tenant
- `locationId` (optional): Filtrar por localização

**Response** (200):
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

### 2. Obter Pagamentos Vencidos

**Endpoint**: `GET /api/v1/dashboard/payments-due`

**Query Parameters**:
- `tenantId` (required): ID do tenant
- `daysAhead` (optional): Próximos N dias (padrão: 30)

**Response** (200):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "payment-1",
        "supplierName": "Distribuidor Premium",
        "amountCents": 45000000,
        "dueDate": "2026-04-25",
        "daysUntilDue": 5,
        "status": "PENDING"
      }
    ],
    "totalAmount": 45000000,
    "count": 1
  }
}
```

### 3. Obter Valor em Estoque

**Endpoint**: `GET /api/v1/dashboard/inventory-value`

**Query Parameters**:
- `tenantId` (required): ID do tenant
- `locationId` (optional): Filtrar por localização

**Response** (200):
```json
{
  "success": true,
  "data": {
    "totalValueCents": 125000000,
    "productCount": 247,
    "lowStockCount": 12,
    "byCategory": [
      {
        "categoryName": "Bebidas",
        "valueCents": 45000000,
        "productCount": 50
      }
    ]
  }
}
```

---

## ❌ Códigos de Erro

### 400 Bad Request
```json
{
  "success": false,
  "error": "INVALID_REQUEST",
  "message": "Descrição do erro"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Token inválido ou expirado"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Você não tem permissão para acessar este recurso"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Recurso não encontrado"
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "CONFLICT",
  "message": "Recurso já existe"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "Erro interno do servidor"
}
```

---

## 📝 Validações

### Payment Schedules
- `dueDate`: Data válida no futuro
- `amountCents`: Valor positivo
- `reminderDays`: 0-30 dias
- Soma de parcelas deve igualar valor total da compra

### Stock Alert Configs
- `alertThresholdPercent`: 1-100
- `alertThresholdQuantity`: Positivo
- Produto e localização devem existir
- Não pode haver duplicatas (produto + localização)

### Stock Alerts
- Criados automaticamente quando estoque cai abaixo do limite
- Severidade calculada automaticamente
- Status: ACTIVE → ACKNOWLEDGED → RESOLVED

---

## 🔄 Fluxos de Negócio

### Fluxo 1: Criar Compra com Pagamento Parcelado

```
1. POST /purchase-orders (criar compra)
2. POST /payment-schedules (criar parcela 1)
3. POST /payment-schedules (criar parcela 2)
4. POST /payment-schedules (criar parcela 3)
5. GET /dashboard/metrics (visualizar no dashboard)
```

### Fluxo 2: Configurar Alerta de Estoque

```
1. POST /stock-alert-configs (criar configuração)
2. Sistema monitora estoque
3. Quando estoque < limite:
   - Cria stock_alert automaticamente
   - Notifica usuário
4. PUT /stock-alerts/:id/acknowledge (reconhecer)
5. PUT /stock-alerts/:id/resolve (resolver)
```

### Fluxo 3: Processar Pagamento

```
1. GET /dashboard/payments-due (listar pagamentos)
2. PUT /payment-schedules/:id/mark-paid (marcar como pago)
3. Sistema atualiza status
4. GET /dashboard/metrics (atualiza métricas)
```

---

## 📚 Exemplos de Uso

### Exemplo 1: Criar Compra com 2 Parcelas

```bash
# 1. Criar compra
curl -X POST http://localhost:8787/api/v1/purchase-orders \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "supplier-123",
    "items": [{"productId": "prod-1", "quantity": 50, "unitPrice": 8000}],
    "totalCostCents": 400000
  }'

# 2. Criar primeira parcela
curl -X POST http://localhost:8787/api/v1/payment-schedules \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "purchaseOrderId": "po-123",
    "dueDate": "2026-04-30",
    "amountCents": 200000,
    "reminderDays": 3
  }'

# 3. Criar segunda parcela
curl -X POST http://localhost:8787/api/v1/payment-schedules \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "purchaseOrderId": "po-123",
    "dueDate": "2026-05-30",
    "amountCents": 200000,
    "reminderDays": 3
  }'
```

### Exemplo 2: Configurar Alerta

```bash
curl -X POST http://localhost:8787/api/v1/stock-alert-configs \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod-vodka",
    "locationId": "loc-main",
    "alertThresholdPercent": 20,
    "alertThresholdQuantity": 20,
    "isActive": true
  }'
```

### Exemplo 3: Obter Dashboard

```bash
curl -X GET "http://localhost:8787/api/v1/dashboard/metrics?tenantId=tenant-123" \
  -H "Authorization: Bearer token"
```

---

**Versão**: 1.0.0  
**Data**: Abril 2026  
**Status**: Pronto para Implementação
