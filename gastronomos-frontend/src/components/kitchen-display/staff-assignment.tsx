/**
 * Staff Assignment Component
 * Tracks kitchen staff assignments and workload
 * Requirements: 11.4
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import type { KitchenOrder } from './kitchen-dashboard';

interface KitchenStaff {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  assignedOrders: number;
}

interface StaffAssignmentProps {
  order: KitchenOrder;
  onStaffAssign: (orderId: string, staffId: string) => void;
}

export function StaffAssignment({ order, onStaffAssign }: StaffAssignmentProps) {
  const [staff, setStaff] = useState<KitchenStaff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [assignedStaff, setAssignedStaff] = useState<string | null>(null);

  useEffect(() => {
    // Fetch kitchen staff
    fetchKitchenStaff();
  }, []);

  const fetchKitchenStaff = async () => {
    try {
      const response = await fetch('/api/v1/kitchen/staff');
      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Error fetching kitchen staff:', error);
      // Mock data for development
      setStaff([
        { id: '1', name: 'Chef Maria', role: 'Head Chef', isActive: true, assignedOrders: 3 },
        { id: '2', name: 'Chef John', role: 'Line Cook', isActive: true, assignedOrders: 2 },
        { id: '3', name: 'Chef Sarah', role: 'Prep Cook', isActive: true, assignedOrders: 1 },
        { id: '4', name: 'Chef Mike', role: 'Line Cook', isActive: false, assignedOrders: 0 },
      ]);
    }
  };

  const handleAssign = () => {
    if (selectedStaffId) {
      onStaffAssign(order.id, selectedStaffId);
      setAssignedStaff(selectedStaffId);
    }
  };

  const getStaffById = (staffId: string): KitchenStaff | undefined => {
    return staff.find(s => s.id === staffId);
  };

  const activeStaff = staff.filter(s => s.isActive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SketchWireIcon name="user" size={20} />
          Staff Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Assignment */}
        {assignedStaff ? (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Assigned to:
                </p>
                <p className="text-lg font-bold text-green-900 dark:text-green-200">
                  {getStaffById(assignedStaff)?.name || 'Unknown'}
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  {getStaffById(assignedStaff)?.role}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignedStaff(null)}
              >
                Reassign
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select kitchen staff..." />
                </SelectTrigger>
                <SelectContent>
                  {activeStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{member.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {member.assignedOrders} orders
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleAssign}
                disabled={!selectedStaffId}
              >
                Assign
              </Button>
            </div>

            {activeStaff.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                No active kitchen staff available
              </p>
            )}
          </div>
        )}

        {/* Staff Workload Overview */}
        <div className="pt-3 border-t">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <SketchWireIcon name="users" size={14} />
            Kitchen Staff Workload
          </h4>
          
          <div className="space-y-2">
            {staff.map((member) => (
              <div
                key={member.id}
                className={`flex items-center justify-between p-2 rounded ${
                  member.isActive ? 'bg-muted/50' : 'bg-muted/20 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    member.isActive ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                </div>

                <Badge 
                  variant={member.assignedOrders > 3 ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {member.assignedOrders} orders
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="pt-3 border-t grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Active Staff</p>
            <p className="text-lg font-bold">{activeStaff.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
            <p className="text-lg font-bold">
              {staff.reduce((sum, s) => sum + s.assignedOrders, 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg Load</p>
            <p className="text-lg font-bold">
              {activeStaff.length > 0 
                ? Math.round(staff.reduce((sum, s) => sum + s.assignedOrders, 0) / activeStaff.length * 10) / 10
                : 0
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
