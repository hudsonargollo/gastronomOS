'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Package, ShoppingCart, ArrowRightLeft, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'purchase' | 'transfer' | 'allocation' | 'receipt' | 'alert';
  title: string;
  description: string;
  user: {
    name: string;
    avatar?: string;
    initials: string;
  };
  timestamp: string;
  status: 'completed' | 'pending' | 'warning' | 'error';
  metadata?: {
    amount?: string;
    location?: string;
    items?: number;
  };
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'purchase',
    title: 'Pedido Aprovado',
    description: 'PO-2024-001 para vegetais frescos aprovado e enviado ao fornecedor',
    user: { name: 'Sarah Silva', initials: 'SS' },
    timestamp: '2 minutos atrás',
    status: 'completed',
    metadata: { amount: 'R$ 1.245,50', items: 15 },
  },
  {
    id: '2',
    type: 'transfer',
    title: 'Transferência Concluída',
    description: 'Tomates transferidos do Estoque para a Cozinha Principal',
    user: { name: 'Miguel Santos', initials: 'MS' },
    timestamp: '5 minutos atrás',
    status: 'completed',
    metadata: { location: 'Cozinha', items: 50 },
  },
  {
    id: '3',
    type: 'alert',
    title: 'Alerta de Estoque Baixo',
    description: 'Azeite com estoque baixo no Local Oeste',
    user: { name: 'Sistema', initials: 'SY' },
    timestamp: '8 minutos atrás',
    status: 'warning',
    metadata: { location: 'Oeste' },
  },
  {
    id: '4',
    type: 'receipt',
    title: 'Recibo Processado',
    description: 'Recibo da Fazenda Vale Verde processado e conferido',
    user: { name: 'Ana Costa', initials: 'AC' },
    timestamp: '12 minutos atrás',
    status: 'completed',
    metadata: { amount: 'R$ 892,30' },
  },
  {
    id: '5',
    type: 'allocation',
    title: 'Alocação Atualizada',
    description: 'Modelo de alocação semanal aplicado a todos os locais',
    user: { name: 'Carlos Lima', initials: 'CL' },
    timestamp: '15 minutos atrás',
    status: 'completed',
    metadata: { items: 120 },
  },
];

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'purchase':
      return ShoppingCart;
    case 'transfer':
      return ArrowRightLeft;
    case 'allocation':
      return GastronomyIcons.Scale;
    case 'receipt':
      return GastronomyIcons.Receipt;
    case 'alert':
      return AlertTriangle;
    default:
      return Package;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return CheckCircle;
    case 'pending':
      return Clock;
    case 'warning':
      return AlertTriangle;
    case 'error':
      return AlertTriangle;
    default:
      return Clock;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-green-600 bg-green-100';
    case 'pending':
      return 'text-blue-600 bg-blue-100';
    case 'warning':
      return 'text-yellow-600 bg-yellow-100';
    case 'error':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export function ActivityFeed() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>Atividade Recente</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-96 overflow-y-auto">
        {mockActivities.map((activity, index) => {
          const ActivityIcon = getActivityIcon(activity.type);
          const StatusIcon = getStatusIcon(activity.status);

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {/* Activity Icon */}
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <ActivityIcon className="h-5 w-5 text-slate-600" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-slate-900 truncate">
                    {activity.title}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <StatusIcon className={`h-4 w-4 ${getStatusColor(activity.status).split(' ')[0]}`} />
                    <span className="text-xs text-slate-500">{activity.timestamp}</span>
                  </div>
                </div>
                
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {activity.description}
                </p>

                {/* Metadata */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={activity.user.avatar} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-orange-400 to-red-500 text-white">
                        {activity.user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-slate-500">{activity.user.name}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {activity.metadata?.amount && (
                      <Badge variant="secondary" className="text-xs">
                        {activity.metadata.amount}
                      </Badge>
                    )}
                    {activity.metadata?.location && (
                      <Badge variant="outline" className="text-xs">
                        {activity.metadata.location}
                      </Badge>
                    )}
                    {activity.metadata?.items && (
                      <Badge variant="outline" className="text-xs">
                        {activity.metadata.items} itens
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}