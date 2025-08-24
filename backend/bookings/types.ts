export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
export type BookingChannel = 'direct' | 'ota';

export interface Booking {
  id: number;
  orgId: number;
  guestId: number;
  propertyId: number;
  checkinDate: Date;
  checkoutDate: Date;
  status: BookingStatus;
  priceCents: number;
  currency: string;
  channel: BookingChannel;
  metaJson: Record<string, any>;
}

export interface Guest {
  id: number;
  orgId: number;
  primaryContactJson: Record<string, any>;
  notesText?: string;
}
