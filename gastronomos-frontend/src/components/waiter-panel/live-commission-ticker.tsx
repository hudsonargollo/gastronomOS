'use client';

import React, { useEffect, useState } from 'react';
import { CommissionTicker } from '@/components/design-system/layouts/commission-ticker';
import { getWebSocketService } from '@/lib/websocket';

interface Commission {
  id: string;
  orderId: string;
  orderAmount: number;
  commissionAmount: number;
  commissionRate: number;
  commissionType: 'PERCENTAGE' | 'FIXED_VALUE';
  calculatedAt: number;
}

interface LiveCommissionTickerProps {
  waiterId: string;
  tenantId: string;
}

export function LiveCommissionTicker({ waiterId, tenantId }: LiveCommissionTickerProps) {
  const [totalCommission, setTotalCommission] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [recentCommissions, setRecentCommissions] = useState<Commission[]>([]);

  useEffect(() => {
    fetchCommissionData();

    // Subscribe to real-time commission updates
    const ws = getWebSocketService();
    ws.connect();

    const unsubscribe = ws.on('commission:calculated', (data) => {
      if (data.waiterId === waiterId) {
        handleNewCommission(data.commission);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [waiterId, tenantId]);

  const fetchCommissionData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();

      const response = await fetch(
        `/api/commissions?waiterId=${waiterId}&tenantId=${tenantId}&startDate=${startOfDay}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setTotalCommission(data.totalCommission || 0);
        setTodayOrders(data.orderCount || 0);
        setRecentCommissions(data.commissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch commission data:', error);
    }
  };

  const handleNewCommission = (commission: Commission) => {
    setTotalCommission(prev => prev + commission.commissionAmount);
    setTodayOrders(prev => prev + 1);
    setRecentCommissions(prev => [commission, ...prev.slice(0, 9)]);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const items = [
    {
      label: 'Total de Hoje',
      value: formatCurrency(totalCommission),
      highlight: true
    },
    {
      label: 'Pedidos',
      value: todayOrders.toString()
    },
    {
      label: 'Média por Pedido',
      value: todayOrders > 0 ? formatCurrency(Math.floor(totalCommission / todayOrders)) : 'R$ 0,00'
    },
    ...recentCommissions.slice(0, 3).map((comm, idx) => ({
      label: `Pedido #${idx + 1}`,
      value: formatCurrency(comm.commissionAmount)
    }))
  ];

  return (
    <CommissionTicker
      currentCommission={totalCommission / 100}
      variant="compact"
      className="mb-6"
    />
  );
}
