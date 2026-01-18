# Implementation Plan: Centralized Purchasing

## Overview

This implementation plan builds the centralized purchasing system for GastronomOS, enabling restaurant organizations to manage bulk procurement through a headquarters model. The system implements a complete purchase order lifecycle with state machine-driven workflows, supplier management, and price history tracking.

## Tasks

- [x] 1. Database Schema Extensions
  - [x] 1.1 Extend Drizzle schema for purchasing tables
    - Add suppliers, purchase_orders, po_items, price_history tables
    - Define proper relationships and constraints
    - Add indexes for performance optimization
    - _Requirements: 1.1, 2.1, 2.2_

  - [ ]* 1.2 Write property test for supplier uniqueness
    - **Property 1: Supplier Name Uniqueness**
    - **Validates: Requirements 1.1**

  - [x] 1.3 Create database migrations for purchasing schema
    - Generate migration files for new tables
    - Add migration runner integration
    - Test migration rollback capabilities
    - _Requirements: 1.1, 2.1_

- [x] 2. Supplier Management System
  - [x] 2.1 Implement SupplierService class
    - Create supplier CRUD operations with tenant isolation
    - Add supplier validation and business rules
    - Implement supplier search and filtering
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.2 Write unit tests for supplier operations
    - Test supplier creation and validation
    - Test tenant isolation for supplier data
    - Test supplier update and deletion scenarios
    - _Requirements: 1.1, 1.2_

  - [x] 2.3 Create supplier management API endpoints
    - POST /suppliers for supplier creation
    - GET /suppliers for listing with pagination
    - PUT /suppliers/:id for updates
    - DELETE /suppliers/:id for deletion
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Purchase Order Core System
  - [x] 3.1 Implement PurchaseOrderService class
    - Create PO draft creation and management
    - Add line item management (add, update, remove)
    - Implement PO calculation and totaling logic
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.2 Write property test for PO calculations
    - **Property 2: Purchase Order Total Consistency**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 3.3 Create purchase order API endpoints
    - POST /purchase-orders for PO creation
    - GET /purchase-orders for listing and filtering
    - GET /purchase-orders/:id for detailed view
    - POST /purchase-orders/:id/items for line item management
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Purchase Order State Machine
  - [x] 4.1 Implement POStateMachine class
    - Define state transition rules and validations
    - Add business logic for each state change
    - Implement transition context and audit logging
    - _Requirements: 2.4, 2.5_

  - [x]* 4.2 Write property test for state machine invariants
    - **Property 3: State Machine Consistency**
    - **Validates: Requirements 2.4, 2.5**

  - [x] 4.3 Add state transition API endpoints
    - POST /purchase-orders/:id/approve for PO approval
    - POST /purchase-orders/:id/receive for receiving
    - POST /purchase-orders/:id/cancel for cancellation
    - _Requirements: 2.4, 2.5_

  - [x]* 4.4 Write unit tests for state transitions
    - Test valid state transitions
    - Test invalid transition prevention
    - Test transition authorization requirements
    - _Requirements: 2.4, 2.5_
- [x] 5. Price History and Intelligence
  - [x] 5.1 Implement PriceHistoryService class
    - Create price tracking for all PO line items
    - Add price suggestion algorithm based on history
    - Implement price trend analysis and reporting
    - _Requirements: 2.2, 2.6_

  - [ ]* 5.2 Write property test for price history accuracy
    - **Property 4: Price History Consistency**
    - **Validates: Requirements 2.2, 2.6**

  - [x] 5.3 Add price intelligence API endpoints
    - GET /suppliers/:id/products/:id/price-history
    - GET /suppliers/:id/products/:id/price-suggestion
    - GET /products/:id/price-trends
    - _Requirements: 2.2, 2.6_

