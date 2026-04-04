/**
 * WebSocket Status Indicator Component
 * Displays real-time connection status
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

'use client';

import { ConnectionState } from '@/lib/websocket';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

interface WebSocketStatusIndicatorProps {
  connectionState: ConnectionState;
  className?: string;
}

export function WebSocketStatusIndicator({ 
  connectionState, 
  className = '' 
}: WebSocketStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return {
          icon: Wifi,
          text: 'Connected',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case ConnectionState.CONNECTING:
        return {
          icon: RefreshCw,
          text: 'Connecting...',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          animate: true
        };
      case ConnectionState.RECONNECTING:
        return {
          icon: RefreshCw,
          text: 'Reconnecting...',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          animate: true
        };
      case ConnectionState.FAILED:
        return {
          icon: AlertCircle,
          text: 'Connection Failed',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case ConnectionState.DISCONNECTED:
      default:
        return {
          icon: WifiOff,
          text: 'Disconnected',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div 
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full border
        ${config.bgColor} ${config.borderColor} ${className}
      `}
    >
      <Icon 
        className={`
          w-4 h-4 ${config.color}
          ${config.animate ? 'animate-spin' : ''}
        `}
      />
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
    </div>
  );
}
