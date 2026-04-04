'use client';

import React, { useEffect, useState } from 'react';
import { AsymmetricCard } from '@/components/design-system/layouts/asymmetric-card';
import { useTranslations } from '@/hooks/use-translations';

interface Table {
  number: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  currentOrderId?: string;
  guestCount?: number;
  waiterId?: string;
}

interface TableManagerProps {
  waiterId: string;
  tenantId: string;
  locationId: string;
  onTableSelect?: (table: Table) => void;
}

export function TableManager({ waiterId, tenantId, locationId, onTableSelect }: TableManagerProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslations();

  useEffect(() => {
    fetchTables();
  }, [waiterId, tenantId, locationId]);

  const fetchTables = async () => {
    try {
      const response = await fetch(
        `/api/tables?tenantId=${tenantId}&locationId=${locationId}&waiterId=${waiterId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignTable = async (tableNumber: string) => {
    try {
      const response = await fetch('/api/tables/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          locationId,
          tableNumber,
          waiterId
        })
      });

      if (response.ok) {
        fetchTables();
      }
    } catch (error) {
      console.error('Failed to assign table:', error);
    }
  };

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border-green-300';
      case 'OCCUPIED': return 'bg-red-100 text-red-800 border-red-300';
      case 'RESERVED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: Table['status']) => {
    switch (status) {
      case 'AVAILABLE': return t('table.available', 'Available');
      case 'OCCUPIED': return t('table.occupied', 'Occupied');
      case 'RESERVED': return t('table.reserved', 'Reserved');
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-lg">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  const myTables = tables.filter(t => t.waiterId === waiterId);
  const availableTables = tables.filter(t => t.status === 'AVAILABLE');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-4">
          {t('waiter.myTables', 'My Tables')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {myTables.length === 0 ? (
            <p className="col-span-full text-muted-foreground">
              {t('waiter.noTablesAssigned', 'No tables assigned')}
            </p>
          ) : (
            myTables.map(table => (
              <AsymmetricCard
                key={table.number}
                variant="outlined"
                onClick={() => onTableSelect?.(table)}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {table.number}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(table.status)}`}>
                    {getStatusLabel(table.status)}
                  </div>
                  {table.guestCount && (
                    <div className="text-sm text-muted-foreground mt-2">
                      {table.guestCount} {t('table.guests', 'guests')}
                    </div>
                  )}
                </div>
              </AsymmetricCard>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4">
          {t('waiter.availableTables', 'Available Tables')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {availableTables.length === 0 ? (
            <p className="col-span-full text-muted-foreground">
              {t('waiter.noAvailableTables', 'No available tables')}
            </p>
          ) : (
            availableTables.map(table => (
              <AsymmetricCard
                key={table.number}
                variant="outlined"
                onClick={() => assignTable(table.number)}
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {table.number}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(table.status)}`}>
                    {getStatusLabel(table.status)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {t('table.clickToAssign', 'Click to assign')}
                  </div>
                </div>
              </AsymmetricCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
