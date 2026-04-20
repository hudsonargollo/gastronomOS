# Pontal Stock - Funcionalidades Implementadas

## 🎯 Visão Geral

Pontal Stock é um sistema de gestão de estoque especializado para Pontal Carapitangui, com foco em:
- Gestão de estoque em tempo real
- Agendamento e rastreamento de pagamentos
- Alertas de estoque configuráveis
- Dashboard analítico com métricas financeiras

---

## 📊 1. Dashboard Analítico

### Localização
- **Página**: `/dashboard`
- **Arquivo**: `src/app/dashboard/page-pontal.tsx`

### Funcionalidades

#### Métricas Principais
1. **Valor em Estoque**
   - Valor total em reais de todos os produtos em estoque
   - Contagem de produtos
   - Número de itens com baixo estoque

2. **Pagamentos Pendentes**
   - Valor total de pagamentos agendados
   - Número de pagamentos
   - Indicador de pagamentos vencidos

3. **Itens com Baixo Estoque**
   - Contagem de produtos abaixo do limite
   - Severidade dos alertas
   - Links rápidos para reposição

#### Alertas de Estoque
- Exibição em tempo real de produtos com estoque baixo
- Classificação por severidade: CRÍTICO, ALTO, MÉDIO, BAIXO
- Informações de estoque atual vs. limite configurado
- Ações rápidas para reposição

#### Pagamentos Agendados
- Lista de próximos pagamentos
- Data de vencimento
- Valor a pagar
- Status (Pendente/Vencido)
- Dias até vencimento

#### Ações Rápidas
- Nova Compra
- Gerenciar Estoque
- Análises
- Fornecedores

---

## 💳 2. Agendamento de Pagamentos

### Localização
- **Componente**: `src/components/purchasing/payment-scheduler.tsx`
- **Integração**: Formulário de Compra

### Funcionalidades

#### Configuração de Parcelas
- Dividir pagamento em múltiplas parcelas
- Definir data de vencimento para cada parcela
- Especificar valor de cada parcela
- Adicionar notas (ex: "Desconto à vista")

#### Lembretes de Pagamento
- Configurar dias antes do vencimento para lembrete
- Notificações automáticas
- Histórico de lembretes enviados

#### Pagamentos Recorrentes
- Marcar compra como recorrente
- Frequências: Semanal, Mensal, Trimestral, Anual
- Próxima data de pagamento automática

#### Validação
- Soma total das parcelas deve igualar valor da compra
- Datas de vencimento em ordem cronológica
- Valores positivos

#### Exemplo de Uso

```typescript
// Compra de R$ 1.000 dividida em 3 parcelas
Parcela 1: R$ 400 - Vencimento: 30/04/2026 - Lembrete: 3 dias antes
Parcela 2: R$ 300 - Vencimento: 30/05/2026 - Lembrete: 3 dias antes
Parcela 3: R$ 300 - Vencimento: 30/06/2026 - Lembrete: 3 dias antes
```

---

## 🚨 3. Alertas de Estoque Configuráveis

### Localização
- **Componente**: `src/components/inventory/stock-alert-config.tsx`
- **Integração**: Página de Produtos

### Funcionalidades

#### Configuração por Produto
- Limite em percentual (1-100%)
- Limite em quantidade absoluta
- Sincronização automática entre percentual e quantidade

#### Presets Recomendados
- **Crítico (5%)**: Produtos de reposição rápida
- **Baixo (10%)**: Produtos de consumo moderado
- **Médio (20%)**: Produtos de consumo normal
- **Alto (30%)**: Produtos de alto consumo

#### Exemplos de Configuração

**Vodka Premium**
- Estoque máximo: 100 garrafas
- Limite: 20% = 20 garrafas
- Alerta disparado quando: ≤ 20 garrafas

**Carne Vermelha**
- Estoque máximo: 80 kg
- Limite: 15% = 12 kg
- Alerta disparado quando: ≤ 12 kg

**Queijo Importado**
- Estoque máximo: 50 kg
- Limite: 10% = 5 kg
- Alerta disparado quando: ≤ 5 kg

#### Severidade dos Alertas
- **CRÍTICO**: Estoque ≤ 5% do máximo
- **ALTO**: Estoque ≤ 15% do máximo
- **MÉDIO**: Estoque ≤ 25% do máximo
- **BAIXO**: Estoque ≤ 35% do máximo

#### Ativação/Desativação
- Toggle para ativar/desativar alertas por produto
- Histórico de alertas
- Reconhecimento de alertas

---

## 📈 4. Análises e Relatórios

### Métricas Disponíveis

#### Estoque
- Valor total em reais
- Produtos por categoria
- Itens com baixo estoque
- Taxa de rotatividade

#### Financeiro
- Pagamentos pendentes
- Pagamentos vencidos
- Valor total a pagar
- Histórico de pagamentos

#### Operacional
- Compras realizadas
- Fornecedores mais utilizados
- Tempo médio de reposição
- Custo médio por produto

---

## 🔄 5. Fluxo de Compra Completo

### Passo 1: Criar Compra
1. Acessar `/purchasing/orders`
2. Clicar em "Nova Compra"
3. Selecionar fornecedor
4. Adicionar produtos e quantidades
5. Revisar totais

