// server/models/User.js (or wherever your User model is defined)
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true  // This creates the index automatically
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  personalityAnalysis: {
    type: Object,
    default: null
  },
  successStrategy: {
    type: Object,
    default: null
  }
}, {
  timestamps: true
});

// DON'T add this line if you have unique: true above
// userSchema.index({ email: 1 }); // REMOVE THIS LINE

const User = mongoose.model('User', userSchema);

export default User;