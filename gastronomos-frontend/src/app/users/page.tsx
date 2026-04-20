'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, Mail, MapPin, Edit, Trash2, MoreVertical } from 'lucide-react';
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

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  location: string;
  status: string;
  lastLogin: string;
};

const initialUsers: User[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@pontal-stock.com',
    role: 'ADMIN',
    location: 'All Locations',
    status: 'active',
    lastLogin: '2 hours ago',
  },
  {
    id: 2,
    name: 'Sarah Silva',
    email: 'sarah.s@pontal-stock.com',
    role: 'MANAGER',
    location: 'Restaurante Centro',
    status: 'active',
    lastLogin: '5 minutos atrás',
  },
  {
    id: 3,
    name: 'Miguel Santos',
    email: 'miguel.s@pontal-stock.com',
    role: 'MANAGER',
    location: 'Local Oeste',
    status: 'active',
    lastLogin: '1 hora atrás',
  },
  {
    id: 4,
    name: 'Lisa Rodrigues',
    email: 'lisa.r@pontal-stock.com',
    role: 'MANAGER',
    location: 'Comissária Central',
    status: 'active',
    lastLogin: '3 horas atrás',
  },
  {
    id: 5,
    name: 'Carlos Lima',
    email: 'carlos.l@pontal-stock.com',
    role: 'STAFF',
    location: 'Mercado Pop-up',
    status: 'inactive',
    lastLogin: '2 dias atrás',
  },
  {
    id: 6,
    name: 'Ana Costa',
    email: 'ana.c@pontal-stock.com',
    role: 'STAFF',
    location: 'Restaurante Centro',
    status: 'active',
    lastLogin: '30 minutos atrás',
  },
];

const getRoleColor = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return 'bg-purple-100 text-purple-700';
    case 'MANAGER':
      return 'bg-blue-100 text-blue-700';
    case 'STAFF':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

export default function UsersPage() {
  const { t } = useTranslations();
  const { palette } = useTheme();
  const [usersList, setUsersList] = React.useState<User[]>(initialUsers);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  const handleEdit = (userId: number) => {
    const user = usersList.find(u => u.id === userId);
    if (user) {
      setEditingUser({ ...user });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    if (editingUser) {
      setUsersList(usersList.map(u => 
        u.id === editingUser.id ? editingUser : u
      ));
      toast.success(`${t('messages.updateSuccess')}`);
      setIsEditDialogOpen(false);
      setEditingUser(null);
    }
  };

  const handleDelete = (userId: number) => {
    const user = usersList.find(u => u.id === userId);
    if (user && confirm(`${t('messages.confirmDelete')}`)) {
      setUsersList(usersList.filter(u => u.id !== userId));
      toast.success(`${t('messages.deleteSuccess')}`);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: palette.text }}>{t('pages.users.title')}</h1>
            <p className="mt-1" style={{ color: palette.textSecondary }}>{t('pages.users.subtitle')}</p>
          </div>
          <Button style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('pages.users.addUser')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usersList.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback style={{ backgroundColor: palette.primary, color: palette.primaryForeground }} className="font-semibold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg" style={{ color: palette.text }}>{user.name}</CardTitle>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.users.lastLogin')}: {user.lastLogin}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        style={{
                          backgroundColor: user.status === 'active' ? palette.accent : palette.border,
                          color: user.status === 'active' ? palette.text : palette.textSecondary
                        }}
                      >
                        {user.status === 'active' ? t('status.active') : t('status.inactive')}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(user.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(user.id)}
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
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" style={{ color: palette.textSecondary }} />
                    <span className="text-sm" style={{ color: palette.textSecondary }}>{user.email}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4" style={{ color: palette.textSecondary }} />
                    <span className="text-sm" style={{ color: palette.textSecondary }}>{user.location}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.users.role')}</span>
                    <Badge style={{
                      backgroundColor: user.role === 'ADMIN' ? palette.primary : user.role === 'MANAGER' ? palette.accent : palette.border,
                      color: palette.text
                    }}>
                      {user.role === 'ADMIN' ? t('users.admin') :
                       user.role === 'MANAGER' ? t('users.manager') :
                       user.role === 'STAFF' ? t('users.staff') :
                       user.role}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ color: palette.text }}>{t('common.edit')} {t('navigation.users')}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" style={{ color: palette.text }}>{t('forms.labels.name')}</Label>
                <Input
                  id="name"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: palette.text }}>{t('forms.labels.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" style={{ color: palette.text }}>{t('forms.labels.role')}</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">{t('users.admin')}</SelectItem>
                    <SelectItem value="MANAGER">{t('users.manager')}</SelectItem>
                    <SelectItem value="STAFF">{t('users.staff')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" style={{ color: palette.text }}>{t('forms.labels.location')}</Label>
                <Select
                  value={editingUser.location}
                  onValueChange={(value) => setEditingUser({ ...editingUser, location: value })}
                >
                  <SelectTrigger style={{
                    backgroundColor: palette.background,
                    color: palette.text,
                    borderColor: palette.border
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Locations">{t('users.allLocations')}</SelectItem>
                    <SelectItem value="Downtown Restaurant">Restaurante Centro</SelectItem>
                    <SelectItem value="Westside Location">Localização Oeste</SelectItem>
                    <SelectItem value="Central Commissary">Comissária Central</SelectItem>
                    <SelectItem value="Pop-up Market">Mercado Pop-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" style={{ color: palette.text }}>{t('forms.labels.status')}</Label>
                <Select
                  value={editingUser.status}
                  onValueChange={(value) => setEditingUser({ ...editingUser, status: value })}
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
                  </SelectContent>
                </Select>
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