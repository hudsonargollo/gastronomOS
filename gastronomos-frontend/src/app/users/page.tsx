'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Plus, Mail, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';

const users = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@gastronomos.com',
    role: 'ADMIN',
    location: 'All Locations',
    status: 'active',
    lastLogin: '2 hours ago',
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    email: 'sarah.j@gastronomos.com',
    role: 'MANAGER',
    location: 'Downtown Restaurant',
    status: 'active',
    lastLogin: '5 minutes ago',
  },
  {
    id: 3,
    name: 'Mike Chen',
    email: 'mike.chen@gastronomos.com',
    role: 'MANAGER',
    location: 'Westside Location',
    status: 'active',
    lastLogin: '1 hour ago',
  },
  {
    id: 4,
    name: 'Lisa Rodriguez',
    email: 'lisa.r@gastronomos.com',
    role: 'MANAGER',
    location: 'Central Commissary',
    status: 'active',
    lastLogin: '3 hours ago',
  },
  {
    id: 5,
    name: 'Tom Wilson',
    email: 'tom.w@gastronomos.com',
    role: 'STAFF',
    location: 'Pop-up Market',
    status: 'inactive',
    lastLogin: '2 days ago',
  },
  {
    id: 6,
    name: 'Emma Davis',
    email: 'emma.d@gastronomos.com',
    role: 'STAFF',
    location: 'Downtown Restaurant',
    status: 'active',
    lastLogin: '30 minutes ago',
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

  return (
    <MainLayout title={t('pages.users.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('pages.users.title')}</h1>
            <p className="text-slate-600 mt-2">{t('pages.users.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('pages.users.addUser')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white font-semibold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{user.name}</CardTitle>
                        <p className="text-sm text-slate-500">{t('pages.users.lastLogin')}: {user.lastLogin}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={user.status === 'active' ? 'default' : 'secondary'}
                      className={user.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                    >
                      {user.status === 'active' ? t('status.active') : t('status.inactive')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">{user.email}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-600">{user.location}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-slate-600">{t('pages.users.role')}</span>
                    <Badge className={getRoleColor(user.role)}>
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
    </MainLayout>
  );
}