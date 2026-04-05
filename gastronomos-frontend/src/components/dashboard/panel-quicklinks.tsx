'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import {
  QrCode,
  Users,
  ChefHat,
  CreditCard,
  BarChart3,
  Settings,
  ArrowRight,
} from 'lucide-react';

interface PanelLink {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  badge?: string;
}

export function PanelQuicklinks() {
  const panels: PanelLink[] = [
    {
      title: 'QR Menu',
      description: 'Customer-facing digital menu',
      icon: QrCode,
      href: '/qr-menu',
      color: 'from-blue-500 to-cyan-500',
      badge: 'Customer',
    },
    {
      title: 'Waiter Panel',
      description: 'Order management & commissions',
      icon: Users,
      href: '/waiter-panel',
      color: 'from-green-500 to-emerald-500',
      badge: 'Staff',
    },
    {
      title: 'Kitchen Display',
      description: 'Order preparation & tracking',
      icon: ChefHat,
      href: '/kitchen-display',
      color: 'from-orange-500 to-red-500',
      badge: 'Kitchen',
    },
    {
      title: 'Cashier Panel',
      description: 'Payment processing & receipts',
      icon: CreditCard,
      href: '/cashier-panel',
      color: 'from-purple-500 to-pink-500',
      badge: 'Payments',
    },
    {
      title: 'Commission Reports',
      description: 'Waiter earnings & analytics',
      icon: BarChart3,
      href: '/commission-reports',
      color: 'from-indigo-500 to-blue-500',
      badge: 'Analytics',
    },
    {
      title: 'System Settings',
      description: 'Configuration & management',
      icon: Settings,
      href: '/settings',
      color: 'from-slate-500 to-gray-500',
      badge: 'Admin',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl flex items-center space-x-2">
              <GastronomyIcons.Plate className="h-5 w-5 text-orange-500" />
              <span>Restaurant Panels</span>
            </CardTitle>
          </div>
          <p className="text-sm text-slate-500 mt-1">Quick access to all system interfaces</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {panels.map((panel, index) => {
              const Icon = panel.icon;
              return (
                <motion.div
                  key={panel.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <Link href={panel.href}>
                    <Button
                      variant="ghost"
                      className="w-full h-auto p-4 hover:bg-slate-50 group transition-all duration-200 hover:shadow-lg border border-slate-200 hover:border-slate-300 flex flex-col items-start justify-start"
                    >
                      <div className="flex items-start justify-between w-full mb-3">
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${panel.color} flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-110 shadow-md`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        {panel.badge && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 group-hover:bg-slate-200">
                            {panel.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm group-hover:text-slate-700 text-left">
                        {panel.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 text-left mt-1 group-hover:text-slate-600">
                        {panel.description}
                      </p>
                      <div className="flex items-center space-x-1 mt-3 text-slate-400 group-hover:text-slate-600 transition-colors">
                        <span className="text-xs font-medium">Access</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
