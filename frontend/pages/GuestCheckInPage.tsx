import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MoreVertical,
  HelpCircle,
  FileText,
  Shield,
  ArrowLeft,
  Camera,
  Check,
  Sparkles,
  Gavel,
  LogIn,
  Trash2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { API_CONFIG } from '../src/config/api';
import { DocumentUploadZone, type DocumentUploadResult } from '../components/guest-checkin/DocumentUploadZone';
import { DocumentViewer } from '../components/guest-checkin/DocumentViewer';
import { AuditLogTable } from '../components/guest-checkin/AuditLogTable';
import { AuditLogFilters } from '../components/guest-checkin/AuditLogFilters';
import { AuditLogDetailModal } from '../components/guest-checkin/AuditLogDetailModal';
import { useAuditLogs } from '../hooks/useAuditLogs';
// import { useGuestCheckinRealtimeV2 } from '../hooks/useGuestCheckinRealtime-v2';
import { getFlagBool } from '../lib/feature-flags';
import { useRealtimeService } from '../hooks/useRealtimeService';
import { setRealtimePropertyFilter } from '../lib/realtime-helpers';
// import { useAuditLogsRealtimeV2 } from '../hooks/useAuditLogsRealtime-v2';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useGuestCheckInRealtimeIntegration } from '../hooks/useGuestCheckInRealtimeIntegration';

