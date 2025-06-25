import mongoose from 'mongoose';

const personalityAnalysisSchema = new mongoose.Schema({
  personalityType: String,
  description: String,
  strengths: [String],
  challenges: [String],
  workingStyle: String,
  motivationDrivers: [String]
});

const successStrategySchema = new mongoose.Schema({
  productivityMethod: String,
  dailyRoutine: String,
  learningApproach: [String],
  habitFormation: [String],
  motivationTechniques: [String],
  focusStrategies: [String],
  pressureManagement: [String],
  goalAchievementPlan: [String],
  weeklyBlueprint: {
    week1: [String],
    week2: [String],
    week3: [String],
    week4: [String]
  },
  bonusTips: [String]
});

const questionnaireDataSchema = new mongoose.Schema({
  personality: {
    energy: {
      type: String,
      enum: ['introvert', 'extrovert', 'ambivert'],
      required: true
    },
    planning: {
      type: String,
      enum: ['planner', 'flexible', 'mixed'],
      required: true
    }
  },
  learningStyle: {
    type: String,
    enum: ['visual', 'auditory', 'kinesthetic', 'reading'],
    required: true
  },
  energyPattern: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true
  },
  pressureHandling: {
    type: String,
    enum: ['thrive', 'shutdown', 'balance', 'avoid'],
    required: true
  },
  focusBreakers: [String],
  struggles: [String],
  goals: {
    type: String,
    required: true
  }
});

const analysisSchema = new mongoose.Schema({
  userId: {
    type: String,  // Changed from ObjectId to String for compatibility
    ref: 'User',
    required: true
  },
  questionnaireData: {
    type: questionnaireDataSchema,
    required: true
  },
  personalityAnalysis: {
    type: personalityAnalysisSchema,
    required: true
  },
  successStrategy: {
    type: successStrategySchema,
    required: true
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  aiProvider: {
    type: String,
    enum: ['pica-ai', 'fallback'],
    default: 'fallback'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
analysisSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Analysis', analysisSchema);