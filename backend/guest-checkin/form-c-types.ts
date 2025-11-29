// TypeScript interface for Form C data structure

export interface FormCData {
  // Accommodation Details
  accommodation: {
    name: string;
    address: string;
    cityDistrict: string;
    state: string;
    starRating: string;
    phoneNo: string;
    mobileNo: string;
  };

  // Personal Details
  personal: {
    surname: string;
    givenName: string;
    sex: 'Male' | 'Female' | 'Other';
    dateOfBirth: string; // Format: DD/MM/YYYY
    specialCategory: string;
    nationality: string;
    permanentAddress: {
      address: string;
      city: string;
      country: string;
    };
  };

  // Address/Reference in India
  indianAddress: {
    address: string;
    cityDistrict: string;
    state: string;
    pincode: string;
  };

  // Passport Details
  passport: {
    number: string;
    placeOfIssue: string;
    dateOfIssue: string; // Format: DD/MM/YYYY
    expiryDate: string; // Format: DD/MM/YYYY
  };

  // Visa Details
  visa: {
    number: string;
    dateOfIssue: string; // Format: DD/MM/YYYY
    validTill: string; // Format: DD/MM/YYYY
    visaType: string;
    placeOfIssue: string;
    visaSubtype?: string;
  };

  // Arrival Details
  arrival: {
    arrivedFrom: string; // Format: "City, State/Province, Country"
    dateOfArrivalInIndia: string; // Format: DD/MM/YYYY
    dateOfArrivalAtAccommodation: string; // Format: DD/MM/YYYY
    timeOfArrival: string; // Format: HH:MM
    intendedDuration: number; // days
    employedInIndia: 'Y' | 'N';
  };

  // Other Details
  other: {
    purposeOfVisit: string;
    nextPlace: string;
    destinationCityDistrict: string;
    destinationState: string;
    contactNoIndia: string;
    mobileNoIndia?: string;
    contactNoPermanent?: string;
    mobileNoPermanent?: string;
    remarks?: string;
  };
}

// Sample data for testing
export const sampleFormCData: FormCData = {
  accommodation: {
    name: "Hostel EXP",
    address: "Hostel EXP, Varkala Helipad Road, opposite to Chembakam Super Market",
    cityDistrict: "THIRUVANANTHAPURAM",
    state: "KERALA",
    starRating: "Three Star",
    phoneNo: "9951339480",
    mobileNo: "9746708929"
  },
  personal: {
    surname: "",
    givenName: "RAPHAEL",
    sex: "Male",
    dateOfBirth: "24/04/2002",
    specialCategory: "Others",
    nationality: "SWITZERLAND",
    permanentAddress: {
      address: "ETAGNIEERES",
      city: "ETAGNIEERES",
      country: "SWITZERLAND"
    }
  },
  indianAddress: {
    address: "HOSTEL EXP, VARKALA HELIPAD ROAD, OPPOSITE TO CHEMBAKAM SUPER MARKET, VARKALA, KERALA 695141",
    cityDistrict: "THIRUVANANTHAPURAM",
    state: "KERALA",
    pincode: "695141"
  },
  passport: {
    number: "X7735942",
    placeOfIssue: "ETAGNIEERES, SWITZERLAND",
    dateOfIssue: "30/05/2022",
    expiryDate: "29/05/2032"
  },
  visa: {
    number: "902400E3P",
    dateOfIssue: "16/10/2025",
    validTill: "07/10/2026",
    visaType: "TOURIST VISA",
    placeOfIssue: "Mumbai, INDIA",
    visaSubtype: ""
  },
  arrival: {
    arrivedFrom: "ETAGNIEERES, ETAGNIEERES, SWITZERLAND",
    dateOfArrivalInIndia: "16/10/2025",
    dateOfArrivalAtAccommodation: "04/11/2025",
    timeOfArrival: "12:00",
    intendedDuration: 5,
    employedInIndia: "N"
  },
  other: {
    purposeOfVisit: "Tourism",
    nextPlace: "TRIVANDRUM",
    destinationCityDistrict: "THIRUVANANTHAPURAM",
    destinationState: "KERALA",
    contactNoIndia: "09746708929",
    mobileNoIndia: "",
    contactNoPermanent: "",
    mobileNoPermanent: "00000000000",
    remarks: ""
  }
};