- [x] 6. PO Number Generation and Management
  - [x] 6.1 Implement PO number generation system
    - Create unique PO number generator per tenant
    - Add configurable PO number formats
    - Ensure thread-safe number generation
    - _Requirements: 2.4_

  - [ ]* 6.2 Write property test for PO number uniqueness
    - **Property 5: PO Number Uniqueness**
    - **Validates: Requirements 2.4**

  - [x] 6.3 Integrate PO numbers with approval workflow
    - Generate PO numbers only on approval
    - Update PO status and audit trail
    - Handle PO number conflicts gracefully
    - _Requirements: 2.4_

- [x] 7. Authorization and Role Integration
  - [x] 7.1 Add purchasing-specific authorization rules
    - Define permissions for PO creation, approval, receiving
    - Integrate with existing role-based authorization
    - Add location-based PO access controls
    - _Requirements: 2.7, 2.8_

  - [ ]* 7.2 Write property test for purchasing authorization
    - **Property 6: Purchasing Authorization Consistency**
    - **Validates: Requirements 2.7, 2.8**

  - [x] 7.3 Create authorization middleware for purchasing
    - Add PO-specific permission checks
    - Implement approval workflow authorization
    - Add audit logging for authorization decisions
    - _Requirements: 2.7, 2.8_

- [x] 8. Audit and Compliance System
  - [x] 8.1 Implement PO audit logging system
    - Create comprehensive audit trail for all PO changes
    - Log state transitions with full context
    - Add audit query and reporting capabilities
    - _Requirements: 2.9_

  - [ ]* 8.2 Write property test for audit completeness
    - **Property 7: Audit Trail Completeness**
    - **Validates: Requirements 2.9**

  - [x] 8.3 Add audit reporting API endpoints
    - GET /purchase-orders/:id/audit-trail
    - GET /audit/purchase-orders for compliance reporting
    - Add audit data export capabilities
    - _Requirements: 2.9_

- [x] 9. Integration with Product Catalog
  - [x] 9.1 Integrate with existing product system
    - Link PO line items to product catalog
    - Add product validation for line items
    - Implement product search for PO creation
    - _Requirements: 2.1, 2.2_

  - [ ]* 9.2 Write integration tests for product linking
    - Test product validation in PO line items
    - Test product catalog integration
    - Test product data consistency
    - _Requirements: 2.1, 2.2_

  - [x] 9.3 Add product-related purchasing endpoints
    - GET /products/:id/purchase-history
    - GET /products/search for PO line item selection
    - POST /purchase-orders/:id/items/from-catalog
    - _Requirements: 2.1, 2.2_

- [x] 10. Checkpoint - Core Purchasing Validation
  - Ensure all purchase order workflows function correctly
  - Verify state machine transitions work properly
  - Confirm supplier management and price history accuracy
  - Ask the user if questions arise about purchasing logic

- [x] 11. Advanced Features and Optimization
  - [x] 11.1 Add bulk operations support
    - Implement bulk PO creation from templates
    - Add bulk line item import from CSV/Excel
    - Create bulk approval workflows
    - _Requirements: 2.3_

  - [ ]* 11.2 Write performance tests for bulk operations
    - Test bulk PO creation performance
    - Test large line item handling
    - Test concurrent PO operations
    - _Requirements: Performance validation_

  - [x] 11.3 Add purchasing analytics and reporting
    - Implement spend analysis by supplier/category
    - Add PO performance metrics and KPIs
    - Create purchasing trend reports
    - _Requirements: 2.6_

- [x] 12. Final Checkpoint - Complete Purchasing System
  - Run complete test suite including all property-based tests
  - Verify purchasing workflows integrate with authentication system
  - Confirm all business rules and constraints are enforced
  - Ensure system is ready for distributed allocation integration

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate business rule consistency across all inputs
- Unit tests validate specific purchasing scenarios and edge cases
- The system must maintain strict tenant isolation for all purchasing data
- All PO operations must be properly audited for compliance
- State machine transitions must be atomic and consistent