const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VetClinic',
      required: true,
    },
    vet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    // Appointment timing
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    timeSlot: {
      start: {
        type: String, // "09:00"
        required: true,
      },
      end: {
        type: String, // "09:30"
        required: true,
      },
    },
    // What service is being booked
    service: {
      name: { type: String, required: true },
      duration: { type: Number, default: 30 },
      price: { type: Number, default: null },
    },
    // Status flow: pending → confirmed → completed
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
      default: 'pending',
    },
    // Reason for visit
    reason: {
      type: String,
      default: '',
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    // Notes (from vet after visit)
    notes: {
      type: String,
      default: '',
    },
    // Cancellation
    cancelledBy: {
      type: String,
      enum: ['user', 'vet', null],
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Prevent double-booking: unique clinic + date + timeSlot.start
appointmentSchema.index(
  { clinic: 1, date: 1, 'timeSlot.start': 1 },
  { unique: true },
);
// User's appointments
appointmentSchema.index({ user: 1, date: -1 });
// Vet's appointments
appointmentSchema.index({ vet: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
