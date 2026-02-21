const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'appointment_booked', // user booked → notify vet
        'appointment_confirmed', // vet confirmed → notify user
        'appointment_cancelled', // either cancelled → notify other party
        'appointment_completed', // vet completed → notify user
        'appointment_reminder', // upcoming appointment reminder
        'new_follower', // someone followed you (public profile)
        'follow_request', // someone requested to follow you (private profile)
        'follow_request_accepted', // your follow request was accepted
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        default: null,
      },
      clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VetClinic',
        default: null,
      },
      petId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pet',
        default: null,
      },
      followRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FollowRequest',
        default: null,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Efficient queries: unread notifications for a user, sorted by newest
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
