/**
 * Allocation Rules Wizard
 * Multi-step wizard for creating allocation rules with criteria and mapping steps
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Trash2, Settings, MapPin, FileText, Check, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Wizard, createWizardConfig } from '@/components/ui/wizard';
import { WizardConfig } from '@/contexts/wizard-context';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animation-utils';

// Types
interface Location {
  id: string;
  name: string;
  type: string;
  address?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
}

interface AllocationCriteria {
  type: 'category' | 'supplier' | 'product' | 'value';
  categoryIds?: string[];
  supplierIds?: string[];
  productIds?: string[];
  minValue?: number;
  maxValue?: number;
  conditions: string[];
}

interface LocationMapping {
  locationId: string;
  location?: Location;
  percentage: number;
  priority: number;
  maxQuantity?: number;
  notes?: string;
}

interface AllocationRuleData {
  name: string;
  description?: string;
  criteria: AllocationCriteria;
  locationMappings: LocationMapping[];
  isActive: boolean;
  notes?: string;
}

// Step 1: Rule Definition
interface RuleDefinitionProps {
  stepData?: { name?: string; description?: string; isActive?: boolean };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function RuleDefinitionStep({ stepData, onDataChange }: RuleDefinitionProps) {
  const [name, setName] = useState(stepData?.name || '');
  const [description, setDescription] = useState(stepData?.description || '');
  const [isActive, setIsActive] = useState(stepData?.isActive ?? true);

  useEffect(() => {
    onDataChange?.({ name, description, isActive });
  }, [name, description, isActive, onDataChange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Settings className="w-5 h-5" />
        <span>Define the basic information for your allocation rule</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rule Information</CardTitle>
          <CardDescription>
            Provide a name and description for this allocation rule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name *</Label>
            <Input
              id="rule-name"
              placeholder="e.g., Restaurant Priority Allocation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-description">Description</Label>
            <Textarea
              id="rule-description"
              placeholder="Describe what this allocation rule does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="rule-active">Active Rule</Label>
              <p className="text-sm text-muted-foreground">
                Enable this rule to start applying it to new purchase orders
              </p>
            </div>
            <Switch
              id="rule-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </CardContent>
      </Card>

      {name && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.default}
        >
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-5 h-5" />
                <span className="font-medium">
                  Rule "{name}" {isActive ? 'will be active' : 'will be inactive'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// Step 2: Criteria Definition
interface CriteriaDefinitionProps {
  stepData?: { criteria?: AllocationCriteria };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function CriteriaDefinitionStep({ stepData, onDataChange }: CriteriaDefinitionProps) {
  const [criteriaType, setCriteriaType] = useState<'category' | 'supplier' | 'product' | 'value'>(
    stepData?.criteria?.type || 'category'
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    stepData?.criteria?.categoryIds || []
  );
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(
    stepData?.criteria?.supplierIds || []
  );
  const [minValue, setMinValue] = useState<number>(stepData?.criteria?.minValue || 0);
  const [maxValue, setMaxValue] = useState<number>(stepData?.criteria?.maxValue || 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const criteria: AllocationCriteria = {
      type: criteriaType,
      conditions: [],
    };

    switch (criteriaType) {
      case 'category':
        criteria.categoryIds = selectedCategoryIds;
        criteria.conditions = selectedCategoryIds.length > 0 
          ? [`Categories: ${categories.filter(c => selectedCategoryIds.includes(c.id)).map(c => c.name).join(', ')}`]
          : [];
        break;
      case 'supplier':
        criteria.supplierIds = selectedSupplierIds;
        criteria.conditions = selectedSupplierIds.length > 0
          ? [`Suppliers: ${suppliers.filter(s => selectedSupplierIds.includes(s.id)).map(s => s.name).join(', ')}`]
          : [];
        break;
      case 'value':
        criteria.minValue = minValue;
        criteria.maxValue = maxValue;
        criteria.conditions = [];
        if (minValue > 0) criteria.conditions.push(`Min value: $${minValue.toFixed(2)}`);
        if (maxValue > 0) criteria.conditions.push(`Max value: $${maxValue.toFixed(2)}`);
        break;
    }

    onDataChange?.({ criteria });
  }, [criteriaType, selectedCategoryIds, selectedSupplierIds, minValue, maxValue, categories, suppliers, onDataChange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesResponse, suppliersResponse] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getSuppliers(),
      ]);

      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data.categories || []);
      }
      if (suppliersResponse.success) {
        setSuppliers(suppliersResponse.data.suppliers || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const criteriaTypes = [
    {
      value: 'category' as const,
      label: 'Product Category',
      description: 'Apply rule based on product categories',
    },
    {
      value: 'supplier' as const,
      label: 'Supplier',
      description: 'Apply rule based on suppliers',
    },
    {
      value: 'value' as const,
      label: 'Order Value',
      description: 'Apply rule based on order value ranges',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Settings className="w-5 h-5" />
        <span>Define when this allocation rule should be applied</span>
      </div>

      {/* Criteria Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Criteria Type</CardTitle>
          <CardDescription>
            Choose what triggers this allocation rule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {criteriaTypes.map((type) => (
              <motion.div
                key={type.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
              >
                <Card 
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    criteriaType === type.value && "border-primary bg-primary/5"
                  )}
                  onClick={() => setCriteriaType(type.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{type.label}</h4>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      {criteriaType === type.value && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Criteria Configuration */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.default}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Criteria Configuration</CardTitle>
              <CardDescription>
                Configure the specific criteria for this rule
              </CardDescription>
            </CardHeader>
            <CardContent>
              {criteriaType === 'category' && (
                <div className="space-y-4">
                  <Label>Select Categories</Label>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`category-${category.id}`}
                          checked={selectedCategoryIds.includes(category.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategoryIds([...selectedCategoryIds, category.id]);
                            } else {
                              setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== category.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`category-${category.id}`} className="text-sm font-normal">
                          {category.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedCategoryIds.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Select at least one category to apply this rule
                    </p>
                  )}
                </div>
              )}

              {criteriaType === 'supplier' && (
                <div className="space-y-4">
                  <Label>Select Suppliers</Label>
                  <div className="space-y-2">
                    {suppliers.map((supplier) => (
                      <div key={supplier.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`supplier-${supplier.id}`}
                          checked={selectedSupplierIds.includes(supplier.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSupplierIds([...selectedSupplierIds, supplier.id]);
                            } else {
                              setSelectedSupplierIds(selectedSupplierIds.filter(id => id !== supplier.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`supplier-${supplier.id}`} className="text-sm font-normal">
                          {supplier.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedSupplierIds.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Select at least one supplier to apply this rule
                    </p>
                  )}
                </div>
              )}

              {criteriaType === 'value' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-value">Minimum Value ($)</Label>
                      <Input
                        id="min-value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={minValue}
                        onChange={(e) => setMinValue(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-value">Maximum Value ($)</Label>
                      <Input
                        id="max-value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={maxValue}
                        onChange={(e) => setMaxValue(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Leave maximum value as 0 for no upper limit
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// Step 3: Location Mapping
interface LocationMappingProps {
  stepData?: { locationMappings?: LocationMapping[] };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function LocationMappingStep({ stepData, onDataChange }: LocationMappingProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationMappings, setLocationMappings] = useState<LocationMapping[]>(
    stepData?.locationMappings || []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    onDataChange?.({ locationMappings });
  }, [locationMappings, onDataChange]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getLocations({ active: true });
      if (response.success) {
        setLocations(response.data.locations || []);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLocationMapping = () => {
    const availableLocations = locations.filter(
      location => !locationMappings.some(mapping => mapping.locationId === location.id)
    );

    if (availableLocations.length > 0) {
      const newMapping: LocationMapping = {
        locationId: availableLocations[0].id,
        location: availableLocations[0],
        percentage: 0,
        priority: locationMappings.length + 1,
      };
      setLocationMappings([...locationMappings, newMapping]);
    }
  };

  const updateLocationMapping = (index: number, updates: Partial<LocationMapping>) => {
    const updatedMappings = [...locationMappings];
    updatedMappings[index] = { ...updatedMappings[index], ...updates };
    
    // Update location object if locationId changed
    if (updates.locationId) {
      const location = locations.find(l => l.id === updates.locationId);
      updatedMappings[index].location = location;
    }
    
    setLocationMappings(updatedMappings);
  };

  const removeLocationMapping = (index: number) => {
    setLocationMappings(locationMappings.filter((_, i) => i !== index));
  };

  const totalPercentage = locationMappings.reduce((sum, mapping) => sum + mapping.percentage, 0);
  const availableLocations = locations.filter(
    location => !locationMappings.some(mapping => mapping.locationId === location.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="w-5 h-5" />
        <span>Define how items should be allocated across locations</span>
      </div>

      {/* Current Mappings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Location Mappings</CardTitle>
              <CardDescription>
                Allocate percentages to different locations (Total: {totalPercentage}%)
              </CardDescription>
            </div>
            <Button
              onClick={addLocationMapping}
              disabled={availableLocations.length === 0}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {locationMappings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No location mappings defined</p>
              <p className="text-sm mt-2">Add locations to define allocation rules</p>
            </div>
          ) : (
            <div className="space-y-4">
              {locationMappings.map((mapping, index) => (
                <motion.div
                  key={`${mapping.locationId}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.default}
                  className="p-4 border rounded-lg space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Location {index + 1}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLocationMapping(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Select
                        value={mapping.locationId}
                        onValueChange={(value) => updateLocationMapping(index, { locationId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Current selection */}
                          {mapping.location && (
                            <SelectItem value={mapping.locationId}>
                              {mapping.location.name} ({mapping.location.type})
                            </SelectItem>
                          )}
                          {/* Available locations */}
                          {availableLocations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name} ({location.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Percentage
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={mapping.percentage}
                        onChange={(e) => updateLocationMapping(index, { 
                          percentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        min="1"
                        value={mapping.priority}
                        onChange={(e) => updateLocationMapping(index, { 
                          priority: Math.max(1, parseInt(e.target.value) || 1)
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Quantity (Optional)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={mapping.maxQuantity || ''}
                      onChange={(e) => updateLocationMapping(index, { 
                        maxQuantity: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      placeholder="No limit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Input
                      value={mapping.notes || ''}
                      onChange={(e) => updateLocationMapping(index, { notes: e.target.value })}
                      placeholder="Add notes for this location mapping..."
                    />
                  </div>
                </motion.div>
              ))}

              {/* Percentage Validation */}
              {totalPercentage !== 100 && locationMappings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.default}
                >
                  <Card className={cn(
                    "border-2",
                    totalPercentage > 100 ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
                  )}>
                    <CardContent className="p-4">
                      <div className={cn(
                        "flex items-center gap-2",
                        totalPercentage > 100 ? "text-red-700" : "text-yellow-700"
                      )}>
                        <Percent className="w-5 h-5" />
                        <span className="font-medium">
                          {totalPercentage > 100 
                            ? `Total percentage exceeds 100% (${totalPercentage}%)`
                            : `Total percentage is ${totalPercentage}% (should be 100%)`
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Step 4: Review
interface ReviewStepProps {
  stepData?: { notes?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function ReviewStep({ stepData, wizardData, onDataChange }: ReviewStepProps) {
  const [notes, setNotes] = useState(stepData?.notes || '');
  
  const ruleData = wizardData?.['rule-definition'];
  const criteriaData = wizardData?.['criteria-definition'];
  const mappingData = wizardData?.['location-mapping'];
  
  useEffect(() => {
    onDataChange?.({ notes });
  }, [notes, onDataChange]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="w-5 h-5" />
        <span>Review your allocation rule configuration</span>
      </div>

      {/* Rule Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rule Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Name</Label>
              <p className="font-medium">{ruleData?.name}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <Badge variant={ruleData?.isActive ? "default" : "secondary"}>
                {ruleData?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {ruleData?.description && (
            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="text-sm">{ruleData.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Criteria Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Allocation Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <Label className="text-sm text-muted-foreground">Type</Label>
              <p className="font-medium capitalize">{criteriaData?.criteria?.type}</p>
            </div>
            {criteriaData?.criteria?.conditions?.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">Conditions</Label>
                <ul className="text-sm space-y-1">
                  {criteriaData.criteria.conditions.map((condition: string, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-600" />
                      {condition}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Mappings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {mappingData?.locationMappings?.length > 0 ? (
            <div className="space-y-3">
              {mappingData.locationMappings.map((mapping: LocationMapping, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{mapping.location?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Priority: {mapping.priority}
                      {mapping.maxQuantity && ` • Max: ${mapping.maxQuantity}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg">
                    {mapping.percentage}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No location mappings defined</p>
          )}
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Notes (Optional)</CardTitle>
          <CardDescription>
            Add any additional notes or comments about this allocation rule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Main Allocation Rules Wizard Component
interface AllocationRulesWizardProps {
  onComplete?: (data: AllocationRuleData) => void;
  onCancel?: () => void;
  className?: string;
}

export function AllocationRulesWizard({ onComplete, onCancel, className }: AllocationRulesWizardProps) {
  const handleComplete = async (wizardData: Record<string, any>) => {
    try {
      const ruleData = wizardData['rule-definition'];
      const criteriaData = wizardData['criteria-definition'];
      const mappingData = wizardData['location-mapping'];
      const reviewData = wizardData['review'];

      if (!ruleData?.name || !criteriaData?.criteria || !mappingData?.locationMappings?.length) {
        throw new Error('Missing required data');
      }

      // Create the allocation rule
      const allocationData = {
        name: ruleData.name,
        description: ruleData.description,
        templateData: JSON.stringify({
          criteria: criteriaData.criteria,
          locationMappings: mappingData.locationMappings,
          isActive: ruleData.isActive,
          notes: reviewData?.notes,
        }),
      };

      const response = await apiClient.createAllocation(allocationData);
      
      if (response.allocation) {
        // Call completion callback
        onComplete?.({
          name: ruleData.name,
          description: ruleData.description,
          criteria: criteriaData.criteria,
          locationMappings: mappingData.locationMappings,
          isActive: ruleData.isActive,
          notes: reviewData?.notes,
        });
      }
    } catch (error) {
      console.error('Failed to create allocation rule:', error);
      throw error;
    }
  };

  const wizardConfig: WizardConfig = createWizardConfig(
    'allocation-rules-wizard',
    'Create Allocation Rule',
    [
      {
        id: 'rule-definition',
        title: 'Rule Definition',
        description: 'Define basic rule information',
        component: RuleDefinitionStep,
        validation: (data) => !!data?.name?.trim(),
      },
      {
        id: 'criteria-definition',
        title: 'Criteria Definition',
        description: 'Define when this rule applies',
        component: CriteriaDefinitionStep,
        validation: (data) => {
          const criteria = data?.criteria;
          if (!criteria) return false;
          
          switch (criteria.type) {
            case 'category':
              return criteria.categoryIds?.length > 0;
            case 'supplier':
              return criteria.supplierIds?.length > 0;
            case 'value':
              return criteria.minValue >= 0;
            default:
              return false;
          }
        },
      },
      {
        id: 'location-mapping',
        title: 'Location Mapping',
        description: 'Define allocation percentages',
        component: LocationMappingStep,
        validation: (data) => {
          const mappings = data?.locationMappings || [];
          if (mappings.length === 0) return false;
          
          const totalPercentage = mappings.reduce((sum: number, mapping: LocationMapping) => 
            sum + mapping.percentage, 0
          );
          return totalPercentage === 100;
        },
      },
      {
        id: 'review',
        title: 'Review & Create',
        description: 'Review and create the allocation rule',
        component: ReviewStep,
        validation: () => true, // Notes are optional
      },
    ],
    {
      onComplete: handleComplete,
      onCancel,
      allowBackNavigation: true,
      persistState: true,
    }
  );

  return (
    <div className={className}>
      <Wizard
        config={wizardConfig}
        persistenceKey="allocation-rules-wizard"
        showProgress={true}
        showNavigation={true}
        navigationVariant="full"
        stepVariant="card"
        animated={true}
        onComplete={onComplete as ((data: Record<string, any>) => void) | undefined}
        onCancel={onCancel}
      />
    </div>
  );
}

export default AllocationRulesWizard;