interface Property {
  id: number;
  name: string;
  mobileNumber?: string;
  addressJson?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
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
  drivingLicenseNumber?: string;
  electionCardNumber?: string;
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

type ViewMode = 'landing' | 'admin-dashboard' | 'add-guest';
type DesktopTab = 'indian-guest' | 'foreign-guest' | 'guest-details' | 'audit-logs';

export default function GuestCheckInPage() {
  const { theme } = useTheme();
  const { setPageTitle } = usePageTitle();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [properties, setProperties] = useState<Property[]>([]);
  const [allCheckIns, setAllCheckIns] = useState<GuestCheckIn[]>([]);
  const [checkIns, setCheckIns] = useState<GuestCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterGuestType, setFilterGuestType] = useState<string>('all');
  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [filterGuestName, setFilterGuestName] = useState<string>('');
  const [filterCheckInDate, setFilterCheckInDate] = useState<string>('');
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);

  // Unified popup for validation errors
  const showValidationToast = useCallback((message: string) => {
    toast({
      title: 'Validation error',
      description: message,
      variant: 'destructive',
      duration: 4000,
    });
  }, [toast]);

  // Additional state for Indian form (moved to top level)
  const [activeTab, setActiveTab] = useState<'personal' | 'id_details' | 'address'>('personal');
  const [aadharScanned, setAadharScanned] = useState(false);
  const [anyIdScanned, setAnyIdScanned] = useState(false); // Track if any ID was scanned

  // Tab state for form navigation
  const [indianActiveTab, setIndianActiveTab] = useState<'personal' | 'id-documents' | 'booking'>('personal');
  const [foreignActiveTab, setForeignActiveTab] = useState<'personal' | 'travel-documents' | 'form-c' | 'booking'>('personal');
  const [desktopTab, setDesktopTab] = useState<DesktopTab>('indian-guest');
  // Mobile UI states
  const [topTabsOpen, setTopTabsOpen] = useState(false);
  const [indMenuOpen, setIndMenuOpen] = useState(false);

  // Safely parse JSON responses, tolerating 204/empty bodies
  const parseJsonSafe = async <T = any>(response: Response): Promise<T> => {
    const text = await response.text();
    console.log('parseJsonSafe - Response text length:', text?.length || 0);
    console.log('parseJsonSafe - Response text preview:', text?.substring(0, 200));
    if (!text) {
      console.warn('parseJsonSafe - Empty response body, returning empty object');
      return {} as T;
    }
    try {
      const parsed = JSON.parse(text) as T;
      console.log('parseJsonSafe - Parsed successfully:', parsed);
      return parsed;
    } catch (e) {
      console.error('parseJsonSafe - JSON parse error:', e);
      throw new Error('Invalid JSON response from server');
    }
  };
  const [foreignMenuOpen, setForeignMenuOpen] = useState(false);
  const indianFormRef = useRef<HTMLFormElement>(null);
  const foreignFormRef = useRef<HTMLFormElement>(null);

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

  // Track which specific upload slots have documents (MANDATORY enforcement)
  const [indianPrimaryDocUploaded, setIndianPrimaryDocUploaded] = useState(false);
  const [foreignPassportUploaded, setForeignPassportUploaded] = useState(false);
  const [foreignVisaUploaded, setForeignVisaUploaded] = useState(false);

  // Version counter to force remount of DocumentUploadZone components after check-in
  // Incrementing this resets all internal state (uploadedDoc, progress, errors, etc.)
  const [uploadZoneResetKey, setUploadZoneResetKey] = useState(0);

  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedGuestForDocs, setSelectedGuestForDocs] = useState<GuestCheckIn | null>(null);
  const [documentViewerDocs, setDocumentViewerDocs] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Guest Details Modal state
  const [showGuestDetailsModal, setShowGuestDetailsModal] = useState(false);
  const [selectedGuestForDetails, setSelectedGuestForDetails] = useState<GuestCheckIn | null>(null);

  // Helpers for Audit Log date normalization (IST, end-of-day inclusive)
  const normalizeUiDateToIso = useCallback((value?: string, endOfDay: boolean = false): string | undefined => {
    if (!value) return undefined;
    if (value.includes('T') && (value.includes('+') || value.endsWith('Z'))) {
      return value.includes('Z') ? value.replace('Z', '+05:30') : value;
    }
    const ddmmyyyy = value.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    let y = 0, m = 0, d = 0;
    if (ddmmyyyy) {
      d = parseInt(ddmmyyyy[1], 10);
      m = parseInt(ddmmyyyy[2], 10) - 1;
      y = parseInt(ddmmyyyy[3], 10);
    } else {
      const yyyymmdd = value.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})$/);
      if (yyyymmdd) {
        y = parseInt(yyyymmdd[1], 10);
        m = parseInt(yyyymmdd[2], 10) - 1;
        d = parseInt(yyyymmdd[3], 10);
      } else {
        return undefined;
      }
    }
    const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');
    const HH = endOfDay ? 23 : 0;
    const MM = endOfDay ? 59 : 0;
    const SS = endOfDay ? 59 : 0;
    const msec = endOfDay ? 999 : 0;
    return `${y}-${pad(m + 1)}-${pad(d)}T${pad(HH)}:${pad(MM)}:${pad(SS)}.${pad(msec, 3)}+05:30`;
  }, []);
  const normalizeAuditFiltersForApi = useCallback((filters: any) => {
    const normalized: any = { ...filters };
    if (filters?.startDate) {
      normalized.startDate = normalizeUiDateToIso(String(filters.startDate), false);
    }
    if (filters?.endDate) {
      normalized.endDate = normalizeUiDateToIso(String(filters.endDate), true);
    }
    return normalized;
  }, [normalizeUiDateToIso]);

  // Audit logs state
  const [auditFiltersUi, setAuditFiltersUi] = useState({});
  const auditFiltersApi = React.useMemo(() => normalizeAuditFiltersForApi(auditFiltersUi), [auditFiltersUi, normalizeAuditFiltersForApi]);
  const { logs: auditLogs, isLoading: auditLoading, error: auditError, pagination: auditPagination, fetchLogs, exportToCsv } = useAuditLogs(auditFiltersApi, false);

  // 🔥 DEBOUNCED filter changes (prevents API spam on typing)
  const debouncedFetchLogs = useDebouncedCallback((filters: any) => {
    console.log('📝 Applying debounced filters:', filters);
    fetchLogs(filters, { silent: true, replace: true });
  }, 500); // Wait 500ms after user stops typing

  // Audit Detail Modal state
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any>(null);

  // 🚀 OPTIMIZED: Event-driven audit log updates with ZERO wasteful polling!
  const isAuditTabActive = desktopTab === 'audit-logs';
  const hasInitialFetchedAuditRef = useRef(false);
  const shouldRefetchOnActivateRef = useRef(false);
  const auditFiltersRef = useRef(auditFiltersApi);
  const fetchLogsRef = useRef(fetchLogs);

  // Keep refs up to date
  useEffect(() => {
    auditFiltersRef.current = auditFiltersApi;
  }, [auditFiltersApi]);

  useEffect(() => {
    fetchLogsRef.current = fetchLogs;
  }, [fetchLogs]);

  // Fetch on tab activation + silent refresh when returning
  useEffect(() => {
    if (isAuditTabActive) {
      if (!hasInitialFetchedAuditRef.current) {
        console.log('📊 Audit logs tab opened for FIRST time, fetching initial data...');
        fetchLogsRef.current(auditFiltersRef.current, { replace: true });
        hasInitialFetchedAuditRef.current = true;
        shouldRefetchOnActivateRef.current = false;
      } else if (shouldRefetchOnActivateRef.current) {
        console.log('👀 Audit logs tab re-activated, performing silent refresh...');
        fetchLogsRef.current(auditFiltersRef.current, { silent: true, replace: true });
        shouldRefetchOnActivateRef.current = false;
      }
    } else if (hasInitialFetchedAuditRef.current) {
      shouldRefetchOnActivateRef.current = true;
    }
  }, [isAuditTabActive]);

  // 🔥 TRULY stable callback for real-time updates (ZERO dependencies!)
  const handleAuditUpdate = useCallback(() => {
    console.log('🔔 Real audit event received, refreshing with filters:', auditFiltersRef.current);
    fetchLogsRef.current(auditFiltersRef.current, { silent: true, replace: true });
  }, []); // NO dependencies = NEVER recreated!

  // Audit realtime handled by guest-stream-events via RealtimeProvider.
  // Legacy audit long-poll disabled to avoid extra network load.
  // useAuditLogsRealtimeV2(isAuditTabActive, handleAuditUpdate);

  // Document management helpers
  const addUploadedDocument = useCallback((doc: DocumentUploadResult) => {
    setUploadedDocuments(prev => {
      // Remove any existing document with same fileData to prevent duplicates
      const filtered = prev.filter(existing => existing.fileData !== doc.fileData);
      return [...filtered, doc];
    });
  }, []);

  const removeUploadedDocument = useCallback((doc?: DocumentUploadResult | null) => {
    if (!doc) return;
    setUploadedDocuments(prev => prev.filter(existing => existing.fileData !== doc.fileData));
  }, []);

  // Property-based autofill helper for Form C Indian address fields
  const autofillIndianAddressFromProperty = useCallback((propertyId: string) => {
    const selectedProperty = properties.find(p => p.id.toString() === propertyId);

    console.log('=== AUTOFILL INDIAN ADDRESS ===');
    console.log('Property ID:', propertyId);
    console.log('Selected property:', selectedProperty);

    if (selectedProperty) {
      // Extract address from addressJson
      const addressJson = (selectedProperty as any).addressJson || {};
      const fullAddress = [
        addressJson.street,
        addressJson.city,
        addressJson.state,
        addressJson.country,
        addressJson.zipCode
      ].filter(Boolean).join(', ');

      console.log('Address JSON:', addressJson);
      console.log('Full address:', fullAddress);

      setForeignForm(prev => ({
        ...prev,
        propertyId: propertyId,
        // Auto-fill Indian address fields from property
        indianAddress: fullAddress || addressJson.street || prev.indianAddress,
        indianCityDistrict: addressJson.city || prev.indianCityDistrict,
        indianState: addressJson.state || prev.indianState,
        indianPincode: addressJson.zipCode || prev.indianPincode,
        mobileNoIndia: (selectedProperty as any).mobileNumber || prev.mobileNoIndia,
      }));
    }
  }, [properties]);

  // Form validation functions
  const isIndianPersonalInfoValid = () => {
    return indianForm.fullName.trim() !== '' &&
      indianForm.email.trim() !== '' &&
      indianForm.phone.trim() !== '' &&
      indianForm.address.trim() !== '';
  };

  const isIndianIdDocumentsValid = () => {
    // MUST have uploaded at least one Indian ID document
    // AND have at least one ID number filled in form
    return indianPrimaryDocUploaded && (
      indianForm.aadharNumber.trim() !== '' ||
      indianForm.panNumber.trim() !== '' ||
      indianForm.drivingLicenseNumber.trim() !== '' ||
      indianForm.electionCardNumber.trim() !== ''
    );
  };

  const isIndianBookingValid = () => {
    const isValid = indianForm.propertyId !== '' &&
      indianForm.numberOfGuests > 0;
    console.log('Indian booking validation:', {
      propertyId: indianForm.propertyId,
      numberOfGuests: indianForm.numberOfGuests,
      indianPrimaryDocUploaded,
      isValid: isValid && indianPrimaryDocUploaded
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
    // Check passport number is filled
    const hasPassportNumber = foreignForm.passportNumber.trim() !== '';

    // Check if country is filled in any of the fields (passportCountry, country, or passportNationality as fallback)
    const hasCountry =
      (foreignForm.passportCountry?.trim() || '').length > 0 ||
      (foreignForm.country?.trim() || '').length > 0 ||
      (foreignForm.passportNationality?.trim() || '').length > 0;

    // MUST have uploaded BOTH passport AND visa documents
    return hasPassportNumber && hasCountry &&
      foreignPassportUploaded && foreignVisaUploaded;
  };

  const isForeignBookingValid = () => {
    const isValid = foreignForm.propertyId !== '' &&
      foreignForm.numberOfGuests > 0;
    console.log('Foreign booking validation:', {
      propertyId: foreignForm.propertyId,
      numberOfGuests: foreignForm.numberOfGuests,
      foreignPassportUploaded,
      foreignVisaUploaded,
      isValid: isValid && foreignPassportUploaded && foreignVisaUploaded
    });
    return isValid;
  };

  // Set page title based on view mode
  useEffect(() => {
    switch (viewMode) {
      case 'landing':
        setPageTitle('Guest Check-in', 'Welcome guests and manage check-ins');
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
    drivingLicenseNumber: '',
    electionCardNumber: '',
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
    // Form C Additional Fields
    surname: '',
    sex: 'Male' as 'Male' | 'Female' | 'Other',
    specialCategory: 'Others',
    permanentCity: '',
    indianAddress: '',
    indianCityDistrict: '',
    indianState: '',
    indianPincode: '',
    arrivedFrom: '',
    dateOfArrivalInIndia: '',
    dateOfArrivalAtAccommodation: '',
    timeOfArrival: '12:00',
    intendedDuration: 7,
    employedInIndia: 'N' as 'Y' | 'N',
    purposeOfVisit: 'Tourism',
    nextPlace: '',
    destinationCityDistrict: '',
    destinationState: '',
    mobileNoIndia: '',
    contactNoPermanent: '',
    mobileNoPermanent: '',
    remarks: '',
    // Legacy fields for backward compatibility
    country: '',
    roomNumber: '',
    numberOfGuests: 1,
    expectedCheckoutDate: '',
  });

  // Document upload handlers
  const handleIndianDocumentUpload = (result: DocumentUploadResult) => {
    addUploadedDocument(result);

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

        // Determine which ID number to use based on detected document type
        // Only fill the field that matches the detected document type to prevent cross-contamination
        const docType = (result.detectedDocumentType || result.documentType || '').toLowerCase();

        if (docType.includes('aadhaar') && extracted.aadharNumber?.value) {
          newForm.aadharNumber = extracted.aadharNumber.value.replace(/\s/g, '');
        } else if (docType.includes('pan') && extracted.panNumber?.value) {
          newForm.panNumber = extracted.panNumber.value;
        } else if (docType.includes('driving') && extracted.licenseNumber?.value) {
          newForm.drivingLicenseNumber = extracted.licenseNumber.value;
        } else if (docType.includes('election') && extracted.epicNumber?.value) {
          newForm.electionCardNumber = extracted.epicNumber.value;
        } else {
          // Fallback: Fill any available ID field if document type is uncertain
          if (extracted.aadharNumber?.value) {
            newForm.aadharNumber = extracted.aadharNumber.value.replace(/\s/g, '');
          }
          if (extracted.panNumber?.value) {
            newForm.panNumber = extracted.panNumber.value;
          }
          if (extracted.licenseNumber?.value) {
            newForm.drivingLicenseNumber = extracted.licenseNumber.value;
          }
          if (extracted.epicNumber?.value) {
            newForm.electionCardNumber = extracted.epicNumber.value;
          }
        }

        return newForm;
      });

      // Mark appropriate ID as scanned based on what was detected
      const detectedType = result.detectedDocumentType || result.documentType || 'unknown';
      if (detectedType.includes('aadhaar') || extracted.aadharNumber?.value) {
        setAadharScanned(true);
      }

      // Mark that any ID was scanned (for validation)
      setAnyIdScanned(true);

      // Show success message with detected document type
      const fieldCount = Object.keys(extracted).length;
      const typeConfidence = result.documentTypeConfidence || 100;

      let successMessage = `Document processed successfully! Detected: ${detectedType.replace(/_/g, ' ').toUpperCase()}. Extracted ${fieldCount} fields with ${result.overallConfidence}% confidence.`;

      // Add warning if detection confidence is low
      if (typeConfidence < 85) {
        successMessage += ` ⚠️ Document type detection confidence is ${typeConfidence}% - please verify the detected type is correct.`;
      }

      setSuccess(successMessage);
      setTimeout(() => setSuccess(''), 7000);
    }
  };

  const handleForeignDocumentUpload = (result: DocumentUploadResult) => {
    addUploadedDocument(result);

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

          // **NEW: Extract surname from fullName**
          // Passport format: "SURNAME, Given Names" or "Given Names SURNAME"
          const nameParts = extracted.fullName.value.split(',');
          if (nameParts.length > 1) {
            // Format: "SURNAME, Given Names"
            newForm.surname = nameParts[0].trim();
          } else {
            // Format: "Given Names SURNAME" - take last word
            const words = extracted.fullName.value.trim().split(/\s+/);
            if (words.length > 1) {
              newForm.surname = words[words.length - 1];
            }
          }
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

            // **NEW: Auto-fill permanentCity from placeOfBirth**
            // Extract city name (before comma if format is "City, Country")
            const cityMatch = extracted.placeOfBirth.value.split(',')[0].trim();
            if (cityMatch) {
              newForm.permanentCity = cityMatch;
            }
          }
          if (extracted.issuingAuthority?.value) {
            newForm.passportIssuingAuthority = extracted.issuingAuthority.value;
          }

          // **NEW: Auto-fill sex from passport**
          if (extracted.sex?.value) {
            const sexValue = extracted.sex.value.toUpperCase();
            if (sexValue === 'M' || sexValue.includes('MALE')) {
              newForm.sex = 'Male';
            } else if (sexValue === 'F' || sexValue.includes('FEMALE')) {
              newForm.sex = 'Female';
            }
          }

          // **NEW: Auto-fill arrivedFrom from passport nationality/country**
          if (extracted.nationality?.value || extracted.country?.value) {
            const countryName = extracted.nationality?.value || extracted.country?.value || '';
            newForm.arrivedFrom = countryName;
          }

          // **NEW: Auto-fill permanent contact numbers from phone**
          if (newForm.phone) {
            newForm.contactNoPermanent = newForm.phone;
            newForm.mobileNoPermanent = newForm.phone;
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
            const visaIssueDate = extracted.issueDate?.value || extracted.visaIssueDate?.value;
            newForm.visaIssueDate = visaIssueDate;

            // **NEW: Use visa issue date as smart default for dateOfArrivalInIndia**
            if (visaIssueDate) {
              newForm.dateOfArrivalInIndia = visaIssueDate;
            }
          }
          if (extracted.expiryDate?.value || extracted.visaExpiryDate?.value) {
            newForm.visaExpiryDate = extracted.expiryDate?.value || extracted.visaExpiryDate?.value;
          }
          if (extracted.placeOfIssue?.value || extracted.visaPlaceOfIssue?.value) {
            newForm.visaPlaceOfIssue = extracted.placeOfIssue?.value || extracted.visaPlaceOfIssue?.value;
          }
          if (extracted.purposeOfVisit?.value) {
            newForm.visaPurposeOfVisit = extracted.purposeOfVisit.value;

            // **NEW: Auto-fill Form C purposeOfVisit from visa**
            newForm.purposeOfVisit = extracted.purposeOfVisit.value;
          }
          if (extracted.durationOfStay?.value) {
            newForm.visaDurationOfStay = extracted.durationOfStay.value;

            // **NEW: Parse duration and auto-fill intendedDuration**
            // Parse "90 days" → 90, "3 months" → 90, etc.
            const durationStr = extracted.durationOfStay.value.toLowerCase();
            const daysMatch = durationStr.match(/(\d+)\s*days?/);
            const monthsMatch = durationStr.match(/(\d+)\s*months?/);

            if (daysMatch) {
              newForm.intendedDuration = parseInt(daysMatch[1]);
            } else if (monthsMatch) {
              newForm.intendedDuration = parseInt(monthsMatch[1]) * 30; // Approximate
            }
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

            // **NEW: Auto-fill Form C remarks from visa**
            newForm.remarks = extracted.remarks.value;
          }
        }

        // **NEW: Auto-set dateOfArrivalAtAccommodation to today**
        const today = new Date().toISOString().split('T')[0];
        newForm.dateOfArrivalAtAccommodation = today;

        // **NEW: Auto-set timeOfArrival to current time**
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        newForm.timeOfArrival = currentTime;

        return newForm;
      });

      // Show success message with document-specific details
      const detectedType = result.detectedDocumentType || documentType || 'Unknown';
      const fieldCount = Object.keys(extracted).length;
      const documentSpecificMessage = documentType === 'passport' || documentType.includes('passport')
        ? 'Passport fields auto-filled (including Form C details)'
        : documentType === 'visa_front' || documentType.includes('visa')
          ? 'Visa fields auto-filled (including Form C details)'
          : 'Document fields auto-filled';

      setSuccess(`Document processed successfully! Detected: ${detectedType}. Extracted ${fieldCount} fields with ${result.overallConfidence}% confidence. ${documentSpecificMessage}.`);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const handleViewDocuments = async (checkIn: GuestCheckIn) => {
    setOpenMenuId(null);
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

        // Log document view action in audit trail (fire-and-forget)
        fetch(`${API_CONFIG.BASE_URL}/guest-checkin/audit/view-documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            guestCheckInId: checkIn.id,
            documentCount: data.documents?.length || 0,
          }),
        })
          .catch(err => console.error('Failed to log audit:', err));
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

  // Auto-select first property for Foreign form if none selected AND trigger autofill
  useEffect(() => {
    if (properties.length > 0 && !foreignForm.propertyId) {
      const firstPropertyId = properties[0].id.toString();
      console.log('Auto-selecting first property on load:', firstPropertyId);
      autofillIndianAddressFromProperty(firstPropertyId);
    }
  }, [properties, foreignForm.propertyId, autofillIndianAddressFromProperty]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Fetch ALL check-ins (no server-side filtering)
  // Client-side filtering is done in the useEffect above
  const fetchCheckIns = useCallback(async () => {
    console.log('=== FETCH CHECK-INS DEBUG ===');
    setIsLoading(true);
    setError(null);
    try {
      // Fetch ALL check-ins - no filter params sent to server
      // Filtering is done client-side for instant results
      const url = `${API_CONFIG.BASE_URL}/guest-checkin/list`;

      const authToken = localStorage.getItem('accessToken');

      console.log('API Base URL:', API_CONFIG.BASE_URL);
      console.log('Full URL:', url);
      console.log('Auth Token:', authToken ? `${authToken.substring(0, 20)}...` : 'NO TOKEN');
      console.log('Fetching all guests (client-side filtering enabled)');

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

      const data = await parseJsonSafe<any>(response);
      console.log('Response Data:', data);
      console.log('Check-ins Count:', data.checkins ? data.checkins.length : 0);
      console.log('Total:', data.total);

      const fetchedCheckins = data.checkins || [];
      setAllCheckIns(fetchedCheckins);
      // Note: setCheckIns is handled by the client-side filtering useEffect
      console.log('Check-ins state updated:', fetchedCheckins.length);
    } catch (err: any) {
      console.log('Fetch Error:', err);
      setError(err.message || 'Failed to fetch check-ins');
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - always fetches all data

  const mapGuestApiToState = useCallback((guest: any): GuestCheckIn => ({
    id: guest.id,
    orgId: guest.orgId,
    propertyId: guest.propertyId,
    propertyName: guest.propertyName,
    guestType: guest.guestType,
    fullName: guest.fullName,
    email: guest.email,
    phone: guest.phone,
    address: guest.address,
    aadharNumber: guest.aadharNumber ?? '',
    panNumber: guest.panNumber ?? '',
    drivingLicenseNumber: guest.drivingLicenseNumber ?? '',
    electionCardNumber: guest.electionCardNumber ?? '',
    passportNumber: guest.passportNumber ?? '',
    country: guest.country ?? '',
    visaType: guest.visaType ?? '',
    visaExpiryDate: guest.visaExpiryDate ?? '',
    checkInDate: guest.checkInDate,
    expectedCheckoutDate: guest.expectedCheckoutDate ?? '',
    actualCheckoutDate: guest.actualCheckoutDate ?? '',
    roomNumber: guest.roomNumber ?? '',
    numberOfGuests: guest.numberOfGuests ?? 1,
    status: guest.status ?? 'checked_in',
    createdByUserId: guest.createdByUserId,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
  }), []);

  const fetchGuestDetailsById = useCallback(async (guestId: number): Promise<GuestCheckIn | null> => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/${guestId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
      });
      if (!response.ok) {
        console.error('Failed to fetch guest by id:', guestId, response.status);
        return null;
      }
      const data = await response.json();
      return mapGuestApiToState(data);
    } catch (error) {
      console.error('Failed to fetch guest by id:', guestId, error);
      return null;
    }
  }, [mapGuestApiToState]);

  const refreshSelectedGuestDocuments = useCallback(async (guestId: number) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/${guestId}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDocumentViewerDocs(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to refresh documents after event:', error);
    }
  }, []);

  const guestDetailsLoadedRef = useRef(false);
  const auditLogsLoadedRef = useRef(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [menuPlacement, setMenuPlacement] = useState<'top' | 'bottom'>('bottom');

  // Client-side filtering - NO API calls when switching filters!
  // This provides instant filtering without loading states
  useEffect(() => {
    let filtered = allCheckIns;

    // Filter by guest name (search)
    if (filterGuestName) {
      const searchLower = filterGuestName.toLowerCase();
      filtered = filtered.filter((checkIn) =>
        checkIn.fullName.toLowerCase().includes(searchLower)
      );
    }

    // Filter by check-in date
    if (filterCheckInDate) {
      filtered = filtered.filter((checkIn) => {
        const checkInDateStr = new Date(checkIn.checkInDate).toISOString().split('T')[0];
        return checkInDateStr === filterCheckInDate;
      });
    }

    // Filter by guest type (nationality)
    if (filterGuestType !== 'all') {
      filtered = filtered.filter((checkIn) => checkIn.guestType === filterGuestType);
    }

    // Filter by property
    if (filterPropertyId && filterPropertyId !== 'all') {
      filtered = filtered.filter((checkIn) =>
        checkIn.propertyId.toString() === filterPropertyId
      );
    }

    // Filter by status (if you add status filtering in the future)
    if (filterStatus !== 'all') {
      filtered = filtered.filter((checkIn) => checkIn.status === filterStatus);
    }

    setCheckIns(filtered);
  }, [allCheckIns, filterGuestName, filterCheckInDate, filterGuestType, filterPropertyId, filterStatus]);

  // Expose selected propertyId globally so the provider can filter server events
  React.useEffect(() => {
    try {
      (window as any).__guestSelectedPropertyId = filterPropertyId || 'all';
    } catch { }
  }, [filterPropertyId]);

  // Production-grade realtime integration (V3) - DISABLED for now (uses old V2)
  // const { isConnected: isRealtimeConnected } = useGuestCheckInRealtimeIntegration({
  //   propertyId: filterPropertyId && filterPropertyId !== 'all' ? parseInt(filterPropertyId) : undefined,
  //   enabled: viewMode === 'admin-dashboard' || desktopTab === 'guest-details',
  //   onAnyChange: fetchCheckIns,  // Simplified: refresh on any guest event
  // });

  // Multi-service provider integration: listen to guest-stream-events
  // Realtime: Guest events via shared hook
  useRealtimeService('guest', async (events: any[]) => {
    const effectiveDesktopTab = (typeof window !== 'undefined' ? (window as any).__guestDesktopTab : null) || desktopTab;
    if (!events?.length) {
      return;
    }
    // Handle document events
    const docEvents = events.filter((event: any) => event.entityType === 'guest_document');
    if (docEvents.length && selectedGuestForDocs?.id) {
      const hasDocEventForOpenGuest = docEvents.some(
        (event: any) => event.entityId === selectedGuestForDocs.id
      );
      if (hasDocEventForOpenGuest) {
        await refreshSelectedGuestDocuments(selectedGuestForDocs.id);
      }
    }
    // Handle guest check-in events
    const guestEvents = events.filter((event: any) => event.entityType === 'guest_checkin');
    if (!guestEvents.length) {
      return;
    }
    const deleteIds = guestEvents
      .filter((event: any) => event.eventType === 'guest_deleted')
      .map((event: any) => event.entityId);
    if (deleteIds.length) {
      setAllCheckIns((prev) => prev.filter((guest) => !deleteIds.includes(guest.id)));
    }
    const fetchIds = Array.from(
      new Set(
        guestEvents
          .filter((event: any) => event.eventType !== 'guest_deleted')
          .map((event: any) => event.entityId)
      )
    );
    if (fetchIds.length) {
      const updatedGuests = (
        await Promise.all(fetchIds.map((guestId) => fetchGuestDetailsById(Number(guestId))))
      ).filter((guest): guest is GuestCheckIn => Boolean(guest));
      if (!updatedGuests.length) {
        fetchCheckIns();
      } else {
        setAllCheckIns((prev) => {
          let next = [...prev];
          updatedGuests.forEach((guest) => {
            const existingIndex = next.findIndex((item) => item.id === guest.id);
            if (existingIndex >= 0) {
              next[existingIndex] = guest;
            } else {
              next = [guest, ...next];
            }
          });
          return next;
        });
      }
    }
    // Debounced audit log refresh when audit tab is visible
    if (effectiveDesktopTab === 'audit-logs') {
      const w: any = window as any;
      clearTimeout(w.__guestAuditDebounce);
      w.__guestAuditDebounce = setTimeout(() => {
        fetchLogsRef.current(auditFiltersApi, { replace: true });
      }, 1000);
    }
  }, getFlagBool('GUEST_REALTIME_V1', true));

  // Standardize property filter (no explicit property scoping here → null)
  useEffect(() => { try { setRealtimePropertyFilter(null); } catch { } }, []);

  useEffect(() => {
    if (viewMode === 'admin-dashboard' && !guestDetailsLoadedRef.current) {
      guestDetailsLoadedRef.current = true;
      fetchCheckIns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]); // Only depend on viewMode, fetchCheckIns is stable

  useEffect(() => {
    if (desktopTab === 'guest-details' && !guestDetailsLoadedRef.current) {
      guestDetailsLoadedRef.current = true;
      fetchCheckIns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktopTab]); // Only depend on desktopTab, fetchCheckIns is stable

  useEffect(() => {
    if (desktopTab === 'audit-logs' && !auditLogsLoadedRef.current) {
      auditLogsLoadedRef.current = true;
      fetchLogsRef.current(auditFiltersApi, { replace: true });
    }
  }, [desktopTab, auditFiltersApi]);

  useEffect(() => {
    const handleCloseOnScroll = () => setOpenMenuId(null);
    window.addEventListener('scroll', handleCloseOnScroll, true);
    window.addEventListener('resize', handleCloseOnScroll);
    return () => {
      window.removeEventListener('scroll', handleCloseOnScroll, true);
      window.removeEventListener('resize', handleCloseOnScroll);
    };
  }, []);

  // Handle Indian guest check-in
  const handleIndianCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // ENFORCE DOCUMENT UPLOAD REQUIREMENT
    if (!indianPrimaryDocUploaded) {
      setError('⚠️ Please upload at least one Indian ID document (Aadhaar/PAN/DL/Election Card) before completing check-in.');
      setIsLoading(false);
      toast({
        title: "Document Required",
        description: "Please upload your Indian ID document to continue.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

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
    if (indianForm.drivingLicenseNumber && indianForm.drivingLicenseNumber.trim()) {
      requestData.drivingLicenseNumber = indianForm.drivingLicenseNumber.trim();
    }
    if (indianForm.electionCardNumber && indianForm.electionCardNumber.trim()) {
      requestData.electionCardNumber = indianForm.electionCardNumber.trim();
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
      showValidationToast('Please fill in all required fields (Name, Email, Phone, Address)');
      return;
    }

    // Validate that at least ONE Indian ID is provided
    const hasAnyId = requestData.aadharNumber ||
      requestData.panNumber ||
      requestData.drivingLicenseNumber ||
      requestData.electionCardNumber;

    if (!hasAnyId) {
      setError('Please provide at least one Indian ID (Aadhaar, PAN, Driving License, or Election Card)');
      setIsLoading(false);
      showValidationToast('Please provide at least one Indian ID (Aadhaar, PAN, Driving License, or Election Card)');
      return;
    }

    // Validate Aadhaar format ONLY if provided
    if (requestData.aadharNumber && !/^\d{12}$/.test(requestData.aadharNumber)) {
      setError('Aadhaar number must be exactly 12 digits');
      setIsLoading(false);
      showValidationToast('Aadhaar number must be exactly 12 digits');
      return;
    }

    if (requestData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(requestData.panNumber.toUpperCase())) {
      setError('PAN number must be in format: ABCDE1234F');
      setIsLoading(false);
      showValidationToast('PAN number must be in format: ABCDE1234F');
      return;
    }

    if (isNaN(requestData.propertyId)) {
      setError('Please select a valid property');
      setIsLoading(false);
      showValidationToast('Please select a valid property');
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
      const checkInId = data.id;

      // Upload documents NOW with checkInId (client-side storage approach)
      if (uploadedDocuments.length > 0 && checkInId) {
        try {
          console.log('Uploading documents to cloud with checkInId:', { checkInId, documentCount: uploadedDocuments.length });

          for (const doc of uploadedDocuments) {
            try {
              const uploadResponse = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/documents/upload`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  documentType: doc.documentType,
                  fileData: doc.fileData, // Base64 from client-side storage
                  filename: doc.filename,
                  mimeType: doc.mimeType,
                  guestCheckInId: checkInId, // Already has check-in ID!
                  performExtraction: false, // Already extracted
                }),
              });

              if (uploadResponse.ok) {
                console.log('Document uploaded successfully:', { documentType: doc.documentType });
              } else {
                console.error('Failed to upload document:', await uploadResponse.text());
              }
            } catch (docError) {
              console.error('Error uploading document:', docError);
              // Continue with other documents
            }
          }

          console.log('All documents uploaded successfully');
        } catch (uploadError) {
          console.error('Error uploading documents:', uploadError);
          // Don't fail the check-in if document upload fails
        }
      }

      const successMessage = data.message || 'Check-in successful! Welcome to our property.';
      setSuccess(successMessage);

      // Show toast notification
      toast({
        title: "Check-in Successful! 🎉",
        description: successMessage,
        variant: 'success' as any,
        duration: 5000,
      });

      // Refresh guest list if in admin dashboard view
      console.log('=== CHECK-IN SUCCESS DEBUG ===');
      console.log('Current viewMode:', viewMode);
      console.log('Should refresh guest list:', viewMode === 'admin-dashboard');

      // Always refresh guest list after successful check-in
      console.log('Calling fetchCheckIns after successful check-in...');
      fetchCheckIns();

      // Reset form and uploaded documents
      setIndianForm({
        propertyId: '',
        fullName: '',
        email: '',
        phone: '',
        address: '',
        aadharNumber: '',
        panNumber: '',
        drivingLicenseNumber: '',
        electionCardNumber: '',
        roomNumber: '',
        numberOfGuests: 1,
        expectedCheckoutDate: '',
      });
      setUploadedDocuments([]); // Clear uploaded documents
      setIndianPrimaryDocUploaded(false); // Reset document upload flag
      setUploadZoneResetKey(prev => prev + 1); // Force remount of upload zones to reset UI

      // Show success message for 5 seconds, then clear it
      setTimeout(() => {
        setSuccess(null);
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

    // ENFORCE DOCUMENT UPLOAD REQUIREMENTS
    if (!foreignPassportUploaded || !foreignVisaUploaded) {
      const missingDocs = [];
      if (!foreignPassportUploaded) missingDocs.push('Passport');
      if (!foreignVisaUploaded) missingDocs.push('Visa');

      setError(`⚠️ Please upload ${missingDocs.join(' and ')} document(s) before completing check-in.`);
      setIsLoading(false);
      toast({
        title: "Documents Required",
        description: `Please upload your ${missingDocs.join(' and ')} to continue.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

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

          // Passport details
          if (foreignForm.passportCountry) requestData.passportCountry = foreignForm.passportCountry;
          if (foreignForm.passportNationality) requestData.passportNationality = foreignForm.passportNationality;
          if (foreignForm.passportDateOfBirth) requestData.passportDateOfBirth = foreignForm.passportDateOfBirth;
          if (foreignForm.passportIssueDate) requestData.passportIssueDate = foreignForm.passportIssueDate;
          if (foreignForm.passportExpiryDate) requestData.passportExpiryDate = foreignForm.passportExpiryDate;
          if (foreignForm.passportPlaceOfBirth) requestData.passportPlaceOfBirth = foreignForm.passportPlaceOfBirth;
          if (foreignForm.passportIssuingAuthority) requestData.passportIssuingAuthority = foreignForm.passportIssuingAuthority;

          // Visa details
          if (foreignForm.visaType) requestData.visaType = foreignForm.visaType;
          if (foreignForm.visaCategory) requestData.visaCategory = foreignForm.visaCategory;
          if (foreignForm.visaNumber) requestData.visaNumber = foreignForm.visaNumber;
          if (foreignForm.visaCountry) requestData.visaCountry = foreignForm.visaCountry;
          if (foreignForm.visaIssueDate) requestData.visaIssueDate = foreignForm.visaIssueDate;
          if (foreignForm.visaExpiryDate) requestData.visaExpiryDate = foreignForm.visaExpiryDate;
          if (foreignForm.visaPlaceOfIssue) requestData.visaPlaceOfIssue = foreignForm.visaPlaceOfIssue;
          if (foreignForm.visaPurposeOfVisit) requestData.visaPurposeOfVisit = foreignForm.visaPurposeOfVisit;
          if (foreignForm.visaDurationOfStay) requestData.visaDurationOfStay = foreignForm.visaDurationOfStay;
          if (foreignForm.visaNumberOfEntries) requestData.visaNumberOfEntries = foreignForm.visaNumberOfEntries;
          if (foreignForm.visaPortOfEntry) requestData.visaPortOfEntry = foreignForm.visaPortOfEntry;
          if (foreignForm.visaIssuingAuthority) requestData.visaIssuingAuthority = foreignForm.visaIssuingAuthority;
          if (foreignForm.visaStatus) requestData.visaStatus = foreignForm.visaStatus;
          if (foreignForm.visaRemarks) requestData.visaRemarks = foreignForm.visaRemarks;

          // Form C specific fields
          if (foreignForm.surname) requestData.surname = foreignForm.surname;
          if (foreignForm.sex) requestData.sex = foreignForm.sex;
          if (foreignForm.specialCategory) requestData.specialCategory = foreignForm.specialCategory;
          if (foreignForm.permanentCity) requestData.permanentCity = foreignForm.permanentCity;
          if (foreignForm.indianAddress) requestData.indianAddress = foreignForm.indianAddress;
          if (foreignForm.indianCityDistrict) requestData.indianCityDistrict = foreignForm.indianCityDistrict;
          if (foreignForm.indianState) requestData.indianState = foreignForm.indianState;
          if (foreignForm.indianPincode) requestData.indianPincode = foreignForm.indianPincode;
          if (foreignForm.arrivedFrom) requestData.arrivedFrom = foreignForm.arrivedFrom;
          if (foreignForm.dateOfArrivalInIndia) requestData.dateOfArrivalInIndia = foreignForm.dateOfArrivalInIndia;
          if (foreignForm.dateOfArrivalAtAccommodation) requestData.dateOfArrivalAtAccommodation = foreignForm.dateOfArrivalAtAccommodation;
          if (foreignForm.timeOfArrival) requestData.timeOfArrival = foreignForm.timeOfArrival;
          if (foreignForm.intendedDuration) requestData.intendedDuration = foreignForm.intendedDuration;
          if (foreignForm.employedInIndia) requestData.employedInIndia = foreignForm.employedInIndia;
          if (foreignForm.purposeOfVisit) requestData.purposeOfVisit = foreignForm.purposeOfVisit;
          if (foreignForm.nextPlace) requestData.nextPlace = foreignForm.nextPlace;
          if (foreignForm.destinationCityDistrict) requestData.destinationCityDistrict = foreignForm.destinationCityDistrict;
          if (foreignForm.destinationState) requestData.destinationState = foreignForm.destinationState;
          if (foreignForm.mobileNoIndia) requestData.mobileNoIndia = foreignForm.mobileNoIndia;
          if (foreignForm.contactNoPermanent) requestData.contactNoPermanent = foreignForm.contactNoPermanent;
          if (foreignForm.mobileNoPermanent) requestData.mobileNoPermanent = foreignForm.mobileNoPermanent;
          if (foreignForm.remarks) requestData.remarks = foreignForm.remarks;

          // Booking details
          if (foreignForm.expectedCheckoutDate) requestData.expectedCheckoutDate = foreignForm.expectedCheckoutDate;
          if (foreignForm.roomNumber) requestData.roomNumber = foreignForm.roomNumber;

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
      const checkInId = data.id;

      // Upload documents NOW with checkInId (client-side storage approach)
      if (uploadedDocuments.length > 0 && checkInId) {
        try {
          console.log('Uploading documents to cloud with checkInId:', { checkInId, documentCount: uploadedDocuments.length });

          for (const doc of uploadedDocuments) {
            try {
              const uploadResponse = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/documents/upload`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  documentType: doc.documentType,
                  fileData: doc.fileData, // Base64 from client-side storage
                  filename: doc.filename,
                  mimeType: doc.mimeType,
                  guestCheckInId: checkInId, // Already has check-in ID!
                  performExtraction: false, // Already extracted
                }),
              });

              if (uploadResponse.ok) {
                console.log('Document uploaded successfully:', { documentType: doc.documentType });
              } else {
                console.error('Failed to upload document:', await uploadResponse.text());
              }
            } catch (docError) {
              console.error('Error uploading document:', docError);
              // Continue with other documents
            }
          }

          console.log('All documents uploaded successfully');
        } catch (uploadError) {
          console.error('Error uploading documents:', uploadError);
          // Don't fail the check-in if document upload fails
        }
      }

      const successMessage = data.message || 'Check-in successful! Welcome to our property.';
      setSuccess(successMessage);

      // Show toast notification
      toast({
        title: "Check-in Successful! 🎉",
        description: successMessage,
        variant: 'success' as any,
        duration: 5000,
      });

      // Always refresh guest list after successful check-in
      console.log('Calling fetchCheckIns after successful foreign check-in...');
      fetchCheckIns();

      // Reset form and uploaded documents
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
        // Form C Additional Fields
        surname: '',
        sex: 'Male',
        specialCategory: 'Others',
        permanentCity: '',
        indianAddress: '',
        indianCityDistrict: '',
        indianState: '',
        indianPincode: '',
        arrivedFrom: '',
        dateOfArrivalInIndia: '',
        dateOfArrivalAtAccommodation: '',
        timeOfArrival: '12:00',
        intendedDuration: 7,
        employedInIndia: 'N',
        purposeOfVisit: 'Tourism',
        nextPlace: '',
        destinationCityDistrict: '',
        destinationState: '',
        mobileNoIndia: '',
        contactNoPermanent: '',
        mobileNoPermanent: '',
        remarks: '',
        // Legacy fields for backward compatibility
        country: '',
        roomNumber: '',
        numberOfGuests: 1,
        expectedCheckoutDate: '',
      });
      setUploadedDocuments([]); // Clear uploaded documents
      setForeignPassportUploaded(false); // Reset document upload flags
      setForeignVisaUploaded(false);
      setUploadZoneResetKey(prev => prev + 1); // Force remount of upload zones to reset UI

      // Show success message for 5 seconds, then clear it
      setTimeout(() => {
        setSuccess(null);
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

  // Handle delete guest
  const handleDelete = async (checkInId: number, guestName: string) => {
    setOpenMenuId(null);

    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `⚠️ Delete Guest Entry?\n\nAre you sure you want to delete the check-in entry for "${guestName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/${checkInId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete guest entry');
      }

      // Show success toast
      toast({
        title: "Guest Deleted Successfully! 🗑️",
        description: `The check-in entry for ${guestName} has been deleted.`,
        duration: 4000,
      });

      setSuccess('Guest entry deleted successfully');

      // Refresh the guest list
      fetchCheckIns();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete guest entry';
      setError(errorMessage);

      // Show error toast
      toast({
        title: "Delete Failed ❌",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewGuestDetails = async (checkIn: GuestCheckIn) => {
    setOpenMenuId(null);
    setSelectedGuestForDetails(checkIn);
    setShowGuestDetailsModal(true);

    // Log guest details view action in audit trail (fire-and-forget)
    fetch(`${API_CONFIG.BASE_URL}/guest-checkin/audit/view-guest-details`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guestCheckInId: checkIn.id,
      }),
    })
      .catch(err => console.error('Failed to log audit:', err));
  };

  // Copy to clipboard helper function
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard.`,
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleCFormReady = async (checkIn: GuestCheckIn) => {
    setOpenMenuId(null);

    try {
      // Show loading toast
      toast({
        title: "Generating C-Form",
        description: "Please wait while we generate the Form C PDF...",
        duration: 3000,
      });

      // Call API to generate C-Form PDF
      const response = await fetch(`${API_CONFIG.BASE_URL}/guest-checkin/${checkIn.id}/generate-c-form`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate C-Form' }));
        throw new Error(errorData.error || 'Failed to generate C-Form');
      }

      // Get JSON response with base64 PDF data
      const data = await response.json();

      // Convert base64 to blob
      const binaryString = window.atob(data.pdfData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });

      // Use filename from API response
      const filename = data.filename || `Form_C_${checkIn.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success toast
      toast({
        title: "C-Form Downloaded! 📄",
        description: `Form C has been generated and downloaded for ${checkIn.fullName}.`,
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Error generating C-Form:', error);
      toast({
        title: "Failed to Generate C-Form ❌",
        description: error.message || 'An error occurred while generating the C-Form',
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  // Smart menu positioning handler
  const handleMenuOpen = (checkInId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 224; // w-56
    const margin = 8; // spacing from trigger

    // Horizontal position (right-align to the trigger, clamp to viewport)
    let left = rect.right - menuWidth; // align right edges
    left = Math.min(left, viewportWidth - menuWidth - margin);
    left = Math.max(margin, left);

    // Decide open direction by available space
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      setMenuCoords({ top: rect.top - margin, left });
      setMenuPlacement('top');
    } else {
      setMenuCoords({ top: rect.bottom + margin, left });
      setMenuPlacement('bottom');
    }

    setOpenMenuId(prev => prev === checkInId ? null : checkInId);
  };

  // Render landing page - Mobile UI
  if (viewMode === 'landing') {
    return (
      <div className="min-h-[100vh] md:min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col pt-safe">
        {/* Unified UI - Reports page style with tabs */}
        <div className="w-full min-h-[100vh] md:min-h-screen bg-gray-50">
          <div className="px-3 xs:px-4 sm:px-6 pt-3 sm:pt-6 pb-20 sm:pb-8 lg:bg-[#F5F7FA]">
            <Tabs value={desktopTab} onValueChange={(v) => setDesktopTab(v as DesktopTab)}>
              {/* Sticky header with mobile dropdown + desktop tabs */}
              <div className="sticky top-20 z-30 bg-white lg:bg-[#F5F7FA] dark:bg-gray-800 -mx-3 xs:-mx-4 sm:-mx-6 px-3 xs:px-4 sm:px-6 py-2 border-b border-gray-200 dark:border-gray-700">
                {/* Mobile header */}
                <div className="flex items-center justify-between sm:hidden">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium truncate">
                      {(() => {
                        const pid = desktopTab === 'foreign-guest' ? foreignForm.propertyId : indianForm.propertyId;
                        const p = properties.find(p => p.id.toString() === String(pid));
                        return p ? p.name : 'Property';
                      })()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTopTabsOpen(v => !v)}
                    className="flex items-center gap-2 px-3 h-10 rounded-md bg-gray-100 dark:bg-gray-700 text-sm"
                    aria-expanded={topTabsOpen}
                  >
                    <span className="truncate">
                      {desktopTab === 'indian-guest' ? 'Indian Guest Check-in' : null}
                      {desktopTab === 'foreign-guest' ? 'Foreign Guest Check-in' : null}
                      {desktopTab === 'guest-details' ? 'Guest Details' : null}
                      {desktopTab === 'audit-logs' ? 'Audit Logs' : null}
                    </span>
                    <svg className={`h-4 w-4 transition-transform ${topTabsOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5" /></svg>
                  </button>
                  <div className="flex items-center gap-2">
                    {(() => { const q = allCheckIns.filter(c => c.status !== 'checked_in').length; return q > 0 ? (<span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">{`Queue · ${q}`}</span>) : null })()}
                    <button type="button" onClick={() => {
                      const targetId = desktopTab === 'foreign-guest' ? 'foreign-upload-section' : 'indian-upload-section';
                      const el = document.getElementById(targetId);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }} className="h-9 w-9 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700" aria-label="Scan ID">
                      <Camera className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {/* Mobile dropdown */}
                <div className={`${topTabsOpen ? 'max-h-64 mt-2' : 'max-h-0'} sm:hidden overflow-hidden transition-[max-height] duration-200`}>
                  <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200/60 dark:divide-gray-700/60">
                    <button className={`w-full h-12 flex items-center gap-2 px-3 text-left ${desktopTab === 'indian-guest' ? 'bg-purple-600 text-white' : ''}`} onClick={() => { setDesktopTab('indian-guest'); setTopTabsOpen(false); }}>
                      <User className="h-4 w-4" /> <span>Indian Guest Check-in</span>
                    </button>
                    <button className={`w-full h-12 flex items-center gap-2 px-3 text-left ${desktopTab === 'foreign-guest' ? 'bg-purple-600 text-white' : ''}`} onClick={() => { setDesktopTab('foreign-guest'); setTopTabsOpen(false); }}>
                      <Globe className="h-4 w-4" /> <span>  Foreign Guest Check-in</span>
                    </button>
                    <button className={`w-full h-12 flex items-center gap-2 px-3 text-left ${desktopTab === 'guest-details' ? 'bg-purple-600 text-white' : ''}`} onClick={() => { setDesktopTab('guest-details'); setTopTabsOpen(false); }}>
                      <Shield className="h-4 w-4" /> <span>  Guest Details</span>
                    </button>
                    <button className={`w-full h-12 flex items-center gap-2 px-3 text-left ${desktopTab === 'audit-logs' ? 'bg-purple-600 text-white' : ''}`} onClick={() => { setDesktopTab('audit-logs'); setTopTabsOpen(false); }}>
                      <FileText className="h-4 w-4" /> <span>  Audit Logs</span>
                    </button>
                  </div>
                </div>
                {/* Desktop tabs */}
                <div className="hidden sm:block">
                  <div className="-mx-6 px-6 lg:bg-[#F5F7FA]">
                    <FinanceTabsList className="grid grid-cols-4 gap-2 bg-gray-100 dark:bg-slate-800 rounded-md p-1" theme={theme}>
                      <FinanceTabsTrigger value="indian-guest" theme={theme} className="text-sm px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-none">
                        <User className="h-4 w-4 mr-2" />
                        Indian Guest Check-in
                      </FinanceTabsTrigger>
                      <FinanceTabsTrigger value="foreign-guest" theme={theme} className="text-sm px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-none">
                        <Globe className="h-4 w-4 mr-2" />
                        Foreign Guest Check-in
                      </FinanceTabsTrigger>
                      <FinanceTabsTrigger value="guest-details" theme={theme} className="text-sm px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-none">
                        <Shield className="h-4 w-4 mr-2" />
                        Guest Details
                      </FinanceTabsTrigger>
                      <FinanceTabsTrigger value="audit-logs" theme={theme} className="text-sm px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-none">
                        <FileText className="h-4 w-4 mr-2" />
                        Audit Logs
                      </FinanceTabsTrigger>
                    </FinanceTabsList>
                  </div>
                </div>
              </div>

              {/* Content Container */}
              <div className="space-y-6 mt-4 pb-12">
                <TabsContent value="indian-guest" className="space-y-4 mt-0 pb-12">
                  <Card className="border-l-4 border-l-green-500 shadow-md">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <User className="h-6 w-6 text-green-600" />
                        Indian Guest Check-in
                      </CardTitle>
                      <CardDescription>Complete check-in for Indian guests</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-8">
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
                      <div className="mb-6" id="indian-upload-section">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload Indian ID Document</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Auto-fill your details by uploading any Indian government ID. AI will detect the document type and extract information automatically. Supported: Aadhaar, PAN, Driving License, Election Card</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <DocumentUploadZone
                            key={`indian-primary-${uploadZoneResetKey}`}
                            documentType="other"
                            label="Any Indian ID Document (Required)"
                            onUploadComplete={handleIndianDocumentUpload}
                            onExtractionComplete={(data) => {
                              // Auto-fill happens in handleIndianDocumentUpload
                            }}
                            onUploadStatusChange={(uploaded, doc) => {
                              if (!uploaded) {
                                setIndianPrimaryDocUploaded(false);
                                removeUploadedDocument(doc);
                              } else {
                                setIndianPrimaryDocUploaded(true);
                              }
                            }}
                            className="min-h-[168px] sm:min-h-[220px]"
                          />

                          <DocumentUploadZone
                            key={`indian-optional-${uploadZoneResetKey}`}
                            documentType="other"
                            label="Additional Document (Optional)"
                            onUploadComplete={handleIndianDocumentUpload}
                            onUploadStatusChange={(uploaded, doc) => {
                              if (!uploaded) {
                                removeUploadedDocument(doc);
                              }
                            }}
                            className="min-h-[168px] sm:min-h-[220px]"
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

                      <form ref={indianFormRef as any} onSubmit={handleIndianCheckIn} className="space-y-6">
                        {/* Tabbed Interface for Form Sections */}
                        <FinanceTabs value={indianActiveTab} onValueChange={(value) => setIndianActiveTab(value as any)} theme={theme} className="space-y-4">
                          {/* Mobile accordion-style headers */}
                          <div className="sm:hidden space-y-2">
                            <button type="button" onClick={() => setIndMenuOpen(v => !v)} className="w-full h-10 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium flex items-center justify-between px-3">
                              <span className="truncate">
                                {indianActiveTab === 'personal' ? 'Personal Information' : indianActiveTab === 'id-documents' ? 'ID Documents' : 'Booking Details'}
                              </span>
                              <svg className={`h-4 w-4 transition-transform ${indMenuOpen ? 'rotate(180deg)' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5" /></svg>
                            </button>
                            <div className={`${indMenuOpen ? 'max-h-48 mt-2' : 'max-h-0'} overflow-hidden transition-[max-height] duration-300`}>
                              <div className="flex flex-col gap-2">
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${indianActiveTab === 'personal' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setIndMenuOpen(false); setIndianActiveTab('personal') }}>Personal Information</button>
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${indianActiveTab === 'id-documents' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setIndMenuOpen(false); setIndianActiveTab('id-documents') }}>ID Documents</button>
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${indianActiveTab === 'booking' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setIndMenuOpen(false); setIndianActiveTab('booking') }}>Booking Details</button>
                              </div>
                            </div>
                          </div>
                          {/* Desktop tabs remain */}
                          <FinanceTabsList className="grid grid-cols-3" containerClassName="hidden sm:block" theme={theme}>
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
                                  inputMode="email"
                                  autoComplete="email"
                                  value={indianForm.email}
                                  onChange={(e) => setIndianForm({ ...indianForm, email: e.target.value })}
                                  placeholder="your.email@example.com"
                                  required
                                  className="h-12 sm:h-11"
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
                                inputMode="tel"
                                autoComplete="tel"
                                value={indianForm.phone}
                                onChange={(e) => setIndianForm({ ...indianForm, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                required
                                className="h-12 sm:h-11"
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
                                className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
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

                              <div className="space-y-2">
                                <Label htmlFor="indian-dl" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Driving License Number
                                </Label>
                                <Input
                                  id="indian-dl"
                                  value={indianForm.drivingLicenseNumber}
                                  onChange={(e) => setIndianForm({ ...indianForm, drivingLicenseNumber: e.target.value.toUpperCase() })}
                                  placeholder="DL-1420110012345"
                                  className="h-11"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="indian-election" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Election Card Number
                                </Label>
                                <Input
                                  id="indian-election"
                                  value={indianForm.electionCardNumber}
                                  onChange={(e) => setIndianForm({ ...indianForm, electionCardNumber: e.target.value.toUpperCase() })}
                                  placeholder="ABC1234567"
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
                                className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
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
                                  inputMode="numeric"
                                  min="1"
                                  value={indianForm.numberOfGuests}
                                  onChange={(e) => setIndianForm({ ...indianForm, numberOfGuests: parseInt(e.target.value) || 1 })}
                                  className="h-12 sm:h-11"
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

                            {/* Complete Check-in Button */}
                            <Button
                              type="submit"
                              className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              disabled={isLoading || !isIndianBookingValid() || !indianPrimaryDocUploaded}
                            >
                              {isLoading ? (
                                <>
                                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : !indianPrimaryDocUploaded ? (
                                <>
                                  <AlertCircle className="h-5 w-5 mr-2" />
                                  Please upload Indian ID document
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
                      {/* Mobile sticky action bar for Indian flow */}
                      {desktopTab === 'indian-guest' && (
                        <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-3 py-3 pb-safe z-40">
                          <div className="flex gap-8">
                            {indianActiveTab !== 'personal' ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 h-12"
                                onClick={() => {
                                  if (indianActiveTab === 'booking') setIndianActiveTab('id-documents');
                                  else if (indianActiveTab === 'id-documents') setIndianActiveTab('personal');
                                }}
                              >
                                Back
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white"
                              disabled={
                                (indianActiveTab === 'personal' && !isIndianPersonalInfoValid()) ||
                                (indianActiveTab === 'id-documents' && !isIndianIdDocumentsValid()) ||
                                (indianActiveTab === 'booking' && (isLoading || !isIndianBookingValid() || !indianPrimaryDocUploaded))
                              }
                              onClick={() => {
                                if (indianActiveTab === 'personal') {
                                  if (isIndianPersonalInfoValid()) setIndianActiveTab('id-documents');
                                } else if (indianActiveTab === 'id-documents') {
                                  if (isIndianIdDocumentsValid()) setIndianActiveTab('booking');
                                } else {
                                  if (!isLoading && isIndianBookingValid() && indianPrimaryDocUploaded) {
                                    (indianFormRef.current as any)?.requestSubmit?.();
                                  }
                                }
                              }}
                            >
                              {indianActiveTab === 'booking' ? (isLoading ? 'Processing…' : 'Complete Check-in') : 'Continue'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="foreign-guest" className="space-y-4 mt-0 pb-12">
                  <Card className="border-l-4 border-l-green-500 shadow-md">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="h-6 w-6 text-green-600" />
                        Foreign Guest Check-in
                      </CardTitle>
                      <CardDescription>Complete check-in for foreign guests</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-8">
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
                      <div className="mb-6" id="foreign-upload-section">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload Travel Documents</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Auto-fill your details by uploading your passport and visa. AI will extract information automatically.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <DocumentUploadZone
                            key={`foreign-passport-${uploadZoneResetKey}`}
                            documentType="passport"
                            label="Passport (Required)"
                            onUploadComplete={handleForeignDocumentUpload}
                            onExtractionComplete={(data) => {
                              // Auto-fill happens in handleForeignDocumentUpload
                            }}
                            onUploadStatusChange={(uploaded, doc) => {
                              if (!uploaded) {
                                setForeignPassportUploaded(false);
                                removeUploadedDocument(doc);
                              } else {
                                setForeignPassportUploaded(true);
                              }
                            }}
                            className="min-h-[168px] sm:min-h-[220px]"
                          />

                          <DocumentUploadZone
                            key={`foreign-visa-${uploadZoneResetKey}`}
                            documentType="visa_front"
                            label="Visa (Required)"
                            onUploadComplete={handleForeignDocumentUpload}
                            onUploadStatusChange={(uploaded, doc) => {
                              if (!uploaded) {
                                setForeignVisaUploaded(false);
                                removeUploadedDocument(doc);
                              } else {
                                setForeignVisaUploaded(true);
                              }
                            }}
                            className="min-h-[168px] sm:min-h-[220px]"
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

                      <form ref={foreignFormRef as any} onSubmit={handleForeignCheckIn} className="space-y-6">
                        {/* Tabbed Interface for Form Sections */}
                        <FinanceTabs value={foreignActiveTab} onValueChange={(value) => setForeignActiveTab(value as any)} theme={theme} className="space-y-4">
                          {/* Mobile accordion-style headers */}
                          <div className="sm:hidden space-y-2">
                            <button type="button" onClick={() => setForeignMenuOpen(v => !v)} className="w-full h-10 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-medium flex items-center justify-between px-3">
                              <span className="truncate">
                                {foreignActiveTab === 'personal' ? 'Personal Info' : foreignActiveTab === 'travel-documents' ? '  Travel Docs' : foreignActiveTab === 'form-c' ? 'Form C Details' : 'Booking'}
                              </span>
                              <svg className={`h-4 w-4 transition-transform ${foreignMenuOpen ? 'rotate(180deg)' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5 7l5 5 5-5" /></svg>
                            </button>
                            <div className={`${foreignMenuOpen ? 'max-h-56 mt-2' : 'max-h-0'} overflow-hidden transition-[max-height] duration-300`}>
                              <div className="flex flex-col gap-2">
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${foreignActiveTab === 'personal' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setForeignMenuOpen(false); setForeignActiveTab('personal') }}>Personal Info</button>
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${foreignActiveTab === 'travel-documents' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setForeignMenuOpen(false); setForeignActiveTab('travel-documents') }}>Travel Docs</button>
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${foreignActiveTab === 'form-c' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setForeignMenuOpen(false); setForeignActiveTab('form-c') }}>Form C Details</button>
                                <button type="button" className={`h-12 text-left px-3 rounded-md ${foreignActiveTab === 'booking' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-slate-800 dark:text-slate-200'}`} onClick={() => { setForeignMenuOpen(false); setForeignActiveTab('booking') }}>Booking</button>
                              </div>
                            </div>
                          </div>
                          {/* Desktop tabs remain */}
                          <FinanceTabsList className="grid grid-cols-4" containerClassName="hidden sm:block" theme={theme}>
                            <FinanceTabsTrigger
                              value="personal"
                              theme={theme}
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Personal Info
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger
                              value="travel-documents"
                              theme={theme}
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Travel Docs
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger
                              value="form-c"
                              theme={theme}
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Form C Details
                            </FinanceTabsTrigger>
                            <FinanceTabsTrigger
                              value="booking"
                              theme={theme}
                              className="text-sm px-4 py-3 data-[state=active]:text-green-600 data-[state=active]:bg-green-50 data-[state=active]:border-b-green-600 data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-800 data-[state=inactive]:hover:bg-gray-50"
                            >
                              Booking
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
                                  inputMode="email"
                                  autoComplete="email"
                                  value={foreignForm.email}
                                  onChange={(e) => setForeignForm({ ...foreignForm, email: e.target.value })}
                                  placeholder="your.email@example.com"
                                  required
                                  className="h-12 sm:h-11"
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
                                inputMode="tel"
                                autoComplete="tel"
                                value={foreignForm.phone}
                                onChange={(e) => setForeignForm({ ...foreignForm, phone: e.target.value })}
                                placeholder="+1 234 567 8900"
                                required
                                className="h-12 sm:h-11"
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
                                className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
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
                                    onChange={(e) => setForeignForm({
                                      ...foreignForm,
                                      passportCountry: e.target.value,
                                      country: e.target.value // Sync legacy field for backward compatibility
                                    })}
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
                                onClick={() => setForeignActiveTab('form-c')}
                                disabled={!isForeignTravelDocumentsValid()}
                                className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              >
                                Next
                              </Button>
                            </div>
                          </TabsContent>

                          {/* Form C Details Tab */}
                          <TabsContent value="form-c" className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Form C Information:</strong> These additional details are required by the FRRO (Foreigners Regional Registration Office) for foreign national registration in India. Complete these fields to enable automatic Form C PDF generation.
                              </p>
                            </div>

                            {/* Property Selection Section - Auto-fills Indian Address */}
                            <Card className="border-l-4 border-l-green-500 shadow-sm">
                              <CardHeader className="pb-4">
                                <CardTitle className="text-md font-medium text-gray-800 dark:text-gray-200">
                                  Accommodation Property
                                </CardTitle>
                                <CardDescription className="text-sm text-gray-600">
                                  Select property to auto-fill Indian address and contact details
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <Label htmlFor="form-c-property" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Select Property *
                                  </Label>
                                  <Select
                                    value={foreignForm.propertyId}
                                    onValueChange={(value) => {
                                      console.log('=== PROPERTY SELECTION (Form C Tab) ===');
                                      autofillIndianAddressFromProperty(value);
                                    }}
                                  >
                                    <SelectTrigger className="h-11">
                                      <SelectValue placeholder="Select accommodation property" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {properties.map((property) => (
                                        <SelectItem key={property.id} value={property.id.toString()}>
                                          {property.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-gray-500">
                                    This will automatically populate the Indian address fields below
                                  </p>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Personal Details for Form C */}
                            <div className="space-y-4">
                              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                                Additional Personal Details
                              </h4>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="surname" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    Surname (if any)
                                    {foreignForm.surname && <Sparkles className="h-3 w-3 text-green-600" />}
                                  </Label>
                                  <Input
                                    id="surname"
                                    value={foreignForm.surname}
                                    onChange={(e) => setForeignForm({ ...foreignForm, surname: e.target.value })}
                                    placeholder="Last name / Family name"
                                    className="h-11"
                                  />
                                  {foreignForm.surname && (
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      Auto-filled from passport
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="sex" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Sex/Gender *
                                  </Label>
                                  <Select value={foreignForm.sex} onValueChange={(value) => setForeignForm({ ...foreignForm, sex: value as 'Male' | 'Female' | 'Other' })}>
                                    <SelectTrigger className="h-11">
                                      <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Male">Male</SelectItem>
                                      <SelectItem value="Female">Female</SelectItem>
                                      <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="special-category" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Special Category
                                  </Label>
                                  <Input
                                    id="special-category"
                                    value={foreignForm.specialCategory}
                                    onChange={(e) => setForeignForm({ ...foreignForm, specialCategory: e.target.value })}
                                    placeholder="e.g., Others, VIP, Diplomat"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="permanent-city" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    Permanent City (Home Country)
                                    {foreignForm.permanentCity && <Sparkles className="h-3 w-3 text-green-600" />}
                                  </Label>
                                  <Input
                                    id="permanent-city"
                                    value={foreignForm.permanentCity}
                                    onChange={(e) => setForeignForm({ ...foreignForm, permanentCity: e.target.value })}
                                    placeholder="City in your home country"
                                    className="h-11"
                                  />
                                  {foreignForm.permanentCity && (
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      Auto-filled from place of birth
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Indian Address Details */}
                            <div className="space-y-4">
                              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                                Address/Reference in India
                              </h4>

                              <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="indian-address" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    Indian Address *
                                    {foreignForm.indianAddress && <Sparkles className="h-3 w-3 text-blue-600" />}
                                  </Label>
                                  <Input
                                    id="indian-address"
                                    value={foreignForm.indianAddress}
                                    onChange={(e) => setForeignForm({ ...foreignForm, indianAddress: e.target.value })}
                                    placeholder="Complete address in India"
                                    required
                                    className="h-11"
                                  />
                                  {foreignForm.indianAddress && (
                                    <p className="text-xs text-blue-600 flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      Auto-filled from selected property
                                    </p>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="indian-city-district" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      City/District *
                                    </Label>
                                    <Input
                                      id="indian-city-district"
                                      value={foreignForm.indianCityDistrict}
                                      onChange={(e) => setForeignForm({ ...foreignForm, indianCityDistrict: e.target.value })}
                                      placeholder="City or District"
                                      required
                                      className="h-11"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="indian-state" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      State *
                                    </Label>
                                    <Input
                                      id="indian-state"
                                      value={foreignForm.indianState}
                                      onChange={(e) => setForeignForm({ ...foreignForm, indianState: e.target.value })}
                                      placeholder="State"
                                      required
                                      className="h-11"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="indian-pincode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      Pincode *
                                    </Label>
                                    <Input
                                      id="indian-pincode"
                                      value={foreignForm.indianPincode}
                                      onChange={(e) => setForeignForm({ ...foreignForm, indianPincode: e.target.value })}
                                      placeholder="6-digit pincode"
                                      required
                                      className="h-11"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Arrival Details */}
                            <div className="space-y-4">
                              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                                Arrival Information
                              </h4>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="arrived-from" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    Arrived From (Last Port) *
                                    {foreignForm.arrivedFrom && <Sparkles className="h-3 w-3 text-green-600" />}
                                  </Label>
                                  <Input
                                    id="arrived-from"
                                    value={foreignForm.arrivedFrom}
                                    onChange={(e) => setForeignForm({ ...foreignForm, arrivedFrom: e.target.value })}
                                    placeholder="City, Country (e.g., London, UK)"
                                    required
                                    className="h-11"
                                  />
                                  {foreignForm.arrivedFrom && (
                                    <p className="text-xs text-green-600 flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      Auto-filled from passport nationality
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="date-arrival-india" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Date of Arrival in India *
                                  </Label>
                                  <Input
                                    id="date-arrival-india"
                                    type="date"
                                    value={foreignForm.dateOfArrivalInIndia}
                                    onChange={(e) => setForeignForm({ ...foreignForm, dateOfArrivalInIndia: e.target.value })}
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="date-arrival-accommodation" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Date of Arrival at Accommodation *
                                  </Label>
                                  <Input
                                    id="date-arrival-accommodation"
                                    type="date"
                                    value={foreignForm.dateOfArrivalAtAccommodation}
                                    onChange={(e) => setForeignForm({ ...foreignForm, dateOfArrivalAtAccommodation: e.target.value })}
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="time-arrival" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Time of Arrival *
                                  </Label>
                                  <Input
                                    id="time-arrival"
                                    type="time"
                                    value={foreignForm.timeOfArrival}
                                    onChange={(e) => setForeignForm({ ...foreignForm, timeOfArrival: e.target.value })}
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="intended-duration" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Intended Duration (Days) *
                                  </Label>
                                  <Input
                                    id="intended-duration"
                                    type="number"
                                    min="1"
                                    value={foreignForm.intendedDuration}
                                    onChange={(e) => setForeignForm({ ...foreignForm, intendedDuration: parseInt(e.target.value) || 7 })}
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="employed-india" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Employed in India? *
                                  </Label>
                                  <Select value={foreignForm.employedInIndia} onValueChange={(value) => setForeignForm({ ...foreignForm, employedInIndia: value as 'Y' | 'N' })}>
                                    <SelectTrigger className="h-11">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="N">No</SelectItem>
                                      <SelectItem value="Y">Yes</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>

                            {/* Other Details */}
                            <div className="space-y-4">
                              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                                Other Details
                              </h4>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="purpose-visit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Purpose of Visit *
                                  </Label>
                                  <Input
                                    id="purpose-visit"
                                    value={foreignForm.purposeOfVisit}
                                    onChange={(e) => setForeignForm({ ...foreignForm, purposeOfVisit: e.target.value })}
                                    placeholder="e.g., Tourism, Business"
                                    required
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="next-place" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Next Place of Visit
                                  </Label>
                                  <Input
                                    id="next-place"
                                    value={foreignForm.nextPlace}
                                    onChange={(e) => setForeignForm({ ...foreignForm, nextPlace: e.target.value })}
                                    placeholder="Next destination"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="destination-city" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Next Destination City
                                  </Label>
                                  <Input
                                    id="destination-city"
                                    value={foreignForm.destinationCityDistrict}
                                    onChange={(e) => setForeignForm({ ...foreignForm, destinationCityDistrict: e.target.value })}
                                    placeholder="City/District"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="destination-state" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Next Destination State
                                  </Label>
                                  <Input
                                    id="destination-state"
                                    value={foreignForm.destinationState}
                                    onChange={(e) => setForeignForm({ ...foreignForm, destinationState: e.target.value })}
                                    placeholder="State"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="mobile-india" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    Mobile No. in India
                                    {foreignForm.mobileNoIndia && <Sparkles className="h-3 w-3 text-blue-600" />}
                                  </Label>
                                  <Input
                                    id="mobile-india"
                                    type="tel"
                                    value={foreignForm.mobileNoIndia}
                                    onChange={(e) => setForeignForm({ ...foreignForm, mobileNoIndia: e.target.value })}
                                    placeholder="+91 XXXXXXXXXX"
                                    className="h-11"
                                  />
                                  {foreignForm.mobileNoIndia && (
                                    <p className="text-xs text-blue-600 flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" />
                                      Auto-filled from property contact
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="contact-permanent" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Permanent Contact No.
                                  </Label>
                                  <Input
                                    id="contact-permanent"
                                    type="tel"
                                    value={foreignForm.contactNoPermanent}
                                    onChange={(e) => setForeignForm({ ...foreignForm, contactNoPermanent: e.target.value })}
                                    placeholder="Contact in home country"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="mobile-permanent" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Permanent Mobile No.
                                  </Label>
                                  <Input
                                    id="mobile-permanent"
                                    type="tel"
                                    value={foreignForm.mobileNoPermanent}
                                    onChange={(e) => setForeignForm({ ...foreignForm, mobileNoPermanent: e.target.value })}
                                    placeholder="Mobile in home country"
                                    className="h-11"
                                  />
                                </div>

                                <div className="space-y-2 sm:col-span-2">
                                  <Label htmlFor="remarks" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Remarks (Optional)
                                  </Label>
                                  <Input
                                    id="remarks"
                                    value={foreignForm.remarks}
                                    onChange={(e) => setForeignForm({ ...foreignForm, remarks: e.target.value })}
                                    placeholder="Any additional information"
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
                                disabled={!foreignForm.indianAddress || !foreignForm.indianCityDistrict || !foreignForm.indianState || !foreignForm.indianPincode || !foreignForm.arrivedFrom || !foreignForm.dateOfArrivalInIndia || !foreignForm.dateOfArrivalAtAccommodation || !foreignForm.purposeOfVisit}
                                className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
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
                                <Select
                                  value={foreignForm.propertyId}
                                  onValueChange={(value) => {
                                    console.log('=== PROPERTY SELECTION (Booking Tab) ===');
                                    autofillIndianAddressFromProperty(value);
                                  }}
                                >
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
                                  inputMode="numeric"
                                  min="1"
                                  value={foreignForm.numberOfGuests}
                                  onChange={(e) => setForeignForm({ ...foreignForm, numberOfGuests: parseInt(e.target.value) || 1 })}
                                  className="h-12 sm:h-11"
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
                              className="hidden sm:inline-flex w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 text-lg font-semibold"
                              disabled={isLoading || !isForeignBookingValid() || !foreignPassportUploaded || !foreignVisaUploaded}
                            >
                              {isLoading ? (
                                <>
                                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : !foreignPassportUploaded || !foreignVisaUploaded ? (
                                <>
                                  <AlertCircle className="h-5 w-5 mr-2" />
                                  {!foreignPassportUploaded && !foreignVisaUploaded
                                    ? 'Please upload passport and visa'
                                    : !foreignPassportUploaded
                                      ? 'Please upload passport'
                                      : 'Please upload visa'}
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
                      {/* Mobile sticky action bar for Foreign flow */}
                      {desktopTab === 'foreign-guest' && (
                        <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-3 py-3 pb-safe z-40">
                          <div className="flex gap-2">
                            {foreignActiveTab !== 'personal' ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1 h-12"
                                onClick={() => {
                                  if (foreignActiveTab === 'booking') setForeignActiveTab('form-c');
                                  else if (foreignActiveTab === 'form-c') setForeignActiveTab('travel-documents');
                                  else if (foreignActiveTab === 'travel-documents') setForeignActiveTab('personal');
                                }}
                              >
                                Back
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white"
                              disabled={
                                (foreignActiveTab === 'personal' && !isForeignPersonalInfoValid()) ||
                                (foreignActiveTab === 'travel-documents' && !isForeignTravelDocumentsValid()) ||
                                (foreignActiveTab === 'booking' && (isLoading || !isForeignBookingValid() || !foreignVisaUploaded || !foreignPassportUploaded))
                              }
                              onClick={() => {
                                if (foreignActiveTab === 'personal') {
                                  if (isForeignPersonalInfoValid()) setForeignActiveTab('travel-documents');
                                } else if (foreignActiveTab === 'travel-documents') {
                                  if (isForeignTravelDocumentsValid()) setForeignActiveTab('form-c');
                                } else if (foreignActiveTab === 'form-c') {
                                  setForeignActiveTab('booking');
                                } else {
                                  if (!isLoading && isForeignBookingValid() && foreignPassportUploaded && foreignVisaUploaded) {
                                    (foreignFormRef.current as any)?.requestSubmit?.();
                                  }
                                }
                              }}
                            >
                              {foreignActiveTab === 'booking' ? (isLoading ? 'Processing…' : 'Complete Check-in') : 'Continue'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="guest-details" className="space-y-6 mt-0 pb-12">
                  {/* Add Guest Modal */}
                  <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm ${showAddGuestModal ? 'flex' : 'hidden'} items-center justify-center z-50 p-4`}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-3xl transform transition-all">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add New Guest</h2>
                        <button
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
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

                  <Card className="border-l-4 border-l-green-500 shadow-lg overflow-visible bg-white dark:bg-gray-800">
                    <CardHeader className="pb-6 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                              <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            Guest List
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full font-medium">
                              {checkIns.length} {checkIns.length === 1 ? 'Guest' : 'Guests'}
                            </span>
                          </CardTitle>
                          <CardDescription className="mt-2 text-gray-600 dark:text-gray-400">
                            View and manage all checked-in guests
                          </CardDescription>
                        </div>
                        <div className="flex-shrink-0 flex gap-3">
                          <Button
                            variant="outline"
                            onClick={fetchCheckIns}
                            disabled={isLoading}
                            className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="overflow-visible pt-6">

                      {/* Enhanced Filter Section */}
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 sm:p-5 mb-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          Filter Guests
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <Label htmlFor="filter-guest-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Guest Name</Label>
                            <Input
                              id="filter-guest-name"
                              placeholder="Search by name"
                              type="text"
                              className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              value={filterGuestName}
                              onChange={(e) => setFilterGuestName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="filter-checkin-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Check-in Date</Label>
                            <Input
                              id="filter-checkin-date"
                              type="date"
                              className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              value={filterCheckInDate}
                              onChange={(e) => setFilterCheckInDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="filter-property" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Property</Label>
                            <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
                              <SelectTrigger className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
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
                            <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nationality</Label>
                            <div className="flex items-center w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800">
                              <Button
                                type="button"
                                variant="ghost"
                                className={`flex-1 h-full rounded-none text-xs font-medium transition-colors ${filterGuestType === 'all'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                onClick={() => setFilterGuestType('all')}
                              >
                                All
                              </Button>
                              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                              <Button
                                type="button"
                                variant="ghost"
                                className={`flex-1 h-full rounded-none text-xs font-medium transition-colors ${filterGuestType === 'indian'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                onClick={() => setFilterGuestType(prev => prev === 'indian' ? 'all' : 'indian')}
                              >
                                Indian
                              </Button>
                              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                              <Button
                                type="button"
                                variant="ghost"
                                className={`flex-1 h-full rounded-none text-xs font-medium transition-colors ${filterGuestType === 'foreign'
                                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:text-white'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                onClick={() => setFilterGuestType(prev => prev === 'foreign' ? 'all' : 'foreign')}
                              >
                                Foreign
                              </Button>
                            </div>
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
                        <div className="overflow-x-auto overflow-y-visible rounded-lg border border-gray-200 dark:border-gray-700">
                          <table className="min-w-[640px] w-full table-fixed text-xs sm:text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                              <tr>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Guest Name</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Property</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nationality</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Room Type</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Check-in Date</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Days</th>
                                <th className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="relative">
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
                                  <tr
                                    key={checkIn.id}
                                    className={`border-b border-gray-100 dark:border-gray-700 transition-all duration-200 ${openMenuId === checkIn.id
                                      ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-300 dark:ring-blue-700 shadow-sm'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 bg-white dark:bg-gray-850'
                                      }`}
                                  >
                                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100">{checkIn.fullName}</td>
                                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{checkIn.propertyName}</td>
                                    <td className="px-4 py-4">
                                      <Badge
                                        variant={checkIn.guestType === 'indian' ? 'default' : 'secondary'}
                                        className={checkIn.guestType === 'indian' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-medium'}
                                      >
                                        {checkIn.guestType === 'indian' ? 'Indian' : 'Foreign'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{checkIn.roomNumber || 'Not assigned'}</td>
                                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{new Date(checkIn.checkInDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-4 text-gray-600 dark:text-gray-400">
                                      {checkIn.expectedCheckoutDate ?
                                        Math.ceil((new Date(checkIn.expectedCheckoutDate).getTime() - new Date(checkIn.checkInDate).getTime()) / (1000 * 60 * 60 * 24)) :
                                        'N/A'
                                      }
                                    </td>
                                    <td className="px-4 py-4 relative text-right">
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                          onClick={() => handleViewDocuments(checkIn)}
                                          title="View Documents"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <div className="relative inline-block">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${openMenuId === checkIn.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                                              }`}
                                            title="More actions"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMenuOpen(checkIn.id, e);
                                            }}
                                          >
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                          {openMenuId === checkIn.id && (
                                            <>
                                              {/* Backdrop for visual emphasis */}
                                              <div
                                                className="fixed inset-0 z-40"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenMenuId(null);
                                                }}
                                                aria-hidden="true"
                                              />
                                              {/* Dropdown menu with smart positioning */}
                                              <div
                                                className="fixed w-56 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-2xl z-[70]"
                                                style={{
                                                  top: `${menuCoords.top}px`,
                                                  left: `${menuCoords.left}px`,
                                                  transform: `translateY(${menuPlacement === 'top' ? '-100%' : '0'})`,
                                                  transformOrigin: menuPlacement === 'top' ? 'bottom right' : 'top right',
                                                  maxHeight: '300px'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <div className="py-1">
                                                  <button
                                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleViewGuestDetails(checkIn);
                                                    }}
                                                  >
                                                    <Eye className="h-4 w-4" />
                                                    <span>View guest details</span>
                                                  </button>
                                                  {checkIn.guestType === 'foreign' && (
                                                    <button
                                                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCFormReady(checkIn);
                                                      }}
                                                    >
                                                      <FileText className="h-4 w-4" />
                                                      <span>C-Form ready</span>
                                                    </button>
                                                  )}
                                                  <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                                  <button
                                                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleDelete(checkIn.id, checkIn.fullName);
                                                    }}
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span>Delete</span>
                                                  </button>
                                                </div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
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
                <TabsContent value="audit-logs" className="space-y-4 mt-0 pb-12">
                  <AuditLogFilters
                    filters={auditFiltersUi}
                    onFiltersChange={(newFilters) => {
                      // Keep UI dates as yyyy-mm-dd for inputs
                      setAuditFiltersUi(newFilters);
                      // 🔥 Use debounced version to prevent API spam
                      const normalized = normalizeAuditFiltersForApi(newFilters);
                      debouncedFetchLogs(normalized);
                    }}
                    onClear={() => {
                      setAuditFiltersUi({});
                      // Clear is instant (no debounce needed)
                      fetchLogsRef.current({}, { silent: true, replace: true });
                    }}
                  />

                  <AuditLogTable
                    logs={auditLogs}
                    isLoading={auditLoading}
                    error={auditError}
                    pagination={auditPagination}
                    onRefresh={() => fetchLogsRef.current(auditFiltersRef.current, { replace: true })}
                    onExport={exportToCsv}
                    onViewDetails={(log) => {
                      setSelectedAuditLog(log);
                      setShowAuditDetailModal(true);
                    }}
                  />
                </TabsContent>
              </div>

              {/* Guest Details Modal */}
              {showGuestDetailsModal && selectedGuestForDetails && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <div
                    className="absolute inset-0 bg-slate-900/60 dark:bg-black/70"
                    onClick={() => setShowGuestDetailsModal(false)}
                  ></div>

                  {/* Modal Content */}
                  <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-[#18212a] shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700/60">
                      <div className="w-8 sm:w-10"></div>
                      <div className="flex-1 text-center">
                        <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 tracking-tight">Guest Details</p>
                      </div>
                      <button
                        className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => setShowGuestDetailsModal(false)}
                        aria-label="Close modal"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Body */}
                    <div className="flex flex-col p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
                      {/* Guest Profile */}
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                          <User className="h-7 w-7 sm:h-8 sm:w-8 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white truncate">
                            {selectedGuestForDetails!.fullName}
                          </p>
                          <Badge
                            variant={selectedGuestForDetails!.guestType === 'indian' ? 'default' : 'secondary'}
                            className={`mt-1 text-xs ${selectedGuestForDetails!.guestType === 'indian' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'}`}
                          >
                            {selectedGuestForDetails!.guestType === 'indian' ? 'Indian Guest' : 'Foreign Guest'}
                          </Badge>
                        </div>
                      </div>

                      {/* Details Section */}
                      <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-700/60">
                        {/* Mobile Number */}
                        <div className="flex items-center gap-3 py-3 sm:py-4">
                          <Phone className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Mobile Number</p>
                            <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200 truncate">
                              {selectedGuestForDetails!.phone || 'Not provided'}
                            </p>
                          </div>
                          {selectedGuestForDetails!.phone && (
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.phone, 'Phone number')}
                              aria-label="Copy phone number"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          )}
                        </div>

                        {/* Email Address */}
                        <div className="flex items-center gap-3 py-3 sm:py-4">
                          <Mail className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Email Address</p>
                            <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200 truncate">
                              {selectedGuestForDetails!.email || 'Not provided'}
                            </p>
                          </div>
                          {selectedGuestForDetails!.email && (
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.email, 'Email')}
                              aria-label="Copy email"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          )}
                        </div>

                        {/* Address */}
                        <div className="flex items-start gap-3 py-3 sm:py-4">
                          <MapPin className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Address</p>
                            <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200 break-words">
                              {selectedGuestForDetails!.address || 'Not provided'}
                            </p>
                          </div>
                          {selectedGuestForDetails!.address && (
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.address, 'Address')}
                              aria-label="Copy address"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          )}
                        </div>

                        {/* Allotted Room */}
                        <div className="flex items-center gap-3 py-3 sm:py-4">
                          <Home className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Allotted Room</p>
                            <p className="text-sm sm:text-base font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                              {selectedGuestForDetails!.roomNumber ? `Room ${selectedGuestForDetails!.roomNumber}` : 'Not assigned'}
                            </p>
                          </div>
                          {selectedGuestForDetails!.roomNumber && (
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.roomNumber || '', 'Room number')}
                              aria-label="Copy room number"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          )}
                        </div>

                        {/* Guest Type Specific Details - Aadhaar for Indian */}
                        {selectedGuestForDetails!.guestType === 'indian' && selectedGuestForDetails!.aadharNumber && (
                          <div className="flex items-center gap-3 py-3 sm:py-4">
                            <CreditCard className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Aadhaar Number</p>
                              <p className="text-sm sm:text-base font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                                {selectedGuestForDetails!.aadharNumber?.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}
                              </p>
                            </div>
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.aadharNumber || '', 'Aadhaar number')}
                              aria-label="Copy Aadhaar number"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          </div>
                        )}

                        {/* Passport Number for Foreign */}
                        {selectedGuestForDetails!.guestType === 'foreign' && selectedGuestForDetails!.passportNumber && (
                          <div className="flex items-center gap-3 py-3 sm:py-4">
                            <Globe className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Passport Number</p>
                              <p className="text-sm sm:text-base font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                                {selectedGuestForDetails!.passportNumber}
                              </p>
                            </div>
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.passportNumber || '', 'Passport number')}
                              aria-label="Copy passport number"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          </div>
                        )}

                        {/* Country for Foreign */}
                        {selectedGuestForDetails!.guestType === 'foreign' && selectedGuestForDetails!.country && (
                          <div className="flex items-center gap-3 py-3 sm:py-4">
                            <Globe className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Country</p>
                              <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200 truncate">
                                {selectedGuestForDetails!.country}
                              </p>
                            </div>
                            <button
                              className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => copyToClipboard(selectedGuestForDetails!.country || '', 'Country')}
                              aria-label="Copy country"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-slate-800 px-2 py-1 text-xs text-white transition-all group-hover:scale-100 whitespace-nowrap">Copy</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Viewer Modal */}
              {showDocumentViewer && selectedGuestForDocs && (
                <DocumentViewer
                  open={showDocumentViewer}
                  onClose={() => setShowDocumentViewer(false)}
                  guestCheckInId={selectedGuestForDocs!.id}
                  guestName={selectedGuestForDocs!.fullName}
                  documents={documentViewerDocs}
                />
              )}

              {/* Audit Log Detail Modal */}
              <AuditLogDetailModal
                open={showAuditDetailModal}
                onClose={() => {
                  setShowAuditDetailModal(false);
                  setSelectedAuditLog(null);
                }}
                log={selectedAuditLog}
              />
            </Tabs>
          </div>
        </div>
      </div>
    );
  }
  // Render Indian guest form (disabled; unified tabs UI used instead)
  if (false) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto p-6 pb-8 overflow-y-auto">

          <Card className="border-l-4 border-l-green-500 shadow-md mb-8">
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

                    <div className="space-y-2">
                      <Label htmlFor="indian-dl" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Driving License Number
                      </Label>
                      <Input
                        id="indian-dl"
                        value={indianForm.drivingLicenseNumber}
                        onChange={(e) => setIndianForm({ ...indianForm, drivingLicenseNumber: e.target.value.toUpperCase() })}
                        placeholder="DL-1420110012345"
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indian-election" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Election Card Number
                      </Label>
                      <Input
                        id="indian-election"
                        value={indianForm.electionCardNumber}
                        onChange={(e) => setIndianForm({ ...indianForm, electionCardNumber: e.target.value.toUpperCase() })}
                        placeholder="ABC1234567"
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

  // Render foreign guest form (disabled; unified tabs UI used instead)
  if (false) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto p-6 pb-8 overflow-y-auto">

          <Card className="border-l-4 border-l-green-500 shadow-md mb-8">
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
                      className="h-12 sm:h-11"
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
                          onChange={(e) => setForeignForm({
                            ...foreignForm,
                            passportCountry: e.target.value,
                            country: e.target.value // Sync legacy field for backward compatibility
                          })}
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

        <Card className="shadow-sm overflow-visible">
          <CardContent className="p-6 overflow-visible">
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
                <Label htmlFor="filter-guest-name-mobile" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Guest Name</Label>
                <Input
                  id="filter-guest-name-mobile"
                  placeholder="Search by name"
                  type="text"
                  className="text-sm"
                  value={filterGuestName}
                  onChange={(e) => setFilterGuestName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filter-checkin-date-mobile" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Check-in Date</Label>
                <Input
                  id="filter-checkin-date-mobile"
                  type="date"
                  className="text-sm"
                  value={filterCheckInDate}
                  onChange={(e) => setFilterCheckInDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filter-property-mobile" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Property</Label>
                <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
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
                    onClick={() => setFilterGuestType(prev => prev === 'indian' ? 'all' : 'indian')}
                  >
                    Indian
                  </Button>
                  <Button
                    variant={filterGuestType === 'foreign' ? 'default' : 'outline'}
                    className="flex-1 rounded-l-none text-xs px-2 py-2"
                    onClick={() => setFilterGuestType(prev => prev === 'foreign' ? 'all' : 'foreign')}
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
              <div className="overflow-x-auto overflow-y-visible rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-[640px] w-full table-fixed text-xs sm:text-sm text-left">
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
                  <tbody className="relative">
                    {checkIns.map((checkIn) => (
                      <tr
                        key={checkIn.id}
                        className={`border-b border-gray-200 dark:border-gray-700 transition-colors ${openMenuId === checkIn.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                      >
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
                        <td className="p-3 relative">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => handleViewDocuments(checkIn)}
                              title="View Documents"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <div className="relative inline-block">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${openMenuId === checkIn.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                                  }`}
                                title="More actions"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMenuOpen(checkIn.id, e);
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                              {openMenuId === checkIn.id && (
                                <>
                                  {/* Backdrop for visual emphasis */}
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                    }}
                                    aria-hidden="true"
                                  />
                                  {/* Dropdown menu with smart positioning */}
                                  <div
                                    className="fixed w-56 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-2xl z-[70]"
                                    style={{
                                      top: `${menuCoords.top}px`,
                                      left: `${menuCoords.left}px`,
                                      transform: `translateY(${menuPlacement === 'top' ? '-100%' : '0'})`,
                                      transformOrigin: menuPlacement === 'top' ? 'bottom right' : 'top right',
                                      maxHeight: '300px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="py-1">
                                      <button
                                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewGuestDetails(checkIn);
                                        }}
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span>View guest details</span>
                                      </button>
                                      {checkIn.guestType === 'foreign' && (
                                        <button
                                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCFormReady(checkIn);
                                          }}
                                        >
                                          <FileText className="h-4 w-4" />
                                          <span>C-Form ready</span>
                                        </button>
                                      )}
                                      <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                      <button
                                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(checkIn.id, checkIn.fullName);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
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

