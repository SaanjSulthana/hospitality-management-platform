import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useWelcomePopup } from '../hooks/use-welcome-popup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Settings, Palette, Building2, Save, Upload, X, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../src/config/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, updateTheme, isLoading } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { markEssentialStepCompleted } = useWelcomePopup();

  // Set page title and description
  useEffect(() => {
    setPageTitle('Settings', 'Configure your application preferences and branding');
  }, [setPageTitle]);

  // Mark organization setup step as completed when user visits settings page
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      markEssentialStepCompleted('setup-organization');
    }
  }, [user?.role, markEssentialStepCompleted]);
  
  const [themeForm, setThemeForm] = useState({
    brandName: theme.brandName,
    logoUrl: theme.logoUrl || '',
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    accentColor: theme.accentColor,
    currency: theme.currency,
    dateFormat: theme.dateFormat,
    timeFormat: theme.timeFormat,
  });

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Update form state when theme changes
  useEffect(() => {
    setThemeForm({
      brandName: theme.brandName,
      logoUrl: theme.logoUrl || '',
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      currency: theme.currency,
      dateFormat: theme.dateFormat,
      timeFormat: theme.timeFormat,
    });

    // Set logo preview - simplified logic
    if (theme.logoUrl && theme.logoUrl.trim() !== '') {
      // For relative URLs, construct the full URL
      if (!theme.logoUrl.startsWith('http')) {
        const logoUrl = `${API_CONFIG.BASE_URL}${theme.logoUrl}`;
        setLogoPreview(logoUrl);
        console.log('Setting logo preview (relative):', logoUrl);
      } else {
        setLogoPreview(theme.logoUrl);
        console.log('Setting logo preview (external):', theme.logoUrl);
      }
    } else {
      setLogoPreview(null);
    }
  }, [theme]);

  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to save your settings.",
      });
      navigate('/login', { replace: true });
      return;
    }
    
    // Validate form data
    if (!themeForm.brandName || themeForm.brandName.trim() === '') {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Brand name is required.",
      });
      return;
    }

    // Validate color formats
    const colorRegex = /^#[0-9A-F]{6}$/i;
    if (!colorRegex.test(themeForm.primaryColor)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Primary color must be a valid hex color (e.g., #3b82f6).",
      });
      return;
    }

    if (!colorRegex.test(themeForm.secondaryColor)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Secondary color must be a valid hex color (e.g., #64748b).",
      });
      return;
    }

    if (!colorRegex.test(themeForm.accentColor)) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Accent color must be a valid hex color (e.g., #10b981).",
      });
      return;
    }
    
    try {
      console.log('Submitting theme form:', themeForm);
      
      // Prepare theme data - keep empty logoUrl as empty string for removal
      const themeData = { ...themeForm };
      
      console.log('Theme data to submit:', themeData);
      await updateTheme(themeData);
      toast({
        title: "Settings updated",
        description: "Your branding settings have been saved successfully.",
      });
    } catch (error: any) {
      console.error('Failed to update theme:', error);
      
      // Check if it's an authentication error
      if (error.message?.includes('session has expired') || error.message?.includes('Invalid token') || error.message?.includes('Unauthorized')) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Your session has expired. Please log in again to save your settings.",
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        
        return;
      }
      
      // Show more specific error message for other errors
      const errorMessage = error.message || "Failed to update settings. Please try again.";
      
      toast({
        variant: "destructive",
        title: "Update failed",
        description: errorMessage,
      });
    }
  };

  const handleColorChange = (field: string, value: string) => {
    setThemeForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (file: File) => {
    if (isUploadingLogo) {
      toast({
        variant: "destructive",
        title: "Upload in Progress",
        description: "Please wait for the current upload to complete.",
      });
      return;
    }

    setIsUploadingLogo(true);
    
    try {
      console.log('Starting logo upload for file:', file.name, file.type, file.size);
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not supported. Please upload images (JPG, PNG, GIF, WebP, SVG) only.');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size too large. Maximum size is 5MB for logos.');
      }

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const base64String = btoa(String.fromCharCode(...buffer));

      console.log('File converted to base64, length:', base64String.length);

      // Upload logo
      const response = await fetch(`${API_CONFIG.BASE_URL}/branding/logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          fileData: base64String,
          filename: file.name,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();
      console.log('Upload result:', uploadResult);
      
      // Update form with new logo URL
      setThemeForm(prev => ({ ...prev, logoUrl: uploadResult.logoUrl }));
      
      // Create preview URL - use the uploaded file data for preview
      const previewUrl = `data:${file.type};base64,${base64String}`;
      setLogoPreview(previewUrl);

      console.log('Logo preview set:', previewUrl);
      console.log('Form logo URL updated:', uploadResult.logoUrl);

      toast({
        title: "Logo uploaded successfully",
        description: "Your organization logo has been uploaded and will be saved when you click 'Save Changes'.",
      });

    } catch (error) {
      console.error('Logo upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Failed to upload logo',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoRemove = () => {
    console.log('Removing logo...');
    setThemeForm(prev => ({ ...prev, logoUrl: '' }));
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    console.log('Logo removed from form state');
    
    // Show confirmation toast
    toast({
      title: "Logo removed",
      description: "Logo has been removed from the form. Click 'Save Changes' to apply.",
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const presetColors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
  ];

  // Only show settings page to Admins
  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-6 py-6">
          <Card className="border-l-4 border-l-red-500 shadow-sm">
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-red-900 mb-2">Access Restricted</h3>
                <p className="text-sm text-gray-600">
                  Only Administrators can access organization settings.
                </p>
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
        {/* Enhanced Header */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow duration-200 mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg shadow-sm">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              Settings
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Manage your organization settings and branding
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="branding" className="space-y-6">
          {/* Enhanced Sticky Tabs */}
          <div className="sticky top-20 z-30 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 border-b-2 border-orange-400 -mx-6 px-4 py-3 shadow-2xl rounded-b-xl mb-6">
            <div className="overflow-x-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 border border-white/20 shadow-inner">
                <TabsList className="grid w-full grid-cols-3 min-w-max bg-transparent h-auto p-0 gap-2">
                  <TabsTrigger 
                    value="branding" 
                    className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10">Branding</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="organization" 
                    className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10">Organization</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="integrations" 
                    className="text-xs sm:text-sm px-4 sm:px-8 py-4 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xl data-[state=active]:border-2 data-[state=active]:border-orange-300 data-[state=inactive]:text-white data-[state=inactive]:bg-gradient-to-r data-[state=inactive]:from-orange-500/30 data-[state=inactive]:to-orange-600/30 data-[state=inactive]:hover:from-orange-500/50 data-[state=inactive]:hover:to-orange-600/50 data-[state=inactive]:hover:shadow-lg data-[state=inactive]:border data-[state=inactive]:border-white/30 transition-all duration-500 flex items-center gap-2 rounded-xl font-semibold relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10">Integrations</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>

        <TabsContent value="branding" className="space-y-6 mt-0">
          <form onSubmit={handleThemeSubmit} className="space-y-6">
            <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg shadow-sm">
                    <Palette className="h-5 w-5 text-purple-600" />
                  </div>
                  Brand Identity
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Customize your organization's visual identity and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Brand Name */}
                <div className="space-y-2">
                  <Label htmlFor="brandName" className="text-sm font-medium text-gray-700">Brand Name</Label>
                  <Input
                    id="brandName"
                    value={themeForm.brandName}
                    onChange={(e) => setThemeForm(prev => ({ ...prev, brandName: e.target.value }))}
                    placeholder="Your organization name"
                    className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Logo Upload */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700">Organization Logo</Label>
                  
                  {/* Logo Preview */}
                  {(logoPreview || (themeForm.logoUrl && themeForm.logoUrl.trim() !== '')) && (
                    <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
                      <div className="relative">
                        <img
                          src={logoPreview || (themeForm.logoUrl.startsWith('http') ? themeForm.logoUrl : `${API_CONFIG.BASE_URL}${themeForm.logoUrl}`)}
                          alt="Organization Logo"
                          className="h-16 w-16 object-contain rounded border"
                          onError={(e) => {
                            console.error('Logo preview failed to load:', logoPreview || themeForm.logoUrl);
                            // Hide the image if it fails to load
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleLogoRemove}
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full z-10"
                          title="Remove logo"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Current Logo</p>
                        <p className="text-xs text-gray-500">
                          {themeForm.logoUrl && themeForm.logoUrl.trim() !== '' ? 'Logo uploaded successfully' : 'Preview of uploaded logo'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Upload Section */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="flex-1 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        disabled={isUploadingLogo}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="h-11 px-4 transition-all duration-200 hover:scale-105 hover:shadow-md flex-shrink-0"
                      >
                        {isUploadingLogo ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Upload your organization logo (JPG, PNG, GIF, WebP, SVG). Max size: 5MB
                    </p>
                  </div>

                                     {/* Manual URL Input (Optional) */}
                   <div className="space-y-2">
                     <Label htmlFor="logoUrl" className="text-sm font-medium text-gray-700">Or provide logo URL</Label>
                     <Input
                       id="logoUrl"
                       value={themeForm.logoUrl}
                       onChange={(e) => setThemeForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                       placeholder="https://example.com/logo.png"
                       className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                     />
                   </div>

                   {/* Debug Info */}
                   {process.env.NODE_ENV === 'development' && (
                     <div className="space-y-2 p-3 bg-gray-100 rounded text-xs">
                       <p className="font-medium">Debug Info:</p>
                       <p>Logo URL: {themeForm.logoUrl || 'None'}</p>
                       <p>Logo Preview: {logoPreview ? 'Set' : 'None'}</p>
                       <p>Theme Logo URL: {theme.logoUrl || 'None'}</p>
                     </div>
                   )}
                </div>

                {/* Color Scheme */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700">Color Scheme</Label>
                  
                  {/* Primary Color */}
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor" className="text-sm font-medium text-gray-700">Primary Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={themeForm.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        className="w-16 h-11 p-1 border border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500"
                      />
                      <Input
                        value={themeForm.primaryColor}
                        onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                        placeholder="#3b82f6"
                        className="flex-1 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {presetColors.map((color: any) => (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => handleColorChange('primaryColor', color.value)}
                          className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 transition-all duration-200 hover:scale-110"
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Secondary Color */}
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor" className="text-sm font-medium text-gray-700">Secondary Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={themeForm.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        className="w-16 h-11 p-1 border border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500"
                      />
                      <Input
                        value={themeForm.secondaryColor}
                        onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                        placeholder="#64748b"
                        className="flex-1 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-2">
                    <Label htmlFor="accentColor" className="text-sm font-medium text-gray-700">Accent Color</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="accentColor"
                        type="color"
                        value={themeForm.accentColor}
                        onChange={(e) => handleColorChange('accentColor', e.target.value)}
                        className="w-16 h-11 p-1 border border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500"
                      />
                      <Input
                        value={themeForm.accentColor}
                        onChange={(e) => handleColorChange('accentColor', e.target.value)}
                        placeholder="#10b981"
                        className="flex-1 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg shadow-sm">
                    <Settings className="h-5 w-5 text-green-600" />
                  </div>
                  Localization
                </CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Configure regional settings and formats
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-sm font-medium text-gray-700">Currency</Label>
                    <Select value={themeForm.currency} onValueChange={(value) => setThemeForm(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat" className="text-sm font-medium text-gray-700">Date Format</Label>
                    <Select value={themeForm.dateFormat} onValueChange={(value) => setThemeForm(prev => ({ ...prev, dateFormat: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeFormat" className="text-sm font-medium text-gray-700">Time Format</Label>
                    <Select value={themeForm.timeFormat} onValueChange={(value) => setThemeForm(prev => ({ ...prev, timeFormat: value }))}>
                      <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select time format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12 Hour</SelectItem>
                        <SelectItem value="24h">24 Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-md h-11 px-6"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">Saving...</span>
                    <span className="sm:hidden">Save</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="sm:hidden">Save</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="organization" className="space-y-6 mt-0">
          <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-orange-100 rounded-lg shadow-sm">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                Organization Details
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Manage your organization information and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Organization Name</Label>
                  <Input 
                    value={theme.brandName} 
                    disabled 
                    className="h-11 border-gray-300 bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Subdomain</Label>
                  <Input 
                    value="demo.hospitality.com" 
                    disabled 
                    className="h-11 border-gray-300 bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">
                    Contact support to change your subdomain
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Plan</Label>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">Professional Plan</p>
                      <p className="text-sm text-gray-600">Up to 10 properties, unlimited users</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                    >
                      Upgrade
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6 mt-0">
          <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-indigo-100 rounded-lg shadow-sm">
                  <Settings className="h-5 w-5 text-indigo-600" />
                </div>
                Integrations
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                Connect with third-party services and platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                  <div>
                    <h4 className="font-medium text-gray-900">Booking.com</h4>
                    <p className="text-sm text-gray-600">Sync reservations and availability</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Connect
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                  <div>
                    <h4 className="font-medium text-gray-900">Airbnb</h4>
                    <p className="text-sm text-gray-600">Manage Airbnb listings and bookings</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Connect
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                  <div>
                    <h4 className="font-medium text-gray-900">Stripe</h4>
                    <p className="text-sm text-gray-600">Process payments and manage billing</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Connect
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                  <div>
                    <h4 className="font-medium text-gray-900">QuickBooks</h4>
                    <p className="text-sm text-gray-600">Sync financial data and accounting</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
