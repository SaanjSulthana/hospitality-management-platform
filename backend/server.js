const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hospitality_user:hospitality_password@localhost:5432/hospitality_platform',
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Auth routes
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, orgName, subdomain } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // For now, just return success (you can implement database logic later)
    const user = {
      id: Date.now(),
      email,
      firstName,
      lastName,
      orgName,
      subdomain
    };
    
    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    res.json({
      user,
      token,
      refreshToken,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // For demo purposes, accept any email/password combination
    // In production, you'd verify against the database
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = {
      id: 1,
      email,
      firstName: 'Demo',
      lastName: 'User',
      role: 'admin'
    };
    
    const token = jwt.sign({ userId: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    
    res.json({
      user,
      token,
      refreshToken,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/auth/me', authenticateToken, (req, res) => {
  const user = {
    id: req.user.userId,
    email: req.user.email,
    firstName: 'Demo',
    lastName: 'User',
    role: 'admin'
  };
  res.json({ user });
});

// Dashboard routes
app.get('/analytics/overview', authenticateToken, (req, res) => {
  res.json({
    totalRevenue: 125000,
    totalBookings: 342,
    occupancyRate: 78.5,
    averageRating: 4.6,
    revenueGrowth: 12.5,
    bookingsGrowth: 8.3,
    occupancyGrowth: 5.2,
    ratingGrowth: 2.1
  });
});

// Tasks routes
app.get('/tasks/list', authenticateToken, (req, res) => {
  const mockTasks = [
    {
      id: 1,
      title: 'Clean Room 101',
      description: 'Deep cleaning required',
      status: 'pending',
      priority: 'high',
      assignedTo: 'John Doe',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      title: 'Maintenance Check',
      description: 'Monthly maintenance check for HVAC',
      status: 'in_progress',
      priority: 'medium',
      assignedTo: 'Jane Smith',
      dueDate: new Date(Date.now() + 172800000).toISOString(),
      createdAt: new Date().toISOString()
    }
  ];
  res.json({ tasks: mockTasks });
});

app.post('/tasks/create', authenticateToken, (req, res) => {
  const { title, description, priority, assignedTo, dueDate } = req.body;
  
  const newTask = {
    id: Date.now(),
    title,
    description,
    status: 'pending',
    priority,
    assignedTo,
    dueDate,
    createdAt: new Date().toISOString()
  };
  
  res.json({ task: newTask, message: 'Task created successfully' });
});

// Users routes
app.get('/users/list', authenticateToken, (req, res) => {
  const mockUsers = [
    {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'manager',
      status: 'active',
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'staff',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  ];
  res.json({ users: mockUsers });
});

// Properties routes
app.get('/properties/list', authenticateToken, (req, res) => {
  const mockProperties = [
    {
      id: 1,
      name: 'Grand Hotel Downtown',
      address: '123 Main St, City',
      rooms: 150,
      occupancyRate: 85.5,
      status: 'active'
    }
  ];
  res.json({ properties: mockProperties });
});

// Finance routes
app.get('/finance/revenues', authenticateToken, (req, res) => {
  const mockRevenues = [
    {
      id: 1,
      amount: 5000,
      source: 'Room Bookings',
      date: new Date().toISOString(),
      description: 'Daily room revenue'
    }
  ];
  res.json({ revenues: mockRevenues });
});

app.get('/finance/expenses', authenticateToken, (req, res) => {
  const mockExpenses = [
    {
      id: 1,
      amount: 1200,
      category: 'Maintenance',
      date: new Date().toISOString(),
      description: 'HVAC repair'
    }
  ];
  res.json({ expenses: mockExpenses });
});

// Staff routes
app.get('/staff/list', authenticateToken, (req, res) => {
  const mockStaff = [
    {
      id: 1,
      firstName: 'Alice',
      lastName: 'Johnson',
      position: 'Housekeeper',
      department: 'Housekeeping',
      status: 'active',
      schedule: 'Morning Shift'
    }
  ];
  res.json({ staff: mockStaff });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
