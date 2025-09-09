# Spec Requirements Document

> Spec: Enhanced Staff Management System
> Created: 2025-09-05

## Overview

Implement a comprehensive staff management system with advanced features including attendance tracking, salary management, enhanced role-based permissions, and detailed reporting capabilities. This system will provide admins with complete control over staff operations while giving managers and staff members appropriate access to their own data and relevant functions.

## User Stories

### Admin Staff Management

As an Admin, I want to manage staff profiles with full CRUD operations, so that I can maintain accurate staff records and control access across properties.

**Detailed Workflow:**
- Add new staff members by selecting from existing users
- Assign staff to specific properties (HostelExp Varkala, etc.)
- Set department roles (Manager, Frontdesk, Accountant, etc.)
- Toggle active/inactive status for staff members
- Edit staff information including hourly rates and performance ratings
- Update my own profile details (name, email, password) while maintaining admin role
- Delete staff records when needed
- View comprehensive staff directory with filtering and search

### Admin Self-Management

As an Admin, I want to update my own profile information, so that I can maintain accurate personal details while keeping my administrative privileges.

**Detailed Workflow:**
- Update my display name and email address
- Change my password for security
- View my own profile information
- Cannot change my own role (prevents accidental privilege loss)
- Maintain admin access to all system functions

### Manager Limited Access

As a Manager, I want to view staff information for my assigned properties only, so that I can understand my team structure without accessing sensitive data.

**Detailed Workflow:**
- View staff members assigned to my properties
- See basic information (name, department, status)
- Request role/permission changes through admin approval
- Cannot add/remove staff but can view their schedules and leave requests
- Access to attendance and performance data for my team

### Admin Schedule Management

As an Admin, I want to create and manage work schedules for all staff, so that I can ensure proper coverage and resource allocation.

**Detailed Workflow:**
- Create weekly/monthly schedules for staff members
- Assign specific shifts with start/end times
- Set break periods and special notes
- Track shift completion status
- Handle shift change requests from staff
- Generate schedule reports and coverage analysis

### Staff Schedule Access

As a Staff Member, I want to view my schedule and manage my availability, so that I can plan my work and personal time effectively.

**Detailed Workflow:**
- View my assigned shifts and schedule
- Mark shift completion when finished
- Request shift changes with reasons
- View upcoming shifts and important dates
- Access schedule history and patterns

### Leave Request Management

As an Admin, I want to manage leave requests with approval workflows, so that I can maintain proper staffing levels while accommodating staff needs.

**Detailed Workflow:**
- Review pending leave requests with staff details
- Approve or reject requests with comments
- View leave history and patterns for each staff member
- Set leave policies and limits
- Generate leave reports and analytics

### Staff Leave Requests

As a Staff Member, I want to submit and track leave requests, so that I can plan time off and stay informed about approval status.

**Detailed Workflow:**
- Submit leave requests with dates and reasons
- Choose from different leave types (vacation, sick, personal, emergency)
- Track approval status in real-time
- View leave history and remaining balance
- Receive notifications about approval decisions

### Attendance Tracking

As an Admin, I want to monitor staff attendance and generate reports, so that I can ensure accountability and identify patterns.

**Detailed Workflow:**
- View daily login/attendance logs for all staff
- Track check-in/check-out times
- Identify late arrivals and early departures
- Generate attendance reports (Excel/PDF)
- Set attendance policies and alerts
- Monitor attendance patterns and trends

### Staff Attendance Management

As a Staff Member, I want to mark my attendance and view my history, so that I can maintain accurate time records.

**Detailed Workflow:**
- Check-in when starting work
- Check-out when finishing work
- View personal attendance history
- See attendance statistics and patterns
- Request attendance corrections if needed

### Salary Management

As an Admin, I want to manage staff salaries and generate payslips, so that I can handle payroll efficiently and transparently.

**Detailed Workflow:**
- Set base salary and variable components for each staff member
- Configure overtime rates and bonuses
- Generate monthly salary calculations based on attendance and leaves
- Create and distribute payslips (PDF)
- Export financial reports for accounting
- Handle salary adjustments and raises

### Staff Salary Access

As a Staff Member, I want to view my salary information and download payslips, so that I can track my earnings and maintain records.

**Detailed Workflow:**
- View current salary structure and components
- Access salary history and changes
- Download monthly payslips
- View salary breakdowns and deductions
- Track overtime and bonus payments

## Spec Scope

1. **Enhanced Staff CRUD Operations** - Complete staff profile management with role-based access control
2. **Admin Self-Management** - Allow admins to update their own profile details while preventing role changes
3. **Advanced Schedule Management** - Comprehensive scheduling system with shift tracking and change requests
4. **Leave Request System** - Full leave management with approval workflows and history tracking
5. **Attendance Tracking System** - Real-time attendance monitoring with check-in/check-out functionality
6. **Salary Management System** - Complete payroll management with payslip generation and reporting

## Out of Scope

- Integration with external payroll systems
- Advanced HR analytics and predictive modeling
- Mobile app development (web-responsive only)
- Biometric attendance systems
- Advanced reporting dashboards with charts
- Multi-language support
- Advanced notification systems beyond basic email

## Expected Deliverable

1. **Fully Functional Staff Management Interface** - Complete CRUD operations for staff with role-based permissions, accessible through responsive web interface
2. **Comprehensive Attendance System** - Real-time attendance tracking with check-in/check-out functionality, generating accurate time records and reports
3. **Complete Payroll Management** - Salary calculation, payslip generation, and financial reporting system integrated with attendance and leave data
4. **Stable Dashboard System** - Fixed internal errors and database schema issues to ensure reliable dashboard loading and real-time updates
5. **Complete Database Schema** - Applied all missing migrations to ensure expenses and revenues tables have all required columns for proper functionality
6. **Stable Authentication Flow** - Fixed logout modal issues and improved authentication state management to prevent stuck logout processes
