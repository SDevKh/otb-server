import express from 'express';
import mongoose from 'mongoose';
// No need to import Analysis model as we're using direct MongoDB operations
// Force mongoose to use native promises
mongoose.Promise = global.Promise;
import { authenticateToken } from '../middleware/auth.js';
import { generateAIPersonalityAnalysis, generateAISuccessStrategy } from '../services/aiService.js';

// Debug middleware to log request details
const logRequest = (req, res, next) => {
  console.log('Request path:', req.path);
  console.log('Auth user:', req.user);
  console.log('MongoDB connection state:', mongoose.connection.readyState);
  next();
};

const router = express.Router();

// Generate personality analysis only
router.post('/generate-personality', authenticateToken, async (req, res) => {
  try {
    const { data } = req.body;
    const userId = req.user.userId;

    if (!data) {
      return res.status(400).json({ error: 'Questionnaire data is required' });
    }

    console.log('🤖 Starting AI personality analysis generation...');

    // Generate AI personality analysis
    const personalityAnalysis = await generateAIPersonalityAnalysis(data);
    console.log('✅ Personality analysis generated');

    res.json({
      success: true,
      data: personalityAnalysis
    });
  } catch (error) {
    console.error('Personality analysis generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate personality analysis',
      message: error.message 
    });
  }
});

// Generate success strategy only
router.post('/generate-strategy', authenticateToken, async (req, res) => {
  try {
    const { data } = req.body;
    const userId = req.user.userId;

    if (!data || !data.questionnaireData || !data.personalityAnalysis) {
      return res.status(400).json({ error: 'Questionnaire data and personality analysis are required' });
    }

    console.log('🎯 Generating success strategy...');

    // Generate success strategy using fallback data
    const successStrategy = await generateAISuccessStrategy(data.questionnaireData, data.personalityAnalysis);
    console.log('✅ Success strategy generated');

    res.json({
      success: true,
      data: successStrategy
    });
  } catch (error) {
    console.error('Success strategy generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate success strategy',
      message: error.message 
    });
  }
});

// Generate complete analysis (both personality and strategy)
router.post('/generate', authenticateToken, logRequest, async (req, res) => {
  try {
    const { questionnaireData } = req.body;
    const userId = req.user.userId;

    console.log('Received analysis generation request for user:', userId);
    
    if (!questionnaireData) {
      return res.status(400).json({ error: 'Questionnaire data is required' });
    }
    
    // Validate userId
    if (!userId) {
      console.error('Missing userId in request');
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('🤖 Starting analysis generation...');

    // Generate personality analysis using fallback data
    const personalityAnalysis = await generateAIPersonalityAnalysis(questionnaireData);
    console.log('✅ Personality analysis generated');
    
    // Generate success strategy using fallback data
    const successStrategy = await generateAISuccessStrategy(questionnaireData, personalityAnalysis);
    console.log('✅ Success strategy generated');

    // Save directly to MongoDB collection
    let savedAnalysis;
    try {
      console.log('MongoDB connection state:', mongoose.connection.readyState);
      console.log('Attempting to save analysis to database for user:', userId);
      
      if (!userId) {
        console.error('No userId provided, cannot save analysis');
        return res.status(400).json({ error: 'User ID is required to save analysis' });
      }
      
      // Create analysis document
      const analysisData = {
        userId: userId,
        questionnaireData: questionnaireData,
        personalityAnalysis: personalityAnalysis,
        successStrategy: successStrategy,
        aiGenerated: true,
        aiProvider: 'pica-ai',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert directly into MongoDB collection
      const result = await mongoose.connection.db.collection('analyses').insertOne(analysisData);
      
      console.log('✅ Analysis saved to database with ID:', result.insertedId);
      
      // Set the saved analysis with ID for response
      savedAnalysis = {
        ...analysisData,
        _id: result.insertedId
      };
      
    } catch (saveError) {
      console.error('Error saving analysis:', saveError);
      console.error('Error details:', JSON.stringify(saveError, null, 2));
      throw new Error('Failed to save analysis to database: ' + saveError.message);
    }

    res.json({
      success: true,
      data: {
        id: savedAnalysis._id,
        personalityAnalysis,
        successStrategy,
        createdAt: savedAnalysis.createdAt
      }
    });
  } catch (error) {
    console.error('Analysis generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate analysis',
      message: error.message 
    });
  }
});

// Get user's analysis history
router.get('/history', authenticateToken, logRequest, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log('Fetching analysis history for user:', userId);
    console.log('MongoDB connection state:', mongoose.connection.readyState);

    // Use direct MongoDB operations
    const collection = mongoose.connection.db.collection('analyses');
    
    // Find analyses for this user
    const analyses = await collection.find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
      
    console.log(`Found ${analyses.length} analyses for user ${userId}`);
    
    // Count total documents
    const total = await collection.countDocuments({ userId: userId });

    res.json({
      success: true,
      data: {
        analyses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Analysis history error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis history' });
  }
});

// Get specific analysis
router.get('/:id', authenticateToken, logRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Use direct MongoDB operations
    const analysis = await mongoose.connection.db.collection('analyses')
      .findOne({ _id: new mongoose.Types.ObjectId(id), userId: userId });
    
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// Delete analysis
router.delete('/:id', authenticateToken, logRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Use direct MongoDB operations
    const result = await mongoose.connection.db.collection('analyses')
      .deleteOne({ _id: new mongoose.Types.ObjectId(id), userId: userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error) {
    console.error('Delete analysis error:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

export default router;