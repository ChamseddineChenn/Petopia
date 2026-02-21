const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    // Whether each participant has accepted the conversation
    // If false → it's a message request
    isAccepted: {
      type: Map,
      of: Boolean,
      default: {},
    },
    // Track unread counts per participant
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    // If the conversation was started through a shop/clinic
    shopContext: {
      shopId: { type: mongoose.Schema.Types.ObjectId, default: null },
      shopType: {
        type: String,
        enum: ['clinic', 'groomer_shop', null],
        default: null,
      },
      shopName: { type: String, default: null },
      shopOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to quickly find conversations between two users
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
