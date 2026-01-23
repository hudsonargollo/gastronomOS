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
import { useLocations } from '@/hooks/use-locations';
import type { User, CreateUserInput, UpdateUserInput, UserRole } from '@/hooks/use-users';

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
  locationId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSubmit: (data: CreateUserInput | UpdateUserInput) => Promise<void>;
}

export function UserFormModal({
  open,
  onOpenChange,
  user,
  onSubmit,
}: UserFormModalProps) {
  const { t } = useTranslations();
  const { locations } = useLocations();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'STAFF',
      locationId: '',
    },
  });

  const selectedRole = watch('role');
  const selectedLocationId = watch('locationId');

  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        password: '', // Don't populate password for security
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        locationId: user.locationId || '',
      });
    } else {
      reset({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'STAFF',
        locationId: '',
      });
    }
  }, [user, reset]);

  const onSubmitForm = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      // Remove password if editing and it's empty
      const submitData = { ...data };
      if (user && !submitData.password) {
        delete submitData.password;
      }
      
      await onSubmit(submitData as any);
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
            {user ? t('pages.users.editUser') : t('pages.users.addUser')}
          </DialogTitle>
          <DialogDescription>
            {user
              ? t('pages.users.editUserDescription')
              : t('pages.users.addUserDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('forms.labels.firstName')}</Label>
              <Input
                id="firstName"
                {...register('firstName')}
                placeholder={t('forms.placeholders.enterFirstName')}
                disabled={isSubmitting}
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">{t('forms.labels.lastName')}</Label>
              <Input
                id="lastName"
                {...register('lastName')}
                placeholder={t('forms.placeholders.enterLastName')}
                disabled={isSubmitting}
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('forms.labels.email')}</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder={t('forms.placeholders.enterEmail')}
              disabled={isSubmitting || !!user} // Disable email editing for existing users
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {!user && (
            <div className="space-y-2">
              <Label htmlFor="password">{t('forms.labels.password')}</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder={t('forms.placeholders.enterPassword')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">{t('forms.labels.role')}</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as UserRole)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('forms.placeholders.selectRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{t('users.admin')}</SelectItem>
                <SelectItem value="MANAGER">{t('users.manager')}</SelectItem>
                <SelectItem value="STAFF">{t('users.staff')}</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-500">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationId">{t('forms.labels.location')}</Label>
            <Select
              value={selectedLocationId}
              onValueChange={(value) => setValue('locationId', value || undefined)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('forms.placeholders.selectLocation')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('users.allLocations')}</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.locationId && (
              <p className="text-sm text-red-500">{errors.locationId.message}</p>
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
              {user ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
