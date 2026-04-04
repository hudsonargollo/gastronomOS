// Property-Based Tests for Order State Engine
// Feature: digital-menu-kitchen-payment-system, Property 1: Order State Machine Enforcement
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { OrderStateEngine } from './order-state-engine';
import { OrderState } from '../db/schema';
import { 
  StateTransitionRequest, 
  VALID_STATE_TRANSITIONS,
  isValidStateTransition,
  isTerminalState,
  OrderErrorCode
} from '../types/orders';

// Mock database
const mockDb = {
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn()
};

// Mock order data generator
const orderGenerator = fc.record({
  id: fc.uuid(),
  tenantId: fc.uuid(),
  orderNumber: fc.string({ minLength: 8, maxLength: 20 }),
  state: fc.constantFrom(...Object.values(OrderState)),
  version: fc.integer({ min: 1, max: 100 }),
  locationId: fc.uuid(),
  totalAmount: fc.integer({ min: 100, max: 100000 }),
  createdAt: fc.integer({ min: 1640995200000, max: Date.now() }),
  updatedAt: fc.integer({ min: 1640995200000, max: Date.now() })
});

// State transition generator
const stateTransitionGenerator = fc.record({
  orderId: fc.uuid(),
  fromState: fc.option(fc.constantFrom(...Object.values(OrderState))),
  toState: fc.constantFrom(...Object.values(OrderState)),
  transitionedBy: fc.option(fc.uuid()),
  reason: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()))
});

