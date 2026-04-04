/**
 * Sketch & Wire Icon Library
 * Comprehensive icon path definitions for the Adaptive Gastronomy Design System
 */

export type IconCategory = 
  | 'kitchen'
  | 'food'
  | 'inventory'
  | 'operations'
  | 'analytics'
  | 'locations'
  | 'documents'
  | 'ui'
  | 'status'
  | 'payment';

export interface IconDefinition {
  paths: string[];
  category: IconCategory;
  description: string;
}

/**
 * Complete icon library with categorization
 */
export const iconLibrary: Record<string, IconDefinition> = {
  // Kitchen & Cooking
  chef: {
    paths: [
      'M6 2.2v5.8a6 6 0 0 0 12 0V2.2',
      'M8 2v4.1',
      'M10 2v4',
      'M12 2v4.1',
      'M14 2v3.9',
      'M16 2v4',
      'M6.1 8v13.8a2 2 0 0 0 2 2h7.8a2 2 0 0 0 2-2V8.1',
    ],
    category: 'kitchen',
    description: 'Chef hat icon',
  },
  plate: {
    paths: [
      'M12 12c0 5.5-4.5 10-10 10s10-4.5 10-10 4.5-10 10-10-10 4.5-10 10',
      'M12 12m-6 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0',
      'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
    ],
    category: 'kitchen',
    description: 'Plate icon',
  },
  utensils: {
    paths: [
      'M3 2.1v6.9c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2',
      'M7 2.1v19.8',
      'M21 15V2.2a5 5 0 0 0-5 5v5.9c0 1.1.9 2 2 2h3Z',
      'M18 15v6.9',
    ],
    category: 'kitchen',
    description: 'Fork and knife icon',
  },
  cookingPot: {
    paths: [
      'M2 12h20',
      'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
      'M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2',
      'M2 12l1-4h18l1 4',
    ],
    category: 'kitchen',
    description: 'Cooking pot icon',
  },
  
  // Food Items
  apple: {
    paths: [
      'M12 20.9c1.5 0 2.8 1.1 4 1.1 3 0 6-8 6-12.2A4.9 4.9 0 0 0 17 5c-2.2 0-4 1.4-5 2-1-.6-2.8-2-5-2a4.9 4.9 0 0 0-5 4.8C2 14 5 22 8 22c1.3 0 2.5-1.1 4-1.1Z',
      'M10 2c1 .5 2 2 2 5',
    ],
    category: 'food',
    description: 'Apple icon',
  },
  carrot: {
    paths: [
      'M2.3 21.7s9.9-3.5 12.7-6.4a4.5 4.5 0 0 0-6.4-6.4C5.8 11.8 2.3 21.7 2.3 21.7z',
      'M8.6 14l-2-2',
      'M15.3 15l-2.5-2.5',
      'M22 9s-1.3-2-3.5-2C16.9 7 15 9 15 9s1.3 2 3.5 2S22 9 22 9z',
      'M15 2s-2 1.3-2 3.5S15 9 15 9s2-1.8 2-3.5S15 2 15 2z',
    ],
    category: 'food',
    description: 'Carrot icon',
  },
  coffee: {
    paths: [
      'M18 8h1a4 4 0 0 1 0 8h-1',
      'M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z',
      'M6 1v3',
      'M10 1v3',
      'M14 1v3',
    ],
    category: 'food',
    description: 'Coffee cup icon',
  },
  pizza: {
    paths: [
      'M12 2a10 10 0 1 0 10 10',
      'M12 2v10l8.7 5',
      'M8 8l.01.01',
      'M16 8l.01.01',
      'M12 14l.01.01',
    ],
    category: 'food',
    description: 'Pizza slice icon',
  },
  
  // Inventory & Storage
  warehouse: {
    paths: [
      'M22 8.4V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.4A2 2 0 0 1 3.3 6.5l7.9-3.2a2 2 0 0 1 1.5 0l8 3.2A2 2 0 0 1 22 8.4Z',
      'M6 18h12',
      'M6 14h12',
      'M12 6v12',
    ],
    category: 'inventory',
    description: 'Warehouse icon',
  },
  refrigerator: {
    paths: [
      'M4 2h16v20H4z',
      'M4 12h16',
      'M8 6v2',
      'M8 14v2',
    ],
    category: 'inventory',
    description: 'Refrigerator icon',
  },
  box: {
    paths: [
      'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      'M3.3 7l8.7 5 8.7-5',
      'M12 22V12',
    ],
    category: 'inventory',
    description: 'Box/package icon',
  },
  package: {
    paths: [
      'M16.5 9.4l-9-5.2',
      'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      'M3.3 7l8.7 5 8.7-5',
      'M12 22V12',
    ],
    category: 'inventory',
    description: 'Package icon',
  },
  
  // Operations
  scale: {
    paths: [
      'M16 11V7a4 4 0 0 0-8 0v4',
      'M8 11c-2.5 2.5-2.5 6.5 0 9s6.5 2.5 9 0 2.5-6.5 0-9',
      'M16 11c2.5 2.5 2.5 6.5 0 9s-6.5 2.5-9 0-2.5-6.5 0-9',
    ],
    category: 'operations',
    description: 'Scale/balance icon',
  },
  timer: {
    paths: [
      'M12 13m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0',
      'M12 9v4l2 2',
      'M5 3L2 6',
      'M22 6l-3-3',
      'M6.4 18.7L4 21',
      'M17.6 18.7L20 21',
    ],
    category: 'operations',
    description: 'Timer icon',
  },
  clock: {
    paths: [
      'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
      'M12 6v6l4 2',
    ],
    category: 'operations',
    description: 'Clock icon',
  },
  calendar: {
    paths: [
      'M8 2v4',
      'M16 2v4',
      'M3 10h18',
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    ],
    category: 'operations',
    description: 'Calendar icon',
  },
  
  // Analytics & Reports
  chartPie: {
    paths: [
      'M21.2 15.9A10 10 0 1 1 8 2.8',
      'M22 12A10 10 0 0 0 12 2v10z',
    ],
    category: 'analytics',
    description: 'Pie chart icon',
  },
  trendingUp: {
    paths: [
      'M22 7l-9.5 8.5-5-5L2 17',
      'M16 7h6v6',
    ],
    category: 'analytics',
    description: 'Trending up icon',
  },
  trendingDown: {
    paths: [
      'M22 17l-9.5-8.5-5 5L2 7',
      'M16 17h6v-6',
    ],
    category: 'analytics',
    description: 'Trending down icon',
  },
  barChart: {
    paths: [
      'M3 3v18h18',
      'M18 17V9',
      'M13 17V5',
      'M8 17v-3',
    ],
    category: 'analytics',
    description: 'Bar chart icon',
  },
  
  // Locations & Transport
  mapPin: {
    paths: [
      'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z',
      'M12 10m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
    ],
    category: 'locations',
    description: 'Map pin icon',
  },
  truck: {
    paths: [
      'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2',
      'M15 18H9',
      'M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14',
      'M17 18m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
      'M7 18m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
    ],
    category: 'locations',
    description: 'Delivery truck icon',
  },
  store: {
    paths: [
      'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      'M9 22V12h6v10',
    ],
    category: 'locations',
    description: 'Store/building icon',
  },
  
  // Documents & Receipts
  receipt: {
    paths: [
      'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z',
      'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8',
      'M12 18V6',
    ],
    category: 'documents',
    description: 'Receipt icon',
  },
  scan: {
    paths: [
      'M3 7V5a2 2 0 0 1 2-2h2',
      'M17 3h2a2 2 0 0 1 2 2v2',
      'M21 17v2a2 2 0 0 1-2 2h-2',
      'M7 21H5a2 2 0 0 1-2-2v-2',
      'M7 8h10',
      'M7 12h10',
      'M7 16h10',
    ],
    category: 'documents',
    description: 'QR code scan icon',
  },
  fileText: {
    paths: [
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      'M14 2v6h6',
      'M16 13H8',
      'M16 17H8',
      'M10 9H8',
    ],
    category: 'documents',
    description: 'Document icon',
  },
  clipboard: {
    paths: [
      'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
      'M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z',
    ],
    category: 'documents',
    description: 'Clipboard icon',
  },
  
  // UI Controls
  menu: {
    paths: [
      'M3 12h18',
      'M3 6h18',
      'M3 18h18',
    ],
    category: 'ui',
    description: 'Menu icon',
  },
  close: {
    paths: [
      'M18 6L6 18',
      'M6 6l12 12',
    ],
    category: 'ui',
    description: 'Close/X icon',
  },
  check: {
    paths: [
      'M20 6L9 17l-5-5',
    ],
    category: 'ui',
    description: 'Checkmark icon',
  },
  chevronRight: {
    paths: ['M9 18l6-6-6-6'],
    category: 'ui',
    description: 'Chevron right icon',
  },
  chevronLeft: {
    paths: ['M15 18l-6-6 6-6'],
    category: 'ui',
    description: 'Chevron left icon',
  },
  chevronDown: {
    paths: ['M6 9l6 6 6-6'],
    category: 'ui',
    description: 'Chevron down icon',
  },
  chevronUp: {
    paths: ['M18 15l-6-6-6 6'],
    category: 'ui',
    description: 'Chevron up icon',
  },
  plus: {
    paths: [
      'M12 5v14',
      'M5 12h14',
    ],
    category: 'ui',
    description: 'Plus icon',
  },
  minus: {
    paths: ['M5 12h14'],
    category: 'ui',
    description: 'Minus icon',
  },
  search: {
    paths: [
      'M11 11m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0',
      'M21 21l-4.4-4.4',
    ],
    category: 'ui',
    description: 'Search icon',
  },
  settings: {
    paths: [
      'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
      'M12 1v6',
      'M12 17v6',
      'M4.2 4.2l4.2 4.2',
      'M15.6 15.6l4.2 4.2',
      'M1 12h6',
      'M17 12h6',
      'M4.2 19.8l4.2-4.2',
      'M15.6 8.4l4.2-4.2',
    ],
    category: 'ui',
    description: 'Settings icon',
  },
  filter: {
    paths: [
      'M22 3H2l8 9.5V19l4 2v-8.5L22 3z',
    ],
    category: 'ui',
    description: 'Filter icon',
  },
  edit: {
    paths: [
      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
      'M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    ],
    category: 'ui',
    description: 'Edit icon',
  },
  trash: {
    paths: [
      'M3 6h18',
      'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
      'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    ],
    category: 'ui',
    description: 'Trash/delete icon',
  },
  
  // Status & Notifications
  user: {
    paths: [
      'M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
      'M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2',
    ],
    category: 'status',
    description: 'User icon',
  },
  users: {
    paths: [
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M23 21v-2a4 4 0 0 0-3-3.9',
      'M16 3.1a4 4 0 0 1 0 7.8',
    ],
    category: 'status',
    description: 'Multiple users icon',
  },
  bell: {
    paths: [
      'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9',
      'M13.7 21a2 2 0 0 1-3.4 0',
    ],
    category: 'status',
    description: 'Notification bell icon',
  },
  heart: {
    paths: [
      'M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z',
    ],
    category: 'status',
    description: 'Heart/favorite icon',
  },
  star: {
    paths: [
      'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3 1.2-6.8-5-4.9 6.9-1z',
    ],
    category: 'status',
    description: 'Star/rating icon',
  },
  info: {
    paths: [
      'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
      'M12 16v-4',
      'M12 8h.01',
    ],
    category: 'status',
    description: 'Information icon',
  },
  alert: {
    paths: [
      'M10.3 3.3a2 2 0 0 1 3.4 0l8.5 14.3a2 2 0 0 1-1.7 3H3.5a2 2 0 0 1-1.7-3z',
      'M12 9v4',
      'M12 17h.01',
    ],
    category: 'status',
    description: 'Alert/warning icon',
  },
  checkCircle: {
    paths: [
      'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
      'M9 12l2 2 4-4',
    ],
    category: 'status',
    description: 'Success/check circle icon',
  },
  xCircle: {
    paths: [
      'M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
      'M15 9l-6 6',
      'M9 9l6 6',
    ],
    category: 'status',
    description: 'Error/X circle icon',
  },
  
  // Payment
  creditCard: {
    paths: [
      'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
      'M1 10h22',
    ],
    category: 'payment',
    description: 'Credit card icon',
  },
  dollarSign: {
    paths: [
      'M12 1v22',
      'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    ],
    category: 'payment',
    description: 'Dollar sign icon',
  },
  wallet: {
    paths: [
      'M21 12V7H5a2 2 0 0 1 0-4h14v4',
      'M3 5v14a2 2 0 0 0 2 2h16v-5',
      'M18 12a2 2 0 0 0 0 4h4v-4z',
    ],
    category: 'payment',
    description: 'Wallet icon',
  },
  qrCode: {
    paths: [
      'M3 3h6v6H3z',
      'M15 3h6v6h-6z',
      'M3 15h6v6H3z',
      'M15 15h1.5',
      'M15 18h3',
      'M18 15v6',
      'M21 18h.01',
    ],
    category: 'payment',
    description: 'QR code icon',
  },
  payment: {
    paths: [
      'M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
      'M1 10h22',
      'M7 15h.01',
      'M11 15h2',
    ],
    category: 'payment',
    description: 'Payment icon',
  },
  cash: {
    paths: [
      'M2 8h20',
      'M2 16h20',
      'M6 12h12',
      'M6 12v4',
      'M18 12v4',
    ],
    category: 'payment',
    description: 'Cash/money icon',
  },
  split: {
    paths: [
      'M16 3h5v5',
      'M8 3H3v5',
      'M12 22v-8.3a4 4 0 0 0-1.2-2.8L7 7',
      'M12 22v-8.3a4 4 0 0 1 1.2-2.8L17 7',
      'M21 3l-7.5 7.5',
      'M3 3l7.5 7.5',
    ],
    category: 'payment',
    description: 'Split payment icon',
  },
  terminal: {
    paths: [
      'M4 17l6-6-6-6',
      'M12 19h8',
    ],
    category: 'ui',
    description: 'Terminal/command icon',
  },
  loading: {
    paths: [
      'M12 2v4',
      'M12 18v4',
      'M4.9 4.9l2.8 2.8',
      'M16.2 16.2l2.8 2.8',
      'M2 12h4',
      'M18 12h4',
      'M4.9 19.1l2.8-2.8',
      'M16.2 7.8l2.8-2.8',
    ],
    category: 'ui',
    description: 'Loading/spinner icon',
  },
  copy: {
    paths: [
      'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.2L16.8 4H10a2 2 0 0 0-2 2z',
      'M16 4v4h4',
      'M4 7.2V20a2 2 0 0 0 2 2h7',
    ],
    category: 'ui',
    description: 'Copy icon',
  },
  refresh: {
    paths: [
      'M21.5 2v6h-6',
      'M2.5 22v-6h6',
      'M2 11.5a10 10 0 0 1 18.8-4.3',
      'M22 12.5a10 10 0 0 1-18.8 4.2',
    ],
    category: 'ui',
    description: 'Refresh/reload icon',
  },
  printer: {
    paths: [
      'M6 9V2h12v7',
      'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
      'M6 14h12v8H6z',
    ],
    category: 'ui',
    description: 'Printer icon',
  },
  cashRegister: {
    paths: [
      'M2 17h20',
      'M6 17V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12',
      'M4 17v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
      'M10 8h4',
      'M10 12h4',
    ],
    category: 'payment',
    description: 'Cash register icon',
  },
  list: {
    paths: [
      'M8 6h13',
      'M8 12h13',
      'M8 18h13',
      'M3 6h.01',
      'M3 12h.01',
      'M3 18h.01',
    ],
    category: 'ui',
    description: 'List icon',
  },
  inbox: {
    paths: [
      'M22 12h-6l-2 3h-4l-2-3H2',
      'M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z',
    ],
    category: 'ui',
    description: 'Inbox icon',
  },
  arrowLeft: {
    paths: [
      'M19 12H5',
      'M12 19l-7-7 7-7',
    ],
    category: 'ui',
    description: 'Arrow left icon',
  },
};

/**
 * Get icons by category
 */
export function getIconsByCategory(category: IconCategory): string[] {
  return Object.entries(iconLibrary)
    .filter(([_, def]) => def.category === category)
    .map(([name]) => name);
}

/**
 * Get all icon names
 */
export function getAllIconNames(): string[] {
  return Object.keys(iconLibrary);
}

/**
 * Get icon definition
 */
export function getIconDefinition(name: string): IconDefinition | undefined {
  return iconLibrary[name];
}
