'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
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
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function Sidebar({ collapsed = false, className }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const [isMobile, setIsMobile] = React.useState(false);

  const navigation = [
    {
      name: t('navigation.dashboard'),
      href: '/dashboard',
      icon: Home,
      description: t('sidebar.overviewMetrics'),
    },
    {
      name: t('navigation.inventory'),
      href: '/inventory',
      icon: Package,
      description: t('sidebar.productManagement'),
      children: [
        { name: t('navigation.products'), href: '/inventory/products', icon: GastronomyIcons.Apple },
        { name: t('navigation.categories'), href: '/inventory/categories', icon: GastronomyIcons.Plate },
        { name: t('navigation.stockLevels'), href: '/inventory/stock', icon: GastronomyIcons.Warehouse },
      ],
    },
    {
      name: t('navigation.purchasing'),
      href: '/purchasing',
      icon: ShoppingCart,
      description: t('sidebar.purchaseOrdersSuppliers'),
      children: [
        { name: t('navigation.purchaseOrders'), href: '/purchasing/orders', icon: FileText },
        { name: t('navigation.suppliers'), href: '/purchasing/suppliers', icon: Building2 },
        { name: t('navigation.receipts'), href: '/purchasing/receipts', icon: GastronomyIcons.Receipt },
      ],
    },
    {
      name: t('navigation.transfers'),
      href: '/transfers',
      icon: ArrowRightLeft,
      description: t('sidebar.interLocationTransfers'),
      children: [
        { name: t('navigation.activeTransfers'), href: '/transfers/active', icon: GastronomyIcons.Truck },
        { name: t('navigation.transferHistory'), href: '/transfers/history', icon: FileText },
        { name: t('navigation.emergencyTransfers'), href: '/transfers/emergency', icon: GastronomyIcons.Timer },
      ],
    },
    {
      name: t('navigation.allocations'),
      href: '/allocations',
      icon: GastronomyIcons.Scale,
      description: t('sidebar.resourceAllocation'),
      children: [
        { name: t('navigation.currentAllocations'), href: '/allocations/current', icon: GastronomyIcons.ChartPie },
        { name: t('navigation.templates'), href: '/allocations/templates', icon: FileText },
        { name: t('navigation.unallocatedItems'), href: '/allocations/unallocated', icon: Package },
      ],
    },
    {
      name: t('navigation.analytics'),
      href: '/analytics',
      icon: BarChart3,
      description: t('sidebar.reportsInsights'),
      children: [
        { name: t('navigation.performance'), href: '/analytics/performance', icon: GastronomyIcons.TrendingUp },
        { name: t('navigation.costAnalysis'), href: '/analytics/costs', icon: GastronomyIcons.ChartPie },
        { name: t('navigation.varianceReports'), href: '/analytics/variance', icon: BarChart3 },
      ],
    },
    {
      name: t('navigation.locations'),
      href: '/locations',
      icon: GastronomyIcons.MapPin,
      description: t('sidebar.restaurantLocations'),
    },
    {
      name: t('navigation.users'),
      href: '/users',
      icon: Users,
      description: t('sidebar.userManagement'),
    },
    {
      name: t('navigation.settings'),
      href: '/settings',
      icon: Settings,
      description: t('sidebar.systemConfiguration'),
    },
  ];

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand parent items based on current path
  React.useEffect(() => {
    const currentParent = navigation.find(item => 
      item.children?.some(child => pathname.startsWith(child.href))
    );
    if (currentParent && !expandedItems.includes(currentParent.href)) {
      setExpandedItems(prev => [...prev, currentParent.href]);
    }
  }, [pathname, expandedItems]);

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
        'flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl relative',
        collapsed ? 'w-16' : 'w-64 sm:w-72',
        className
      )}
      animate={{ width: collapsed ? 64 : isMobile ? 280 : 288 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <div className="flex h-14 sm:h-16 items-center justify-center border-b border-slate-700/50 bg-slate-900/50 px-3">
        <motion.div
          className="flex items-center space-x-3 w-full"
          animate={{ opacity: collapsed ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shrink-0">
            <GastronomyIcons.Chef className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent truncate">
                GastronomOS
              </h1>
              <p className="text-xs text-slate-400 truncate">{t('sidebar.restaurantManagement')}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 sm:p-4 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const expanded = isExpanded(item.href);

          return (
            <div key={item.name}>
              <motion.div
                whileHover={{ scale: collapsed ? 1.05 : 1.02 }}
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
                    'group flex items-center rounded-xl px-3 py-2.5 sm:py-3 text-sm font-medium transition-all duration-200 relative',
                    'min-h-[44px]', // Better touch target
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
                      <span className="ml-3 flex-1 truncate">{item.name}</span>
                      {item.children && (
                        <motion.div
                          animate={{ rotate: expanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-auto"
                        >
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </motion.div>
                      )}
                    </>
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </Link>
              </motion.div>

              {/* Submenu */}
              <AnimatePresence>
                {item.children && !collapsed && expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 sm:ml-8 mt-1 space-y-1">
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
                                'min-h-[40px]', // Better touch target
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
                              <span className="ml-3 truncate">{child.name}</span>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-slate-700/50 p-3 sm:p-4">
        <motion.div
          className={cn(
            'flex items-center space-x-3 rounded-xl bg-slate-800/50 p-3 transition-colors hover:bg-slate-700/50 cursor-pointer',
            'min-h-[52px]' // Better touch target
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-white">JD</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">João Silva</p>
              <p className="text-xs text-slate-400 truncate">{t('sidebar.restaurantManager')}</p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}