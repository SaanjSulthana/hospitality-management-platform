export type PropertyType = 'hostel' | 'hotel' | 'resort' | 'apartment';

export interface Property {
  id: number;
  orgId: number;
  regionId?: number;
  name: string;
  type: PropertyType;
  mobileNumber: string;
  addressJson: Record<string, any>;
  amenitiesJson: Record<string, any>;
  capacityJson: Record<string, any>;
  status: string;
  createdAt: Date;
}

export interface Room {
  id: number;
  orgId: number;
  propertyId: number;
  name: string;
  type: string;
  capacity: number;
  attributesJson: Record<string, any>;
}

export interface BedOrUnit {
  id: number;
  orgId: number;
  roomId?: number;
  propertyId: number;
  label: string;
  status: 'available' | 'occupied' | 'oo';
  metaJson: Record<string, any>;
}
