# Requirements Document

## Introduction

The Distributed Allocation system enables restaurant organizations to split bulk purchases across multiple delivery locations before physical delivery occurs. This system is the core differentiator of GastronomOS, allowing headquarters to purchase large quantities (e.g., 500kg of Wagyu beef) and virtually allocate portions to specific satellite locations (e.g., Beach House A gets 50kg, Commissary gets 200kg) with full tracking through delivery and receipt.

## Glossary

- **Allocation**: A virtual assignment of purchased quantity to a specific location before delivery
- **Approved_PO**: A purchase order that has been approved and locked from editing
- **Allocation_Matrix**: The interface showing how PO line items are distributed across locations
- **Over_Allocation**: When total allocated quantity exceeds the purchased quantity
- **Unallocated_Reserve**: Purchased quantity not yet assigned to any location
- **Allocation_Status**: The current state of an allocation (PENDING, SHIPPED, RECEIVED)
- **Central_Warehouse**: Default location for unallocated inventory

## Requirements

### Requirement 1: Allocation Matrix Management

**User Story:** As a procurement officer, I want to allocate purchased quantities across multiple locations, so that each location receives the appropriate amount of inventory.

#### Acceptance Criteria

1. WHEN viewing an approved PO, THE System SHALL display an allocation interface showing all line items and available locations
2. WHEN allocating quantities, THE System SHALL allow selection of target locations and input of allocation amounts
3. WHEN displaying the allocation matrix, THE System SHALL show current allocations, remaining unallocated quantities, and allocation status
4. THE System SHALL calculate and display allocation totals and remaining quantities in real-time
5. WHEN saving allocations, THE System SHALL validate that all allocations are within purchased quantities

### Requirement 2: Allocation Validation and Business Rules

**User Story:** As a system administrator, I want strict validation of allocations, so that over-allocation errors are prevented and data integrity is maintained.

#### Acceptance Criteria

1. IF the total allocated quantity for a line item exceeds the purchased quantity, THEN THE System SHALL block the save operation and return a validation error
2. WHEN calculating allocation totals, THE System SHALL ensure the sum of all allocations never exceeds the ordered quantity
3. WHEN an allocation is created, THE System SHALL validate that the target location exists and is accessible to the user
4. THE System SHALL prevent allocation modifications once the allocation status changes to SHIPPED
5. WHEN allocations are updated, THE System SHALL recalculate totals and validate constraints in real-time

### Requirement 3: Unallocated Inventory Management

**User Story:** As a restaurant manager, I want to track unallocated inventory, so that I know what quantities are available for future allocation or remain in central storage.

#### Acceptance Criteria

1. IF a line item is not fully allocated, THE System SHALL track the remainder as unallocated reserve
2. WHEN displaying allocation summaries, THE System SHALL show unallocated quantities for each line item
3. WHERE tenant configuration specifies, THE System SHALL automatically assign unallocated quantities to a central warehouse location
4. THE System SHALL allow manual allocation of previously unallocated quantities to locations
5. WHEN generating reports, THE System SHALL include unallocated inventory in central warehouse calculations

### Requirement 4: Allocation Status Tracking

**User Story:** As a location manager, I want to track the status of my allocated inventory, so that I know when to expect deliveries and can plan accordingly.

#### Acceptance Criteria

1. WHEN an allocation is created, THE System SHALL set the initial status to PENDING
2. WHEN a PO is marked as shipped, THE System SHALL update relevant allocation statuses to SHIPPED
3. WHEN a location confirms receipt, THE System SHALL update the allocation status to RECEIVED
4. THE System SHALL track allocation status changes with timestamps and user context
5. WHEN querying allocations, THE System SHALL filter results by status for operational reporting

### Requirement 5: Location-Based Allocation Access

**User Story:** As a location manager, I want to see only my location's allocations, so that I can focus on relevant inventory without seeing other locations' data.

#### Acceptance Criteria

1. WHEN a location-scoped user views allocations, THE System SHALL filter results to show only their assigned location
2. WHEN creating allocations, THE System SHALL restrict location selection based on user permissions
3. IF a user has multi-location access, THE System SHALL show allocations for all accessible locations
4. WHEN displaying allocation summaries, THE System SHALL respect location-based access controls
5. THE System SHALL audit allocation access attempts for security monitoring

### Requirement 6: Allocation Modification and History

**User Story:** As a procurement officer, I want to modify allocations before shipping, so that I can adjust quantities based on changing location needs.

#### Acceptance Criteria

1. WHEN an allocation is in PENDING status, THE System SHALL allow quantity modifications within validation constraints
2. WHEN allocation quantities are changed, THE System SHALL log the modification with user context and timestamp
3. IF an allocation is modified, THE System SHALL recalculate dependent allocations and totals
4. WHEN allocations are in SHIPPED or RECEIVED status, THE System SHALL prevent further modifications
5. THE System SHALL maintain a complete history of allocation changes for audit purposes

### Requirement 7: Bulk Allocation Operations

**User Story:** As a procurement officer, I want to perform bulk allocation operations, so that I can efficiently distribute large purchase orders across many locations.

#### Acceptance Criteria

1. WHEN allocating multiple line items, THE System SHALL support bulk allocation by percentage or fixed amounts
2. WHEN using allocation templates, THE System SHALL apply predefined distribution patterns across locations
3. THE System SHALL validate bulk operations against the same constraints as individual allocations
4. WHEN bulk operations fail validation, THE System SHALL provide detailed error information for each failed allocation
5. THE System SHALL support bulk allocation rollback if any part of the operation fails

### Requirement 8: Integration with Purchase Order Workflow

**User Story:** As a system component, I want seamless integration with the purchase order system, so that allocations are properly linked to approved purchases.

#### Acceptance Criteria

1. WHEN a PO is approved, THE System SHALL make it available for allocation operations
2. WHEN PO line items are modified before approval, THE System SHALL clear any existing draft allocations
3. THE System SHALL prevent allocation operations on POs that are not in APPROVED status
4. WHEN a PO is cancelled, THE System SHALL automatically cancel all associated allocations
5. THE System SHALL maintain referential integrity between PO line items and allocations