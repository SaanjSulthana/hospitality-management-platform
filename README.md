# White-Label Multi-Tenant Hospitality Management Platform

A comprehensive hospitality management platform built with Encore.ts and React, designed for hotels, hostels, resorts, and vacation rentals.

## Features

### 🏢 Multi-Tenancy & White-Labeling
- Organization-scoped data isolation
- Custom branding per organization (logo, colors, brand name)
- Subdomain-based tenant routing
- Role-based access control (RBAC)

### 👥 User Management & Roles
- **ADMIN**: Full organizational control
- **MANAGER**: Property and operations management

### 🏨 Property Management
- Multi-property support (hotels, hostels, resorts, apartments)
- Room and unit management
- Occupancy tracking and analytics
- Capacity management

### ✅ Operations Management
- Task management with priorities and assignments
- Staff scheduling and department organization
- Approval workflows (leave, expenses, tasks)
- Real-time notifications

### 📊 Analytics & Reporting
- Occupancy rates and RevPAR calculations
- Financial tracking (revenue, expenses, profit margins)
- Task completion metrics
- Staff utilization analytics
- Role-based dashboard views

### 🔐 Authentication & Security
- JWT-based authentication (15min access, 7-day refresh)
- Secure password hashing with bcrypt
- Session management
- Tenant isolation enforcement

### 🤖 Automation
- Night audit cron jobs for revenue finalization
- Task reminder notifications
- OTA sync placeholders for future integrations

## Tech Stack

### Backend (Encore.ts)
- **Framework**: Encore.ts with TypeScript
- **Database**: PostgreSQL with row-level tenancy
- **Authentication**: JWT with refresh tokens
- **Cron Jobs**: Automated night audit and reminders
- **API**: RESTful endpoints with type-safe schemas

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query for server state
- **UI Components**: shadcn/ui with Tailwind CSS
- **Styling**: Tailwind CSS v4 with custom theming

## Getting Started

### Prerequisites
- Node.js 18+ and Bun
- Encore CLI installed
- PostgreSQL database

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd hospitality-platform
```

2. **Install dependencies**
```bash
bun install
```

3. **Set up environment secrets**
Configure the following secrets in your Encore dashboard or locally:
```
JWTSecret=your-jwt-secret-key
RefreshSecret=your-refresh-secret-key
```

4. **Run database migrations**
```bash
encore db migrate
```

5. **Seed demo data**
```bash
# Start the backend
encore run

# In another terminal, seed the database
curl -X POST http://localhost:4000/seed/data
```

6. **Start the development server**
```bash
# Backend
encore run

# Frontend (in another terminal)
cd frontend && bun run dev
```

### Demo Credentials

After seeding the database, you can log in with:
- **Email**: admin@example.com
- **Password**: password123
- **Role**: Administrator

Additional demo users:
- manager@example.com (Manager)
- property@example.com (Property Manager)
- dept@example.com (Department Head)
- staff1@example.com (Front Desk Staff)
- staff2@example.com (Housekeeping Staff)

All demo accounts use the password: **password123**

## API Documentation

### Authentication Endpoints
- `POST /auth/signup` - Create new user/organization
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Invalidate session
- `GET /auth/me` - Get current user info

### Core Endpoints
- `GET /properties` - List properties (role-filtered)
- `POST /properties` - Create new property
- `GET /properties/:id/occupancy` - Get occupancy data
- `GET /tasks` - List tasks (role-filtered)
- `POST /tasks` - Create new task
- `PATCH /tasks/:id/status` - Update task status
- `GET /analytics/overview` - Get analytics data
- `GET /users` - List organization users
- `POST /users` - Create new user

### Branding Endpoints
- `GET /branding/theme` - Get organization theme
- `PATCH /branding/theme` - Update organization theme

## Database Schema

### Core Tables
- `organizations` - Tenant organizations with branding
- `users` - User accounts with roles and org association
- `properties` - Hotels, hostels, resorts, apartments
- `rooms` - Individual rooms within properties
- `beds_or_units` - Bookable units with availability status
- `bookings` - Guest reservations and check-ins
- `tasks` - Operational tasks with assignments
- `staff` - Staff records with department assignments

### Supporting Tables
- `sessions` - JWT refresh token storage
- `regions` - Geographic regions for properties
- `guests` - Guest contact information
- `revenues` - Revenue tracking by property
- `expenses` - Expense tracking by property
- `notifications` - User notifications
- `approvals` - Workflow approvals

## Role-Based Access Control

### Permission Matrix
| Feature | Admin | Manager |
|---------|-------|---------|
| Org Settings | ✅ | ❌ |
| User Management | ✅ | ❌ |
| Property CRUD | ✅ | ✅ |
| Task Management | ✅ | ✅ |
| Analytics | All Data | Limited |
| Bookings | ✅ | ✅ |

## Deployment

### Production Secrets
Set the following secrets for production:
```
JWTSecret=<strong-jwt-secret>
RefreshSecret=<strong-refresh-secret>
```

### Optional Integrations
For enhanced functionality, configure:
```
# Email (choose one)
SendGridApiKey=<sendgrid-key>
# OR
SMTPHost=<smtp-host>
SMTPPort=<smtp-port>
SMTPUser=<smtp-user>
SMTPPassword=<smtp-password>
FromEmail=<from-email>
FromName=<from-name>

# File Storage (optional)
AWSRegion=<aws-region>
AWSAccessKeyId=<aws-access-key>
AWSSecretAccessKey=<aws-secret-key>
```

## Testing

Run the test suite:
```bash
# Backend tests
encore test

# Frontend tests
cd frontend && bun test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the demo data and examples

## Roadmap

### Upcoming Features
- [ ] Real-time WebSocket notifications
- [ ] Advanced reporting and dashboards
- [ ] Mobile app for staff
- [ ] OTA integrations (Booking.com, Airbnb)
- [ ] Payment processing (Stripe)
- [ ] Inventory management
- [ ] Guest communication portal
- [ ] Advanced workflow automation
- [ ] Multi-language support
- [ ] API rate limiting and monitoring
