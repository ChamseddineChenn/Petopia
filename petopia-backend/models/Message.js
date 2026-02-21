const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    // Message delivery status
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent',
    },
    // When recipient(s) received the message on their device
    deliveredAt: {
      type: Date,
      default: null,
    },
    // When recipient(s) actually saw/opened the message
    seenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for fetching messages in a conversation (most recent first)
messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
