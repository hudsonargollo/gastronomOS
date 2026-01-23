'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useTranslations } from '@/hooks/use-translations';
import type { Location, CreateLocationInput, UpdateLocationInput } from '@/hooks/use-locations';

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['RESTAURANT', 'COMMISSARY', 'POP_UP', 'WAREHOUSE']),
  address: z.string().min(1, 'Address is required').max(255),
  managerId: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: Location | null;
  onSubmit: (data: CreateLocationInput | UpdateLocationInput) => Promise<void>;
}

export function LocationFormModal({
  open,
  onOpenChange,
  location,
  onSubmit,
}: LocationFormModalProps) {
  const { t } = useTranslations();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
      type: 'RESTAURANT',
      address: '',
      managerId: '',
    },
  });

  const selectedType = watch('type');

  useEffect(() => {
    if (location) {
      reset({
        name: location.name,
        type: location.type,
        address: location.address,
        managerId: location.managerId || '',
      });
    } else {
      reset({
        name: '',
        type: 'RESTAURANT',
        address: '',
        managerId: '',
      });
    }
  }, [location, reset]);

  const onSubmitForm = async (data: LocationFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
      reset();
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {location ? t('pages.locations.editLocation') : t('pages.locations.addLocation')}
          </DialogTitle>
          <DialogDescription>
            {location
              ? t('pages.locations.editLocationDescription')
              : t('pages.locations.addLocationDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('pages.locations.form.name')}</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder={t('pages.locations.form.namePlaceholder')}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t('pages.locations.form.type')}</Label>
            <Select
              value={selectedType}
              onValueChange={(value) => setValue('type', value as any)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('pages.locations.form.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESTAURANT">{t('locations.restaurant')}</SelectItem>
                <SelectItem value="COMMISSARY">{t('locations.commissary')}</SelectItem>
                <SelectItem value="POP_UP">{t('locations.popUp')}</SelectItem>
                <SelectItem value="WAREHOUSE">{t('locations.warehouse')}</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-500">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('pages.locations.form.address')}</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder={t('pages.locations.form.addressPlaceholder')}
              disabled={isSubmitting}
            />
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {location ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
