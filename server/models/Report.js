const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reason: {
    type: String,
    enum: ['Nudity/Sexual content', 'Harassment', 'Underage user', 'Spam', 'Hate speech', 'Other'],
    required: true,
  },
  description: {
    type: String,
  },
  chatSessionId: {
    type: String,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
