/**
 * Manual Payment Logger Demo
 * Demonstrates how to use the ManualPaymentLogger service
 */

import { ManualPaymentLogger, type ManualPaymentRequest } from '../services/manual-payment-logger';

async function demonstrateManualPaymentValidation() {
  // Create a simple mock that just validates without database calls
  const mockDb = {};
  const logger = new ManualPaymentLogger(mockDb as any);
  const tenantId = 'tenant-456';

  console.log('=== Manual Payment Validation Demo ===\n');

  // Example 1: Invalid payment - missing reference number
  console.log('1. Attempting payment with missing reference number...');
  const invalidPayment1: ManualPaymentRequest = {
    orderId: 'order-123',
    method: 'MANUAL_CARD',
    amount: 5000,
    referenceNumber: '', // Invalid - empty reference
    processedBy: 'cashier-001'
  };

  const result1 = await logger.logPayment(tenantId, invalidPayment1);
  console.log('Result:', {
    success: result1.success,
    error: result1.error,
    errorCode: result1.errorCode
  });
  console.log('');

  // Example 2: Invalid payment - invalid amount
  console.log('2. Attempting payment with invalid amount...');
  const invalidPayment2: ManualPaymentRequest = {
    orderId: 'order-123',
    method: 'CASH',
    amount: 0, // Invalid - zero amount
    referenceNumber: 'CASH-REF-789',
    processedBy: 'cashier-001'
  };

  const result2 = await logger.logPayment(tenantId, invalidPayment2);
  console.log('Result:', {
    success: result2.success,
    error: result2.error,
    errorCode: result2.errorCode
  });
  console.log('');

  // Example 3: Invalid payment method
  console.log('3. Attempting payment with invalid method...');
  const invalidPayment3: ManualPaymentRequest = {
    orderId: 'order-123',
    method: 'PIX' as any, // Invalid for manual payments
    amount: 5000,
    referenceNumber: 'PIX-REF-123',
    processedBy: 'cashier-001'
  };

  const result3 = await logger.logPayment(tenantId, invalidPayment3);
  console.log('Result:', {
    success: result3.success,
    error: result3.error,
    errorCode: result3.errorCode
  });
  console.log('');

  // Example 4: Invalid reference number length
  console.log('4. Attempting payment with invalid reference number length...');
  const invalidPayment4: ManualPaymentRequest = {
    orderId: 'order-123',
    method: 'MANUAL_CARD',
    amount: 5000,
    referenceNumber: 'AB', // Too short
    processedBy: 'cashier-001'
  };

  const result4 = await logger.logPayment(tenantId, invalidPayment4);
  console.log('Result:', {
    success: result4.success,
    error: result4.error,
    errorCode: result4.errorCode
  });
  console.log('');

  // Example 5: Valid payment structure (will fail at database level in demo)
  console.log('5. Valid payment structure (validation passes)...');
  const validPayment: ManualPaymentRequest = {
    orderId: 'order-123',
    method: 'MANUAL_CARD',
    amount: 5000,
    referenceNumber: 'VALID-REF-123',
    processedBy: 'cashier-001',
    notes: 'Payment processed via external card machine'
  };

  const result5 = await logger.logPayment(tenantId, validPayment);
  console.log('Result:', {
    success: result5.success,
    error: result5.error,
    errorCode: result5.errorCode
  });
  console.log('Note: This fails at database level since we have no real database in demo');
  console.log('');

  console.log('=== Demo Complete ===');
  console.log('The ManualPaymentLogger successfully validates:');
  console.log('- Required fields (orderId, method, amount, referenceNumber, processedBy)');
  console.log('- Payment method restrictions (only MANUAL_CARD and CASH allowed)');
  console.log('- Amount validation (must be > 0)');
  console.log('- Reference number format (3-50 characters)');
}

// Export for use in other files
export { demonstrateManualPaymentValidation };

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateManualPaymentValidation().catch(console.error);
}