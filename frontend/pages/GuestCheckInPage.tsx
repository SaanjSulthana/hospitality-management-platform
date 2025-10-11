import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { FinanceTabs, FinanceTabsList, FinanceTabsTrigger } from '../components/ui/finance-tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useToast } from '@/components/ui/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Globe, 
  Calendar, 
  Home, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  Edit, 
  LogOut,
  HelpCircle,
  FileText,
  Shield,
  ArrowLeft,
  Camera,
  Check,
  Sparkles,
  Gavel,
  LogIn
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { API_CONFIG } from '../src/config/api';
import { DocumentUploadZone, type DocumentUploadResult } from '../components/guest-checkin/DocumentUploadZone';
import { DocumentViewer } from '../components/guest-checkin/DocumentViewer';
import { AuditLogTable } from '../components/guest-checkin/AuditLogTable';
import { AuditLogFilters } from '../components/guest-checkin/AuditLogFilters';
import { useAuditLogs } from '../hooks/useAuditLogs';

interface Property {
  id: number;
  name: string;
}

interface GuestCheckIn {
  id: number;
  orgId: number;
  propertyId: number;
  propertyName: string;
  guestType: 'indian' | 'foreign';
  fullName: string;
  email: string;
  phone: string;
  address: string;
  aadharNumber?: string;
  panNumber?: string;
  passportNumber?: string;
  country?: string;
  visaType?: string;
  visaExpiryDate?: string;
  checkInDate: string;
  expectedCheckoutDate?: string;
  actualCheckoutDate?: string;
  roomNumber?: string;
  numberOfGuests: number;
  status: 'checked_in' | 'checked_out' | 'cancelled';
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'landing' | 'indian-form' | 'foreign-form' | 'admin-dashboard' | 'add-guest';

export default function GuestCheckInPage() {
  const { getAuthenticatedBackend, user } = useAuth();
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [properties, setProperties] = useState<Property[]>([]);
  const [checkIns, setCheckIns] = useState<GuestCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGuestType, setFilterGuestType] = useState<string>('all');
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  
  // Additional state for Indian form (moved to top level)
  const [activeTab, setActiveTab] = useState<'personal' | 'id_details' | 'address'>('personal');
  const [aadharScanned, setAadharScanned] = useState(false);
  
  // Tab state for form navigation
  const [indianActiveTab, setIndianActiveTab] = useState<'personal' | 'id-documents' | 'booking'>('personal');
  const [foreignActiveTab, setForeignActiveTab] = useState<'personal' | 'travel-documents' | 'booking'>('personal');

  // Helper function to get country code from country name
  const getCountryCode = (country: string): string => {
    const countryCodeMap: { [key: string]: string } = {
      'EST': '+372',
      'Estonia': '+372',
      'India': '+91',
      'IND': '+91',
      'United States': '+1',
      'USA': '+1',
      'US': '+1',
      'United Kingdom': '+44',
      'UK': '+44',
      'Germany': '+49',
      'DEU': '+49',
      'France': '+33',
      'FRA': '+33',
      'Canada': '+1',
      'CAN': '+1',
      'Australia': '+61',
      'AUS': '+61',
      'Japan': '+81',
      'JPN': '+81',
      'China': '+86',
      'CHN': '+86',
      'Brazil': '+55',
      'BRA': '+55',
      'Russia': '+7',
      'RUS': '+7',
      'South Korea': '+82',
      'KOR': '+82',
      'Italy': '+39',
      'ITA': '+39',
      'Spain': '+34',
      'ESP': '+34',
      'Netherlands': '+31',
      'NLD': '+31',
      'Sweden': '+46',
      'SWE': '+46',
      'Norway': '+47',
      'NOR': '+47',
      'Denmark': '+45',
      'DNK': '+45',
      'Finland': '+358',
      'FIN': '+358',
    };
    
    const upperCountry = country.toUpperCase();
    return countryCodeMap[upperCountry] || countryCodeMap[country] || '+1';
  };
  
