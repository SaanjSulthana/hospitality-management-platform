# Spec Requirements Document

> Spec: Guest Check-in Microservice
> Created: 2025-10-08

## Overview

Implement a comprehensive guest check-in system that allows both Indian and foreign guests to self-check-in at hospitality properties, while providing administrators with a centralized view of all guest details. This feature will streamline the check-in process, reduce front desk workload, and provide real-time guest management capabilities.

## User Stories

### Self-Service Guest Check-in

As a guest arriving at a hospitality property, I want to complete my check-in independently through a user-friendly interface, so that I can quickly access my accommodation without waiting at the front desk.

The guest opens the check-in interface, selects their guest type (Indian or Foreign), enters their personal details (name, contact, ID proof), booking information, and confirms their check-in. The system validates the information, creates a guest record, and provides a confirmation with room details.

### Admin Guest Management

As a property administrator, I want to view and manage all guest check-ins in real-time, so that I can maintain accurate occupancy records and handle any check-in issues promptly.

The admin accesses the "Guest Details for Admin" section, views a comprehensive list of all checked-in guests filtered by property, date range, and status. They can view detailed guest information, verify documents, modify check-in details, and mark check-outs.

### Guest Type Differentiation

As a system user, I want to provide different check-in flows for Indian and foreign guests, so that I can collect the appropriate identification and compliance information required by local regulations.

The system presents tailored forms based on guest nationality - Indian guests provide Aadhar/PAN details while foreign guests provide passport information, visa details, and country of origin. The system validates and stores this information according to regulatory requirements.

## Spec Scope

1. **Guest Check-in Interface** - Self-service check-in portal with guest type selection and form submission
2. **Guest Type Forms** - Separate optimized forms for Indian and foreign guests with appropriate ID fields
3. **Admin Dashboard** - Comprehensive view of all guest check-ins with search, filter, and management capabilities
4. **Database Schema** - Complete guest information storage with support for different document types
5. **API Endpoints** - RESTful APIs for guest check-in creation, retrieval, update, and deletion

## Out of Scope

- Payment processing integration (handled by existing finance microservice)
- Room assignment automation (manual assignment by staff)
- Biometric verification
- Mobile app native implementation (responsive web only)
- Third-party booking platform integration

## Expected Deliverable

1. Functional guest check-in interface accessible via browser with both Indian and foreign guest flows
2. Admin dashboard displaying all guest check-ins with filtering and management capabilities
3. Complete API endpoints for guest check-in operations integrated with authentication middleware
