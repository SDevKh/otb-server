import mongoose from 'mongoose';
import realUser from './User.js';
import realAnalysis from './Analysis.js';

// Mock classes to wrap mockDB functions
class MockUser {
  static async findOne(query) {
    const userData = await global.mockDB.users.findOne(query);
    return userData ? new MockUser(userData) : null;
  }
  static async findById(id) {
    const userData = await global.mockDB.users.findOne({ _id: id });
    return userData ? new MockUser(userData) : null;
  }
  static async findByIdAndUpdate(id, update, options) {
    const updatedUserData = await global.mockDB.users.findByIdAndUpdate(id, update);
    return updatedUserData ? new MockUser(updatedUserData) : null;
  }
  constructor(data) {
    Object.assign(this, data);
  }
  async save() {
    if (!this._id) {
      const user = await global.mockDB.users.create(this);
      Object.assign(this, user);
    } else {
      const updatedUser = await global.mockDB.users.findByIdAndUpdate(this._id, this);
      Object.assign(this, updatedUser);
    }
  }
}

class MockAnalysis {
  static async find(query) {
    const analysesData = await global.mockDB.analyses.find(query);
    return analysesData.map(data => new MockAnalysis(data));
  }
  static async findOne(query) {
    const analysisData = await global.mockDB.analyses.findById(query._id);
    return analysisData ? new MockAnalysis(analysisData) : null;
  }
  static async findOneAndDelete(query) {
    const deletedAnalysis = await global.mockDB.analyses.findByIdAndDelete(query._id);
    return deletedAnalysis ? new MockAnalysis(deletedAnalysis) : null;
  }
  static async countDocuments(query) {
    const results = await global.mockDB.analyses.find(query);
    return results.length;
  }
  static async findById(id) {
    const analysisData = await global.mockDB.analyses.findById(id);
    return analysisData ? new MockAnalysis(analysisData) : null;
  }
  static async findByIdAndUpdate(id, update, options) {
    // Not implemented in mockDB, fallback to find and update manually
    const analysis = await global.mockDB.analyses.findById(id);
    if (analysis) {
      Object.assign(analysis, update);
      return analysis;
    }
    return null;
  }
  constructor(data) {
    Object.assign(this, data);
  }
  async save() {
    if (!this._id) {
      const analysis = await global.mockDB.analyses.create(this);
      Object.assign(this, analysis);
    } else {
      // No update method in mockDB, no-op
    }
  }
}

// Always use real MongoDB models for consistent behavior
const User = realUser;
const Analysis = realAnalysis;

// Log which models are being used
console.log('Using real MongoDB models for User and Analysis');

export { User, Analysis };
