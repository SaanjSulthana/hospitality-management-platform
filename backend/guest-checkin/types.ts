export type GuestType = 'indian' | 'foreign';
export type CheckInStatus = 'checked_in' | 'checked_out' | 'cancelled';

export interface GuestCheckIn {
  id: number;
  orgId: number;
  propertyId: number;
  guestType: GuestType;
  
  // Personal Information
  fullName: string;
  email: string;
  phone: string;
  address: string;
  
  // Indian Guest ID Fields
  aadharNumber?: string;
  panNumber?: string;
  drivingLicenseNumber?: string;
  electionCardNumber?: string;
  
  // Foreign Guest ID Fields
  passportNumber?: string;
  country?: string;
  visaType?: string;
  visaExpiryDate?: string;
  
  // Booking Information
  checkInDate: string;
  expectedCheckoutDate?: string;
  actualCheckoutDate?: string;
  roomNumber?: string;
  numberOfGuests: number;
  
  // Status
  status: CheckInStatus;
  
  // Audit Fields
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  checkedOutByUserId?: number;
}

export interface GuestCheckInWithProperty extends GuestCheckIn {
  propertyName: string;
}

export interface CreateCheckInRequest {
  propertyId: number;
  guestType: GuestType;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  
  // Indian guests
  aadharNumber?: string;
  panNumber?: string;
  drivingLicenseNumber?: string;
  electionCardNumber?: string;
  
  // Foreign guests
  passportNumber?: string;
  country?: string;
  visaType?: string;
  visaExpiryDate?: string;
  
  // Booking details
  expectedCheckoutDate?: string;
  roomNumber?: string;
  numberOfGuests?: number;
}

export interface CreateCheckInResponse {
  id: number;
  message: string;
  checkInDate: string;
}

export interface ListCheckInsRequest {
  propertyId?: number;
  status?: CheckInStatus;
  guestType?: GuestType;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListCheckInsResponse {
  checkins: GuestCheckInWithProperty[];
  total: number;
  limit: number;
  offset: number;
}

export interface UpdateCheckInRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  aadharNumber?: string;
  panNumber?: string;
  drivingLicenseNumber?: string;
  electionCardNumber?: string;
  roomNumber?: string;
  numberOfGuests?: number;
  expectedCheckoutDate?: string;
}

export interface UpdateCheckInResponse {
  message: string;
  updatedAt: string;
}

export interface CheckOutRequest {
  actualCheckoutDate?: string;
}

export interface CheckOutResponse {
  message: string;
  actualCheckoutDate: string;
}

export interface DeleteCheckInResponse {
  message: string;
}

export interface CheckInStatsRequest {
  propertyId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CheckInStatsResponse {
  totalCheckins: number;
  currentlyCheckedIn: number;
  checkedOut: number;
  indianGuests: number;
  foreignGuests: number;
  byProperty: Array<{
    propertyId: number;
    propertyName: string;
    count: number;
  }>;
}