describe('OrderStateEngine Property Tests', () => {
  let orderStateEngine: OrderStateEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    orderStateEngine = new OrderStateEngine(mockDb);
  });

  describe('Property 1: Order State Machine Enforcement', () => {
    it('should enforce valid state transitions and reject invalid ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderGenerator,
          stateTransitionGenerator,
          async (order, transitionRequest) => {
            // Setup mock database responses
            mockDb.transaction.mockImplementation(async (callback) => {
              const mockTx = {
                select: vi.fn().mockReturnValue({
                  from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([order])
                    })
                  })
                }),
                update: vi.fn().mockReturnValue({
                  set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({ changes: 1 }) // Simulate successful update
                  })
                }),
                insert: vi.fn().mockReturnValue({
                  values: vi.fn().mockResolvedValue({})
                })
              };
              return await callback(mockTx);
            });

            const request: StateTransitionRequest = {
              ...transitionRequest,
              orderId: order.id
            };

            const result = await orderStateEngine.transitionState(request);

            // Property: Valid transitions should succeed, invalid ones should fail
            const currentState = order.state as OrderState;
            const isValidTransition = isValidStateTransition(currentState, request.toState);
            const isTerminalState = currentState === OrderState.DELIVERED || currentState === OrderState.CANCELLED;
            const hasConcurrentModification = request.fromState && request.fromState !== currentState;

            if (isTerminalState) {
              // Terminal states should never allow transitions
              expect(result.success).toBe(false);
              expect(result.errorCode).toBe(OrderErrorCode.INVALID_STATE_TRANSITION);
            } else if (hasConcurrentModification) {
              // Concurrent modification should be detected first
              expect(result.success).toBe(false);
              expect(result.errorCode).toBe(OrderErrorCode.CONCURRENT_MODIFICATION);
            } else if (isValidTransition) {
              // Valid transitions should succeed
              expect(result.success).toBe(true);
              expect(result.newState).toBe(request.toState);
            } else {
              // Invalid transitions should fail
              expect(result.success).toBe(false);
              expect(result.errorCode).toBe(OrderErrorCode.INVALID_STATE_TRANSITION);
            }
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });

    it('should maintain state transition consistency across all possible sequences', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...Object.values(OrderState)), { minLength: 2, maxLength: 5 }),
          async (stateSequence) => {
            // Property: Any sequence of states should follow valid transition rules
            for (let i = 0; i < stateSequence.length - 1; i++) {
              const fromState = stateSequence[i];
              const toState = stateSequence[i + 1];
              
              const isValid = isValidStateTransition(fromState, toState);
              const validNextStates = VALID_STATE_TRANSITIONS[fromState] || [];
              
              // The transition should be valid if and only if toState is in validNextStates
              expect(isValid).toBe(validNextStates.includes(toState));
            }
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });

    it('should handle concurrent modifications with optimistic locking', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderGenerator.filter(order => {
            // Only test non-terminal states that have valid next states
            const currentState = order.state as OrderState;
            return !isTerminalState(currentState) && VALID_STATE_TRANSITIONS[currentState]?.length > 0;
          }),
          fc.integer({ min: 1, max: 10 }),
          async (order, _versionMismatch) => {
            const currentState = order.state as OrderState;
            const validNextStates = VALID_STATE_TRANSITIONS[currentState] || [];
            
            // Skip if no valid transitions available
            if (validNextStates.length === 0) return;
            
            // Pick a valid next state
            const toState = validNextStates[0];

            // Setup mock for concurrent modification scenario (optimistic lock failure)
            mockDb.transaction.mockImplementation(async (callback) => {
              const mockTx = {
                select: vi.fn().mockReturnValue({
                  from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([order])
                    })
                  })
                }),
                update: vi.fn().mockReturnValue({
                  set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({ changes: 0 }) // Simulate optimistic lock failure
                  })
                }),
                insert: vi.fn().mockReturnValue({
                  values: vi.fn().mockResolvedValue({})
                })
              };
              return await callback(mockTx);
            });

            const request: StateTransitionRequest = {
              orderId: order.id,
              fromState: currentState, // Set fromState to current order state
              toState: toState
            };

            const result = await orderStateEngine.transitionState(request);

            // Property: Valid transitions with optimistic lock failure should return CONCURRENT_MODIFICATION
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(OrderErrorCode.CONCURRENT_MODIFICATION);
          }
        ),
        { numRuns: 50, verbose: true }
      );
    });

    it('should validate state transition history consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(
            fc.record({
              fromState: fc.option(fc.constantFrom(...Object.values(OrderState))),
              toState: fc.constantFrom(...Object.values(OrderState)),
              transitionedAt: fc.integer({ min: 1640995200000, max: Date.now() })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (orderId, transitions) => {
            // Sort transitions by time
            const sortedTransitions = transitions.sort((a, b) => a.transitionedAt - b.transitionedAt);

            // Mock the database to return order data
            const mockOrder = {
              id: orderId,
              tenantId: 'test-tenant',
              state: sortedTransitions[sortedTransitions.length - 1].toState, // Last transition state
              version: 1
            };

            // Mock order lookup
            mockDb.select.mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockOrder])
                })
              })
            });

            // Mock transition history lookup
            mockDb.select.mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(
                    sortedTransitions.map((t, index) => ({
                      id: `transition-${index}`,
                      tenantId: 'test-tenant',
                      orderId: orderId,
                      fromState: t.fromState,
                      toState: t.toState,
                      transitionedAt: t.transitionedAt,
                      metadata: null
                    }))
                  )
                })
              })
            });

            const validation = await orderStateEngine.validateOrderState(orderId);

            // Property: Transition history should follow valid state machine rules
            let hasValidationIssues = false;
            let expectedState: OrderState | null = null; // Start with null for initial transition

            for (const transition of sortedTransitions) {
              // First transition should have null fromState and go to PLACED
              if (expectedState === null) {
                if (transition.fromState !== null && transition.fromState !== undefined) {
                  hasValidationIssues = true;
                  break;
                }
                if (transition.toState !== OrderState.PLACED) {
                  hasValidationIssues = true;
                  break;
                }
                expectedState = transition.toState;
                continue;
              }

              if (transition.fromState && transition.fromState !== expectedState) {
                hasValidationIssues = true;
                break;
              }

              if (!isValidStateTransition(transition.fromState || OrderState.PLACED, transition.toState)) {
                hasValidationIssues = true;
                break;
              }

              expectedState = transition.toState;
            }

            expect(validation.isValid).toBe(!hasValidationIssues);
            if (hasValidationIssues) {
              expect(validation.issues.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });

    it('should correctly identify valid next states for any current state', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(OrderState)),
          (currentState) => {
            const validNextStates = orderStateEngine.getValidNextStates(currentState);
            const expectedStates = VALID_STATE_TRANSITIONS[currentState] || [];

            // Property: Valid next states should match the state machine definition
            expect(validNextStates).toEqual(expectedStates);

            // Property: All returned states should be valid transitions
            for (const nextState of validNextStates) {
              expect(orderStateEngine.isValidTransition(currentState, nextState)).toBe(true);
            }

            // Property: Terminal states should have no valid next states
            if (currentState === OrderState.DELIVERED || currentState === OrderState.CANCELLED) {
              expect(validNextStates).toEqual([]);
            }
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });

    it('should handle batch state transitions atomically', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              orderId: fc.uuid(),
              fromState: fc.constantFrom(...Object.values(OrderState)),
              toState: fc.constantFrom(...Object.values(OrderState))
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (batchRequests) => {
            // Mock individual transition calls
            const mockTransitionState = vi.spyOn(orderStateEngine, 'transitionState');
            
            for (const request of batchRequests) {
              const isValid = isValidStateTransition(request.fromState, request.toState);
              mockTransitionState.mockResolvedValueOnce({
                success: isValid,
                newState: isValid ? request.toState : undefined,
                error: isValid ? undefined : 'Invalid transition',
                errorCode: isValid ? undefined : OrderErrorCode.INVALID_STATE_TRANSITION
              });
            }

            const results = await orderStateEngine.batchTransitionStates(batchRequests);

            // Property: Batch results should match individual transition validations
            expect(results).toHaveLength(batchRequests.length);
            
            for (let i = 0; i < batchRequests.length; i++) {
              const request = batchRequests[i];
              const result = results[i];
              const expectedSuccess = isValidStateTransition(request.fromState, request.toState);
              
              expect(result.success).toBe(expectedSuccess);
              if (expectedSuccess) {
                expect(result.newState).toBe(request.toState);
              } else {
                expect(result.errorCode).toBe(OrderErrorCode.INVALID_STATE_TRANSITION);
              }
            }

            mockTransitionState.mockRestore();
          }
        ),
        { numRuns: 50, verbose: true }
      );
    });
  });

  describe('State Machine Invariants', () => {
    it('should maintain state machine invariants across all operations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(OrderState)),
          fc.constantFrom(...Object.values(OrderState)),
          (fromState, toState) => {
            const isValid = orderStateEngine.isValidTransition(fromState, toState);
            const validStates = VALID_STATE_TRANSITIONS[fromState] || [];

            // Invariant: isValidTransition should be consistent with VALID_STATE_TRANSITIONS
            expect(isValid).toBe(validStates.includes(toState));

            // Invariant: No state should transition to itself except through explicit rules
            if (fromState === toState) {
              expect(isValid).toBe(false);
            }

            // Invariant: Terminal states should not allow any transitions
            if (fromState === OrderState.DELIVERED || fromState === OrderState.CANCELLED) {
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 200, verbose: true }
      );
    });
  });
});