# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-08-guest-check-in/spec.md

## Technical Requirements

### Frontend Requirements

- **Framework**: React with TypeScript following existing project patterns
- **Styling**: Tailwind CSS with dark mode support using existing color system
- **UI Components**: Reusable shadcn/ui components (Card, Button, Input, Select, Badge, Tabs)
- **Responsive Design**: Mobile-first approach with breakpoints at sm (640px), md (768px), lg (1024px), xl (1280px)
- **State Management**: React hooks (useState, useEffect) with proper error handling
- **Form Validation**: Client-side validation for required fields, email format, phone numbers, ID proof formats
- **Loading States**: Card-based loading indicators with descriptive text
- **Error Handling**: Professional error cards with retry options

### Backend Requirements

- **Framework**: Encore.dev microservice architecture
- **Language**: TypeScript with strict type checking
- **Database**: PostgreSQL with Encore SQLDatabase
- **Authentication**: JWT-based auth using existing auth middleware
- **Authorization**: Role-based access control (RBAC) - guests can create their own check-ins, admin/manager/owner can view all
- **API Pattern**: RESTful endpoints following existing project conventions
- **Error Handling**: Proper APIError responses with meaningful messages
- **Logging**: Structured logging using encore.dev/log
- **Migrations**: SQL migration files for database schema changes

### UI/UX Specifications

- **Check-in Landing Page**:
  - Clean centered layout with welcome message
  - Two prominent buttons: "Indian Guest" and "Foreign Guest"
  - Admin access button at bottom with divider
  - Bottom navigation with Help and Terms & Conditions links
  - Primary color: #1173d4 (blue-600)
  - Background: Light gray (#f6f7f8) with dark mode support

- **Guest Check-in Form**:
  - Multi-step form with progress indicator
  - Fields grouped logically (Personal Info, Contact, ID Proof, Booking Details)
  - Indian Guest Fields: Name, Email, Phone, Aadhar/PAN, Address, Check-in Date, Property
  - Foreign Guest Fields: Name, Email, Phone, Passport Number, Country, Visa Type, Visa Expiry, Address, Check-in Date, Property
  - Form validation with inline error messages
  - Submit button with loading state
  - Success confirmation with check-in details

- **Admin Dashboard**:
  - Tabbed interface (All, Indian, Foreign, Recent, By Property)
  - Search and filter section at top
  - Guest cards displaying key information
  - Actions: View Details, Edit, Check-out, Export
  - Real-time updates using data refresh
  - Enhanced card design with border accents

### Integration Requirements

- **Authentication**: Use existing auth microservice for user authentication
- **Properties**: Integrate with properties microservice for property selection
- **File Upload**: Support document upload for ID proofs (optional enhancement)
- **Notifications**: Future integration with notification system for check-in confirmations

### Performance Criteria

- **Page Load**: Initial page load under 2 seconds
- **API Response**: All API calls under 500ms (excluding large data sets)
- **Database Queries**: Optimized queries with proper indexing
- **Concurrent Users**: Support for 100+ simultaneous check-ins
- **Data Validation**: Client and server-side validation for all inputs

### Security Requirements

- **Data Encryption**: Sensitive guest information encrypted at rest
- **Access Control**: Strict RBAC enforcement on all endpoints
- **Input Sanitization**: All user inputs sanitized to prevent SQL injection and XSS
- **Rate Limiting**: API rate limiting to prevent abuse
- **Audit Logging**: All check-in operations logged with user and timestamp
- **GDPR Compliance**: Guest data handling compliant with privacy regulations

## External Dependencies

No new external dependencies required. The implementation uses existing project dependencies:
- **React**: Frontend framework
- **Tailwind CSS**: Styling
- **Encore.dev**: Backend microservice framework
- **PostgreSQL**: Database
- **shadcn/ui**: UI component library (already in use)
