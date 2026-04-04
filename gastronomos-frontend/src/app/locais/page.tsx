'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { MapPin, Plus, Users, Package, Edit, Trash2, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';
import { useTheme } from '@/contexts/theme-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Location = {
  id: number;
  name: string;
  type: string;
  address: string;
  status: string;
  staff: number;
  inventory: number;
  manager: string;
};

const initialLocations: Location[] = [
  {
    id: 1,
    name: 'ESTOQUE',
    type: 'WAREHOUSE',
    address: 'Depósito Principal',
    status: 'active',
    staff: 3,
    inventory: 2847,
    manager: 'Sistema',
  },
  {
    id: 2,
    name: 'COZINHA',
    type: 'KITCHEN',
    address: 'Cozinha Principal',
    status: 'active',
    staff: 12,
    inventory: 456,
    manager: 'Chef',
  },
];

export default function LocationsPage() {
  const { t } = useTranslations();
  const { palette } = useTheme();
  const [locationsList, setLocationsList] = React.useState<Location[]>(initialLocations);
  const [editingLocation, setEditingLocation] = React.useState<Location | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const handleEdit = (locationId: number) => {
    const location = locationsList.find(l => l.id === locationId);
    if (location) {
      setEditingLocation({ ...location });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    if (editingLocation) {
      setLocationsList(locationsList.map(l => 
        l.id === editingLocation.id ? editingLocation : l
      ));
      toast.success(`${t('messages.updateSuccess')}`);
      setIsEditDialogOpen(false);
      setEditingLocation(null);
    }
  };

  const handleDelete = (locationId: number) => {
    const location = locationsList.find(l => l.id === locationId);
    if (location && confirm(`${t('messages.confirmDelete')}`)) {
      setLocationsList(locationsList.filter(l => l.id !== locationId));
      toast.success(`${t('messages.deleteSuccess')}`);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: palette.text }}>{t('pages.locations.title')}</h1>
            <p className="mt-1" style={{ color: palette.textSecondary }}>{t('pages.locations.subtitle')}</p>
          </div>
          <Button style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('pages.locations.addLocation')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locationsList.map((location, index) => (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: palette.primary }}>
                        <MapPin className="h-6 w-6" style={{ color: palette.primaryForeground }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg" style={{ color: palette.text }}>{location.name}</CardTitle>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>{location.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        style={{
                          backgroundColor: location.status === 'active' ? palette.accent : palette.border,
                          color: location.status === 'active' ? palette.text : palette.textSecondary
                        }}
                      >
                        {location.status === 'active' ? t('status.active') : 
                         location.status === 'seasonal' ? t('status.seasonal') : 
                         t('status.inactive')}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(location.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(location.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: palette.textSecondary }}>{t('pages.locations.type')}</span>
                    <Badge variant="outline" style={{ borderColor: palette.border, color: palette.text }}>
                      {location.type === 'RESTAURANT' ? t('locations.restaurant') :
                       location.type === 'COMMISSARY' ? t('locations.commissary') :
                       location.type === 'POP_UP' ? t('locations.popUp') :
                       location.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: palette.textSecondary }}>{t('pages.locations.manager')}</span>
                    <span className="font-medium" style={{ color: palette.text }}>{location.manager}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" style={{ color: palette.textSecondary }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: palette.text }}>{location.staff}</p>
                        <p className="text-xs" style={{ color: palette.textSecondary }}>{t('pages.locations.staff')}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4" style={{ color: palette.textSecondary }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: palette.text }}>{location.inventory.toLocaleString()}</p>
                        <p className="text-xs" style={{ color: palette.textSecondary }}>{t('pages.locations.items')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ color: palette.text }}>{t('common.edit')} {t('navigation.locations')}</DialogTitle>
          </DialogHeader>
          {editingLocation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" style={{ color: palette.text }}>{t('forms.labels.name')}</Label>
                <Input
                  id="name"
                  value={editingLocation.name}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address" style={{ color: palette.text }}>{t('forms.labels.address')}</Label>
                <Input
                  id="address"
                  value={editingLocation.address}
                  onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" style={{ color: palette.text }}>{t('forms.labels.type')}</Label>
                <Select
                  value={editingLocation.type}
                  onValueChange={(value) => setEditingLocation({ ...editingLocation, type: value })}
                >
                  <SelectTrigger style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAREHOUSE">{t('locations.warehouse')}</SelectItem>
                    <SelectItem value="KITCHEN">{t('locations.kitchen')}</SelectItem>
                    <SelectItem value="RESTAURANT">{t('locations.restaurant')}</SelectItem>
                    <SelectItem value="COMMISSARY">{t('locations.commissary')}</SelectItem>
                    <SelectItem value="POP_UP">{t('locations.popUp')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manager" style={{ color: palette.text }}>{t('forms.labels.manager')}</Label>
                <Input
                  id="manager"
                  value={editingLocation.manager}
                  onChange={(e) => setEditingLocation({ ...editingLocation, manager: e.target.value })}
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" style={{ color: palette.text }}>{t('forms.labels.status')}</Label>
                <Select
                  value={editingLocation.status}
                  onValueChange={(value) => setEditingLocation({ ...editingLocation, status: value })}
                >
                  <SelectTrigger style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('status.active')}</SelectItem>
                    <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                    <SelectItem value="seasonal">{t('status.seasonal')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="staff" style={{ color: palette.text }}>{t('pages.locations.staff')}</Label>
                  <Input
                    id="staff"
                    type="number"
                    value={editingLocation.staff}
                    onChange={(e) => setEditingLocation({ ...editingLocation, staff: parseInt(e.target.value) || 0 })}
                    style={{
                      backgroundColor: palette.background,
                      color: palette.text,
                      borderColor: palette.border
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inventory" style={{ color: palette.text }}>{t('pages.locations.items')}</Label>
                  <Input
                    id="inventory"
                    type="number"
                    value={editingLocation.inventory}
                    onChange={(e) => setEditingLocation({ ...editingLocation, inventory: parseInt(e.target.value) || 0 })}
                    style={{
                      backgroundColor: palette.background,
                      color: palette.text,
                      borderColor: palette.border
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveEdit} style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}