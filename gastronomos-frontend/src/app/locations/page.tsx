'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MapPin, Plus, Users, Package, MoreVertical, Edit, Trash2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';
import { useLocations, type Location } from '@/hooks/use-locations';
import { LocationFormModal } from '@/components/locations/location-form-modal';

export default function LocationsPage() {
  const { t } = useTranslations();
  const { locations, isLoading, createLocation, updateLocation, deleteLocation } = useLocations();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddLocation = () => {
    setSelectedLocation(null);
    setIsFormOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (location: Location) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteLocation(locationToDelete.id);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (selectedLocation) {
      await updateLocation(selectedLocation.id, data);
    } else {
      await createLocation(data);
    }
  };

  if (isLoading) {
    return (
      <MainLayout title={t('pages.locations.title')}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('pages.locations.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('pages.locations.title')}</h1>
            <p className="text-slate-600 mt-2">{t('pages.locations.subtitle')}</p>
          </div>
          <Button 
            onClick={handleAddLocation}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('pages.locations.addLocation')}
          </Button>
        </div>

        {locations.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {t('pages.locations.noLocations')}
              </h3>
              <p className="text-slate-600 mb-4">
                {t('pages.locations.noLocationsDescription')}
              </p>
              <Button onClick={handleAddLocation}>
                <Plus className="h-4 w-4 mr-2" />
                {t('pages.locations.addLocation')}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location, index) => (
              <motion.div
                key={location.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <MapPin className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{location.name}</CardTitle>
                          <p className="text-sm text-slate-500">{location.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={location.status === 'active' ? 'default' : 'secondary'}
                          className={location.status === 'active' ? 'bg-green-100 text-green-700' : ''}
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
                            <DropdownMenuItem onClick={() => handleEditLocation(location)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('common.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(location)}
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
                      <span className="text-slate-600">{t('pages.locations.type')}</span>
                      <Badge variant="outline">
                        {location.type === 'RESTAURANT' ? t('locations.restaurant') :
                         location.type === 'COMMISSARY' ? t('locations.commissary') :
                         location.type === 'POP_UP' ? t('locations.popUp') :
                         location.type === 'WAREHOUSE' ? t('locations.warehouse') :
                         location.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {location.manager && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{t('pages.locations.manager')}</span>
                        <span className="font-medium">
                          {location.manager.firstName} {location.manager.lastName}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <LocationFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        location={selectedLocation}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.locations.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.locations.deleteConfirmDescription', { name: locationToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}