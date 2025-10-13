import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatUserActivityDateTime } from '../lib/datetime';
import { Users, Plus, Search, Mail, Calendar, UserPlus, Pencil, RefreshCw, Shield, User, AlertCircle, Trash2 } from 'lucide-react';

type ListUsersResponse = {
  users: {
    id: number;
    email: string;
    role: 'ADMIN' | 'MANAGER';
    displayName: string;
    createdByUserId?: number;
    createdByName?: string;
    createdAt: string | Date;
    lastLoginAt?: string | Date;
    lastActivityAt?: string | Date;
    loginCount: number;
    lastLoginIp?: string;
    lastLoginUserAgent?: string;
    lastLoginLocation?: {
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
    } | null;
    timezone?: string;
    locale?: string;
  }[];
};

export default function UsersPage() {
  const { user, getAuthenticatedBackend, refreshUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('User Management', 'Manage user accounts and permissions');
  }, [setPageTitle]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [userToPromote, setUserToPromote] = useState<any | null>(null);
  const [isDemoteDialogOpen, setIsDemoteDialogOpen] = useState(false);
  const [userToDemote, setUserToDemote] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'MANAGER' as 'ADMIN' | 'MANAGER',
    propertyIds: [] as number[],
  });
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [editingPropertyIds, setEditingPropertyIds] = useState<number[]>([]);

  const { data: users, isLoading, refetch: refetchUsers } = useQuery<ListUsersResponse>({
    queryKey: ['users'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.users.list({});
    },
    enabled: user?.role === 'ADMIN',
    refetchInterval: 3000, // Refresh every 3 seconds for real-time activity updates (increased frequency)
    staleTime: 0, // Consider data immediately stale for fresh user activity
    gcTime: 0, // Don't cache results
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      console.error('Users query failed:', error);
      return failureCount < 2;
    },
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list({});
    },
    enabled: user?.role === 'ADMIN',
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    staleTime: 0, // Always consider data stale for fresh updates
    gcTime: 0, // Don't cache results
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      console.log('Creating user with data:', userData);
      const backend = getAuthenticatedBackend();
      return backend.users.create(userData);
    },
    onMutate: async (newUserData) => {
      console.log('User creation mutation starting...');
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData<ListUsersResponse>(['users']);

      // Optimistically update to the new value
      queryClient.setQueryData<ListUsersResponse>(['users'], (old) => {
        if (!old) return { users: [] };
        
        const optimisticUser = {
          id: Date.now(), // temporary optimistic ID (13-digit)
          email: newUserData.email,
          role: newUserData.role,
          displayName: newUserData.displayName,
          createdByUserId: user?.userID ? parseInt(user.userID) : 0,
          createdByName: user?.displayName,
          createdAt: new Date(),
          lastLoginAt: undefined,
          lastActivityAt: new Date(),
          loginCount: 0,
          lastLoginIp: undefined,
          lastLoginUserAgent: undefined,
          lastLoginLocation: null,
          timezone: 'UTC',
          locale: 'en-US',
        };
        
        return { users: [optimisticUser, ...old.users] };
      });

      return { previousUsers };
    },
    onError: (error: any, newUserData, context) => {
      console.error('User creation failed:', error);
      // Roll back to the previous state
      queryClient.setQueryData(['users'], context?.previousUsers);
      
      let errorMessage = "Please try again.";
      if (error.message) {
        if (error.message.includes('already exists')) {
          errorMessage = "A user with this email already exists in your organization. Please check the user list or use a different email.";
        } else if (error.message.includes('email')) {
          errorMessage = "This email address is already in use.";
        } else if (error.message.includes('password')) {
          errorMessage = "Password must be at least 8 characters long.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Failed to create manager",
        description: errorMessage,
      });
    },
    onSuccess: (createdUser) => {
      console.log('User created successfully:', createdUser);
      
      // Update the cache with the real data from the server
      queryClient.setQueryData<ListUsersResponse>(['users'], (old) => {
        if (!old) return { users: [createdUser as any] };
        
        // Remove optimistic updates (Date.now() ~ 13 digits)
        const filteredUsers = old.users.filter((u: any) => !(typeof u.id === 'number' && u.id >= 1_000_000_000_000));
        
        // Since CreateUserResponse doesn't have all the fields, we'll use type assertion
        // and let the backend refetch handle the complete data
        return { users: [createdUser as any, ...filteredUsers] };
      });

      setIsCreateDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        displayName: '',
        role: 'MANAGER',
        propertyIds: [],
      });
      toast({
        title: "Manager created successfully",
        description: "The new manager account has been created.",
      });
    },
    onSettled: () => {
      console.log('User creation mutation settled, invalidating queries...');
      // Always refetch after error or success to ensure we have the latest data
      refetchUsers();
      
      // Invalidate related caches since new managers might affect staff visibility
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-statistics'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff-statistics'] });
      
      // Invalidate analytics and dashboard for updated data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: { id: number; displayName?: string; email?: string; password?: string }) => {
      console.log('Updating user with data:', payload);
      const backend = getAuthenticatedBackend();
      return backend.users.update(payload.id, { 
        displayName: payload.displayName, 
        email: payload.email, 
        password: payload.password 
      });
    },
    onMutate: async (updatedUser) => {
      console.log('User update mutation starting...');
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData<ListUsersResponse>(['users']);

      // Optimistically update to the new value
      queryClient.setQueryData<ListUsersResponse>(['users'], (old) => {
        if (!old) return old;
        
        return {
          users: old.users.map((u) =>
            u.id === updatedUser.id
              ? {
                  ...u,
                  displayName: updatedUser.displayName ?? u.displayName,
                  email: updatedUser.email ?? u.email,
                }
              : u
          ),
        };
      });

      return { previousUsers };
    },
    onError: (error: any, variables, context) => {
      console.error('User update failed:', error);
      // Roll back to the previous state
      queryClient.setQueryData(['users'], context?.previousUsers);
      
      let errorMessage = "Please try again.";
      if (error.message && error.message.includes('already exists')) {
        errorMessage = "This email address is already in use by another user.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Failed to update user",
        description: errorMessage,
      });
    },
    onSuccess: (data, variables) => {
      console.log('✅ User updated successfully');
      console.log('🔍 Checking if current user updated their own profile...');
      console.log('Current user ID:', user?.userID, 'Updated user ID:', variables.id);
      
      // If the current user updated their own profile, refresh AuthContext
      if (user && parseInt(user.userID) === variables.id) {
        console.log('🎯 Current user updated their own profile, refreshing AuthContext...');
        refreshUser().catch(error => {
          console.warn('❌ Failed to refresh current user data:', error);
        });
      } else {
        console.log('ℹ️ Different user updated, no need to refresh AuthContext');
      }
      
      toast({
        title: "User updated",
        description: "Manager details have been updated.",
      });
    },
    onSettled: () => {
      console.log('User update mutation settled, invalidating queries...');
      refetchUsers();
      
      // Invalidate related caches since user updates might affect staff visibility
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-statistics'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff-statistics'] });
      
      // Invalidate analytics and dashboard for updated data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const assignPropertiesMutation = useMutation({
    mutationFn: async (payload: { id: number; propertyIds: number[] }) => {
      console.log('Assigning properties with data:', payload);
      const backend = getAuthenticatedBackend();
      return backend.users.assignProperties({ id: payload.id, propertyIds: payload.propertyIds });
    },
    onError: (error: any) => {
      console.error('Property assignment failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to update assignments",
        description: error.message || "Please try again.",
      });
    },
    onSuccess: () => {
      console.log('Properties assigned successfully');
      toast({
        title: "Assignments updated",
        description: "Property assignments have been saved.",
      });
    },
    onSettled: () => {
      console.log('Property assignment mutation settled, invalidating queries...');
      refetchUsers();
      
      // Invalidate staff cache since manager property assignments affect staff visibility
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-statistics'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff-statistics'] });
      
      // Also invalidate tasks cache since task assignments might be affected
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      
      // Invalidate analytics and dashboard for updated data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const promoteToAdminMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log('Promoting user to admin:', userId);
      
      // Additional validation
      if (typeof userId !== 'number' || isNaN(userId)) {
        throw new Error(`Invalid user ID: ${userId} (type: ${typeof userId})`);
      }
      
      const backend = getAuthenticatedBackend();
      return backend.users.update(userId, { role: 'ADMIN' });
    },
    onError: (error: any) => {
      console.error('Role promotion failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to promote user",
        description: error.message || "Please try again.",
      });
    },
    onSuccess: (updatedUser) => {
      console.log('User promoted to admin successfully:', updatedUser);
      toast({
        title: "User promoted",
        description: "User has been promoted to Admin role.",
      });
    },
    onSettled: () => {
      console.log('Role promotion mutation settled, invalidating queries...');
      refetchUsers();
      
      // Invalidate related caches since role changes affect staff visibility
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-statistics'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff-statistics'] });
      
      // Invalidate analytics and dashboard for updated data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const demoteToManagerMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log('Demoting user to manager:', userId);
      
      // Additional validation
      if (typeof userId !== 'number' || isNaN(userId)) {
        throw new Error(`Invalid user ID: ${userId} (type: ${typeof userId})`);
      }
      
      const backend = getAuthenticatedBackend();
      return backend.users.update(userId, { role: 'MANAGER' });
    },
    onError: (error: any) => {
      console.error('Role demotion failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to demote user",
        description: error.message || "Please try again.",
      });
    },
    onSuccess: (updatedUser) => {
      console.log('User demoted to manager successfully:', updatedUser);
      toast({
        title: "User demoted",
        description: "User has been demoted to Manager role.",
      });
    },
    onSettled: () => {
      console.log('Role demotion mutation settled, invalidating queries...');
      refetchUsers();
      
      // Invalidate related caches since role changes affect staff visibility
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-statistics'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff-statistics'] });
      
      // Invalidate analytics and dashboard for updated data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log('Deleting user:', userId);
      
      // Additional validation
      if (typeof userId !== 'number' || isNaN(userId)) {
        throw new Error(`Invalid user ID: ${userId} (type: ${typeof userId})`);
      }
      
      // Use direct fetch call as workaround until client is regenerated
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token found');
      }
      
      const response = await fetch(`http://localhost:4000/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete user: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onError: (error: any) => {
      console.error('User deletion failed:', error);
      let errorMessage = "Please try again.";
      if (error.message && error.message.includes('Cannot delete your own account')) {
        errorMessage = "You cannot delete your own account.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Failed to delete user",
        description: errorMessage,
      });
    },
    onSuccess: (result) => {
      console.log('User deleted successfully:', result);
      toast({
        title: "User deleted",
        description: result.message || "User has been successfully deleted.",
      });
    },
    onSettled: () => {
      console.log('User deletion mutation settled, invalidating queries...');
      refetchUsers();
      
      // Invalidate related caches since user deletion affects staff visibility
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-statistics'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff-statistics'] });
      
      // Invalidate analytics and dashboard for updated data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const filteredUsers = users?.users.filter(user => {
    const matchesSearch = user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800';
      case 'MANAGER': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Admin';
      case 'MANAGER': return 'Manager';
      default: return role.charAt(0) + role.slice(1).toLowerCase();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleCreateUser = () => {
    if (!newUser.email || !newUser.password || !newUser.displayName) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all required fields.",
      });
      return;
    }

    // Check if email already exists in current user list
    const emailExists = users?.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase());
    if (emailExists) {
      toast({
        variant: "destructive",
        title: "Email already exists",
        description: "A user with this email already exists in your organization.",
      });
      return;
    }

    createUserMutation.mutate(newUser);
  };

  const openEditDialog = async (u: any) => {
    setEditingUser(u);
    setEditingDisplayName(u.displayName);
    setEditingEmail(u.email);
    setEditingPassword('');
    setIsEditDialogOpen(true);

    try {
      const backend = getAuthenticatedBackend();
      // Pass the ID as the first parameter, not as an object property
      const details = await backend.users.get(u.id);
      setEditingPropertyIds(details.propertyIds);
    } catch (err) {
      console.error('Failed to load user details:', err);
      setEditingPropertyIds([]);
    }
  };

  const toggleSelectedProperty = (pid: number) => {
    setEditingPropertyIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const handleRefresh = () => {
    refetchUsers();
    toast({
      title: "Refreshed",
      description: "User list has been refreshed.",
    });
  };

  const handlePromoteToAdmin = (user: any) => {
    console.log('Handling promotion for user:', user);
    console.log('User ID type:', typeof user.id, 'Value:', user.id);
    
    // Validate user object before setting state
    if (!user || typeof user.id !== 'number' || isNaN(user.id)) {
      console.error('Invalid user object for promotion:', user);
      toast({
        variant: "destructive",
        title: "Invalid User Data",
        description: "Cannot promote user with invalid data. Please refresh and try again.",
      });
      return;
    }
    
    setUserToPromote(user);
    setIsPromoteDialogOpen(true);
  };

  const confirmPromoteToAdmin = () => {
    if (userToPromote) {
      console.log('Confirming promotion for user:', userToPromote);
      console.log('User ID type:', typeof userToPromote.id, 'Value:', userToPromote.id);
      
      // Validate user ID before making the API call
      if (typeof userToPromote.id !== 'number' || isNaN(userToPromote.id)) {
        console.error('Invalid user ID for promotion:', userToPromote.id);
        toast({
          variant: "destructive",
          title: "Invalid User ID",
          description: "Cannot promote user with invalid ID. Please refresh and try again.",
        });
        return;
      }
      
      // Determine which promotion to use based on current role
      if (userToPromote.role === 'MANAGER') {
        promoteToAdminMutation.mutate(userToPromote.id);
      }
      
      setIsPromoteDialogOpen(false);
      setUserToPromote(null);
    }
  };

  const handleDemoteToManager = (user: any) => {
    console.log('Handling demotion for user:', user);
    console.log('User ID type:', typeof user.id, 'Value:', user.id);
    
    // Validate user object before setting state
    if (!user || typeof user.id !== 'number' || isNaN(user.id)) {
      console.error('Invalid user object for demotion:', user);
      toast({
        variant: "destructive",
        title: "Invalid User Data",
        description: "Cannot demote user with invalid data. Please refresh and try again.",
      });
      return;
    }
    
    setUserToDemote(user);
    setIsDemoteDialogOpen(true);
  };

  const confirmDemoteToManager = () => {
    if (userToDemote) {
      console.log('Confirming demotion for user:', userToDemote);
      console.log('User ID type:', typeof userToDemote.id, 'Value:', userToDemote.id);
      
      // Validate user ID before making the API call
      if (typeof userToDemote.id !== 'number' || isNaN(userToDemote.id)) {
        console.error('Invalid user ID for demotion:', userToDemote.id);
        toast({
          variant: "destructive",
          title: "Invalid User ID",
          description: "Cannot demote user with invalid ID. Please refresh and try again.",
        });
        return;
      }
      
      // Determine which demotion to use based on current role
      if (userToDemote.role === 'ADMIN') {
        demoteToManagerMutation.mutate(userToDemote.id);
      }
      
      setIsDemoteDialogOpen(false);
      setUserToDemote(null);
    }
  };

  const handleDeleteUser = (user: any) => {
    console.log('Handling deletion for user:', user);
    console.log('User ID type:', typeof user.id, 'Value:', user.id);
    
    // Validate user object before setting state
    if (!user || typeof user.id !== 'number' || isNaN(user.id)) {
      console.error('Invalid user object for deletion:', user);
      toast({
        variant: "destructive",
        title: "Invalid User Data",
        description: "Cannot delete user with invalid data. Please refresh and try again.",
      });
      return;
    }
    
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      console.log('Confirming deletion for user:', userToDelete);
      console.log('User ID type:', typeof userToDelete.id, 'Value:', userToDelete.id);
      
      // Validate user ID before making the API call
      if (typeof userToDelete.id !== 'number' || isNaN(userToDelete.id)) {
        console.error('Invalid user ID for deletion:', userToDelete.id);
        toast({
          variant: "destructive",
          title: "Invalid User ID",
          description: "Cannot delete user with invalid ID. Please refresh and try again.",
        });
        return;
      }
      
      deleteUserMutation.mutate(userToDelete.id);
      
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  // Only show to ADMIN
  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-red-900 mb-2">Access Restricted</h3>
                <p className="text-sm text-gray-600">Only Administrators can manage users.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">Loading users...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your user data</p>
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-6">
        {/* Optimized User Management Section */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200 mb-6">
          <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                <Users className="h-5 w-5 text-blue-600" />
            </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  User Management
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Manage team members and their roles
                </CardDescription>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('🔄 Manual refresh triggered...');
                refreshUser().catch(error => {
                  console.warn('❌ Manual refresh failed:', error);
                });
              }}
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh User Data
            </Button>
          </div>
        </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search-users" className="text-sm font-medium text-gray-700">Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search-users"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-filter" className="text-sm font-medium text-gray-700">Filter by Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
              >
            <RefreshCw className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Refresh</span>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md">
                <Plus className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Create User</span>
                    <span className="sm:hidden">Create</span>
              </Button>
            </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                        <UserPlus className="h-5 w-5 text-blue-600" />
                      </div>
                      Create {newUser.role === 'ADMIN' ? 'Admin' : 'Manager'} Account
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600">
                 Create a new {newUser.role === 'ADMIN' ? 'admin' : 'manager'} account{newUser.role === 'MANAGER' ? ' and assign properties' : ''}.
               </DialogDescription>
             </DialogHeader>
                  <div className="flex-1 overflow-y-auto px-1">
                    <div className="space-y-6">
                <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-sm font-medium text-gray-700">Full Name *</Label>
                  <Input
                    id="displayName"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Enter full name"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  {users?.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase()) && (
                    <p className="text-sm text-red-600">This email is already in use</p>
                  )}
                </div>
                <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password (min 8 characters)"
                    minLength={8}
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                        <Label htmlFor="role" className="text-sm font-medium text-gray-700">Role *</Label>
                                     <Select 
                     value={newUser.role} 
                     onValueChange={(value: 'ADMIN' | 'MANAGER') => setNewUser(prev => ({ ...prev, role: value }))}
                   >
                          <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {newUser.role === 'ADMIN' 
                      ? 'Admins have full access to all features and can manage managers.'
                      : 'Managers can manage properties and tasks assigned to them.'
                    }
                  </p>
                </div>

                <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">Assign Properties</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded p-2">
                    {properties?.properties.map((p: any) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newUser.propertyIds.includes(p.id)}
                          onChange={() => {
                            setNewUser(prev => ({
                              ...prev,
                              propertyIds: prev.propertyIds.includes(p.id)
                                ? prev.propertyIds.filter(id => id !== p.id)
                                : [...prev.propertyIds, p.id]
                            }));
                          }}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
                  </div>
                  <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                    <div className="flex items-center justify-between w-full">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                        className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                      >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateUser}
                  disabled={
                    createUserMutation.isPending || 
                    !newUser.email || 
                    !newUser.password || 
                    !newUser.displayName ||
                    users?.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase())
                  }
                        className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                      >
                        {createUserMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create {newUser.role === 'ADMIN' ? 'Admin' : 'Manager'}
                          </>
                        )}
                 </Button>
                    </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
          </CardContent>
        </Card>

        {/* Optimized Users Grid */}
      {filteredUsers.length === 0 ? (
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500 text-center mb-4">
              {searchTerm || roleFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first user'
              }
            </p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleRefresh}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh List
              </Button>
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                <Plus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredUsers.map((u) => {
            // Debug logging for user objects
            if (process.env.NODE_ENV === 'development') {
              console.log('Rendering user:', { id: u.id, type: typeof u.id, email: u.email, role: u.role });
            }
            
            return (
                <Card key={u.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-4">
                <div className="flex items-start space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {getInitials(u.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold text-gray-900 truncate">{u.displayName}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                              <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate text-sm text-gray-600">{u.email}</span>
                        </CardDescription>
                      </div>
                      
                      {/* Action Buttons - Moved to top right */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openEditDialog(u)}
                          className="h-8 w-8 p-0 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 rounded-lg shadow-sm"
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {/* Only show delete button for other users, not current user */}
                        {u.id !== parseInt(user?.userID || '0') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteUser(u)}
                            disabled={deleteUserMutation.isPending}
                            className="h-8 w-8 p-0 bg-white border-gray-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-all duration-200 rounded-lg shadow-sm"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
                  <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Role</span>
                      <Badge className={`${getRoleColor(u.role)} flex-shrink-0`}>
                      {getRoleDisplayName(u.role)}
                    </Badge>
                  </div>

                  {u.createdByName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Created by</span>
                      <span className="text-gray-600">{u.createdByName}</span>
                    </div>
                  )}

                  {u.lastLoginAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Last login</span>
                      <div className="flex items-center text-gray-600">
                          <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span>{new Date(u.lastLoginAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Joined</span>
                    <div className="flex items-center text-gray-600">
                        <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Login count</span>
                    <span className="text-gray-600">{u.loginCount || 0}</span>
                  </div>

                  {u.lastActivityAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Last activity</span>
                      <div className="flex items-center text-gray-600">
                          <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span>{formatUserActivityDateTime(u.lastActivityAt)}</span>
                      </div>
                    </div>
                  )}

                  {u.lastLoginLocation && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Last location</span>
                      <div className="text-gray-600 text-xs">
                        {u.lastLoginLocation.city && <div>{u.lastLoginLocation.city}</div>}
                        {u.lastLoginLocation.region && <div>{u.lastLoginLocation.region}</div>}
                        {u.lastLoginLocation.country && <div>{u.lastLoginLocation.country}</div>}
                      </div>
                    </div>
                  )}

                  {u.timezone && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Timezone</span>
                      <span className="text-gray-600">{u.timezone}</span>
                    </div>
                  )}

                    <div className="flex flex-wrap gap-2 pt-2">
                    {/* ADMIN can promote managers to admin */}
                    {user?.role === 'ADMIN' && u.role === 'MANAGER' && u.id !== parseInt(user?.userID || '0') && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePromoteToAdmin(u)}
                        disabled={promoteToAdminMutation.isPending}
                          className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                      >
                        <Shield className="mr-2 h-3 w-3" />
                          <span className="hidden sm:inline">Promote to Admin</span>
                          <span className="sm:hidden">Promote</span>
                      </Button>
                    )}
                    {u.role === 'MANAGER' && u.id === parseInt(user?.userID || '0') && (
                      <div className="text-xs text-gray-500 italic px-2 py-1 bg-gray-100 rounded">
                        Current user (cannot promote)
                      </div>
                    )}
                    {/* ADMIN can demote other admins to manager */}
                    {user?.role === 'ADMIN' && u.role === 'ADMIN' && u.id !== parseInt(user?.userID || '0') && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDemoteToManager(u)}
                        disabled={demoteToManagerMutation.isPending}
                          className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                      >
                        <User className="mr-2 h-3 w-3" />
                          <span className="hidden sm:inline">Demote to Manager</span>
                          <span className="sm:hidden">Demote</span>
                      </Button>
                    )}
                    {u.role === 'ADMIN' && u.id === parseInt(user?.userID || '0') && (
                      <div className="text-xs text-gray-500 italic px-2 py-1 bg-gray-100 rounded">
                        Current user (cannot demote)
                      </div>
                    )}
                  </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

        {/* Enhanced Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                  <Pencil className="h-5 w-5 text-orange-600" />
                </div>
                Edit {editingUser?.role === 'ADMIN' ? 'Admin' : 'Manager'}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Update {editingUser?.role === 'ADMIN' ? 'admin' : 'manager'} details{editingUser?.role === 'MANAGER' ? ' and property assignments' : ''}
              </DialogDescription>
           </DialogHeader>
          {editingUser && (
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6">
              {editingUser.id === parseInt(user?.userID || '0') && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">ℹ️ Note: This is your own account</p>
                      <p>You can update your personal details, but some changes may require another admin.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                    <Label htmlFor="edit-displayName" className="text-sm font-medium text-gray-700">Full Name *</Label>
                <Input
                      id="edit-displayName"
                  value={editingDisplayName}
                  onChange={(e) => setEditingDisplayName(e.target.value)}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                    <Label htmlFor="edit-email" className="text-sm font-medium text-gray-700">Email *</Label>
                <Input
                      id="edit-email"
                  type="email"
                  value={editingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
                {users?.users.some(u => u.id !== editingUser.id && u.email.toLowerCase() === editingEmail.toLowerCase()) && (
                  <p className="text-sm text-red-600">This email is already in use by another user</p>
                )}
              </div>
              <div className="space-y-2">
                    <Label htmlFor="edit-password" className="text-sm font-medium text-gray-700">New Password (optional)</Label>
                <Input
                      id="edit-password"
                  type="password"
                  value={editingPassword}
                  onChange={(e) => setEditingPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                      className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Assigned Properties</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded p-2">
                  {properties?.properties.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editingPropertyIds.includes(p.id)}
                        onChange={() => toggleSelectedProperty(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                    </div>
                </div>
              </div>
            </div>
          )}
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editingUser) return;
                
                // Check for email conflicts before saving
                const emailConflict = users?.users.some(u => 
                  u.id !== editingUser.id && u.email.toLowerCase() === editingEmail.toLowerCase()
                );
                
                if (emailConflict) {
                  toast({
                    variant: "destructive",
                    title: "Email conflict",
                    description: "This email is already in use by another user.",
                  });
                  return;
                }
                
                try {
                  await updateUserMutation.mutateAsync({
                    id: editingUser.id,
                    displayName: editingDisplayName,
                    email: editingEmail,
                    password: editingPassword || undefined,
                  });
                  await assignPropertiesMutation.mutateAsync({
                    id: editingUser.id,
                    propertyIds: editingPropertyIds,
                  });
                  setIsEditDialogOpen(false);
                  setEditingUser(null);
                } catch (err) {
                  // errors handled in mutations
                }
              }}
              disabled={
                updateUserMutation.isPending || 
                assignPropertiesMutation.isPending || 
                !editingDisplayName || 
                !editingEmail ||
                users?.users.some(u => u.id !== editingUser?.id && u.email.toLowerCase() === editingEmail.toLowerCase())
              }
                  className="bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {(updateUserMutation.isPending || assignPropertiesMutation.isPending) ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Pencil className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
            </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* Enhanced Promotion Confirmation Dialog */}
       <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                Promote User
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
               Are you sure you want to promote <strong>{userToPromote?.displayName}</strong>?
             </DialogDescription>
           </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4">
            {userToPromote && parseInt(user?.userID || '0') === userToPromote.id && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">⚠️ Warning: This is your own account</p>
                    <p>You cannot promote yourself. Ask another admin to do this for you.</p>
                  </div>
                </div>
              </div>
            )}
                         <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
               <div className="flex items-start gap-3">
                 <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                 <div className="text-sm text-yellow-800">
                   <p className="font-medium mb-1">
                     {userToPromote?.role === 'MANAGER' ? 'Admin privileges include:' : 'Admin privileges include:'}
                   </p>
                   <ul className="list-disc list-inside space-y-1">
                     {userToPromote?.role === 'MANAGER' ? (
                       <>
                         <li>Full access to all system features</li>
                         <li>Ability to create and manage managers</li>
                         <li>Access to organization settings</li>
                         <li>View all properties and financial data</li>
                       </>
                     ) : (
                       <>
                         <li>Full access to all system features</li>
                         <li>Ability to create and manage managers</li>
                         <li>Complete control over organization settings</li>
                         <li>View and manage all properties and financial data</li>
                         <li>Highest level administrative privileges</li>
                       </>
                     )}
                   </ul>
                 </div>
               </div>
             </div>
          </div>
            </div>
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button 
                  variant="outline" 
                  onClick={() => setIsPromoteDialogOpen(false)}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
              Cancel
            </Button>
                         <Button 
               onClick={confirmPromoteToAdmin}
               disabled={promoteToAdminMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {promoteToAdminMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Promoting...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Promote User
                    </>
                  )}
             </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* Enhanced Demotion Confirmation Dialog */}
       <Dialog open={isDemoteDialogOpen} onOpenChange={setIsDemoteDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                  <User className="h-5 w-5 text-orange-600" />
                </div>
                Demote User
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
               Are you sure you want to demote <strong>{userToDemote?.displayName}</strong>?
             </DialogDescription>
           </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4">
            {userToDemote && parseInt(user?.userID || '0') === userToDemote.id && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">⚠️ Warning: This is your own account</p>
                    <p>You cannot demote yourself. Ask another admin to do this for you.</p>
                  </div>
                </div>
              </div>
            )}
                         <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
               <div className="flex items-start gap-3">
                 <User className="h-5 w-5 text-orange-600 mt-0.5" />
                 <div className="text-sm text-orange-800">
                   <p className="font-medium mb-1">
                     {userToDemote?.role === 'ADMIN' ? 'Admin privileges include:' : 'Manager privileges include:'}
                   </p>
                   <ul className="list-disc list-inside space-y-1">
                     {userToDemote?.role === 'ADMIN' ? (
                       <>
                         <li>Full access to all system features</li>
                         <li>Ability to create and manage managers</li>
                         <li>Access to organization settings</li>
                         <li>View all properties and financial data</li>
                       </>
                     ) : (
                       <>
                         <li>Manage assigned properties and tasks</li>
                         <li>View financial data for assigned properties</li>
                         <li>Manage staff and bookings</li>
                         <li>Cannot access user management or system settings</li>
                       </>
                     )}
                   </ul>
                 </div>
               </div>
             </div>
          </div>
            </div>
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDemoteDialogOpen(false)}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
              Cancel
            </Button>
                         <Button 
               onClick={confirmDemoteToManager}
               disabled={demoteToManagerMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {demoteToManagerMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Demoting...
                    </>
                  ) : (
                    <>
                      <User className="mr-2 h-4 w-4" />
                      Demote User
                    </>
                  )}
             </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* Enhanced Delete Confirmation Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                Delete User
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
               Are you sure you want to delete <strong>{userToDelete?.displayName}</strong>? This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4">
            {userToDelete && parseInt(user?.userID || '0') === userToDelete.id && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">⚠️ Warning: This is your own account</p>
                    <p>You cannot delete your own account. Ask another admin to do this for you.</p>
                  </div>
                </div>
              </div>
            )}
                         <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
               <div className="flex items-start gap-3">
                 <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
                 <div className="text-sm text-red-800">
                   <p className="font-medium mb-1">⚠️ This will permanently delete:</p>
                   <ul className="list-disc list-inside space-y-1">
                     <li>User account and all login sessions</li>
                     <li>All tasks created by this user</li>
                     <li>All expenses and revenues created by this user</li>
                     <li>All staff records associated with this user</li>
                     <li>All property assignments for this user</li>
                     <li>All related data and history</li>
                   </ul>
                   <p className="font-medium mt-2 text-red-900">This action cannot be undone!</p>
                 </div>
               </div>
             </div>
          </div>
            </div>
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
              Cancel
            </Button>
                         <Button 
               onClick={confirmDeleteUser}
               disabled={deleteUserMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {deleteUserMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                    </>
                  )}
             </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
