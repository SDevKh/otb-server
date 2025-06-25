import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import routes
import authRoutes from './routes/auth.js';
import analysisRoutes from './routes/analysis.js';
import userRoutes from './routes/users.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory storage for development (replace with MongoDB when available)
const users = new Map();
const analyses = new Map();

// Mock database functions
const mockDB = {
  users: {
    findOne: (query) => {
      if (query.email) {
        for (const [id, user] of users.entries()) {
          if (user.email === query.email) {
            return Promise.resolve({ ...user, _id: id });
          }
        }
      }
      if (query._id) {
        const user = users.get(query._id);
        return Promise.resolve(user ? { ...user, _id: query._id } : null);
      }
      return Promise.resolve(null);
    },
    create: (userData) => {
      const id = Date.now().toString();
      const user = { ...userData, _id: id, createdAt: new Date() };
      users.set(id, user);
      return Promise.resolve(user);
    },
    findByIdAndUpdate: (id, update) => {
      const user = users.get(id);
      if (user) {
        const updatedUser = { ...user, ...update, updatedAt: new Date() };
        users.set(id, updatedUser);
        return Promise.resolve(updatedUser);
      }
      return Promise.resolve(null);
    }
  },
  analyses: {
    create: (analysisData) => {
      const id = Date.now().toString();
      const analysis = { ...analysisData, _id: id, createdAt: new Date() };
      analyses.set(id, analysis);
      return Promise.resolve(analysis);
    },
    find: (query) => {
      const results = [];
      for (const [id, analysis] of analyses.entries()) {
        if (!query.userId || analysis.userId === query.userId) {
          results.push({ ...analysis, _id: id });
        }
      }
      return Promise.resolve(results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    },
    findById: (id) => {
      const analysis = analyses.get(id);
      return Promise.resolve(analysis ? { ...analysis, _id: id } : null);
    },
    findByIdAndDelete: (id) => {
      const analysis = analyses.get(id);
      if (analysis) {
        analyses.delete(id);
        return Promise.resolve({ ...analysis, _id: id });
      }
      return Promise.resolve(null);
    }
  }
};

// Always use real MongoDB
console.log('Using real MongoDB database only');
global.useRealDB = true;

// MongoDB Connection
const connectDB = async () => {
try {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/personality-app';
  console.log("Connecting to MongoDB:", mongoURI);
  
  await mongoose.connect(mongoURI);
  
  console.log('✅ MongoDB connected successfully to:', mongoose.connection.name);
  global.useRealDB = true;
  
  // Test the connection by checking if we can list collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(`Available collections: ${collections.map(c => c.name).join(', ')}`);
  
} catch (error) {
  console.error('❌ MongoDB connection error:', error.message);
  console.error('Please check your MongoDB connection string and ensure MongoDB is running');
  console.error('Error details:', error);
  
  // Set to true anyway to force using real MongoDB models
  global.useRealDB = true;
  
  // Exit the application if MongoDB connection fails
  process.exit(1);
}
};

// Connect to database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Personality Success App API is running',
    database: global.useRealDB ? 'MongoDB' : 'In-Memory (Development)',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💾 Database: ${global.useRealDB ? 'MongoDB' : 'In-Memory (Development)'}`);
});