# Form C PDF Generation Feature

## Overview
This feature enables automatic generation of FRRO Form C PDF documents for foreign guest check-ins. Form C is a mandatory registration form required by the Foreigners Regional Registration Office (FRRO) in India for all foreign nationals staying at hotels, hostels, or other accommodations.

## Features

### ✅ Comprehensive Data Collection
- **Personal Details**: Name, surname, gender, nationality, date of birth
- **Passport Details**: Number, country, issue/expiry dates, place of birth, issuing authority
- **Visa Details**: Type, number, category, validity, purpose of visit, port of entry
- **Indian Address**: Complete address with city, state, and pincode
- **Arrival Information**: Arrival dates, time, last port, intended duration
- **Contact Details**: Mobile numbers in India and home country

### ✅ Auto-Fill from Property Data
- Accommodation details (name, address, star rating, contact) are automatically populated from the property associated with the check-in

### ✅ Pixel-Perfect PDF Generation
- Professional HTML template styled to match official FRRO Form C format
- Puppeteer-based PDF generation with proper formatting
- All required sections and fields included

### ✅ Immediate Download
- One-click download from the guest list
- Automatic filename generation with guest name and date
- No server-side storage required

## Architecture

### Backend Components

1. **form-c-types.ts**: TypeScript interfaces for Form C data structure
2. **form-c-generator.ts**: PDF generation logic using Puppeteer and Handlebars
3. **templates/form-c-template.html**: HTML template for Form C with proper styling
4. **generate-c-form.ts**: Encore API endpoint for generating and downloading PDFs
5. **migrations/8_add_form_c_fields.up.sql**: Database migration adding Form C fields

### Frontend Components

1. **GuestCheckInPage.tsx**: Enhanced with Form C fields in a dedicated tab
2. **Form C Details Tab**: Organized sections for all required information
3. **Download Button**: Integrated in the guest list menu

## API Endpoints

### POST `/guest-checkin/:id/generate-c-form`
Generates and returns a Form C PDF for a specific guest check-in.

**Authentication**: Required

**Request Parameters**:
- `id`: Guest check-in ID (URL parameter)

**Response**:
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="Form_C_{GuestName}_{Date}.pdf"`
- Body: PDF binary data

**Error Responses**:
- `400`: Invalid check-in ID or not a foreign guest
- `404`: Check-in not found
- `500`: PDF generation failed

## Database Schema

### New Fields Added to `guest_checkins` Table

#### Personal Details
- `surname`: VARCHAR(255) - Guest's surname/family name
- `sex`: VARCHAR(10) - Gender (Male/Female/Other)
- `special_category`: VARCHAR(100) - Special category (Others/VIP/Diplomat)
- `permanent_city`: VARCHAR(255) - City in home country

#### Indian Address
- `indian_address`: TEXT - Complete address in India
- `indian_city_district`: VARCHAR(255) - City or district
- `indian_state`: VARCHAR(100) - State name
- `indian_pincode`: VARCHAR(20) - 6-digit pincode

#### Arrival Details
- `arrived_from`: VARCHAR(500) - Last port/city before India
- `date_of_arrival_in_india`: TIMESTAMP - First arrival date in India
- `date_of_arrival_at_accommodation`: TIMESTAMP - Arrival at this property
- `time_of_arrival`: VARCHAR(10) - Arrival time (HH:MM)
- `intended_duration`: INTEGER - Planned stay duration in days
- `employed_in_india`: VARCHAR(1) - Y/N indicator

#### Other Details
- `purpose_of_visit`: VARCHAR(255) - Purpose (Tourism/Business/etc.)
- `next_place`: VARCHAR(255) - Next destination
- `destination_city_district`: VARCHAR(255) - Next city
- `destination_state`: VARCHAR(100) - Next state
- `mobile_no_india`: VARCHAR(20) - Indian mobile number
- `contact_no_permanent`: VARCHAR(20) - Permanent contact number
- `mobile_no_permanent`: VARCHAR(20) - Permanent mobile number
- `remarks`: TEXT - Additional notes

### Property Table Enhancement
- `star_rating`: VARCHAR(50) - Hotel star rating
- `mobile`: VARCHAR(20) - Mobile contact for property

## Usage Flow

### 1. Foreign Guest Check-In
When checking in a foreign guest, staff must fill out four tabs:
1. **Personal Information**: Basic details, name, email, phone, address
2. **Travel Documents**: Comprehensive passport and visa details
3. **Form C Details**: Additional information required for FRRO compliance
4. **Booking Details**: Room, duration, property selection

### 2. Form C Generation
After check-in is complete:
1. Navigate to Guest List
2. Find the foreign guest's entry
3. Click the three-dot menu (⋮)
4. Select "C-Form ready"
5. PDF automatically downloads

### 3. Form C Submission
The downloaded PDF can be:
- Printed and physically submitted to FRRO
- Used as a reference for online FRRO portal submission
- Stored as a record for compliance

## Data Mapping

### From Check-In to Form C

```typescript
Accommodation Details:
- name: property.name
- address: property.address
- cityDistrict: property.city (uppercase)
- state: property.state (uppercase)
- starRating: property.star_rating
- phoneNo: property.phone
- mobileNo: property.mobile

