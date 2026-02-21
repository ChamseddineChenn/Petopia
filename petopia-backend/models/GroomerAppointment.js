const mongoose = require('mongoose');

const groomerAppointmentSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroomerShop',
      required: true,
    },
    groomer: {
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
        type: String,
        required: true,
      },
      end: {
        type: String,
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
    // Notes
    reason: {
      type: String,
      default: '',
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    notes: {
      type: String,
      default: '',
    },
    // Cancellation
    cancelledBy: {
      type: String,
      enum: ['user', 'groomer', null],
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

// Prevent double-booking: unique shop + date + timeSlot.start
groomerAppointmentSchema.index(
  { shop: 1, date: 1, 'timeSlot.start': 1 },
  { unique: true },
);
// User's appointments
groomerAppointmentSchema.index({ user: 1, date: -1 });
// Groomer's appointments
groomerAppointmentSchema.index({ groomer: 1, date: 1 });

module.exports = mongoose.model('GroomerAppointment', groomerAppointmentSchema);
