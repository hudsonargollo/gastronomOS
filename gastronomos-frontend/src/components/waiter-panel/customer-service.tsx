'use client';

import React, { useState } from 'react';
import { AsymmetricCard } from '@/components/design-system/layouts/asymmetric-card';
import { useTranslations } from '@/hooks/use-translations';

interface CustomerRequest {
  id: string;
  type: 'ASSISTANCE' | 'BILL' | 'COMPLAINT' | 'MODIFICATION' | 'OTHER';
  tableNumber: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: number;
  resolvedAt?: number;
}

interface CustomerServiceProps {
  waiterId: string;
  tenantId: string;
  locationId: string;
}

export function CustomerService({ waiterId, tenantId, locationId }: CustomerServiceProps) {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: 'ASSISTANCE' as CustomerRequest['type'],
    tableNumber: '',
    description: '',
    priority: 'MEDIUM' as CustomerRequest['priority']
  });
  const { t } = useTranslations();

  const handleCreateRequest = async () => {
    try {
      const response = await fetch('/api/customer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          locationId,
          waiterId,
          ...newRequest
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(prev => [data.request, ...prev]);
        setNewRequest({
          type: 'ASSISTANCE',
          tableNumber: '',
          description: '',
          priority: 'MEDIUM'
        });
        setShowNewRequest(false);
      }
    } catch (error) {
      console.error('Failed to create request:', error);
    }
  };

  const handleResolveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/customer-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          status: 'RESOLVED'
        })
      });

      if (response.ok) {
        setRequests(prev => prev.map(req =>
          req.id === requestId
            ? { ...req, status: 'RESOLVED' as const, resolvedAt: Date.now() }
            : req
        ));
      }
    } catch (error) {
      console.error('Failed to resolve request:', error);
    }
  };

  const getRequestTypeLabel = (type: CustomerRequest['type']) => {
    const labels = {
      ASSISTANCE: t('service.assistance', 'Assistance'),
      BILL: t('service.bill', 'Bill Request'),
      COMPLAINT: t('service.complaint', 'Complaint'),
      MODIFICATION: t('service.modification', 'Order Modification'),
      OTHER: t('service.other', 'Other')
    };
    return labels[type];
  };

  const getPriorityColor = (priority: CustomerRequest['priority']) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingRequests = requests.filter(r => r.status !== 'RESOLVED');
  const resolvedRequests = requests.filter(r => r.status === 'RESOLVED');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {t('service.customerService', 'Customer Service')}
        </h2>
        <button
          onClick={() => setShowNewRequest(!showNewRequest)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          {showNewRequest ? t('common.cancel', 'Cancel') : t('service.newRequest', 'New Request')}
        </button>
      </div>

      {showNewRequest && (
        <AsymmetricCard variant="elevated">
          <h3 className="text-lg font-bold mb-4">
            {t('service.createRequest', 'Create Service Request')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('service.requestType', 'Request Type')}
              </label>
              <select
                value={newRequest.type}
                onChange={(e) => setNewRequest(prev => ({
                  ...prev,
                  type: e.target.value as CustomerRequest['type']
                }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="ASSISTANCE">{getRequestTypeLabel('ASSISTANCE')}</option>
                <option value="BILL">{getRequestTypeLabel('BILL')}</option>
                <option value="COMPLAINT">{getRequestTypeLabel('COMPLAINT')}</option>
                <option value="MODIFICATION">{getRequestTypeLabel('MODIFICATION')}</option>
                <option value="OTHER">{getRequestTypeLabel('OTHER')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('service.tableNumber', 'Table Number')}
              </label>
              <input
                type="text"
                value={newRequest.tableNumber}
                onChange={(e) => setNewRequest(prev => ({
                  ...prev,
                  tableNumber: e.target.value
                }))}
                className="w-full p-2 border rounded-md"
                placeholder={t('service.enterTable', 'Enter table number')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('service.priority', 'Priority')}
              </label>
              <select
                value={newRequest.priority}
                onChange={(e) => setNewRequest(prev => ({
                  ...prev,
                  priority: e.target.value as CustomerRequest['priority']
                }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="LOW">{t('priority.low', 'Low')}</option>
                <option value="MEDIUM">{t('priority.medium', 'Medium')}</option>
                <option value="HIGH">{t('priority.high', 'High')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('service.description', 'Description')}
              </label>
              <textarea
                value={newRequest.description}
                onChange={(e) => setNewRequest(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                className="w-full p-2 border rounded-md"
                rows={3}
                placeholder={t('service.enterDescription', 'Enter request details...')}
              />
            </div>

            <button
              onClick={handleCreateRequest}
              disabled={!newRequest.tableNumber || !newRequest.description}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {t('service.submitRequest', 'Submit Request')}
            </button>
          </div>
        </AsymmetricCard>
      )}

      <div>
        <h3 className="text-lg font-bold mb-4">
          {t('service.pendingRequests', 'Pending Requests')}
        </h3>
        <div className="space-y-3">
          {pendingRequests.length === 0 ? (
            <p className="text-muted-foreground">
              {t('service.noPendingRequests', 'No pending requests')}
            </p>
          ) : (
            pendingRequests.map(request => (
              <AsymmetricCard key={request.id} variant="outlined">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold">
                        {t('waiter.table', 'Table')} {request.tableNumber}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(request.priority)}`}>
                        {request.priority}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mb-1">
                      {getRequestTypeLabel(request.type)}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {request.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(request.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResolveRequest(request.id)}
                    className="ml-4 px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600"
                  >
                    {t('service.resolve', 'Resolve')}
                  </button>
                </div>
              </AsymmetricCard>
            ))
          )}
        </div>
      </div>

      {resolvedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-4">
            {t('service.recentlyResolved', 'Recently Resolved')}
          </h3>
          <div className="space-y-2">
            {resolvedRequests.slice(0, 5).map(request => (
              <div
                key={request.id}
                className="p-3 rounded-lg bg-muted/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">
                      {t('waiter.table', 'Table')} {request.tableNumber} - {getRequestTypeLabel(request.type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {request.description}
                    </p>
                  </div>
                  <span className="text-xs text-green-600">
                    ✓ {t('service.resolved', 'Resolved')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