Personal Details:
- surname: guest.surname
- givenName: guest.full_name
- sex: guest.sex
- dateOfBirth: guest.passport_date_of_birth (formatted DD/MM/YYYY)
- nationality: guest.passport_nationality
- specialCategory: guest.special_category

Passport Details:
- number: guest.passport_number
- placeOfIssue: guest.passport_issuing_authority
- dateOfIssue: guest.passport_issue_date (formatted DD/MM/YYYY)
- expiryDate: guest.passport_expiry_date (formatted DD/MM/YYYY)

Visa Details:
- number: guest.visa_number
- visaType: guest.visa_type
- dateOfIssue: guest.visa_issue_date (formatted DD/MM/YYYY)
- validTill: guest.visa_expiry_date (formatted DD/MM/YYYY)
- placeOfIssue: guest.visa_place_of_issue

... and more
```

## Template Customization

The HTML template (`templates/form-c-template.html`) can be customized to match your specific requirements:

1. **Styling**: Modify the CSS in the `<style>` section
2. **Layout**: Adjust table structures and grid layouts
3. **Fields**: Add or remove fields as needed
4. **Branding**: Add logos or property-specific information

### Important Notes:
- Keep the Handlebars syntax intact (e.g., `{{accommodation.name}}`)
- Maintain responsive design for proper PDF rendering
- Test PDF output after any changes

## Error Handling

### Common Issues and Solutions

**Issue**: PDF generation fails
- **Solution**: Check Puppeteer installation and browser dependencies
- **Command**: `npm install puppeteer` or use system Chrome

**Issue**: Missing data in PDF
- **Solution**: Ensure all required Form C fields are filled during check-in
- **Check**: Database migration has been applied

**Issue**: Template not found
- **Solution**: Verify template path in `form-c-generator.ts`
- **Path**: `backend/guest-checkin/templates/form-c-template.html`

**Issue**: Invalid date formats
- **Solution**: Check `formatDateForFormC` helper function
- **Format**: Expected DD/MM/YYYY

## Testing

### Manual Testing Steps

1. **Create Foreign Guest Check-In**:
   ```
   - Fill all personal information
   - Upload passport and visa documents
   - Complete Form C details tab
   - Submit check-in
   ```

2. **Generate Form C**:
   ```
   - Go to Guest Details tab
   - Find the foreign guest entry
   - Click menu ⋮ → "C-Form ready"
   - Verify PDF downloads
   ```

3. **Verify PDF Content**:
   ```
   - Open downloaded PDF
   - Check all sections are filled
   - Verify formatting is correct
   - Confirm dates are in DD/MM/YYYY format
   ```

### Sample Test Data

See `form-c-types.ts` for `sampleFormCData` with complete test data.

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only generate PDFs for their organization's guests
3. **Data Validation**: Input validation on both frontend and backend
4. **No Persistent Storage**: PDFs generated on-demand, not stored
5. **HTTPS Only**: All API calls should use HTTPS in production

## Performance

- **PDF Generation Time**: ~2-3 seconds per document
- **Concurrent Requests**: Supports multiple simultaneous generations
- **Memory Usage**: Puppeteer launches headless Chrome (~50MB per instance)
- **Optimization**: Consider using a PDF generation service for high-volume scenarios

## Compliance

This feature helps properties comply with:
- **Foreigners Act, 1946**
- **Foreigners Order, 1948**
- **FRRO Registration Requirements**

**Note**: Generated PDFs are for reference. Official submission must be done through the FRRO online portal or physically at the FRRO office.

## Future Enhancements

- [ ] Auto-submit to FRRO portal API (when available)
- [ ] Batch PDF generation for multiple guests
- [ ] Email PDF directly to FRRO office
- [ ] QR code integration for digital verification
- [ ] Multi-language support for forms
- [ ] Template selection (different states may have variations)
- [ ] Signature capture integration
- [ ] Automatic reminder for 24-hour submission deadline

## Support

For issues or questions:
1. Check error logs in Encore dashboard
2. Review database migration status
3. Verify Puppeteer installation
4. Ensure all Form C fields are properly saved

## License

This feature is part of the Hospitality Management Platform and follows the same license terms.