### Passo 2: Agendar Pagamentos
1. Definir se é compra recorrente
2. Configurar parcelas
3. Definir datas de vencimento
4. Configurar lembretes
5. Revisar resumo

### Passo 3: Confirmar Compra
1. Revisar todos os detalhes
2. Adicionar notas (opcional)
3. Confirmar e salvar
4. Sistema cria agendamento de pagamentos

### Passo 4: Rastrear Pagamentos
1. Dashboard mostra pagamentos pendentes
2. Lembretes automáticos 3 dias antes
3. Marcar como pago quando realizado
4. Histórico completo de pagamentos

---

## 📱 6. Notificações e Lembretes

### Tipos de Notificações

#### Alertas de Estoque
- Disparado quando: Estoque cai abaixo do limite
- Frequência: Imediato
- Ação: Reposição recomendada

#### Lembretes de Pagamento
- Disparado quando: X dias antes do vencimento
- Frequência: Uma vez por agendamento
- Ação: Processar pagamento

#### Pagamentos Vencidos
- Disparado quando: Data de vencimento passa
- Frequência: Diário
- Ação: Priorizar pagamento

---

## 💾 7. Banco de Dados

### Novas Tabelas

#### `payment_schedules`
```sql
- id: Identificador único
- purchase_order_id: Referência à compra
- due_date: Data de vencimento
- amount_cents: Valor em centavos
- status: PENDING, PAID, OVERDUE, CANCELLED
- reminder_sent_at: Quando lembrete foi enviado
- reminder_count: Número de lembretes enviados
```

#### `stock_alert_configs`
```sql
- id: Identificador único
- product_id: Referência ao produto
- location_id: Referência à localização
- alert_threshold_percent: Limite em percentual
- alert_threshold_quantity: Limite em quantidade
- is_active: Se alerta está ativo
```

#### `stock_alerts`
```sql
- id: Identificador único
- product_id: Referência ao produto
- current_quantity: Quantidade atual
- threshold_quantity: Limite configurado
- severity: CRITICAL, HIGH, MEDIUM, LOW
- status: ACTIVE, ACKNOWLEDGED, RESOLVED
- acknowledged_by: Usuário que reconheceu
```

### Alterações em Tabelas Existentes

#### `purchase_orders`
- `is_recurring`: Se é compra recorrente
- `recurring_frequency`: WEEKLY, MONTHLY, QUARTERLY, YEARLY
- `next_payment_due_at`: Próximo vencimento
- `payment_reminder_days`: Dias para lembrete

---

## 🎨 8. Interface do Usuário

### Componentes Principais

#### Dashboard
- Cards de métricas com cores do Pontal Stock
- Alertas com ícones e badges
- Ações rápidas com links
- Responsivo para mobile

#### Payment Scheduler
- Slider para percentual
- Inputs para valores
- Presets recomendados
- Resumo de totais

#### Stock Alert Config
- Slider para percentual
- Presets por tipo de produto
- Toggle para ativar/desativar
- Dicas de configuração

---

## 🔐 9. Segurança e Permissões

### Controle de Acesso
- Apenas gerentes podem criar compras
- Apenas administradores podem configurar alertas
- Histórico completo de alterações
- Auditoria de pagamentos

### Validações
- Valores positivos
- Datas válidas
- Totais consistentes
- Produtos ativos

---

## 📝 10. Exemplos de Uso

### Exemplo 1: Compra com Pagamento Parcelado

```
Fornecedor: Distribuidor Premium
Produtos:
  - Vodka Premium: 50 garrafas × R$ 80 = R$ 4.000
  - Carne Vermelha: 30 kg × R$ 50 = R$ 1.500
Total: R$ 5.500

Agendamento:
  Parcela 1: R$ 2.750 - Vencimento: 30/04/2026
  Parcela 2: R$ 2.750 - Vencimento: 30/05/2026

Lembretes: 3 dias antes de cada vencimento
```

### Exemplo 2: Compra Recorrente Mensal

```
Fornecedor: Fornecedor Local
Frequência: Mensal
Produtos:
  - Queijo Importado: 20 kg × R$ 120 = R$ 2.400
Total: R$ 2.400

Próximos Vencimentos:
  - 30/04/2026
  - 30/05/2026
  - 30/06/2026
  - ...
```

### Exemplo 3: Configuração de Alertas

```
Vodka Premium:
  - Estoque máximo: 100 garrafas
  - Limite: 20% = 20 garrafas
  - Alerta: CRÍTICO quando ≤ 20

Carne Vermelha:
  - Estoque máximo: 80 kg
  - Limite: 15% = 12 kg
  - Alerta: ALTO quando ≤ 12

Queijo Importado:
  - Estoque máximo: 50 kg
  - Limite: 10% = 5 kg
  - Alerta: MÉDIO quando ≤ 5
```

---

## 🚀 11. Próximas Melhorias

- [ ] Integração com API de pagamento para automação
- [ ] Relatórios em PDF
- [ ] Exportação de dados em Excel
- [ ] Previsão de estoque com IA
- [ ] Integração com WhatsApp para alertas
- [ ] Dashboard mobile nativo
- [ ] Sincronização com sistemas ERP

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação do Pontal Stock
2. Verifique os exemplos de uso
3. Contate o time de desenvolvimento

---

**Versão**: 1.0.0  
**Data**: Abril 2026  
**Sistema**: Pontal Stock - Gestão de Estoque
