/**
 * Menu Availability Hook
 * Real-time menu item availability updates via WebSocket
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

import { useEffect, useState, useCallback } from 'react';
import { getWebSocketService } from '@/lib/websocket';

export interface MenuAvailability {
  menuItemId: string;
  isAvailable: boolean;
  reason?: string;
  estimatedAvailableAt?: number;
}

export interface MenuAvailabilityUpdate {
  menuItemId: string;
  isAvailable: boolean;
  reason?: 'OUT_OF_STOCK' | 'MANUAL_OVERRIDE' | 'PREPARATION_CAPACITY' | 'RESTORED';
  estimatedAvailableAt?: number;
}

/**
 * Hook for real-time menu availability updates
 */
export function useMenuAvailability() {
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, MenuAvailability>>(
    new Map()
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = getWebSocketService();

    // Connect to WebSocket
    ws.connect();

    // Handle connection status
    const unsubscribeConnect = ws.onConnect(() => {
      setIsConnected(true);
      // Request current availability status
      ws.send('menu:availability:request', {});
    });

    const unsubscribeDisconnect = ws.onDisconnect(() => {
      setIsConnected(false);
    });

    // Handle availability updates
    const unsubscribeAvailability = ws.on(
      'menu:availability:update',
      (data: MenuAvailabilityUpdate) => {
        setAvailabilityMap(prev => {
          const next = new Map(prev);
          next.set(data.menuItemId, {
            menuItemId: data.menuItemId,
            isAvailable: data.isAvailable,
            reason: data.reason,
            estimatedAvailableAt: data.estimatedAvailableAt
          });
          return next;
        });
      }
    );

    // Handle bulk availability updates
    const unsubscribeBulk = ws.on(
      'menu:availability:bulk',
      (data: { items: MenuAvailabilityUpdate[] }) => {
        setAvailabilityMap(prev => {
          const next = new Map(prev);
          data.items.forEach(item => {
            next.set(item.menuItemId, {
              menuItemId: item.menuItemId,
              isAvailable: item.isAvailable,
              reason: item.reason,
              estimatedAvailableAt: item.estimatedAvailableAt
            });
          });
          return next;
        });
      }
    );

    // Cleanup
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeAvailability();
      unsubscribeBulk();
    };
  }, []);

  const getAvailability = useCallback(
    (menuItemId: string): MenuAvailability | undefined => {
      return availabilityMap.get(menuItemId);
    },
    [availabilityMap]
  );

  const isMenuItemAvailable = useCallback(
    (menuItemId: string): boolean => {
      const availability = availabilityMap.get(menuItemId);
      return availability?.isAvailable ?? true; // Default to available if not in map
    },
    [availabilityMap]
  );

  return {
    availabilityMap,
    getAvailability,
    isMenuItemAvailable,
    isConnected
  };
}
