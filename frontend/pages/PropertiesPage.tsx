import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Building2, MapPin, Users, Bed, Plus, Search, Pencil } from 'lucide-react';

export default function PropertiesPage() {
  const { getAuthenticatedBackend } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any | null>(null);
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    type: 'hotel' as 'hotel' | 'hostel' | 'resort' | 'apartment',
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
    },
    amenities: [] as string[],
    capacity: {
      totalRooms: '',
      totalBeds: '',
      maxGuests: '',
    },
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const backend = getAuthenticatedBackend();
      return backend.properties.list();
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      console.error('Properties query failed:', error);
      return failureCount < 2;
    },
  });

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating property with data:', data);
      const backend = getAuthenticatedBackend();
      return backend.properties.create({
        name: data.name,
        type: data.type,
        address: data.address,
        amenities: data.amenities,
        capacity: {
          totalRooms: data.capacity.totalRooms ? parseInt(data.capacity.totalRooms) : undefined,
          totalBeds: data.capacity.totalBeds ? parseInt(data.capacity.totalBeds) : undefined,
          maxGuests: data.capacity.maxGuests ? parseInt(data.capacity.maxGuests) : undefined,
        },
      });
    },
    onMutate: async (newProperty) => {
      console.log('Property creation mutation starting...');
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['properties'] });

      // Snapshot the previous value
      const previousProperties = queryClient.getQueryData(['properties']);

      // Optimistically update to the new value
      queryClient.setQueryData(['properties'], (old: any) => {
        if (!old) return { properties: [] };
        
        const optimisticProperty = {
          id: Date.now(), // temporary optimistic ID (13-digit)
          name: newProperty.name,
          type: newProperty.type,
          addressJson: newProperty.address || {},
          amenitiesJson: { amenities: newProperty.amenities || [] },
          capacityJson: newProperty.capacity || {},
          status: 'active',
          createdAt: new Date().toISOString(),
        };
        
        return {
          properties: [optimisticProperty, ...old.properties]
        };
      });

      // Return a context object with the snapshotted value
      return { previousProperties };
    },
    onError: (error: any, newProperty, context) => {
      console.error('Property creation failed:', error);
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(['properties'], context?.previousProperties);
      
      toast({
        variant: "destructive",
        title: "Failed to create property",
        description: error.message || "Please try again.",
      });
    },
    onSuccess: (newProperty) => {
      console.log('Property created successfully:', newProperty);
      
      // Update the cache with the real data from the server
      queryClient.setQueryData(['properties'], (old: any) => {
        if (!old) return { properties: [newProperty] };
        
        // Remove optimistic updates (Date.now() ~ 13 digits)
        const filteredProperties = old.properties.filter((p: any) => !(typeof p.id === 'number' && p.id >= 1_000_000_000_000));
        
        return {
          properties: [newProperty, ...filteredProperties]
        };
      });

      // Also invalidate to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['properties'] });

      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Property created",
        description: "The property has been created successfully.",
      });
    },
    onSettled: () => {
      console.log('Property creation mutation settled, invalidating queries...');
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Updating property with data:', data);
      const backend = getAuthenticatedBackend();
      return backend.properties.update({
        id: data.id,
        name: data.name,
        type: data.type,
        address: data.address,
        amenities: data.amenities,
        capacity: {
          totalRooms: data.capacity.totalRooms ? parseInt(data.capacity.totalRooms) : null,
          totalBeds: data.capacity.totalBeds ? parseInt(data.capacity.totalBeds) : null,
          maxGuests: data.capacity.maxGuests ? parseInt(data.capacity.maxGuests) : null,
        },
        status: data.status,
      });
    },
    onMutate: async (updatedProperty) => {
      console.log('Property update mutation starting...');
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['properties'] });

      // Snapshot the previous value
      const previousProperties = queryClient.getQueryData(['properties']);

      // Optimistically update to the new value
      queryClient.setQueryData(['properties'], (old: any) => {
        if (!old) return old;
        
        return {
          properties: old.properties.map((prop: any) =>
            prop.id === updatedProperty.id
              ? {
                  ...prop,
                  name: updatedProperty.name,
                  type: updatedProperty.type,
                  addressJson: updatedProperty.address || {},
                  amenitiesJson: { amenities: updatedProperty.amenities || [] },
                  capacityJson: updatedProperty.capacity || {},
                  status: updatedProperty.status,
                }
              : prop
          )
        };
      });

      return { previousProperties };
    },
    onError: (error: any, updatedProperty, context) => {
      console.error('Property update failed:', error);
      // Roll back to the previous state
      queryClient.setQueryData(['properties'], context?.previousProperties);
      
      toast({
        variant: "destructive",
        title: "Failed to update property",
        description: error.message || "Please try again.",
      });
    },
    onSuccess: (result, variables) => {
      console.log('Property updated successfully');
      
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      toast({
        title: "Property updated",
        description: "The property has been updated successfully.",
      });
    },
    onSettled: () => {
      console.log('Property update mutation settled, invalidating queries...');
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const filteredProperties = properties?.properties.filter((property: any) => {
    const matchesSearch = property.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || property.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const getPropertyTypeColor = (type: string) => {
    switch (type) {
      case 'hotel': return 'bg-blue-100 text-blue-800';
      case 'hostel': return 'bg-green-100 text-green-800';
      case 'resort': return 'bg-purple-100 text-purple-800';
      case 'apartment': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAddress = (addressJson: any) => {
    if (!addressJson || Object.keys(addressJson).length === 0) {
      return 'No address provided';
    }
    const { street, city, state, country } = addressJson;
    return [street, city, state, country].filter(Boolean).join(', ');
  };

  const handleCreateProperty = () => {
    if (!propertyForm.name || !propertyForm.type) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in the required fields.",
      });
      return;
    }
    createPropertyMutation.mutate(propertyForm);
  };

  const handleAmenityToggle = (amenity: string) => {
    setPropertyForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const commonAmenities = [
    'wifi', 'parking', 'pool', 'gym', 'restaurant', 'bar', 'spa', 'beach_access',
    'laundry', 'concierge', 'room_service', 'business_center', 'pet_friendly'
  ];

  const resetForm = () => {
    setPropertyForm({
      name: '',
      type: 'hotel',
      address: {
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
      },
      amenities: [],
      capacity: {
        totalRooms: '',
        totalBeds: '',
        maxGuests: '',
      },
    });
  };

  const openEditDialog = (property: any) => {
    setEditingProperty(property);
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Properties</h1>
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
          <h1 className="text-3xl font-bold text-gray-900">Properties</h1>
          <p className="text-gray-600">Manage your hospitality properties</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
              <DialogDescription>
                Create a new property for your hospitality business
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Property Name *</Label>
                    <Input
                      id="name"
                      value={propertyForm.name}
                      onChange={(e) => setPropertyForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter property name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Property Type *</Label>
                    <Select value={propertyForm.type} onValueChange={(value: any) => setPropertyForm(prev => ({ ...prev, type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="hostel">Hostel</SelectItem>
                        <SelectItem value="resort">Resort</SelectItem>
                        <SelectItem value="apartment">Apartment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Address</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={propertyForm.address.street}
                      onChange={(e) => setPropertyForm(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, street: e.target.value }
                      }))}
                      placeholder="Enter street address"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={propertyForm.address.city}
                        onChange={(e) => setPropertyForm(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, city: e.target.value }
                        }))}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        value={propertyForm.address.state}
                        onChange={(e) => setPropertyForm(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, state: e.target.value }
                        }))}
                        placeholder="State"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                      <Input
                        id="zipCode"
                        value={propertyForm.address.zipCode}
                        onChange={(e) => setPropertyForm(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, zipCode: e.target.value }
                        }))}
                        placeholder="ZIP Code"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={propertyForm.address.country}
                      onChange={(e) => setPropertyForm(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, country: e.target.value }
                      }))}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Capacity</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalRooms">Total Rooms</Label>
                    <Input
                      id="totalRooms"
                      type="number"
                      value={propertyForm.capacity.totalRooms}
                      onChange={(e) => setPropertyForm(prev => ({ 
                        ...prev, 
                        capacity: { ...prev.capacity, totalRooms: e.target.value }
                      }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalBeds">Total Beds</Label>
                    <Input
                      id="totalBeds"
                      type="number"
                      value={propertyForm.capacity.totalBeds}
                      onChange={(e) => setPropertyForm(prev => ({ 
                        ...prev, 
                        capacity: { ...prev.capacity, totalBeds: e.target.value }
                      }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxGuests">Max Guests</Label>
                    <Input
                      id="maxGuests"
                      type="number"
                      value={propertyForm.capacity.maxGuests}
                      onChange={(e) => setPropertyForm(prev => ({ 
                        ...prev, 
                        capacity: { ...prev.capacity, maxGuests: e.target.value }
                      }))}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Amenities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {commonAmenities.map((amenity) => (
                    <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={propertyForm.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm capitalize">{amenity.replace('_', ' ')}</span>
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
                onClick={handleCreateProperty}
                disabled={createPropertyMutation.isPending || !propertyForm.name}
              >
                {createPropertyMutation.isPending ? 'Creating...' : 'Create Property'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
            <SelectItem value="hostel">Hostel</SelectItem>
            <SelectItem value="resort">Resort</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Properties Grid */}
      {filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-500 text-center mb-4">
              {searchTerm || typeFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first property'
              }
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property: any) => (
            <Card key={property.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      {formatAddress(property.addressJson)}
                    </CardDescription>
                  </div>
                  <Badge className={getPropertyTypeColor(property.type)}>
                    {property.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Amenities */}
                  {property.amenitiesJson?.amenities && property.amenitiesJson.amenities.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Amenities</p>
                      <div className="flex flex-wrap gap-1">
                        {property.amenitiesJson.amenities.slice(0, 3).map((amenity: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {amenity.replace('_', ' ')}
                          </Badge>
                        ))}
                        {property.amenitiesJson.amenities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{property.amenitiesJson.amenities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Capacity */}
                  {property.capacityJson && Object.keys(property.capacityJson).length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      {property.capacityJson.totalRooms && (
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-1 text-gray-500" />
                          <span>{property.capacityJson.totalRooms} rooms</span>
                        </div>
                      )}
                      {property.capacityJson.totalBeds && (
                        <div className="flex items-center">
                          <Bed className="h-4 w-4 mr-1 text-gray-500" />
                          <span>{property.capacityJson.totalBeds} beds</span>
                        </div>
                      )}
                      {property.capacityJson.maxGuests && (
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1 text-gray-500" />
                          <span>{property.capacityJson.maxGuests} guests</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status and actions */}
                  <div className="flex items-center justify-between">
                    <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                      {property.status}
                    </Badge>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(property)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>Update property details</DialogDescription>
          </DialogHeader>
          {editingProperty && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Property Name</Label>
                  <Input
                    value={editingProperty.name}
                    onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select
                    value={editingProperty.type}
                    onValueChange={(value: any) => setEditingProperty((prev: any) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="hostel">Hostel</SelectItem>
                      <SelectItem value="resort">Resort</SelectItem>
                      <SelectItem value="apartment">Apartment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingProperty.status}
                  onValueChange={(value: any) => setEditingProperty((prev: any) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <Label>Address</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Street"
                    value={editingProperty.addressJson?.street || ''}
                    onChange={(e) => setEditingProperty((prev: any) => ({
                      ...prev,
                      addressJson: { ...prev.addressJson, street: e.target.value }
                    }))}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input
                      placeholder="City"
                      value={editingProperty.addressJson?.city || ''}
                      onChange={(e) => setEditingProperty((prev: any) => ({
                        ...prev,
                        addressJson: { ...prev.addressJson, city: e.target.value }
                      }))}
                    />
                    <Input
                      placeholder="State/Province"
                      value={editingProperty.addressJson?.state || ''}
                      onChange={(e) => setEditingProperty((prev: any) => ({
                        ...prev,
                        addressJson: { ...prev.addressJson, state: e.target.value }
                      }))}
                    />
                    <Input
                      placeholder="ZIP"
                      value={editingProperty.addressJson?.zipCode || ''}
                      onChange={(e) => setEditingProperty((prev: any) => ({
                        ...prev,
                        addressJson: { ...prev.addressJson, zipCode: e.target.value }
                      }))}
                    />
                  </div>
                  <Input
                    placeholder="Country"
                    value={editingProperty.addressJson?.country || ''}
                    onChange={(e) => setEditingProperty((prev: any) => ({
                      ...prev,
                      addressJson: { ...prev.addressJson, country: e.target.value }
                    }))}
                  />
                </div>
              </div>

              {/* Capacity */}
              <div className="space-y-4">
                <Label>Capacity</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    type="number"
                    placeholder="Total Rooms"
                    value={editingProperty.capacityJson?.totalRooms || ''}
                    onChange={(e) => setEditingProperty((prev: any) => ({
                      ...prev,
                      capacityJson: { ...prev.capacityJson, totalRooms: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Total Beds"
                    value={editingProperty.capacityJson?.totalBeds || ''}
                    onChange={(e) => setEditingProperty((prev: any) => ({
                      ...prev,
                      capacityJson: { ...prev.capacityJson, totalBeds: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Guests"
                    value={editingProperty.capacityJson?.maxGuests || ''}
                    onChange={(e) => setEditingProperty((prev: any) => ({
                      ...prev,
                      capacityJson: { ...prev.capacityJson, maxGuests: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editingProperty) return;
                updatePropertyMutation.mutate({
                  id: editingProperty.id,
                  name: editingProperty.name,
                  type: editingProperty.type,
                  status: editingProperty.status,
                  address: editingProperty.addressJson || {},
                  amenities: editingProperty.amenitiesJson?.amenities || [],
                  capacity: editingProperty.capacityJson || {},
                });
              }}
              disabled={updatePropertyMutation.isPending || !editingProperty?.name}
            >
              {updatePropertyMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
