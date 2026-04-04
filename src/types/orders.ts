// Order system type definitions

import { 
  OrderState, 
  OrderItemStatus, 
  PaymentMethod, 
  PaymentStatus, 
  CommissionType,
  PaymentGatewayProvider 
} from '../db/schema';

// Core order interfaces
export interface OrderDetails {
  id: string;
  tenantId: string;
  orderNumber: string;
  state: OrderState;
  tableNumber?: string;
  waiterId?: string;
  locationId: string;
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  specialInstructions?: string;
  estimatedReadyTime?: number;
  actualReadyTime?: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  items: OrderItemDetails[];
}

export interface OrderItemDetails {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
  status: OrderItemStatus;
  createdAt: number;
}

export interface MenuItemDetails {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  categoryId?: string;
  isAvailable: boolean;
  preparationTime: number;
  imageUrl?: string;
  allergens?: string[];
  nutritionalInfo?: Record<string, any>;
  active: boolean;
  recipe?: RecipeDetails;
}

export interface RecipeDetails {
  id: string;
  menuItemId: string;
  instructions?: string;
  preparationTime: number;
  servingSize: number;
  ingredients: RecipeIngredientDetails[];
}

export interface RecipeIngredientDetails {
  id: string;
  recipeId: string;
  productId: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  notes?: string;
}

// State transition interfaces
export interface StateTransitionRequest {
  orderId: string;
  fromState?: OrderState;
  toState: OrderState;
  transitionedBy?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface StateTransitionResult {
  success: boolean;
  newState?: OrderState;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface StateTransitionLog {
  id: string;
  tenantId: string;
  orderId: string;
  fromState?: OrderState;
  toState: OrderState;
  transitionedBy?: string;
  transitionedAt: number;
  reason?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Payment interfaces
export interface PaymentDetails {
  id: string;
  tenantId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  gatewayTransactionId?: string;
  gatewayResponse?: Record<string, any>;
  processedBy?: string;
  createdAt: number;
  processedAt?: number;
  failedAt?: number;
  errorMessage?: string;
}

export interface SplitPaymentDetails {
  id: string;
  tenantId: string;
  orderId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isComplete: boolean;
  createdAt: number;
  completedAt?: number;
  payments: PaymentDetails[];
}

export interface PaymentRequest {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  processedBy?: string;
  gatewayData?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  payment?: PaymentDetails;
  error?: string;
  errorCode?: string;
  gatewayResponse?: Record<string, any>;
}

// Commission interfaces
export interface CommissionDetails {
  id: string;
  tenantId: string;
  waiterId: string;
  orderId: string;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  commissionType: CommissionType;
  calculatedAt: number;
  paidAt?: number;
  notes?: string;
}

export interface CommissionConfig {
  id: string;
  tenantId: string;
  defaultType: CommissionType;
  defaultRate: number;
  menuItemId?: string;
  itemSpecificType?: CommissionType;
  itemSpecificRate?: number;
  active: boolean;
}

export interface CommissionCalculationRequest {
  orderId: string;
  waiterId: string;
  orderAmount: number;
  orderItems: OrderItemDetails[];
}

export interface CommissionCalculationResult {
  success: boolean;
  commission?: CommissionDetails;
  error?: string;
  errorCode?: string;
}

// Inventory consumption interfaces
export interface InventoryConsumptionDetails {
  id: string;
  tenantId: string;
  orderId: string;
  productId: string;
  locationId: string;
  quantityConsumed: number;
  unit: string;
  consumedAt: number;
  reversedAt?: number;
  reversedBy?: string;
  notes?: string;
}

export interface InventoryConsumptionRequest {
  orderId: string;
  locationId: string;
  consumptions: {
    productId: string;
    quantity: number;
    unit: string;
  }[];
}

export interface InventoryConsumptionResult {
  success: boolean;
  consumptions?: InventoryConsumptionDetails[];
  error?: string;
  errorCode?: string;
}

// Order creation interfaces
export interface CreateOrderRequest {
  tenantId: string;
  locationId: string;
  tableNumber?: string;
  waiterId?: string;
  items: {
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  specialInstructions?: string;
}

export interface CreateOrderResult {
  success: boolean;
  order?: OrderDetails;
  error?: string;
  errorCode?: string;
}

// Order update interfaces
export interface UpdateOrderRequest {
  orderId: string;
  version: number;
  tableNumber?: string;
  waiterId?: string;
  specialInstructions?: string;
  items?: {
    id?: string;
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }[];
}

export interface UpdateOrderResult {
  success: boolean;
  order?: OrderDetails;
  error?: string;
  errorCode?: string;
}

// Error types
export enum OrderErrorCode {
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVALID_MENU_ITEM = 'INVALID_MENU_ITEM',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  INVALID_WAITER = 'INVALID_WAITER',
  INVALID_LOCATION = 'INVALID_LOCATION',
  COMMISSION_CALCULATION_FAILED = 'COMMISSION_CALCULATION_FAILED',
  INVENTORY_LOCK_FAILED = 'INVENTORY_LOCK_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

// Valid state transitions
export const VALID_STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  [OrderState.PLACED]: [OrderState.PREPARING, OrderState.CANCELLED],
  [OrderState.PREPARING]: [OrderState.READY, OrderState.CANCELLED],
  [OrderState.READY]: [OrderState.DELIVERED, OrderState.CANCELLED],
  [OrderState.DELIVERED]: [], // Terminal state
  [OrderState.CANCELLED]: [] // Terminal state
};

// State transition validation
export function isValidStateTransition(fromState: OrderState, toState: OrderState): boolean {
  return VALID_STATE_TRANSITIONS[fromState]?.includes(toState) ?? false;
}

// Order state helpers
export function isTerminalState(state: OrderState): boolean {
  return state === OrderState.DELIVERED || state === OrderState.CANCELLED;
}

export function canModifyOrder(state: OrderState): boolean {
  return state === OrderState.PLACED;
}

export function requiresInventoryConsumption(state: OrderState): boolean {
  return state === OrderState.PREPARING;
}

export function requiresPayment(state: OrderState): boolean {
  return state === OrderState.DELIVERED;
}