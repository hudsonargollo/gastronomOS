'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/hooks/use-translations';

interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbNavigationProps {
  className?: string;
  customItems?: BreadcrumbItem[];
}

export function BreadcrumbNavigation({ className, customItems }: BreadcrumbNavigationProps) {
  const pathname = usePathname();
  const { t } = useTranslations();

  // Generate breadcrumb items from pathname if no custom items provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (customItems) return customItems;

    const pathSegments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: t('navigation.dashboard'), href: '/dashboard', icon: Home }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip dashboard as it's already added as home
      if (segment === 'dashboard') return;

      // Map segments to readable labels
      const label = getSegmentLabel(segment, pathSegments, index);
      breadcrumbs.push({
        label,
        href: currentPath
      });
    });

    return breadcrumbs;
  };

  const getSegmentLabel = (segment: string, segments: string[], index: number): string => {
    // Navigation mapping
    const navigationMap: Record<string, string> = {
      'inventory': t('navigation.inventory'),
      'products': t('navigation.products'),
      'categories': t('navigation.categories'),
      'stock': t('navigation.stockLevels'),
      'purchasing': t('navigation.purchasing'),
      'orders': t('navigation.purchaseOrders'),
      'suppliers': t('navigation.suppliers'),
      'receipts': t('navigation.receipts'),
      'transfers': t('navigation.transfers'),
      'active': t('navigation.activeTransfers'),
      'history': t('navigation.transferHistory'),
      'emergency': t('navigation.emergencyTransfers'),
      'allocations': t('navigation.allocations'),
      'current': t('navigation.currentAllocations'),
      'templates': t('navigation.templates'),
      'unallocated': t('navigation.unallocatedItems'),
      'analytics': t('navigation.analytics'),
      'performance': t('navigation.performance'),
      'costs': t('navigation.costAnalysis'),
      'variance': t('navigation.varianceReports'),
      'locations': t('navigation.locations'),
      'users': t('navigation.users'),
      'settings': t('navigation.settings')
    };

    // Check if it's a known navigation item
    if (navigationMap[segment]) {
      return navigationMap[segment];
    }

    // If it looks like an ID (numbers, hyphens, etc.), try to get a more meaningful label
    if (/^[0-9-]+$/.test(segment)) {
      const parentSegment = segments[index - 1];
      if (parentSegment === 'orders') return `Order #${segment}`;
      if (parentSegment === 'transfers') return `Transfer #${segment}`;
      if (parentSegment === 'products') return `Product #${segment}`;
      return `#${segment}`;
    }

    // Fallback: capitalize and replace hyphens with spaces
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs for single-level pages
  }

  return (
    <motion.nav
      className={cn(
        'flex items-center space-x-1 text-sm text-slate-600 py-2',
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex items-center">
              {index > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <ChevronRight className="h-4 w-4 text-slate-400 mx-1" />
                </motion.div>
              )}
              
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center"
              >
                {isLast ? (
                  <span
                    className="flex items-center font-medium text-slate-900 cursor-default"
                    aria-current="page"
                  >
                    {Icon && <Icon className="h-4 w-4 mr-1.5" />}
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="flex items-center hover:text-slate-900 transition-colors duration-200 rounded px-1 py-0.5 hover:bg-slate-100"
                  >
                    {Icon && <Icon className="h-4 w-4 mr-1.5" />}
                    {item.label}
                  </Link>
                )}
              </motion.div>
            </li>
          );
        })}
      </ol>
    </motion.nav>
  );
}