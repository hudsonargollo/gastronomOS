'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import {
  BarChart3,
  Package,
  ShoppingCart,
  ArrowRightLeft,
  Users,
  Settings,
  Home,
  FileText,
  Building2,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    description: 'Overview and key metrics',
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    description: 'Product management',
    children: [
      { name: 'Products', href: '/inventory/products', icon: GastronomyIcons.Apple },
      { name: 'Categories', href: '/inventory/categories', icon: GastronomyIcons.Plate },
      { name: 'Stock Levels', href: '/inventory/stock', icon: GastronomyIcons.Warehouse },
    ],
  },
  {
    name: 'Purchasing',
    href: '/purchasing',
    icon: ShoppingCart,
    description: 'Purchase orders and suppliers',
    children: [
      { name: 'Purchase Orders', href: '/purchasing/orders', icon: FileText },
      { name: 'Suppliers', href: '/purchasing/suppliers', icon: Building2 },
      { name: 'Receipts', href: '/purchasing/receipts', icon: GastronomyIcons.Receipt },
    ],
  },
  {
    name: 'Transfers',
    href: '/transfers',
    icon: ArrowRightLeft,
    description: 'Inter-location transfers',
    children: [
      { name: 'Active Transfers', href: '/transfers/active', icon: GastronomyIcons.Truck },
      { name: 'Transfer History', href: '/transfers/history', icon: FileText },
      { name: 'Emergency Transfers', href: '/transfers/emergency', icon: GastronomyIcons.Timer },
    ],
  },
  {
    name: 'Allocations',
    href: '/allocations',
    icon: GastronomyIcons.Scale,
    description: 'Resource allocation',
    children: [
      { name: 'Current Allocations', href: '/allocations/current', icon: GastronomyIcons.ChartPie },
      { name: 'Templates', href: '/allocations/templates', icon: FileText },
      { name: 'Unallocated Items', href: '/allocations/unallocated', icon: Package },
    ],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Reports and insights',
    children: [
      { name: 'Performance', href: '/analytics/performance', icon: GastronomyIcons.TrendingUp },
      { name: 'Cost Analysis', href: '/analytics/costs', icon: GastronomyIcons.ChartPie },
      { name: 'Variance Reports', href: '/analytics/variance', icon: BarChart3 },
    ],
  },
  {
    name: 'Locations',
    href: '/locations',
    icon: GastronomyIcons.MapPin,
    description: 'Restaurant locations',
  },
  {
    name: 'Users',
    href: '/users',
    icon: Users,
    description: 'User management',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'System configuration',
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href)
        ? prev.filter(item => item !== href)
        : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isExpanded = (href: string) => {
    return expandedItems.includes(href) || pathname.startsWith(href + '/');
  };

  return (
    <motion.div
      className={cn(
        'flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl',
        collapsed ? 'w-16' : 'w-64'
      )}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-slate-700/50 bg-slate-900/50">
        <motion.div
          className="flex items-center space-x-3"
          animate={{ opacity: collapsed ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
            <GastronomyIcons.Chef className="h-6 w-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                GastronomOS
              </h1>
              <p className="text-xs text-slate-400">Restaurant Management</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const expanded = isExpanded(item.href);

          return (
            <div key={item.name}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href={item.children ? '#' : item.href}
                  onClick={(e) => {
                    if (item.children) {
                      e.preventDefault();
                      toggleExpanded(item.href);
                    }
                  }}
                  className={cn(
                    'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 shadow-lg shadow-orange-500/10'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0 transition-colors',
                      active ? 'text-orange-400' : 'text-slate-400 group-hover:text-white'
                    )}
                  />
                  {!collapsed && (
                    <>
                      <span className="ml-3 flex-1">{item.name}</span>
                      {item.children && (
                        <motion.div
                          animate={{ rotate: expanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <svg
                            className="h-4 w-4 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </motion.div>
                      )}
                    </>
                  )}
                </Link>
              </motion.div>

              {/* Submenu */}
              {item.children && !collapsed && (
                <motion.div
                  initial={false}
                  animate={{
                    height: expanded ? 'auto' : 0,
                    opacity: expanded ? 1 : 0,
                  }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isActive(child.href);

                      return (
                        <motion.div
                          key={child.name}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Link
                            href={child.href}
                            className={cn(
                              'group flex items-center rounded-lg px-3 py-2 text-sm transition-all duration-200',
                              childActive
                                ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-300'
                                : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
                            )}
                          >
                            <ChildIcon
                              className={cn(
                                'h-4 w-4 flex-shrink-0',
                                childActive ? 'text-orange-400' : 'text-slate-500 group-hover:text-slate-300'
                              )}
                            />
                            <span className="ml-3">{child.name}</span>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-slate-700/50 p-4">
        <motion.div
          className="flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 transition-colors hover:bg-slate-700/50"
          whileHover={{ scale: 1.02 }}
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <span className="text-sm font-semibold text-white">JD</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">John Doe</p>
              <p className="text-xs text-slate-400 truncate">Restaurant Manager</p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}