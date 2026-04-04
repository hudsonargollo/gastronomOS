# Cashier Panel Components

Payment processing and order completion interface components for the Digital Menu, Kitchen Orchestration & Payment System.

## Components

### PaymentProcessor

Main payment interface with method selection (Pix, credit, debit, manual, cash).

**Requirements**: 1.5, 5.1, 5.2, 6.1

**Features**:
- Payment method selection with visual cards
- Support for all payment types (Pix, credit/debit cards, manual card, cash)
- Split payment support with remaining balance display
- Configurable available payment methods

**Usage**:
```tsx
import { PaymentProcessor } from '@/components/cashier-panel';

<PaymentProcessor
  orderId="order-123"
  orderNumber="001"
  totalAmount={5000} // in cents
  remainingAmount={2000} // optional, for split payments
  onPaymentMethodSelect={(method) => console.log(method)}
  availableMethods={['PIX', 'CREDIT_CARD', 'CASH']}
/>
```

### SplitPaymentManager

Interface for handling multiple partial payments with real-time balance tracking.

**Requirements**: 7.1, 7.2

**Features**:
- Real-time balance tracking with progress bar
- Payment history display
- Overpayment detection and change calculation
- Support for mixed payment methods

**Usage**:
```tsx
import { SplitPaymentManager } from '@/components/cashier-panel';

<SplitPaymentManager
  orderId="order-123"
  orderNumber="001"
  balanceInfo={{
    totalAmount: 5000,
    paidAmount: 3000,
    remainingAmount: 2000,
    isComplete: false,
    paymentCount: 2,
    payments: [...]
  }}
  onAddPayment={() => console.log('Add payment')}
  onComplete={() => console.log('Complete order')}
/>
```

### PixGenerator

QR code generation and display for Pix payments with 15-minute expiration.

**Requirements**: 5.2

**Features**:
- Pix QR code generation
- 15-minute countdown timer
- Expiration handling
- QR code copy to clipboard
- Payment status checking

**Usage**:
```tsx
import { PixGenerator } from '@/components/cashier-panel';

<PixGenerator
  orderId="order-123"
  orderNumber="001"
  amount={5000}
  pixData={{
    pixId: 'pix-123',
    qrCode: 'pix-code-string',
    qrCodeBase64: 'base64-image',
    expirationDate: new Date(),
    gatewayTransactionId: 'mp-123'
  }}
  onGenerate={async () => console.log('Generate')}
  onCheckStatus={async () => console.log('Check status')}
/>
```

### ManualPaymentLogger

Interface for logging external machine payments.

**Requirements**: 6.1, 6.2, 6.3

**Features**:
- Manual card and cash payment logging
- Reference number validation
- Amount validation with warnings
- Optional notes field
- Split payment support

**Usage**:
```tsx
import { ManualPaymentLogger } from '@/components/cashier-panel';

<ManualPaymentLogger
  orderId="order-123"
  orderNumber="001"
  orderTotal={5000}
  remainingAmount={2000} // optional
  onSubmit={async (data) => console.log(data)}
/>
```

### ReceiptGenerator

Order completion and receipt display/printing.

**Requirements**: 1.5, 5.3

**Features**:
- Complete order receipt display
- Payment breakdown
- Change calculation display
- Print functionality
- Tenant branding support

**Usage**:
```tsx
import { ReceiptGenerator } from '@/components/cashier-panel';

<ReceiptGenerator
  receipt={{
    orderNumber: '001',
    orderId: 'order-123',
    tableNumber: '5',
    items: [...],
    subtotal: 5000,
    totalAmount: 5000,
    payments: [...],
    changeAmount: 500,
    completedAt: Date.now(),
    tenantName: 'Restaurant Name'
  }}
  onPrint={() => window.print()}
  onNewOrder={() => console.log('New order')}
/>
```

## Integration

All components integrate with:
- **Payment Gateway Service** (task 5) - For Pix, credit/debit processing
- **Split Payment Manager Service** (task 6) - For split payment logic
- **Manual Payment Logger Service** (task 5) - For manual payment logging
- **Order State Engine** (task 2) - For order state transitions
- **Commission Engine** (task 7) - For commission tracking
- **WebSocket Service** - For real-time updates
- **Adaptive Gastronomy Design System** - For theming and branding

## Design System

Components use the Adaptive Gastronomy design system:
- **Sketch & Wire Icons** - Hand-drawn style iconography
- **Semantic Tokens** - Theme-aware color system
- **Asymmetric Cards** - For payment method selection
- **Typography** - Consistent font hierarchy
- **Responsive Layout** - Mobile-optimized interfaces

## Workflow

1. **Order Ready for Payment** → Display in cashier panel
2. **Select Payment Method** → PaymentProcessor
3. **Process Payment**:
   - **Pix** → PixGenerator (QR code with 15-min timer)
   - **Card (Gateway)** → Payment gateway integration
   - **Manual/Cash** → ManualPaymentLogger
4. **Split Payment** → SplitPaymentManager (track balance)
5. **Payment Complete** → ReceiptGenerator
6. **Order Delivered** → State transition to DELIVERED

## Testing

Components should be tested for:
- Payment method selection and validation
- Split payment balance calculations
- Pix QR code expiration handling
- Manual payment validation
- Receipt generation and printing
- Real-time balance updates
- Error handling and user feedback