  // Document upload state
  const [uploadedDocuments, setUploadedDocuments] = useState<DocumentUploadResult[]>([]);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedGuestForDocs, setSelectedGuestForDocs] = useState<GuestCheckIn | null>(null);
  const [documentViewerDocs, setDocumentViewerDocs] = useState<any[]>([]);
  
  // Audit logs state
  const [auditFilters, setAuditFilters] = useState({});
  const { logs: auditLogs, isLoading: auditLoading, error: auditError, fetchLogs, exportToCsv } = useAuditLogs(auditFilters, false);
  
  // Form validation functions
  const isIndianPersonalInfoValid = () => {
    return indianForm.fullName.trim() !== '' && 
           indianForm.email.trim() !== '' && 
           indianForm.phone.trim() !== '' && 
           indianForm.address.trim() !== '';
  };
  
  const isIndianIdDocumentsValid = () => {
    return indianForm.aadharNumber.trim() !== '';
  };
  
  const isIndianBookingValid = () => {
    const isValid = indianForm.propertyId !== '' && 
                   indianForm.numberOfGuests > 0;
    console.log('Indian booking validation:', {
      propertyId: indianForm.propertyId,
      numberOfGuests: indianForm.numberOfGuests,
      isValid
    });
    return isValid;
  };
  
  const isForeignPersonalInfoValid = () => {
    return foreignForm.fullName.trim() !== '' && 
           foreignForm.email.trim() !== '' && 
           foreignForm.phone.trim() !== '' && 
           foreignForm.address.trim() !== '';
  };
  
  const isForeignTravelDocumentsValid = () => {
    return foreignForm.passportNumber.trim() !== '' && 
           foreignForm.country.trim() !== '';
  };
  
  const isForeignBookingValid = () => {
    const isValid = foreignForm.propertyId !== '' && 
                   foreignForm.numberOfGuests > 0;
    console.log('Foreign booking validation:', {
      propertyId: foreignForm.propertyId,
      numberOfGuests: foreignForm.numberOfGuests,
      isValid
    });
    return isValid;
  };

  // Set page title based on view mode
  useEffect(() => {
    switch (viewMode) {
      case 'landing':
        setPageTitle('Guest Check-in', 'Welcome guests and manage check-ins');
        break;
      case 'indian-form':
        setPageTitle('Indian Guest Check-in', 'Complete check-in for Indian guests');
        break;
      case 'foreign-form':
        setPageTitle('Foreign Guest Check-in', 'Complete check-in for foreign guests');
        break;
      case 'admin-dashboard':
        setPageTitle('Guest Management', 'Manage all guest check-ins');
        break;
      case 'add-guest':
        setPageTitle('Add New Guest', 'Add a new guest to the system');
        break;
    }
  }, [viewMode, setPageTitle]);

  // Form state for Indian guest
  const [indianForm, setIndianForm] = useState({
    propertyId: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    aadharNumber: '',
    panNumber: '',
    roomNumber: '',
    numberOfGuests: 1,
    expectedCheckoutDate: '',
  });

  // Form state for foreign guest - Enhanced with comprehensive passport and visa fields
  const [foreignForm, setForeignForm] = useState({
    propertyId: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    // Passport Details
    passportNumber: '',
    passportCountry: '',
    passportNationality: '',
    passportDateOfBirth: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    passportPlaceOfBirth: '',
    passportIssuingAuthority: '',
    // Visa Details
    visaType: '',
    visaCategory: '',
    visaNumber: '',
    visaCountry: '',
    visaIssueDate: '',
    visaExpiryDate: '',
    visaPlaceOfIssue: '',
    visaPurposeOfVisit: '',
    visaDurationOfStay: '',
    visaNumberOfEntries: '',
    visaPortOfEntry: '',
    visaIssuingAuthority: '',
    visaStatus: '',
    visaRemarks: '',
    // Legacy fields for backward compatibility
    country: '',
    roomNumber: '',
    numberOfGuests: 1,
    expectedCheckoutDate: '',
  });

  // Document upload handlers
  const handleIndianDocumentUpload = (result: DocumentUploadResult) => {
    setUploadedDocuments(prev => [...prev, result]);
    
    // Auto-fill form from extracted data (supports all Indian ID types)
    if (result.extractedData) {
      const extracted = result.extractedData;
      
      setIndianForm(prev => {
        const newForm = { ...prev };
        
        // Always fill personal information if available
        if (extracted.fullName?.value) {
          newForm.fullName = extracted.fullName.value;
          
          // Generate email from name
          const cleanName = extracted.fullName.value.toLowerCase()
            .replace(/[^a-z\s]/g, '') // Remove special characters
            .replace(/\s+/g, '') // Remove spaces
            .substring(0, 10); // Limit length
          newForm.email = `${cleanName}@curat.ai`;
        }
        
        // Fill address - prioritize extracted address, fallback to place of birth + country
        if (extracted.address?.value) {
          newForm.address = extracted.address.value;
        } else if (extracted.placeOfBirth?.value && extracted.nationality?.value) {
          newForm.address = `${extracted.placeOfBirth.value}, ${extracted.nationality.value}`;
        } else if (extracted.placeOfBirth?.value) {
          newForm.address = extracted.placeOfBirth.value;
        }
        
        // Generate phone number with India country code
        newForm.phone = "+910000000000";
        
        // Determine which ID number to use based on document type
        if (extracted.aadharNumber?.value) {
          newForm.aadharNumber = extracted.aadharNumber.value.replace(/\s/g, '');
        }
        if (extracted.panNumber?.value) {
          newForm.panNumber = extracted.panNumber.value;
        }
        
        return newForm;
      });
      setAadharScanned(true);
      
      // Show success message with detected document type
      const detectedType = result.detectedDocumentType || result.documentType || 'Unknown';
      const fieldCount = Object.keys(extracted).length;
      setSuccess(`Document processed successfully! Detected: ${detectedType}. Extracted ${fieldCount} fields with ${result.overallConfidence}% confidence. Personal information auto-filled.`);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const handleForeignDocumentUpload = (result: DocumentUploadResult) => {
    setUploadedDocuments(prev => [...prev, result]);
    
    // Auto-fill form from extracted data based on document type
    if (result.extractedData) {
      const extracted = result.extractedData;
      const documentType = result.documentType || result.detectedDocumentType || 'unknown';
      
      setForeignForm(prev => {
        const newForm = { ...prev };
        
        // Always fill personal information if available
        if (extracted.fullName?.value) {
          newForm.fullName = extracted.fullName.value;
          
          // Generate email from name
          const cleanName = extracted.fullName.value.toLowerCase()
            .replace(/[^a-z\s]/g, '') // Remove special characters
            .replace(/\s+/g, '') // Remove spaces
            .substring(0, 10); // Limit length
          newForm.email = `${cleanName}@curat.ai`;
        }
        
        // Fill address - prioritize extracted address, fallback to place of birth + country
        if (extracted.address?.value) {
          newForm.address = extracted.address.value;
        } else if (extracted.placeOfBirth?.value && extracted.nationality?.value) {
          newForm.address = `${extracted.placeOfBirth.value}, ${extracted.nationality.value}`;
        } else if (extracted.placeOfBirth?.value) {
          newForm.address = extracted.placeOfBirth.value;
        }
        
        // Generate phone number with country code
        if (extracted.country?.value) {
          const countryCode = getCountryCode(extracted.country.value);
          newForm.phone = `${countryCode}0000000000`;
        }
        
        // Fill passport fields only if this is a passport document
        if (documentType === 'passport' || documentType.includes('passport')) {
          
          if (extracted.passportNumber?.value) {
            newForm.passportNumber = extracted.passportNumber.value;
          }
          if (extracted.country?.value) {
            newForm.passportCountry = extracted.country.value;
          }
          if (extracted.nationality?.value) {
            newForm.passportNationality = extracted.nationality.value;
          }
          if (extracted.dateOfBirth?.value) {
            newForm.passportDateOfBirth = extracted.dateOfBirth.value;
          }
          if (extracted.issueDate?.value) {
            newForm.passportIssueDate = extracted.issueDate.value;
          }
          if (extracted.expiryDate?.value) {
            newForm.passportExpiryDate = extracted.expiryDate.value;
          }
          if (extracted.placeOfBirth?.value) {
            newForm.passportPlaceOfBirth = extracted.placeOfBirth.value;
          }
          if (extracted.issuingAuthority?.value) {
            newForm.passportIssuingAuthority = extracted.issuingAuthority.value;
          }
          
          // Legacy field for backward compatibility
          if (extracted.country?.value || extracted.nationality?.value) {
            newForm.country = extracted.country?.value || extracted.nationality?.value || prev.country;
          }
        }
        
        // Fill visa fields only if this is a visa document
        if (documentType === 'visa_front' || documentType === 'visa_back' || documentType.includes('visa')) {
          
          if (extracted.visaType?.value) {
            newForm.visaType = extracted.visaType.value;
          }
          if (extracted.visaCategory?.value) {
            newForm.visaCategory = extracted.visaCategory.value;
          }
          if (extracted.visaNumber?.value) {
            newForm.visaNumber = extracted.visaNumber.value;
          }
          if (extracted.country?.value) {
            newForm.visaCountry = extracted.country.value;
          }
          if (extracted.issueDate?.value || extracted.visaIssueDate?.value) {
            newForm.visaIssueDate = extracted.issueDate?.value || extracted.visaIssueDate?.value;
          }
          if (extracted.expiryDate?.value || extracted.visaExpiryDate?.value) {
            newForm.visaExpiryDate = extracted.expiryDate?.value || extracted.visaExpiryDate?.value;
          }
          if (extracted.placeOfIssue?.value || extracted.visaPlaceOfIssue?.value) {
            newForm.visaPlaceOfIssue = extracted.placeOfIssue?.value || extracted.visaPlaceOfIssue?.value;
          }
          if (extracted.purposeOfVisit?.value) {
            newForm.visaPurposeOfVisit = extracted.purposeOfVisit.value;
          }
          if (extracted.durationOfStay?.value) {
            newForm.visaDurationOfStay = extracted.durationOfStay.value;
          }
          if (extracted.numberOfEntries?.value) {
            newForm.visaNumberOfEntries = extracted.numberOfEntries.value;
          }
          if (extracted.portOfEntry?.value) {
            newForm.visaPortOfEntry = extracted.portOfEntry.value;
          }
          if (extracted.issuingAuthority?.value || extracted.visaIssuingAuthority?.value) {
            newForm.visaIssuingAuthority = extracted.issuingAuthority?.value || extracted.visaIssuingAuthority?.value;
          }
          if (extracted.visaStatus?.value) {
            newForm.visaStatus = extracted.visaStatus.value;
          }
          if (extracted.remarks?.value) {
            newForm.visaRemarks = extracted.remarks.value;
          }
        }
        
        return newForm;
      });
      
      // Show success message with document-specific details
      const detectedType = result.detectedDocumentType || documentType || 'Unknown';
      const fieldCount = Object.keys(extracted).length;
      const documentSpecificMessage = documentType === 'passport' || documentType.includes('passport') 
        ? 'Passport fields auto-filled' 
        : documentType === 'visa_front' || documentType.includes('visa')
        ? 'Visa fields auto-filled'
        : 'Document fields auto-filled';
        
      setSuccess(`Document processed successfully! Detected: ${detectedType}. Extracted ${fieldCount} fields with ${result.overallConfidence}% confidence. ${documentSpecificMessage}.`);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const handleViewDocuments = async (checkIn: GuestCheckIn) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/${checkIn.id}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocumentViewerDocs(data.documents || []);
        setSelectedGuestForDocs(checkIn);
        setShowDocumentViewer(true);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  // Fetch properties using the same API as PropertiesPage
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/properties`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch properties');
        }
        
        const data = await response.json();
        setProperties(data.properties || []);
      } catch (err) {
        console.error('Error fetching properties:', err);
      }
    };
    fetchProperties();
  }, []);

  // Auto-select first property for Indian form if none selected
  useEffect(() => {
    if (properties.length > 0 && !indianForm.propertyId) {
      setIndianForm(prev => ({ ...prev, propertyId: properties[0].id.toString() }));
    }
  }, [properties, indianForm.propertyId]);

  // Auto-select first property for Foreign form if none selected
  useEffect(() => {
    if (properties.length > 0 && !foreignForm.propertyId) {
      setForeignForm(prev => ({ ...prev, propertyId: properties[0].id.toString() }));
    }
  }, [properties, foreignForm.propertyId]);

  // Fetch check-ins for admin view
  const fetchCheckIns = async () => {
    console.log('=== FETCH CHECK-INS DEBUG ===');
    setIsLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterGuestType !== 'all') params.guestType = filterGuestType;

      const queryString = new URLSearchParams(params).toString();
      const url = `${API_CONFIG.BASE_URL}/guest-checkin/list${queryString ? `?${queryString}` : ''}`;
      
      const authToken = localStorage.getItem('accessToken');
      
      console.log('API Base URL:', API_CONFIG.BASE_URL);
      console.log('Full URL:', url);
      console.log('Auth Token:', authToken ? `${authToken.substring(0, 20)}...` : 'NO TOKEN');
      console.log('Filters:', { filterStatus, filterGuestType });
      console.log('Query Params:', params);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error Response:', errorText);
        throw new Error(`Failed to fetch check-ins: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Response Data:', data);
      console.log('Check-ins Count:', data.checkins ? data.checkins.length : 0);
      console.log('Total:', data.total);
      
      setCheckIns(data.checkins || []);
      console.log('Check-ins state updated:', data.checkins ? data.checkins.length : 0);
    } catch (err: any) {
      console.log('Fetch Error:', err);
      setError(err.message || 'Failed to fetch check-ins');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('=== ADMIN DASHBOARD EFFECT DEBUG ===');
    console.log('View Mode:', viewMode);
    console.log('User:', user);
    console.log('Access Token:', localStorage.getItem('accessToken') ? 'EXISTS' : 'MISSING');
    
    if (viewMode === 'admin-dashboard') {
      console.log('Triggering fetchCheckIns...');
      fetchCheckIns();
    }
  }, [viewMode, filterStatus, filterGuestType]);

  // Handle Indian guest check-in
  const handleIndianCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Build request data, only including fields with values
    const requestData: any = {
      propertyId: parseInt(indianForm.propertyId),
      guestType: 'indian',
      fullName: indianForm.fullName || '',
      email: indianForm.email || '',
      phone: indianForm.phone || '',
      address: indianForm.address || '',
      aadharNumber: indianForm.aadharNumber || '',
      numberOfGuests: indianForm.numberOfGuests || 1,
    };

    // Only add optional fields if they have values
    if (indianForm.panNumber && indianForm.panNumber.trim()) {
      requestData.panNumber = indianForm.panNumber.trim();
    }
    if (indianForm.expectedCheckoutDate && indianForm.expectedCheckoutDate.trim()) {
      requestData.expectedCheckoutDate = indianForm.expectedCheckoutDate.trim();
    }
    if (indianForm.roomNumber && indianForm.roomNumber.trim()) {
      requestData.roomNumber = indianForm.roomNumber.trim();
    }

    console.log('=== INDIAN CHECK-IN REQUEST DEBUG ===');
    console.log('API Base URL:', API_CONFIG.BASE_URL);
    console.log('Full URL:', `${API_CONFIG.BASE_URL}/guest-checkin/create`);
    console.log('Request Data:', requestData);
    console.log('Raw Form Data:', indianForm);
    console.log('Property ID type:', typeof requestData.propertyId);
    console.log('Property ID value:', requestData.propertyId);

    // Validate required fields before sending
    if (!requestData.fullName || !requestData.email || !requestData.phone || !requestData.address) {
      setError('Please fill in all required fields (Name, Email, Phone, Address)');
      setIsLoading(false);
      return;
    }

    if (!requestData.aadharNumber) {
      setError('Aadhar number is required for Indian guests');
      setIsLoading(false);
      return;
    }

    if (requestData.aadharNumber && !/^\d{12}$/.test(requestData.aadharNumber)) {
      setError('Aadhar number must be exactly 12 digits');
      setIsLoading(false);
      return;
    }

    if (requestData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(requestData.panNumber.toUpperCase())) {
      setError('PAN number must be in format: ABCDE1234F');
      setIsLoading(false);
      return;
    }

    if (isNaN(requestData.propertyId)) {
      setError('Please select a valid property');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('=== SERVER ERROR RESPONSE ===');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Error Data:', errorData);
        console.log('Request Data Sent:', requestData);
        throw new Error(errorData.message || `Server error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('=== SUCCESS RESPONSE ===');
      console.log('Response Data:', data);
      const successMessage = data.message || 'Check-in successful! Welcome to our property.';
      setSuccess(successMessage);
      
      // Show toast notification
      toast({
        title: "Check-in Successful! 🎉",
        description: successMessage,
        duration: 5000,
      });
      
      // Refresh guest list if in admin dashboard view
      console.log('=== CHECK-IN SUCCESS DEBUG ===');
      console.log('Current viewMode:', viewMode);
      console.log('Should refresh guest list:', viewMode === 'admin-dashboard');
      
      // Always refresh guest list after successful check-in
      console.log('Calling fetchCheckIns after successful check-in...');
      fetchCheckIns();
      
      // Reset form
      setIndianForm({
        propertyId: '',
        fullName: '',
        email: '',
        phone: '',
        address: '',
        aadharNumber: '',
        panNumber: '',
        roomNumber: '',
        numberOfGuests: 1,
        expectedCheckoutDate: '',
      });

      // Show success message for 5 seconds, then clear it
      setTimeout(() => {
        setSuccess(null);
        // If in form view, switch to landing after success
        if (viewMode === 'indian-form') {
          setViewMode('landing');
        }
      }, 5000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to complete check-in';
      setError(errorMessage);
      
      // Show error toast notification
      toast({
        title: "Check-in Failed ❌",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle foreign guest check-in
  const handleForeignCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify((() => {
          // Build request data, only including fields with values
          const requestData: any = {
            propertyId: parseInt(foreignForm.propertyId),
            guestType: 'foreign',
            fullName: foreignForm.fullName || '',
            email: foreignForm.email || '',
            phone: foreignForm.phone || '',
            address: foreignForm.address || '',
            passportNumber: foreignForm.passportNumber || '',
            country: foreignForm.passportCountry || foreignForm.country || '',
            numberOfGuests: foreignForm.numberOfGuests || 1,
          };

          // Only add optional fields if they have values
          if (foreignForm.visaType && foreignForm.visaType.trim()) {
            requestData.visaType = foreignForm.visaType.trim();
          }
          if (foreignForm.visaExpiryDate && foreignForm.visaExpiryDate.trim()) {
            requestData.visaExpiryDate = foreignForm.visaExpiryDate.trim();
          }
          if (foreignForm.expectedCheckoutDate && foreignForm.expectedCheckoutDate.trim()) {
            requestData.expectedCheckoutDate = foreignForm.expectedCheckoutDate.trim();
          }
          if (foreignForm.roomNumber && foreignForm.roomNumber.trim()) {
            requestData.roomNumber = foreignForm.roomNumber.trim();
          }

          return requestData;
        })()),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete check-in');
      }

      const data = await response.json();
      console.log('=== SUCCESS RESPONSE ===');
      console.log('Response Data:', data);
      const successMessage = data.message || 'Check-in successful! Welcome to our property.';
      setSuccess(successMessage);
      
      // Show toast notification
      toast({
        title: "Check-in Successful! 🎉",
        description: successMessage,
        duration: 5000,
      });
      
      // Always refresh guest list after successful check-in
      console.log('Calling fetchCheckIns after successful foreign check-in...');
      fetchCheckIns();
      
      // Reset form
      setForeignForm({
        propertyId: '',
        fullName: '',
        email: '',
        phone: '',
        address: '',
        // Passport Details
        passportNumber: '',
        passportCountry: '',
        passportNationality: '',
        passportDateOfBirth: '',
        passportIssueDate: '',
        passportExpiryDate: '',
        passportPlaceOfBirth: '',
        passportIssuingAuthority: '',
        // Visa Details
        visaType: '',
        visaCategory: '',
        visaNumber: '',
        visaCountry: '',
        visaIssueDate: '',
        visaExpiryDate: '',
        visaPlaceOfIssue: '',
        visaPurposeOfVisit: '',
        visaDurationOfStay: '',
        visaNumberOfEntries: '',
        visaPortOfEntry: '',
        visaIssuingAuthority: '',
        visaStatus: '',
        visaRemarks: '',
        // Legacy fields for backward compatibility
        country: '',
        roomNumber: '',
        numberOfGuests: 1,
        expectedCheckoutDate: '',
      });

      // Show success message for 5 seconds, then clear it
      setTimeout(() => {
        setSuccess(null);
        // If in form view, switch to landing after success
        if (viewMode === 'foreign-form') {
          setViewMode('landing');
        }
      }, 5000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to complete check-in';
      setError(errorMessage);
      
      // Show error toast notification
      toast({
        title: "Check-in Failed ❌",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle checkout
  const handleCheckOut = async (checkInId: number) => {
    if (!confirm('Are you sure you want to check out this guest?')) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/${checkInId}/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out guest');
      }

      setSuccess('Guest checked out successfully');
      fetchCheckIns();
    } catch (err: any) {
      setError(err.message || 'Failed to check out guest');
    }
  };

  // Render landing page - Mobile UI
  if (viewMode === 'landing') {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
        {/* Mobile UI - Current design */}
        <div className="block md:hidden">
          <main className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8">
              <div className="text-center">
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">Welcome</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Please select your guest type to proceed with check-in.
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => setViewMode('indian-form')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-6 rounded-xl shadow-lg transition-transform transform hover:scale-105 text-lg"
                >
                  <User className="h-6 w-6 mr-3" />
                  Indian Guest
                </Button>

                <Button
                  onClick={() => setViewMode('foreign-form')}
                  className="w-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold py-6 px-6 rounded-xl border-2 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all text-lg"
                >
                  <Globe className="h-6 w-6 mr-3" />
                  Foreign Guest
                </Button>
              </div>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-gray-50 dark:bg-gray-900 px-3 text-sm text-gray-600 dark:text-gray-400">
                      For Admin
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => setViewMode('admin-dashboard')}
                  variant="outline"
                  className="mt-4 w-full border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold py-4 px-6 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  Guest Details for Admin
                </Button>
              </div>
            </div>
          </main>

          <footer className="bg-white border-t border-gray-200 p-6">
            <nav className="flex justify-center items-center space-x-16 max-w-4xl mx-auto" role="navigation" aria-label="Footer navigation">
              <button className="flex flex-col items-center text-gray-700 hover:text-gray-900 transition-colors" aria-label="Help and support">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mb-2" aria-hidden="true">
                  <span className="text-white text-lg font-bold">?</span>
                </div>
                <span className="text-sm font-medium">Help</span>
              </button>
              <button className="flex flex-col items-center text-gray-700 hover:text-gray-900 transition-colors" aria-label="Terms and conditions">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mb-2" aria-hidden="true">
                  <div className="w-4 h-4 bg-white rounded-sm flex flex-col justify-center">
                    <div className="h-0.5 bg-gray-700 mb-0.5"></div>
                    <div className="h-0.5 bg-gray-700 mb-0.5"></div>
                    <div className="h-0.5 bg-gray-700"></div>
                  </div>
                </div>
                <span className="text-sm font-medium">Terms & Conditions</span>
              </button>
            </nav>
          </footer>
        </div>

        {/* Web UI - Reports page style with tabs */}
        <div className="hidden md:block w-full h-screen bg-gray-50 overflow-hidden">
          <div className="px-6 pt-1 pb-4 h-full flex flex-col">
            
            {/* Tabs positioned above cards */}
            <FinanceTabs defaultValue="indian-guest" theme={theme} className="h-full flex flex-col">
              <div className="-mx-6 px-6 py-2 mb-4">
                <FinanceTabsList className="grid-cols-4" theme={theme}>
                <FinanceTabsTrigger value="indian-guest" theme={theme}>
                  <User className="h-4 w-4 mr-2" />
                  Indian Guest Check-in
                </FinanceTabsTrigger>
                <FinanceTabsTrigger value="foreign-guest" theme={theme}>
                  <Globe className="h-4 w-4 mr-2" />
                  Foreign Guest Check-in
                </FinanceTabsTrigger>
                <FinanceTabsTrigger value="guest-details" theme={theme}>
                  <Shield className="h-4 w-4 mr-2" />
                  Guest Details
                </FinanceTabsTrigger>
                <FinanceTabsTrigger value="audit-logs" theme={theme}>
                  <FileText className="h-4 w-4 mr-2" />
                  Audit Logs
                </FinanceTabsTrigger>
              </FinanceTabsList>
              </div>

              {/* Content Container */}
              <div className="space-y-6 mt-4 flex-1 overflow-y-auto">
                <TabsContent value="indian-guest" className="space-y-4 mt-0">
                  <Card className="border-l-4 border-l-green-500 shadow-md">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <User className="h-6 w-6 text-green-600" />
                        Indian Guest Check-in
                      </CardTitle>
                      <CardDescription>Complete check-in for Indian guests</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {error && (
                        <Alert className="mb-4 border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800">{error}</AlertDescription>
                        </Alert>
                      )}

                      {success && (
                        <Alert className="mb-4 border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                      )}

                      {/* Indian ID Documents Upload Section */}
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload Indian ID Document</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Auto-fill your details by uploading any Indian government ID. AI will detect the document type and extract information automatically.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <DocumentUploadZone
                            documentType="other"
                            label="Any Indian ID Document"
                            onUploadComplete={handleIndianDocumentUpload}
                            onExtractionComplete={(data) => {
                              // Auto-fill happens in handleIndianDocumentUpload
                            }}
                          />
                          
                          <DocumentUploadZone
                            documentType="aadhaar_back"
                            label="Additional Document (Optional)"
                            onUploadComplete={handleIndianDocumentUpload}
                          />
                        </div>
                        
                        {uploadedDocuments.length > 0 && (
                          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-700 flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              <strong>{uploadedDocuments.length} document(s) uploaded.</strong> Form fields have been auto-filled. Please verify the information.
                            </p>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleIndianCheckIn} className="space-y-6">
                        {/* Tabbed Interface for Form Sections */}
                        <FinanceTabs value={indianActiveTab} onValueChange={(value) => setIndianActiveTab(value as any)} theme={theme} className="space-y-4">
                          <FinanceTabsList className="grid-cols-3" theme={theme}>
                            <FinanceTabsTrigger 
                              value="personal" 
                              theme={theme} 
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Personal Information
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger 
                              value="id-documents" 
                              theme={theme} 
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              ID Documents
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger 
                              value="booking" 
                              theme={theme} 
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Booking Details
                            </FinanceTabsTrigger>
                          </FinanceTabsList>

                          {/* Personal Information Tab */}
                          <TabsContent value="personal" className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="indian-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Full Name *
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="indian-name"
                                    value={indianForm.fullName}
                                    onChange={(e) => setIndianForm({ ...indianForm, fullName: e.target.value })}
                                    placeholder="Enter your full name"
                                    required
                                    className="h-11"
                                  />
                                  {aadharScanned && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                      <Check className="h-5 w-5 text-green-600" />
                                    </div>
                                  )}
                                </div>
                                {aadharScanned && (
                                  <p className="text-xs text-green-700 bg-green-100 p-1.5 rounded-md mt-1 flex items-center">
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Auto-filled from Aadhaar
                                  </p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="indian-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Email *
                                </Label>
                                <Input
                                  id="indian-email"
                                  type="email"
                                  value={indianForm.email}
                                  onChange={(e) => setIndianForm({ ...indianForm, email: e.target.value })}
                                  placeholder="your.email@example.com"
                                  required
                                  className="h-11"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="indian-phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Phone Number *
                              </Label>
                              <Input
                                id="indian-phone"
                                type="tel"
                                value={indianForm.phone}
                                onChange={(e) => setIndianForm({ ...indianForm, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                required
                                className="h-11"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="indian-address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Address *
                              </Label>
                              <div className="relative">
                                <Input
                                  id="indian-address"
                                  value={indianForm.address}
                                  onChange={(e) => setIndianForm({ ...indianForm, address: e.target.value })}
                                  placeholder="Enter your address"
                                  required
                                  className="h-11"
                                />
                                {aadharScanned && (
                                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <Check className="h-5 w-5 text-green-600" />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Next Button */}
                            <div className="pt-4">
                              <Button
                                type="button"
                                onClick={() => setIndianActiveTab('id-documents')}
                                disabled={!isIndianPersonalInfoValid()}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              >
                                Next
                              </Button>
                            </div>
                          </TabsContent>

                          {/* ID Documents Tab */}
                          <TabsContent value="id-documents" className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="indian-aadhar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Aadhaar Number *
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="indian-aadhar"
                                    value={aadharScanned ? "**** **** 8432" : indianForm.aadharNumber}
                                    onChange={(e) => setIndianForm({ ...indianForm, aadharNumber: e.target.value })}
                                    placeholder="1234 5678 9012"
                                    required
                                    className="h-11"
                                  />
                                  {aadharScanned && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                      <Check className="h-5 w-5 text-green-600" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="indian-pan" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  PAN Card Number
                                </Label>
                                <Input
                                  id="indian-pan"
                                  value={indianForm.panNumber}
                                  onChange={(e) => setIndianForm({ ...indianForm, panNumber: e.target.value.toUpperCase() })}
                                  placeholder="ABCDE1234F"
                                  className="h-11"
                                />
                              </div>
                            </div>
                            
                            {/* Next Button */}
                            <div className="pt-4">
                              <Button
                                type="button"
                                onClick={() => setIndianActiveTab('booking')}
                                disabled={!isIndianIdDocumentsValid()}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              >
                                Next
                              </Button>
                            </div>
                          </TabsContent>

                          {/* Booking Details Tab */}
                          <TabsContent value="booking" className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="indian-property" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Property *
                                </Label>
                                <Select value={indianForm.propertyId} onValueChange={(value) => setIndianForm({ ...indianForm, propertyId: value })}>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select property" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {properties.map((property) => (
                                      <SelectItem key={property.id} value={property.id.toString()}>
                                        {property.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="indian-room" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Room Number (Optional)
                                </Label>
                                <Input
                                  id="indian-room"
                                  value={indianForm.roomNumber}
                                  onChange={(e) => setIndianForm({ ...indianForm, roomNumber: e.target.value })}
                                  placeholder="101"
                                  className="h-11"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="indian-guests" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Number of Guests
                                </Label>
                                <Input
                                  id="indian-guests"
                                  type="number"
                                  min="1"
                                  value={indianForm.numberOfGuests}
                                  onChange={(e) => setIndianForm({ ...indianForm, numberOfGuests: parseInt(e.target.value) || 1 })}
                                  className="h-11"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="indian-checkout" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Expected Checkout Date
                                </Label>
                                <Input
                                  id="indian-checkout"
                                  type="date"
                                  value={indianForm.expectedCheckoutDate}
                                  onChange={(e) => setIndianForm({ ...indianForm, expectedCheckoutDate: e.target.value })}
                                  className="h-11"
                                />
                              </div>
                            </div>
                            
                            {/* Terms and Conditions */}
                            <div className="pt-4">
                              <div className="flex items-start">
                                <div className="flex items-center h-5">
                                  <Input
                                    type="checkbox"
                                    id="indian-terms"
                                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    required
                                  />
                                </div>
                                <div className="ml-3 text-sm">
                                  <Label htmlFor="indian-terms" className="text-gray-900 dark:text-gray-100">
                                    I agree to the <a href="#" className="font-medium text-blue-600 hover:underline">hostel's terms and conditions</a>.
                                  </Label>
                                </div>
                              </div>
                            </div>

                            {/* Complete Check-in Button */}
                            <Button
                              type="submit"
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              disabled={isLoading || !isIndianBookingValid()}
                            >
                              {isLoading ? (
                                <>
                                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : !isIndianBookingValid() ? (
                                <>
                                  <AlertCircle className="h-5 w-5 mr-2" />
                                  {indianForm.propertyId === '' ? 'Please select a property' : 'Please fill required fields'}
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-5 w-5 mr-2" />
                                  Complete Check-in
                                </>
                              )}
                            </Button>
                          </TabsContent>
                        </FinanceTabs>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="foreign-guest" className="space-y-4 mt-0">
                  <Card className="border-l-4 border-l-green-500 shadow-md">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="h-6 w-6 text-green-600" />
                        Foreign Guest Check-in
                      </CardTitle>
                      <CardDescription>Complete check-in for foreign guests</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {error && (
                        <Alert className="mb-4 border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800">{error}</AlertDescription>
                        </Alert>
                      )}

                      {success && (
                        <Alert className="mb-4 border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                      )}

                      {/* Document Upload Section */}
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload Travel Documents</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Auto-fill your details by uploading your passport and visa. AI will extract information automatically.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <DocumentUploadZone
                            documentType="passport"
                            label="Passport"
                            onUploadComplete={handleForeignDocumentUpload}
                            onExtractionComplete={(data) => {
                              // Auto-fill happens in handleForeignDocumentUpload
                            }}
                          />
                          
                          <DocumentUploadZone
                            documentType="visa_front"
                            label="Visa - Optional"
                            onUploadComplete={handleForeignDocumentUpload}
                          />
                        </div>
                        
                        {uploadedDocuments.length > 0 && (
                          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-700 flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              <strong>{uploadedDocuments.length} document(s) uploaded.</strong> Form fields have been auto-filled. Please verify the information.
                            </p>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleForeignCheckIn} className="space-y-6">
                        {/* Tabbed Interface for Form Sections */}
                        <FinanceTabs value={foreignActiveTab} onValueChange={(value) => setForeignActiveTab(value as any)} theme={theme} className="space-y-4">
                          <FinanceTabsList className="grid-cols-3" theme={theme}>
                            <FinanceTabsTrigger 
                              value="personal" 
                              theme={theme} 
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Personal Information
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger 
                              value="travel-documents" 
                              theme={theme} 
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Travel Documents
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger 
                              value="booking" 
                              theme={theme} 
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Booking Details
                            </FinanceTabsTrigger>
                          </FinanceTabsList>

                          {/* Personal Information Tab */}
                          <TabsContent value="personal" className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="foreign-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Full Name *
                                </Label>
                                <Input
                                  id="foreign-name"
                                  value={foreignForm.fullName}
                                  onChange={(e) => setForeignForm({ ...foreignForm, fullName: e.target.value })}
                                  placeholder="Enter your full name"
                                  required
                                  className="h-11"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="foreign-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Email *
                                </Label>
                                <Input
                                  id="foreign-email"
                                  type="email"
                                  value={foreignForm.email}
                                  onChange={(e) => setForeignForm({ ...foreignForm, email: e.target.value })}
                                  placeholder="your.email@example.com"
                                  required
                                  className="h-11"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="foreign-phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Phone Number *
                              </Label>
                              <Input
                                id="foreign-phone"
                                type="tel"
                                value={foreignForm.phone}
                                onChange={(e) => setForeignForm({ ...foreignForm, phone: e.target.value })}
                                placeholder="+1 234 567 8900"
                                required
                                className="h-11"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="foreign-address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Address *
                              </Label>
                              <Input
                                id="foreign-address"
                                value={foreignForm.address}
                                onChange={(e) => setForeignForm({ ...foreignForm, address: e.target.value })}
                              placeholder="Enter your address"
                              required
                              className="h-11"
                            />
                          </div>
                          
                          {/* Next Button */}
                          <div className="pt-4">
                            <Button
                              type="button"
                              onClick={() => setForeignActiveTab('travel-documents')}
                              disabled={!isForeignPersonalInfoValid()}
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                            >
                              Next
                            </Button>
                          </div>
                        </TabsContent>

                          {/* Travel Documents Tab - Comprehensive Passport and Visa Details */}
                          <TabsContent value="travel-documents" className="space-y-6">
                            {/* Passport Details Section */}
                            <div className="space-y-4">
                              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                                Passport Details
                              </h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="passport-number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Passport Number *
                                  </Label>
                                  <Input
                                    id="passport-number"
                                    value={foreignForm.passportNumber}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportNumber: e.target.value })}
                                    placeholder="KF0250087"
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="passport-country" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Country *
                                  </Label>
                                  <Input
                                    id="passport-country"
                                    value={foreignForm.passportCountry}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportCountry: e.target.value })}
                                    placeholder="Estonia"
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="passport-nationality" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Nationality
                                  </Label>
                                  <Input
                                    id="passport-nationality"
                                    value={foreignForm.passportNationality}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportNationality: e.target.value })}
                                    placeholder="Estonia"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="passport-date-of-birth" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Date of Birth
                                  </Label>
                                  <Input
                                    id="passport-date-of-birth"
                                    type="date"
                                    value={foreignForm.passportDateOfBirth}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportDateOfBirth: e.target.value })}
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="passport-issue-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Issue Date
                                  </Label>
                                  <Input
                                    id="passport-issue-date"
                                    type="date"
                                    value={foreignForm.passportIssueDate}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportIssueDate: e.target.value })}
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="passport-expiry-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Expiry Date *
                                  </Label>
                                  <Input
                                    id="passport-expiry-date"
                                    type="date"
                                    value={foreignForm.passportExpiryDate}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportExpiryDate: e.target.value })}
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="passport-place-of-birth" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Place of Birth
                                  </Label>
                                  <Input
                                    id="passport-place-of-birth"
                                    value={foreignForm.passportPlaceOfBirth}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportPlaceOfBirth: e.target.value })}
                                    placeholder="Tallinn, Estonia"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                  <Label htmlFor="passport-issuing-authority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Issuing Authority
                                  </Label>
                                  <Input
                                    id="passport-issuing-authority"
                                    value={foreignForm.passportIssuingAuthority}
                                    onChange={(e) => setForeignForm({ ...foreignForm, passportIssuingAuthority: e.target.value })}
                                    placeholder="Police and Border Guard Board, Tallinn, Estonia"
                                    className="h-11"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Visa Details Section */}
                            <div className="space-y-4">
                              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                                Visa Details (FRRO C-Form Ready)
                              </h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="visa-type" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Visa Type
                                  </Label>
                                  <Input
                                    id="visa-type"
                                    value={foreignForm.visaType}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaType: e.target.value })}
                                    placeholder="Tourist"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-category" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Visa Category
                                  </Label>
                                  <Input
                                    id="visa-category"
                                    value={foreignForm.visaCategory}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaCategory: e.target.value })}
                                    placeholder="e-Visa"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Visa Number
                                  </Label>
                                  <Input
                                    id="visa-number"
                                    value={foreignForm.visaNumber}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaNumber: e.target.value })}
                                    placeholder="900F3927P"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-country" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Visa Country
                                  </Label>
                                  <Input
                                    id="visa-country"
                                    value={foreignForm.visaCountry}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaCountry: e.target.value })}
                                    placeholder="India"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-issue-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Issue Date
                                  </Label>
                                  <Input
                                    id="visa-issue-date"
                                    type="date"
                                    value={foreignForm.visaIssueDate}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaIssueDate: e.target.value })}
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-expiry-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Expiry Date
                                  </Label>
                                  <Input
                                    id="visa-expiry-date"
                                    type="date"
                                    value={foreignForm.visaExpiryDate}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaExpiryDate: e.target.value })}
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-place-of-issue" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Place of Issue
                                  </Label>
                                  <Input
                                    id="visa-place-of-issue"
                                    value={foreignForm.visaPlaceOfIssue}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaPlaceOfIssue: e.target.value })}
                                    placeholder="New Delhi"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-purpose" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Purpose of Visit
                                  </Label>
                                  <Input
                                    id="visa-purpose"
                                    value={foreignForm.visaPurposeOfVisit}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaPurposeOfVisit: e.target.value })}
                                    placeholder="Tourism"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-duration" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Duration of Stay
                                  </Label>
                                  <Input
                                    id="visa-duration"
                                    value={foreignForm.visaDurationOfStay}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaDurationOfStay: e.target.value })}
                                    placeholder="90 days"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-entries" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Number of Entries
                                  </Label>
                                  <Input
                                    id="visa-entries"
                                    value={foreignForm.visaNumberOfEntries}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaNumberOfEntries: e.target.value })}
                                    placeholder="Multiple"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-port-of-entry" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Port of Entry
                                  </Label>
                                  <Input
                                    id="visa-port-of-entry"
                                    value={foreignForm.visaPortOfEntry}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaPortOfEntry: e.target.value })}
                                    placeholder="IGI AIRPORT, NEW DELHI"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="visa-status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Visa Status
                                  </Label>
                                  <Input
                                    id="visa-status"
                                    value={foreignForm.visaStatus}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaStatus: e.target.value })}
                                    placeholder="Active"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                  <Label htmlFor="visa-issuing-authority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Issuing Authority
                                  </Label>
                                  <Input
                                    id="visa-issuing-authority"
                                    value={foreignForm.visaIssuingAuthority}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaIssuingAuthority: e.target.value })}
                                    placeholder="BUREAU OF IMMIGRATION INDIA"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                  <Label htmlFor="visa-remarks" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Remarks/Conditions
                                  </Label>
                                  <Input
                                    id="visa-remarks"
                                    value={foreignForm.visaRemarks}
                                    onChange={(e) => setForeignForm({ ...foreignForm, visaRemarks: e.target.value })}
                                    placeholder="Each stay not to exceed 90 days"
                                    className="h-11"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Next Button */}
                            <div className="pt-4">
                              <Button
                                type="button"
                                onClick={() => setForeignActiveTab('booking')}
                                disabled={!isForeignTravelDocumentsValid()}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              >
                                Next
                              </Button>
                            </div>
                          </TabsContent>

                          {/* Booking Details Tab */}
                          <TabsContent value="booking" className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="foreign-property" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Property *
                                </Label>
                                <Select value={foreignForm.propertyId} onValueChange={(value) => setForeignForm({ ...foreignForm, propertyId: value })}>
                                  <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select property" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {properties.map((property) => (
                                      <SelectItem key={property.id} value={property.id.toString()}>
                                        {property.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="foreign-room" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Room Number (Optional)
                                </Label>
                                <Input
                                  id="foreign-room"
                                  value={foreignForm.roomNumber}
                                  onChange={(e) => setForeignForm({ ...foreignForm, roomNumber: e.target.value })}
                                  placeholder="101"
                                  className="h-11"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="foreign-guests" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Number of Guests
                                </Label>
                                <Input
                                  id="foreign-guests"
                                  type="number"
                                  min="1"
                                  value={foreignForm.numberOfGuests}
                                  onChange={(e) => setForeignForm({ ...foreignForm, numberOfGuests: parseInt(e.target.value) || 1 })}
                                  className="h-11"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="foreign-checkout" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Expected Checkout Date
                                </Label>
                                <Input
                                  id="foreign-checkout"
                                  type="date"
                                  value={foreignForm.expectedCheckoutDate}
                                  onChange={(e) => setForeignForm({ ...foreignForm, expectedCheckoutDate: e.target.value })}
                                  className="h-11"
                                />
                              </div>
                            </div>
                            
                            {/* Complete Check-in Button */}
                            <Button
                              type="submit"
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              disabled={isLoading || !isForeignBookingValid()}
                            >
                              {isLoading ? (
                                <>
                                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : !isForeignBookingValid() ? (
                                <>
                                  <AlertCircle className="h-5 w-5 mr-2" />
                                  {foreignForm.propertyId === '' ? 'Please select a property' : 'Please fill required fields'}
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-5 w-5 mr-2" />
                                  Complete Check-in
                                </>
                              )}
                            </Button>
                          </TabsContent>
                        </FinanceTabs>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="guest-details" className="space-y-4 mt-0">
                  {/* Add Guest Modal */}
                  <div className={`fixed inset-0 bg-black bg-opacity-50 ${showAddGuestModal ? 'flex' : 'hidden'} items-center justify-center z-50`}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl transform transition-all">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add New Guest</h2>
                        <button 
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                          onClick={() => setShowAddGuestModal(false)}
                        >
                          <AlertCircle className="h-6 w-6" />
                        </button>
                      </div>
                      <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="guest-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</Label>
                          <Input 
                            id="guest-name" 
                            type="text" 
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label htmlFor="dob" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Date of Birth</Label>
                          <Input 
                            id="dob" 
                            type="date" 
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label htmlFor="nationality" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Nationality</Label>
                          <Select>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select nationality" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="indian">Indian</SelectItem>
                              <SelectItem value="foreign">Foreign</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="id-proof" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">ID Proof</Label>
                          <Input 
                            id="id-proof" 
                            type="file" 
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label htmlFor="payment-proof" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Proof</Label>
                          <Input 
                            id="payment-proof" 
                            type="file" 
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label htmlFor="days-stay" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">No. of Days</Label>
                          <Input 
                            id="days-stay" 
                            type="number" 
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label htmlFor="property" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Property</Label>
                          <Select>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select property" />
                            </SelectTrigger>
                            <SelectContent>
                              {properties.map((property) => (
                                <SelectItem key={property.id} value={property.id.toString()}>
                                  {property.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="room-type" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Room Type</Label>
                          <Select>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select room type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Single Room</SelectItem>
                              <SelectItem value="double">Double Room</SelectItem>
                              <SelectItem value="dorm-4">Dormitory (4 beds)</SelectItem>
                              <SelectItem value="dorm-8">Dormitory (8 beds)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowAddGuestModal(false)}
                            type="button"
                          >
                            Cancel
                          </Button>
                          <Button 
                            className="bg-green-600 hover:bg-green-700"
                            type="button"
                            onClick={() => setShowAddGuestModal(false)}
                          >
                            Add Guest
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <Card className="border-l-4 border-l-green-500 shadow-md">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Shield className="h-6 w-6 text-green-600" />
                            Guest List
                          </CardTitle>
                          <CardDescription>View and manage all checked-in guests</CardDescription>
                        </div>
                        <div className="flex-shrink-0 flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={fetchCheckIns}
                            disabled={isLoading}
                            className="flex items-center gap-2"
                          >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                          <Button 
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            onClick={() => setShowAddGuestModal(true)}
                          >
                            <User className="h-4 w-4" />
                            Add Guest
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div>
                          <Label htmlFor="filter-guest-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Guest Name</Label>
                          <Input 
                            id="filter-guest-name" 
                            placeholder="Search by name" 
                            type="text" 
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="filter-checkin-date" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Check-in Date</Label>
                          <Input 
                            id="filter-checkin-date" 
                            type="date" 
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="filter-property" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Property</Label>
                          <Select>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="All Properties" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Properties</SelectItem>
                              {properties.map((property) => (
                                <SelectItem key={property.id} value={property.id.toString()}>
                                  {property.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Nationality</Label>
                          <div className="flex items-center w-full">
                            <Button 
                              variant={filterGuestType === 'all' ? 'default' : 'outline'}
                              className="flex-1 rounded-r-none border-r-0 text-xs px-2 py-2"
                              onClick={() => setFilterGuestType('all')}
                            >
                              All
                            </Button>
                            <Button 
                              variant={filterGuestType === 'indian' ? 'default' : 'outline'}
                              className="flex-1 rounded-none border-r-0 text-xs px-2 py-2"
                              onClick={() => setFilterGuestType('indian')}
                            >
                              Indian
                            </Button>
                            <Button 
                              variant={filterGuestType === 'foreign' ? 'default' : 'outline'}
                              className="flex-1 rounded-l-none text-xs px-2 py-2"
                              onClick={() => setFilterGuestType('foreign')}
                            >
                              Foreign
                            </Button>
                          </div>
                        </div>
                      </div>

                      {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Loading guests...</p>
                          </div>
                        </div>
                      ) : error ? (
                        <div className="flex items-center justify-center p-12">
                          <div className="text-center">
                            <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
                            <p className="text-lg font-medium text-red-900 dark:text-red-100">{error}</p>
                            <Button onClick={fetchCheckIns} variant="outline" className="mt-4">
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Try Again
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Guest Name</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Property</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Nationality</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Room Type</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Check-in Date</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Days</th>
                                <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                console.log('=== GUEST LIST RENDER DEBUG ===');
                                console.log('checkIns state:', checkIns);
                                console.log('checkIns.length:', checkIns.length);
                                console.log('checkIns type:', typeof checkIns);
                                console.log('Is array:', Array.isArray(checkIns));
                                return null;
                              })()}
                              {checkIns.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-gray-500">
                                    No guests found. Click "Add Guest" to get started.
                                    <br />
                                    <small className="text-xs text-gray-400 mt-2 block">
                                      Debug: checkIns.length = {checkIns.length}
                                    </small>
                                  </td>
                                </tr>
                              ) : (
                                checkIns.map((checkIn) => (
                                  <tr key={checkIn.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="p-3 font-medium">{checkIn.fullName}</td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400">{checkIn.propertyName}</td>
                                    <td className="p-3">
                                      <Badge 
                                        variant={checkIn.guestType === 'indian' ? 'default' : 'secondary'}
                                        className={checkIn.guestType === 'indian' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'}
                                      >
                                        {checkIn.guestType === 'indian' ? 'Indian' : 'Foreign'}
                                      </Badge>
                                    </td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400">{checkIn.roomNumber || 'Not assigned'}</td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400">{new Date(checkIn.checkInDate).toLocaleDateString()}</td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400">
                                      {checkIn.expectedCheckoutDate ? 
                                        Math.ceil((new Date(checkIn.expectedCheckoutDate).getTime() - new Date(checkIn.checkInDate).getTime()) / (1000 * 60 * 60 * 24)) : 
                                        'N/A'
                                      }
                                    </td>
                                    <td className="p-3 flex gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="p-1.5"
                                        onClick={() => handleViewDocuments(checkIn)}
                                        title="View Documents"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="p-1.5" title="Edit">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                        onClick={() => handleCheckOut(checkIn.id)}
                                        title="Check Out"
                                      >
                                        <LogOut className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Audit Logs Tab */}
                <TabsContent value="audit-logs" className="space-y-4 mt-0">
                  <AuditLogFilters
                    filters={auditFilters}
                    onFiltersChange={(newFilters) => {
                      setAuditFilters(newFilters);
                      fetchLogs(newFilters);
                    }}
                    onClear={() => {
                      setAuditFilters({});
                      fetchLogs({});
                    }}
                  />

                  <AuditLogTable
                    logs={auditLogs}
                    isLoading={auditLoading}
                    error={auditError}
                    onRefresh={() => fetchLogs(auditFilters)}
                    onExport={exportToCsv}
                  />
                </TabsContent>
              </div>
            </FinanceTabs>
          </div>
        </div>

        {/* Document Viewer Modal */}
        {showDocumentViewer && selectedGuestForDocs && (
          <DocumentViewer
            open={showDocumentViewer}
            onClose={() => setShowDocumentViewer(false)}
            guestCheckInId={selectedGuestForDocs.id}
            guestName={selectedGuestForDocs.fullName}
            documents={documentViewerDocs}
          />
        )}
      </div>
    );
  }

  // Render Indian guest form
  if (viewMode === 'indian-form') {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto p-6 overflow-y-auto">

          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <User className="h-6 w-6 text-green-600" />
                Indian Guest Check-in
              </CardTitle>
              <CardDescription>Please fill in your details to complete check-in</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              {/* Aadhaar Scan Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Scan Aadhaar Card (Optional)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Auto-fill your details by scanning your Aadhaar card.</p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg h-auto"
                    onClick={() => setAadharScanned(true)}
                  >
                    <Camera className="h-8 w-8 text-blue-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Scan Front</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg h-auto"
                    onClick={() => setAadharScanned(true)}
                  >
                    <Camera className="h-8 w-8 text-blue-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Scan Back</span>
                  </Button>
                </div>
              </div>

              <form onSubmit={handleIndianCheckIn} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Personal Information</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="indian-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full Name *
                      </Label>
                      <div className="relative">
                        <Input
                          id="indian-name"
                          value={indianForm.fullName}
                          onChange={(e) => setIndianForm({ ...indianForm, fullName: e.target.value })}
                          placeholder="Enter your full name"
                          required
                          className="h-11"
                        />
                        {aadharScanned && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                        )}
                      </div>
                      {aadharScanned && (
                        <p className="text-xs text-green-700 bg-green-100 p-1.5 rounded-md mt-1 flex items-center">
                          <Sparkles className="h-4 w-4 mr-1" />
                          Auto-filled from Aadhaar
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indian-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email *
                      </Label>
                      <Input
                        id="indian-email"
                        type="email"
                        value={indianForm.email}
                        onChange={(e) => setIndianForm({ ...indianForm, email: e.target.value })}
                        placeholder="your.email@example.com"
                        required
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="indian-phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Phone Number *
                    </Label>
                    <Input
                      id="indian-phone"
                      type="tel"
                      value={indianForm.phone}
                      onChange={(e) => setIndianForm({ ...indianForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="indian-address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address *
                    </Label>
                    <div className="relative">
                      <Input
                        id="indian-address"
                        value={indianForm.address}
                        onChange={(e) => setIndianForm({ ...indianForm, address: e.target.value })}
                        placeholder="Enter your address"
                        required
                        className="h-11"
                      />
                      {aadharScanned && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ID Documents */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ID Documents</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="indian-aadhar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Aadhaar Number *
                      </Label>
                      <div className="relative">
                        <Input
                          id="indian-aadhar"
                          value={aadharScanned ? "**** **** 8432" : indianForm.aadharNumber}
                          onChange={(e) => setIndianForm({ ...indianForm, aadharNumber: e.target.value })}
                          placeholder="1234 5678 9012"
                          required
                          className="h-11"
                        />
                        {aadharScanned && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indian-pan" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        PAN Card Number
                      </Label>
                      <Input
                        id="indian-pan"
                        value={indianForm.panNumber}
                        onChange={(e) => setIndianForm({ ...indianForm, panNumber: e.target.value.toUpperCase() })}
                        placeholder="ABCDE1234F"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Booking Details</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="indian-property" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Property *
                      </Label>
                      <Select value={indianForm.propertyId} onValueChange={(value) => setIndianForm({ ...indianForm, propertyId: value })}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indian-room" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Room Number (Optional)
                      </Label>
                      <Input
                        id="indian-room"
                        value={indianForm.roomNumber}
                        onChange={(e) => setIndianForm({ ...indianForm, roomNumber: e.target.value })}
                        placeholder="101"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="indian-guests" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Number of Guests
                      </Label>
                      <Input
                        id="indian-guests"
                        type="number"
                        min="1"
                        value={indianForm.numberOfGuests}
                        onChange={(e) => setIndianForm({ ...indianForm, numberOfGuests: parseInt(e.target.value) || 1 })}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indian-checkout" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Expected Checkout Date
                      </Label>
                      <Input
                        id="indian-checkout"
                        type="date"
                        value={indianForm.expectedCheckoutDate}
                        onChange={(e) => setIndianForm({ ...indianForm, expectedCheckoutDate: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="pt-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <Input
                        type="checkbox"
                        id="indian-terms"
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <Label htmlFor="indian-terms" className="text-gray-900 dark:text-gray-100">
                        I agree to the <a href="#" className="font-medium text-blue-600 hover:underline">hostel's terms and conditions</a>.
                      </Label>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Complete Check-in
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render foreign guest form (similar structure)
  if (viewMode === 'foreign-form') {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto p-6 overflow-y-auto">

          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Globe className="h-6 w-6 text-green-600" />
                Foreign Guest Check-in
              </CardTitle>
              <CardDescription>Please fill in your details to complete check-in</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleForeignCheckIn} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Personal Information</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="foreign-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full Name *
                      </Label>
                      <Input
                        id="foreign-name"
                        value={foreignForm.fullName}
                        onChange={(e) => setForeignForm({ ...foreignForm, fullName: e.target.value })}
                        placeholder="Enter your full name"
                        required
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="foreign-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email *
                      </Label>
                      <Input
                        id="foreign-email"
                        type="email"
                        value={foreignForm.email}
                        onChange={(e) => setForeignForm({ ...foreignForm, email: e.target.value })}
                        placeholder="your.email@example.com"
                        required
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="foreign-phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Phone Number *
                    </Label>
                    <Input
                      id="foreign-phone"
                      type="tel"
                      value={foreignForm.phone}
                      onChange={(e) => setForeignForm({ ...foreignForm, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="foreign-address" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Address *
                    </Label>
                    <Input
                      id="foreign-address"
                      value={foreignForm.address}
                      onChange={(e) => setForeignForm({ ...foreignForm, address: e.target.value })}
                      placeholder="Enter your address"
                      required
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Travel Documents - Comprehensive Passport and Visa Details */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Travel Documents</h3>
                  
                  {/* Passport Details Section */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                      Passport Details
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="passport-number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Passport Number *
                        </Label>
                        <Input
                          id="passport-number"
                          value={foreignForm.passportNumber}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportNumber: e.target.value })}
                          placeholder="KF0250087"
                          required
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="passport-country" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Country *
                        </Label>
                        <Input
                          id="passport-country"
                          value={foreignForm.passportCountry}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportCountry: e.target.value })}
                          placeholder="Estonia"
                          required
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="passport-nationality" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Nationality
                        </Label>
                        <Input
                          id="passport-nationality"
                          value={foreignForm.passportNationality}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportNationality: e.target.value })}
                          placeholder="Estonia"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="passport-issue-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Issue Date
                        </Label>
                        <Input
                          id="passport-issue-date"
                          type="date"
                          value={foreignForm.passportIssueDate}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportIssueDate: e.target.value })}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="passport-expiry-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Expiry Date *
                        </Label>
                        <Input
                          id="passport-expiry-date"
                          type="date"
                          value={foreignForm.passportExpiryDate}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportExpiryDate: e.target.value })}
                          required
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="passport-place-of-birth" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Place of Birth
                        </Label>
                        <Input
                          id="passport-place-of-birth"
                          value={foreignForm.passportPlaceOfBirth}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportPlaceOfBirth: e.target.value })}
                          placeholder="Tallinn, Estonia"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                        <Label htmlFor="passport-issuing-authority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Issuing Authority
                        </Label>
                        <Input
                          id="passport-issuing-authority"
                          value={foreignForm.passportIssuingAuthority}
                          onChange={(e) => setForeignForm({ ...foreignForm, passportIssuingAuthority: e.target.value })}
                          placeholder="Police and Border Guard Board, Tallinn, Estonia"
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Visa Details Section */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                      Visa Details (FRRO C-Form Ready)
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="visa-type" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Visa Type
                        </Label>
                        <Input
                          id="visa-type"
                          value={foreignForm.visaType}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaType: e.target.value })}
                          placeholder="Tourist"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-category" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Visa Category
                        </Label>
                        <Input
                          id="visa-category"
                          value={foreignForm.visaCategory}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaCategory: e.target.value })}
                          placeholder="e-Visa"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-number" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Visa Number
                        </Label>
                        <Input
                          id="visa-number"
                          value={foreignForm.visaNumber}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaNumber: e.target.value })}
                          placeholder="900F3927P"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-country" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Visa Country
                        </Label>
                        <Input
                          id="visa-country"
                          value={foreignForm.visaCountry}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaCountry: e.target.value })}
                          placeholder="India"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-issue-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Issue Date
                        </Label>
                        <Input
                          id="visa-issue-date"
                          type="date"
                          value={foreignForm.visaIssueDate}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaIssueDate: e.target.value })}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-expiry-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Expiry Date
                        </Label>
                        <Input
                          id="visa-expiry-date"
                          type="date"
                          value={foreignForm.visaExpiryDate}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaExpiryDate: e.target.value })}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-place-of-issue" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Place of Issue
                        </Label>
                        <Input
                          id="visa-place-of-issue"
                          value={foreignForm.visaPlaceOfIssue}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaPlaceOfIssue: e.target.value })}
                          placeholder="New Delhi"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-purpose" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Purpose of Visit
                        </Label>
                        <Input
                          id="visa-purpose"
                          value={foreignForm.visaPurposeOfVisit}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaPurposeOfVisit: e.target.value })}
                          placeholder="Tourism"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-duration" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Duration of Stay
                        </Label>
                        <Input
                          id="visa-duration"
                          value={foreignForm.visaDurationOfStay}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaDurationOfStay: e.target.value })}
                          placeholder="90 days"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-entries" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Number of Entries
                        </Label>
                        <Input
                          id="visa-entries"
                          value={foreignForm.visaNumberOfEntries}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaNumberOfEntries: e.target.value })}
                          placeholder="Multiple"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-port-of-entry" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Port of Entry
                        </Label>
                        <Input
                          id="visa-port-of-entry"
                          value={foreignForm.visaPortOfEntry}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaPortOfEntry: e.target.value })}
                          placeholder="IGI AIRPORT, NEW DELHI"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="visa-status" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Visa Status
                        </Label>
                        <Input
                          id="visa-status"
                          value={foreignForm.visaStatus}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaStatus: e.target.value })}
                          placeholder="Active"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                        <Label htmlFor="visa-issuing-authority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Issuing Authority
                        </Label>
                        <Input
                          id="visa-issuing-authority"
                          value={foreignForm.visaIssuingAuthority}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaIssuingAuthority: e.target.value })}
                          placeholder="BUREAU OF IMMIGRATION INDIA"
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                        <Label htmlFor="visa-remarks" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Remarks/Conditions
                        </Label>
                        <Input
                          id="visa-remarks"
                          value={foreignForm.visaRemarks}
                          onChange={(e) => setForeignForm({ ...foreignForm, visaRemarks: e.target.value })}
                          placeholder="Each stay not to exceed 90 days"
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Booking Details</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="foreign-property" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Property *
                      </Label>
                      <Select value={foreignForm.propertyId} onValueChange={(value) => setForeignForm({ ...foreignForm, propertyId: value })}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="foreign-room" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Room Number (Optional)
                      </Label>
                      <Input
                        id="foreign-room"
                        value={foreignForm.roomNumber}
                        onChange={(e) => setForeignForm({ ...foreignForm, roomNumber: e.target.value })}
                        placeholder="101"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="foreign-guests" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Number of Guests
                      </Label>
                      <Input
                        id="foreign-guests"
                        type="number"
                        min="1"
                        value={foreignForm.numberOfGuests}
                        onChange={(e) => setForeignForm({ ...foreignForm, numberOfGuests: parseInt(e.target.value) || 1 })}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="foreign-checkout" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Expected Checkout Date
                      </Label>
                      <Input
                        id="foreign-checkout"
                        type="date"
                        value={foreignForm.expectedCheckoutDate}
                        onChange={(e) => setForeignForm({ ...foreignForm, expectedCheckoutDate: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Complete Check-in
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render admin dashboard
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="h-full p-8 overflow-y-auto">


        {/* Add Guest Modal */}
        <div className={`fixed inset-0 bg-black bg-opacity-50 ${viewMode === 'add-guest' ? 'flex' : 'hidden'} items-center justify-center z-50`}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add New Guest</h2>
              <button 
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                onClick={() => setViewMode('admin-dashboard')}
              >
                <AlertCircle className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="guest-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</Label>
                <Input 
                  id="guest-name" 
                  type="text" 
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="dob" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Date of Birth</Label>
                <Input 
                  id="dob" 
                  type="date" 
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="nationality" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Nationality</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indian">Indian</SelectItem>
                    <SelectItem value="foreign">Foreign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="id-proof" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">ID Proof</Label>
                <Input 
                  id="id-proof" 
                  type="file" 
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="payment-proof" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Proof</Label>
                <Input 
                  id="payment-proof" 
                  type="file" 
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="days-stay" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">No. of Days</Label>
                <Input 
                  id="days-stay" 
                  type="number" 
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="property" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Property</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="room-type" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Room Type</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Room</SelectItem>
                    <SelectItem value="double">Double Room</SelectItem>
                    <SelectItem value="dorm-4">Dormitory (4 beds)</SelectItem>
                    <SelectItem value="dorm-8">Dormitory (8 beds)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setViewMode('admin-dashboard')}
                  type="button"
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  type="button"
                  onClick={() => setViewMode('admin-dashboard')}
                >
                  Add Guest
                </Button>
              </div>
            </form>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold">Guest List</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">View and manage all checked-in guests.</p>
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                <Button 
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => setViewMode('add-guest')}
                >
                  <User className="h-4 w-4" />
                  Add Guest
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <Label htmlFor="filter-guest-name" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Guest Name</Label>
                <Input 
                  id="filter-guest-name" 
                  placeholder="Search by name" 
                  type="text" 
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="filter-checkin-date" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Check-in Date</Label>
                <Input 
                  id="filter-checkin-date" 
                  type="date" 
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="filter-property" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Property</Label>
                <Select>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id.toString()}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Nationality</Label>
                <div className="flex items-center w-full">
                  <Button 
                    variant={filterGuestType === 'all' ? 'default' : 'outline'}
                    className="flex-1 rounded-r-none border-r-0 text-xs px-2 py-2"
                    onClick={() => setFilterGuestType('all')}
                  >
                    All
                  </Button>
                  <Button 
                    variant={filterGuestType === 'indian' ? 'default' : 'outline'}
                    className="flex-1 rounded-none border-r-0 text-xs px-2 py-2"
                    onClick={() => setFilterGuestType('indian')}
                  >
                    Indian
                  </Button>
                  <Button 
                    variant={filterGuestType === 'foreign' ? 'default' : 'outline'}
                    className="flex-1 rounded-l-none text-xs px-2 py-2"
                    onClick={() => setFilterGuestType('foreign')}
                  >
                    Foreign
                  </Button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Loading guests...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-red-900 dark:text-red-100">{error}</p>
                  <Button onClick={fetchCheckIns} variant="outline" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Guest Name</th>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Property</th>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Nationality</th>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Room Type</th>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Check-in Date</th>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Days</th>
                      <th className="p-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.map((checkIn) => (
                      <tr key={checkIn.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-3 font-medium">{checkIn.fullName}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">{checkIn.propertyName}</td>
                        <td className="p-3">
                          <Badge 
                            variant={checkIn.guestType === 'indian' ? 'default' : 'secondary'}
                            className={checkIn.guestType === 'indian' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'}
                          >
                            {checkIn.guestType === 'indian' ? 'Indian' : 'Foreign'}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">{checkIn.roomNumber || 'Not assigned'}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">{new Date(checkIn.checkInDate).toLocaleDateString()}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">
                          {checkIn.expectedCheckoutDate ? 
                            Math.ceil((new Date(checkIn.expectedCheckoutDate).getTime() - new Date(checkIn.checkInDate).getTime()) / (1000 * 60 * 60 * 24)) : 
                            'N/A'
                          }
                        </td>
                        <td className="p-3 flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="p-1.5"
                            onClick={() => handleViewDocuments(checkIn)}
                            title="View Documents"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="p-1.5" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                            onClick={() => handleCheckOut(checkIn.id)}
                            title="Check Out"
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
