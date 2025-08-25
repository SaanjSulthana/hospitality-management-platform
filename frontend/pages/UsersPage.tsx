import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Search, Mail, Calendar, UserPlus, Pencil, RefreshCw } from 'lucide-react';

type ListUsersResponse = {
  users: {
    id: number;
    email: string;
    role: 'ADMIN' | 'MANAGER';
    displayName: string;
    createdByUserId?: number;
    createdByName?: string;
    createdAt: Date;
    lastLoginAt?: Date;
  }[];
};

export default function UsersPage() {
  const { user, getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'MANAGER' as const,
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
      return backend.users.list();
    },
    enabled: user?.role === 'ADMIN',
    staleTime: 10000, // Reduced to 10 seconds for more frequent updates
    gcTime: 300000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list();
    },
    enabled: user?.role === 'ADMIN',
    staleTime: 30000,
    gcTime: 300000,
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const backend = getAuthenticatedBackend();
      return backend.users.create(userData);
    },
    onSuccess: (createdUser) => {
      // Force refetch to ensure we have the latest data
      refetchUsers();
      
      // Also update the cache immediately with the new user
      queryClient.setQueryData<ListUsersResponse>(['users'], (old) => {
        if (!old) return { users: [createdUser] };
        
        // Check if user already exists to avoid duplicates
        const exists = old.users.some((u) => u.id === createdUser.id || u.email === createdUser.email);
        if (exists) return old;
        
        const newUserData = {
          id: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
          displayName: createdUser.displayName,
          createdByUserId: createdUser.createdByUserId,
          createdByName: user?.displayName,
          createdAt: new Date(),
          lastLoginAt: undefined,
        };
        
        return { users: [newUserData, ...old.users] };
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
    onError: (error: any) => {
      console.error('Create user error:', error);
      
      // Force refetch to ensure UI is in sync with database
      refetchUsers();
      
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
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: { id: number; displayName?: string; email?: string; password?: string }) => {
      const backend = getAuthenticatedBackend();
      return backend.users.update(payload);
    },
    onSuccess: (result, variables) => {
      // Force refetch to ensure we have the latest data
      refetchUsers();
      
      // Update the specific user in cache
      queryClient.setQueryData<ListUsersResponse>(['users'], (old) => {
        if (!old) return old;
        
        return {
          users: old.users.map((u) =>
            u.id === variables.id
              ? {
                  ...u,
                  displayName: variables.displayName ?? u.displayName,
                  email: variables.email ?? u.email,
                }
              : u
          ),
        };
      });

      toast({
        title: "User updated",
        description: "Manager details have been updated.",
      });
    },
    onError: (error: any) => {
      console.error('Update user error:', error);
      
      // Force refetch on error
      refetchUsers();
      
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
  });

  const assignPropertiesMutation = useMutation({
    mutationFn: async (payload: { id: number; propertyIds: number[] }) => {
      const backend = getAuthenticatedBackend();
      return backend.users.assignProperties(payload);
    },
    onSuccess: () => {
      refetchUsers();
      toast({
        title: "Assignments updated",
        description: "Property assignments have been saved.",
      });
    },
    onError: (error: any) => {
      console.error('Assign properties error:', error);
      refetchUsers();
      toast({
        variant: "destructive",
        title: "Failed to update assignments",
        description: error.message || "Please try again.",
      });
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
    return role.charAt(0) + role.slice(1).toLowerCase();
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
      const details = await backend.users.get({ id: u.id });
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

  // Only show to admins
  if (user?.role !== 'ADMIN') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-500">
            Only Administrators can manage users.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Users</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage team members and their roles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Manager
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Manager Account</DialogTitle>
                <DialogDescription>
                  Create a new manager account and assign properties.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input
                    id="displayName"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                  {users?.users.some(u => u.email.toLowerCase() === newUser.email.toLowerCase()) && (
                    <p className="text-sm text-red-600">This email is already in use</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password (min 8 characters)"
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assign Properties</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded p-2">
                    {properties?.properties.map((p) => (
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
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
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create Manager'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500 text-center mb-4">
              {searchTerm || roleFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first manager'
              }
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh List
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Manager
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((u) => (
            <Card key={u.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {getInitials(u.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{u.displayName}</CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Mail className="h-3 w-3 mr-1" />
                      <span className="truncate">{u.email}</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Role</span>
                    <Badge className={getRoleColor(u.role)}>
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
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{new Date(u.lastLoginAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Joined</span>
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(u)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Manager</DialogTitle>
            <DialogDescription>Update manager details and property assignments</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editingDisplayName}
                  onChange={(e) => setEditingDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                />
                {users?.users.some(u => u.id !== editingUser.id && u.email.toLowerCase() === editingEmail.toLowerCase()) && (
                  <p className="text-sm text-red-600">This email is already in use by another user</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>New Password (optional)</Label>
                <Input
                  type="password"
                  value={editingPassword}
                  onChange={(e) => setEditingPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div className="space-y-2">
                <Label>Assigned Properties</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded p-2">
                  {properties?.properties.map((p) => (
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
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
            >
              {(updateUserMutation.isPending || assignPropertiesMutation.isPending) ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
