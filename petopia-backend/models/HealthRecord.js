const mongoose = require('mongoose');

/**
 * Pet Health Record Schema
 *
 * Modeled after internationally recognized veterinary health record standards
 * including AAHA (American Animal Hospital Association) and WSAVA
 * (World Small Animal Veterinary Association) guidelines.
 */
const healthRecordSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Record Type Classification
    recordType: {
      type: String,
      required: [true, 'Record type is required'],
      enum: [
        'vaccination',
        'examination',
        'surgery',
        'laboratory',
        'prescription',
        'dental',
        'imaging',
        'emergency',
        'wellness',
        'deworming',
        'allergy',
        'other',
      ],
    },

    // -- Core Record Information --
    title: {
      type: String,
      required: [true, 'Record title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Record date is required'],
      default: Date.now,
    },

    // -- Veterinary Clinic / Provider Details --
    veterinarian: {
      name: { type: String, trim: true, default: '' },
      clinic: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      licenseNumber: { type: String, trim: true, default: '' },
    },

    // -- Vaccination-Specific Fields --
    vaccination: {
      vaccineName: { type: String, trim: true, default: '' },
      manufacturer: { type: String, trim: true, default: '' },
      lotNumber: { type: String, trim: true, default: '' },
      serialNumber: { type: String, trim: true, default: '' },
      dosage: { type: String, trim: true, default: '' },
      route: {
        type: String,
        enum: [
          'subcutaneous',
          'intramuscular',
          'intranasal',
          'oral',
          'other',
          '',
        ],
        default: '',
      },
      site: { type: String, trim: true, default: '' }, // e.g., "Right hind leg"
      nextDueDate: { type: Date, default: null },
      isBooster: { type: Boolean, default: false },
    },

    // -- Examination / Wellness Fields --
    examination: {
      weight: { type: Number, default: null }, // kg
      temperature: { type: Number, default: null }, // Celsius
      heartRate: { type: Number, default: null }, // bpm
      respiratoryRate: { type: Number, default: null }, // breaths/min
      bodyConditionScore: { type: Number, min: 1, max: 9, default: null }, // 1-9 BCS
      findings: { type: String, default: '' },
      recommendations: { type: String, default: '' },
    },

    // -- Laboratory / Diagnostic Results --
    laboratory: {
      testName: { type: String, trim: true, default: '' },
      results: { type: String, default: '' },
      referenceRange: { type: String, default: '' },
      isAbnormal: { type: Boolean, default: false },
    },

    // -- Prescription / Medication --
    prescription: {
      medicationName: { type: String, trim: true, default: '' },
      dosage: { type: String, trim: true, default: '' },
      frequency: { type: String, trim: true, default: '' }, // e.g., "2x daily"
      duration: { type: String, trim: true, default: '' }, // e.g., "14 days"
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      refillsRemaining: { type: Number, default: 0 },
      instructions: { type: String, default: '' },
    },

    // -- Surgery Fields --
    surgery: {
      procedure: { type: String, trim: true, default: '' },
      anesthesia: { type: String, trim: true, default: '' },
      duration: { type: String, trim: true, default: '' }, // e.g., "45 minutes"
      complications: { type: String, default: '' },
      postOpInstructions: { type: String, default: '' },
      followUpDate: { type: Date, default: null },
    },

    // -- Attached Documents / Images --
    attachments: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        name: { type: String, default: 'Document' },
        type: {
          type: String,
          enum: ['image', 'pdf', 'other'],
          default: 'image',
        },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // -- Additional Notes --
    notes: {
      type: String,
      default: '',
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },

    // -- Follow-up --
    followUpDate: {
      type: Date,
      default: null,
    },
    followUpNotes: {
      type: String,
      default: '',
    },

    // -- Cost Tracking --
    cost: {
      amount: { type: Number, default: null },
      currency: { type: String, default: 'USD' },
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
healthRecordSchema.index({ pet: 1, date: -1 });
healthRecordSchema.index({ pet: 1, recordType: 1, date: -1 });

// Ensure virtuals are included in JSON
healthRecordSchema.set('toJSON', { virtuals: true });
healthRecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
