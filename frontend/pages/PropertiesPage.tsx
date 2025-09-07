import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Building2, MapPin, Users, Bed, Plus, Search, Pencil, Trash2, RefreshCw, Edit } from 'lucide-react';

export default function PropertiesPage() {
  const { user, getAuthenticatedBackend } = useAuth();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Properties Management', 'Manage your hospitality properties and their details');
  }, [setPageTitle]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<any | null>(null);
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

  const { data: properties, isLoading, error: propertiesError, refetch } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      try {
        const backend = getAuthenticatedBackend();
        const result = await backend.properties.list({});
        
        // Safety check: ensure the response has the expected structure
        if (!result || !result.properties || !Array.isArray(result.properties)) {
          console.error('Invalid properties response:', result);
          return { properties: [] };
        }
        
        console.log('Properties query successful, count:', result.properties.length);
        return { properties: result.properties };
      } catch (error) {
        console.error('Properties query error:', error);
        throw error;
      }
    },
    // Enable real-time updates
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnMount: true, // Refetch on mount
    refetchOnWindowFocus: true, // Refetch on window focus
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
    onSuccess: (newProperty) => {
      console.log('Property created successfully:', newProperty);
      
      // Invalidate and refetch properties to get the latest data
      queryClient.invalidateQueries({ queryKey: ['properties'] });

      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Property created",
        description: "The property has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Property creation failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to create property",
        description: error.message || "Please try again.",
      });
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Updating property with data:', data);
      
      // Use direct fetch call to avoid client generation issues
      const response = await fetch(`http://localhost:4000/properties/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update property: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Property update response:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('Property updated successfully:', result);
      
      // Invalidate and refetch properties to get the latest data
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      
      setIsEditDialogOpen(false);
      setEditingProperty(null);
      toast({
        title: "Property updated",
        description: "The property has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Property update failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to update property",
        description: error.message || "Please try again.",
      });
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      console.log('Deleting property with ID:', propertyId);
      
      // Use direct fetch call to avoid client generation issues
      const response = await fetch(`http://localhost:4000/properties/${propertyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete property: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (result) => {
      console.log('Property deleted successfully:', result);
      
      // Invalidate and refetch properties to get the latest data
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      
      setIsDeleteDialogOpen(false);
      setDeletingProperty(null);
      toast({
        title: "Property deleted",
        description: "The property has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Property deletion failed:', error);
      
      let errorMessage = "Please try again.";
      if (error.message) {
        if (error.message.includes('not found')) {
          errorMessage = "Property not found or already deleted.";
        } else if (error.message.includes('permission')) {
          errorMessage = "You don't have permission to delete this property.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Failed to delete property",
        description: errorMessage,
      });
    },
  });

  // Use React Query data directly
  const currentProperties = properties?.properties || [];
  
  const filteredProperties = currentProperties.filter((property: any) => {
    // Basic check: ensure property exists
    if (!property || typeof property !== 'object') {
      console.warn('Invalid property object:', property);
      return false;
    }
    
    const matchesSearch = property.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false;
    const matchesType = typeFilter === 'all' || property.type === typeFilter;
    return matchesSearch && matchesType;
  });

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

  const openDeleteDialog = (property: any) => {
    setDeletingProperty(property);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProperty = () => {
    if (deletingProperty) {
      deletePropertyMutation.mutate(deletingProperty.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="space-y-6">
          {/* Loading Search Section */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">Loading properties...</p>
                <p className="text-sm text-gray-600 mt-2">Please wait while we fetch your property data</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Loading Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="border-l-4 border-l-green-500 animate-pulse">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    <div className="flex gap-1">
                      <div className="h-5 bg-gray-200 rounded w-12"></div>
                      <div className="h-5 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                    <div className="flex gap-2">
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if data failed to load
  if (propertiesError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="space-y-6">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-lg font-medium text-red-900 mb-2">Error loading properties</p>
                <p className="text-sm text-gray-600 mb-4">{propertiesError.message || 'There was an error loading your properties'}</p>
                <Button 
                  onClick={() => refetch()}
                  variant="outline" 
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6">
        {/* Enhanced Search and Filter Section */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              Properties Management
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Search, filter, and manage your hospitality properties efficiently
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search-properties" className="text-sm font-medium text-gray-700">Search Properties</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="search-properties"
                    placeholder="Search properties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type-filter" className="text-sm font-medium text-gray-700">Property Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                Showing {filteredProperties.length} propert{filteredProperties.length !== 1 ? 'ies' : 'y'}
              </div>
              {user?.role === 'ADMIN' && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Property
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
                    <DialogHeader className="pb-4">
                      <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                          <Plus className="h-5 w-5 text-blue-600" />
                        </div>
                        Add New Property
                      </DialogTitle>
                      <DialogDescription className="text-sm text-gray-600">
                        Create a new property for your hospitality business
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-1">
                      <div className="space-y-6">
                        {/* Basic Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Property Name *</Label>
                              <Input
                                id="name"
                                value={propertyForm.name}
                                onChange={(e) => setPropertyForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter property name"
                                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="type" className="text-sm font-medium text-gray-700">Property Type *</Label>
                              <Select value={propertyForm.type} onValueChange={(value: any) => setPropertyForm(prev => ({ ...prev, type: value }))}>
                                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
                  <h3 className="text-lg font-medium text-gray-900">Address</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="street" className="text-sm font-medium text-gray-700">Street Address</Label>
                      <Input
                        id="street"
                        value={propertyForm.address.street}
                        onChange={(e) => setPropertyForm(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, street: e.target.value }
                        }))}
                        placeholder="Enter street address"
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-sm font-medium text-gray-700">City</Label>
                        <Input
                          id="city"
                          value={propertyForm.address.city}
                          onChange={(e) => setPropertyForm(prev => ({ 
                            ...prev, 
                            address: { ...prev.address, city: e.target.value }
                          }))}
                          placeholder="City"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-sm font-medium text-gray-700">State/Province</Label>
                        <Input
                          id="state"
                          value={propertyForm.address.state}
                          onChange={(e) => setPropertyForm(prev => ({ 
                            ...prev, 
                            address: { ...prev.address, state: e.target.value }
                          }))}
                          placeholder="State"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode" className="text-sm font-medium text-gray-700">ZIP/Postal Code</Label>
                        <Input
                          id="zipCode"
                          value={propertyForm.address.zipCode}
                          onChange={(e) => setPropertyForm(prev => ({ 
                            ...prev, 
                            address: { ...prev.address, zipCode: e.target.value }
                          }))}
                          placeholder="ZIP Code"
                          className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country" className="text-sm font-medium text-gray-700">Country</Label>
                      <Input
                        id="country"
                        value={propertyForm.address.country}
                        onChange={(e) => setPropertyForm(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, country: e.target.value }
                        }))}
                        placeholder="Country"
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                    {commonAmenities.map((amenity: any) => (
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
                    </div>
                    <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                      <div className="flex items-center justify-between w-full">
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateProperty}
                          disabled={createPropertyMutation.isPending || !propertyForm.name}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {createPropertyMutation.isPending ? 'Creating...' : 'Create Property'}
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Properties Grid */}
        {filteredProperties.length === 0 ? (
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
              <p className="text-gray-500 text-center mb-4">
                {searchTerm || typeFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first property'
                }
              </p>
              {user?.role === 'ADMIN' && (
                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {filteredProperties.map((property: any) => {
              // Basic safety check
              if (!property || !property.id || !property.name) {
                console.warn('Skipping invalid property:', property);
                return null;
              }
              
              return (
                <Card key={property.id} className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-green-100 rounded-xl shadow-sm flex-shrink-0">
                        <Building2 className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <CardTitle className="text-lg font-bold text-gray-900 leading-tight flex-1 min-w-0 break-words">
                            {property.name}
                          </CardTitle>
                          <Badge className={`${getPropertyTypeColor(property.type)} flex-shrink-0 self-start`}>
                            {property.type}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center text-sm text-gray-600 break-words">
                          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="min-w-0">{formatAddress(property.addressJson)}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {/* Amenities */}
                    {property.amenitiesJson?.amenities && property.amenitiesJson.amenities.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Amenities</p>
                        <div className="flex flex-wrap gap-1">
                          {property.amenitiesJson.amenities.slice(0, 3).map((amenity: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs border-gray-200">
                              {amenity.replace('_', ' ')}
                            </Badge>
                          ))}
                          {property.amenitiesJson.amenities.length > 3 && (
                            <Badge variant="outline" className="text-xs border-gray-200">
                              +{property.amenitiesJson.amenities.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Capacity */}
                    {property.capacityJson && Object.keys(property.capacityJson).length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-gray-500">
                        {property.capacityJson.totalRooms && (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="break-words min-w-0">{property.capacityJson.totalRooms} rooms</span>
                          </div>
                        )}
                        {property.capacityJson.totalBeds && (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Bed className="h-4 w-4 flex-shrink-0" />
                            <span className="break-words min-w-0">{property.capacityJson.totalBeds} beds</span>
                          </div>
                        )}
                        {property.capacityJson.maxGuests && (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span className="break-words min-w-0">{property.capacityJson.maxGuests} guests</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Status and actions */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={property.status === 'active' ? 'default' : 'secondary'}
                          className={`self-start ${
                            property.status === 'active' 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : ''
                          }`}
                        >
                          {property.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openEditDialog(property)}
                          className="transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Edit</span>
                          <span className="sm:hidden">Edit</span>
                        </Button>
                        {/* Only ADMIN can delete properties */}
                        {user?.role === 'ADMIN' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openDeleteDialog(property)}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Delete</span>
                            <span className="sm:hidden">Delete</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
              </Card>
            );
          })}
        </div>
      )}

        {/* Edit dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                  <Edit className="h-5 w-5 text-blue-600" />
                </div>
                Edit Property
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">Update property details</DialogDescription>
            </DialogHeader>
            {editingProperty && (
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Property Name</Label>
                      <Input
                        value={editingProperty.name}
                        onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, name: e.target.value }))}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">Property Type</Label>
                      <Select
                        value={editingProperty.type}
                        onValueChange={(value: any) => setEditingProperty((prev: any) => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
                    <Label className="text-sm font-medium text-gray-700">Status</Label>
                    <Select
                      value={editingProperty.status}
                      onValueChange={(value: any) => setEditingProperty((prev: any) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
              </div>
            )}
            <DialogFooter className="border-t pt-4 mt-6 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
              <div className="flex items-center justify-between w-full">
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updatePropertyMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-lg max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-lg shadow-sm">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                Delete Property
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Are you sure you want to delete <strong>{deletingProperty?.name}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {deletingProperty && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Trash2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800">
                      <p className="font-medium mb-1">⚠️ Warning: This action is permanent</p>
                      <p>Deleting this property will:</p>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Remove all property data and settings</li>
                        <li>Remove all user assignments to this property</li>
                        <li>Cannot be undone</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
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
                  onClick={handleDeleteProperty}
                  disabled={deletePropertyMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {deletePropertyMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Property
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
