const express = require('express');
const Appointment = require('../models/Appointment');
const VetClinic = require('../models/VetClinic');
const Pet = require('../models/Pet');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { sendToUser, broadcastSlotUpdate } = require('../socket');
const { calculateCommission } = require('../services/stripeService');

const router = express.Router();

// ========================================
// HELPER: Generate available time slots for a given date
// ========================================
function generateTimeSlots(workingHours, duration, date) {
  const dayName = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][date.getDay()];

  const dayHours = workingHours.find((wh) => wh.day === dayName);
  if (!dayHours || !dayHours.isOpen) return [];

  const slots = [];
  const [openH, openM] = dayHours.openTime.split(':').map(Number);
  const [closeH, closeM] = dayHours.closeTime.split(':').map(Number);

  let breakStartMin = null;
  let breakEndMin = null;
  if (dayHours.breakStart && dayHours.breakEnd) {
    const [bsH, bsM] = dayHours.breakStart.split(':').map(Number);
    const [beH, beM] = dayHours.breakEnd.split(':').map(Number);
    breakStartMin = bsH * 60 + bsM;
    breakEndMin = beH * 60 + beM;
  }

  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;

  for (let t = openMin; t + duration <= closeMin; t += duration) {
    // Skip break time
    if (
      breakStartMin !== null &&
      breakEndMin !== null &&
      t < breakEndMin &&
      t + duration > breakStartMin
    ) {
      continue;
    }

    const startH = Math.floor(t / 60)
      .toString()
      .padStart(2, '0');
    const startM = (t % 60).toString().padStart(2, '0');
    const endT = t + duration;
    const endH = Math.floor(endT / 60)
      .toString()
      .padStart(2, '0');
    const endM = (endT % 60).toString().padStart(2, '0');

    slots.push({
      start: `${startH}:${startM}`,
      end: `${endH}:${endM}`,
    });
  }

  return slots;
}

// ========================================
// GET /api/appointments/slots/:clinicId â€” Available slots for a date
// ========================================
router.get('/slots/:clinicId', protect, async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: 'Date is required (YYYY-MM-DD)' });
    }

    const clinic = await VetClinic.findById(req.params.clinicId);
    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    const targetDate = new Date(date + 'T00:00:00.000Z');
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all possible slots
    const allSlots = generateTimeSlots(
      clinic.workingHours,
      clinic.appointmentDuration,
      targetDate,
    );

    // Get already booked slots
    const booked = await Appointment.find({
      clinic: req.params.clinicId,
      date: { $gte: targetDate, $lt: nextDay },
      status: { $in: ['pending', 'confirmed'] },
    }).select('timeSlot');

    const bookedStarts = new Set(booked.map((a) => a.timeSlot.start));

    // Filter out booked slots
    const available = allSlots.map((slot) => ({
      ...slot,
      available: !bookedStarts.has(slot.start),
    }));

    res.json({
      success: true,
      date,
      clinicName: clinic.clinicName,
      appointmentDuration: clinic.appointmentDuration,
      slots: available,
    });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// POST /api/appointments â€” Book an appointment
// ========================================
router.post('/', protect, async (req, res) => {
  let deductedPrice = 0;
  try {
    const { clinicId, petId, date, timeSlot, serviceName, reason } = req.body;

    if (!clinicId || !petId || !date || !timeSlot?.start || !serviceName) {
      return res.status(400).json({
        success: false,
        message:
          'clinicId, petId, date, timeSlot, and serviceName are required',
      });
    }

    const clinic = await VetClinic.findById(clinicId);
    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    // Can't book own clinic
    if (clinic.owner.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book an appointment at your own clinic',
      });
    }

    // Verify pet ownership â€” user can only book for their own pets
    const Pet = require('../models/Pet');
    const pet = await Pet.findById(petId);
    if (!pet || pet.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to book for this pet',
      });
    }

    // Find the service in clinic's service list
    const clinicService = clinic.services.find(
      (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
    );

    const appointmentDate = new Date(date + 'T00:00:00.000Z');

    // Check if slot is still available
    const existing = await Appointment.findOne({
      clinic: clinicId,
      date: appointmentDate,
      'timeSlot.start': timeSlot.start,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'This time slot is already booked' });
    }

    // ── Pet Dollar reservation (funds held until vet accepts/declines) ──
    const servicePrice = clinicService?.price;
    if (!servicePrice || servicePrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This service does not have a valid price. Cannot book.',
      });
    }

    const price = Math.round(servicePrice * 100) / 100;

    // Check buyer balance
    const buyer = await User.findById(req.user.id).select('petDollars');
    if (!buyer || buyer.petDollars < price) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Pet Dollars. You have P$${(buyer?.petDollars || 0).toFixed(2)} but need P$${price.toFixed(2)}`,
        balance: buyer?.petDollars || 0,
      });
    }

    // Atomic deduct from buyer (reserve funds)
    const updatedBuyer = await User.findOneAndUpdate(
      { _id: req.user.id, petDollars: { $gte: price } },
      { $inc: { petDollars: -price } },
      { new: true, select: 'petDollars' },
    );
    if (!updatedBuyer) {
      return res.status(400).json({
        success: false,
        message:
          'Insufficient balance or concurrent transaction. Please try again.',
      });
    }
    deductedPrice = price;

    const appointment = await Appointment.create({
      clinic: clinicId,
      vet: clinic.owner,
      user: req.user.id,
      pet: petId,
      date: appointmentDate,
      timeSlot,
      service: {
        name: serviceName,
        duration: clinicService?.duration || clinic.appointmentDuration,
        price: clinicService?.price || null,
      },
      reason: reason || '',
      status: 'pending',
    });

    // Record reservation transaction (funds held, not yet transferred to vet)
    await WalletTransaction.create({
      user: req.user.id,
      type: 'reservation',
      amount: -price,
      balanceAfter: updatedBuyer.petDollars,
      description: `Reserved P$${price.toFixed(2)} for vet appointment — ${serviceName} at ${clinic.clinicName}`,
      reference: {
        entityType: 'vet_appointment',
        entityId: appointment._id,
      },
      commission: {
        rate: 0.07,
        platformAmount: null, // calculated upon acceptance
        sellerAmount: null,
        sellerId: clinic.owner,
      },
      status: 'pending',
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('clinic', 'clinicName phone address')
      .populate('pet', 'name species breed')
      .populate('user', 'name profileImage')
      .populate('vet', 'name profileImage');

    // --- Send real-time notification to the vet ---
    try {
      const booker = await User.findById(req.user.id).select('name');
      const pet = await Pet.findById(petId).select('name species');
      const dateStr = new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const notification = await Notification.create({
        recipient: clinic.owner,
        sender: req.user.id,
        type: 'appointment_booked',
        title: 'New Appointment Request',
        body: `${booker?.name || 'A user'} booked ${pet?.name || 'a pet'} for ${serviceName} on ${dateStr} at ${timeSlot.start}`,
        data: {
          appointmentId: appointment._id,
          clinicId: clinic._id,
          petId,
        },
      });

      sendToUser(clinic.owner.toString(), 'notification', {
        ...notification.toObject(),
        sender: { _id: req.user.id, name: booker?.name },
      });

      // Broadcast slot taken to anyone watching this clinic+date
      broadcastSlotUpdate(clinicId, date, {
        timeSlot,
        status: 'booked',
      });
    } catch (notifErr) {
      console.error('Notification send error (non-blocking):', notifErr);
    }

    res.status(201).json({ success: true, appointment: populated });
  } catch (error) {
    console.error('Book appointment error:', error);

    // Rollback P$ if balance was deducted but booking failed
    if (deductedPrice > 0) {
      try {
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { petDollars: deductedPrice },
        });
        console.log('Rolled back P$ reservation after booking error');
      } catch (rollbackErr) {
        console.error(
          'CRITICAL: Failed to rollback P$ reservation:',
          rollbackErr,
        );
      }
    }

    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: 'This time slot is already booked' });
    }
    res.status(500).json({
      success: false,
      message: 'Server error. Your balance has been restored.',
    });
  }
});

// ========================================
// GET /api/appointments/my â€” User's appointments
// ========================================
router.get('/my', protect, async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    const filter = { user: req.user.id };

    if (typeof status === 'string') {
      filter.status = status;
    }

    if (upcoming === 'true') {
      filter.date = { $gte: new Date() };
      filter.status = { $in: ['pending', 'confirmed'] };
    }

    const appointments = await Appointment.find(filter)
      .populate('clinic', 'clinicName phone address logo')
      .populate('pet', 'name species breed profileImage')
      .populate('vet', 'name profileImage')
      .sort({ date: 1, 'timeSlot.start': 1 })
      .lean();

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('Get my appointments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/appointments/vet â€” Vet's appointments
// ========================================
router.get('/vet', protect, async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = { vet: req.user.id };

    if (date) {
      const targetDate = new Date(date + 'T00:00:00.000Z');
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: targetDate, $lt: nextDay };
    }

    if (typeof status === 'string') {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('clinic', 'clinicName')
      .populate('pet', 'name species breed profileImage')
      .populate('user', 'name profileImage phone')
      .sort({ date: 1, 'timeSlot.start': 1 })
      .lean();

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('Get vet appointments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PUT /api/appointments/:id/status â€” Update status
// ========================================
router.put('/:id/status', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: 'Appointment not found' });
    }

    const isVet = appointment.vet.toString() === req.user.id;
    const isUser = appointment.user.toString() === req.user.id;

    if (!isVet && !isUser) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { status, cancellationReason, notes } = req.body;

    // Validate status transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled', 'no-show'],
      cancelled: [],
      completed: [],
      'no-show': [],
    };

    if (!validTransitions[appointment.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${appointment.status} to ${status}`,
      });
    }

    // Only vet can confirm/complete/no-show
    if (['confirmed', 'completed', 'no-show'].includes(status) && !isVet) {
      return res.status(403).json({
        success: false,
        message: 'Only the vet can perform this action',
      });
    }

    appointment.status = status;
    if (status === 'cancelled') {
      appointment.cancelledBy = isVet ? 'vet' : 'user';
      appointment.cancellationReason = cancellationReason || '';
    }
    if (notes) {
      appointment.notes = notes;
    }

    await appointment.save();

    // ── Financial logic based on status transition ──
    const servicePrice = appointment.service?.price;
    if (servicePrice && servicePrice > 0) {
      const price = Math.round(servicePrice * 100) / 100;

      if (status === 'confirmed') {
        // ACCEPT: Mark reservation as accepted (funds stay reserved until completed)
        await WalletTransaction.findOneAndUpdate(
          {
            'reference.entityId': appointment._id,
            'reference.entityType': 'vet_appointment',
            type: 'reservation',
            status: 'pending',
          },
          { status: 'accepted' },
        );
      } else if (status === 'completed') {
        // COMPLETE: Transfer reserved funds to vet (93%) — platform keeps 7%
        const split = calculateCommission(price);

        // Credit the vet
        const updatedVet = await User.findByIdAndUpdate(
          appointment.vet,
          { $inc: { petDollars: split.sellerAmount } },
          { new: true, select: 'petDollars' },
        );

        // Mark reservation as completed
        await WalletTransaction.findOneAndUpdate(
          {
            'reference.entityId': appointment._id,
            'reference.entityType': 'vet_appointment',
            type: 'reservation',
            status: { $in: ['pending', 'accepted'] },
          },
          { status: 'completed' },
        );

        // Record buyer's finalized purchase transaction
        const buyer = await User.findById(appointment.user).select(
          'petDollars',
        );
        await WalletTransaction.create({
          user: appointment.user,
          type: 'purchase',
          amount: -price,
          balanceAfter: buyer?.petDollars ?? 0,
          description: `Vet appointment completed — ${appointment.service.name}`,
          reference: {
            entityType: 'vet_appointment',
            entityId: appointment._id,
          },
          commission: {
            rate: split.commissionRate,
            platformAmount: split.platformAmount,
            sellerAmount: split.sellerAmount,
            sellerId: appointment.vet,
          },
          status: 'completed',
        });

        // Record vet's incoming transaction
        if (updatedVet) {
          await WalletTransaction.create({
            user: appointment.vet,
            type: 'transfer_in',
            amount: split.sellerAmount,
            balanceAfter: updatedVet.petDollars,
            description: `Appointment payment — ${appointment.service.name} (P$${price.toFixed(2)}, 7% platform fee deducted)`,
            reference: {
              entityType: 'vet_appointment',
              entityId: appointment._id,
            },
            commission: {
              rate: split.commissionRate,
              platformAmount: split.platformAmount,
              sellerAmount: split.sellerAmount,
              sellerId: appointment.vet,
            },
            status: 'completed',
          });
        }
      } else if (status === 'no-show') {
        // NO-SHOW: Refund reserved funds to pet owner
        const reservationTx = await WalletTransaction.findOne({
          'reference.entityId': appointment._id,
          'reference.entityType': 'vet_appointment',
          type: 'reservation',
          status: { $in: ['pending', 'accepted'] },
        });

        if (reservationTx) {
          const refundAmount = Math.abs(reservationTx.amount);
          const updatedBuyer = await User.findByIdAndUpdate(
            appointment.user,
            { $inc: { petDollars: refundAmount } },
            { new: true, select: 'petDollars' },
          );

          reservationTx.status = 'reversed';
          await reservationTx.save();

          if (updatedBuyer) {
            await WalletTransaction.create({
              user: appointment.user,
              type: 'refund',
              amount: refundAmount,
              balanceAfter: updatedBuyer.petDollars,
              description: `Refund — vet appointment no-show (${appointment.service.name})`,
              reference: {
                entityType: 'vet_appointment',
                entityId: appointment._id,
              },
              status: 'completed',
            });
          }
        }
      } else if (status === 'cancelled' && appointment.cancelledBy) {
        // CANCEL/DECLINE: Refund reserved funds to pet owner
        const reservationTx = await WalletTransaction.findOne({
          'reference.entityId': appointment._id,
          'reference.entityType': 'vet_appointment',
          type: 'reservation',
          status: { $in: ['pending', 'accepted'] },
        });

        if (reservationTx) {
          const refundAmount = Math.abs(reservationTx.amount);
          const updatedBuyer = await User.findByIdAndUpdate(
            appointment.user,
            { $inc: { petDollars: refundAmount } },
            { new: true, select: 'petDollars' },
          );

          // Mark reservation as reversed
          reservationTx.status = 'reversed';
          await reservationTx.save();

          // Record refund transaction
          if (updatedBuyer) {
            await WalletTransaction.create({
              user: appointment.user,
              type: 'refund',
              amount: refundAmount,
              balanceAfter: updatedBuyer.petDollars,
              description: `Refund — vet appointment ${isVet ? 'declined' : 'cancelled'} (${appointment.service.name})`,
              reference: {
                entityType: 'vet_appointment',
                entityId: appointment._id,
              },
              status: 'completed',
            });
          }
        }
      }
    }

    const populated = await Appointment.findById(appointment._id)
      .populate('clinic', 'clinicName phone address')
      .populate('pet', 'name species breed')
      .populate('user', 'name profileImage')
      .populate('vet', 'name profileImage');

    // --- Send real-time notification on status change ---
    try {
      const notifMap = {
        confirmed: {
          recipient: appointment.user,
          type: 'appointment_confirmed',
          title: 'Appointment Confirmed',
          body: `Your appointment at ${populated.clinic?.clinicName || 'the clinic'} on ${new Date(appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${appointment.timeSlot.start} has been confirmed!`,
        },
        cancelled: {
          recipient: isVet ? appointment.user : appointment.vet,
          type: 'appointment_cancelled',
          title: 'Appointment Cancelled',
          body: `An appointment for ${populated.pet?.name || 'a pet'} on ${new Date(appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${appointment.timeSlot.start} has been cancelled${cancellationReason ? ': ' + cancellationReason : '.'}`,
        },
        completed: {
          recipient: appointment.user,
          type: 'appointment_completed',
          title: 'Appointment Completed',
          body: `Your appointment for ${populated.pet?.name || 'your pet'} at ${populated.clinic?.clinicName || 'the clinic'} has been marked as completed.`,
        },
      };

      const notifData = notifMap[status];
      if (notifData) {
        const notification = await Notification.create({
          recipient: notifData.recipient,
          sender: req.user.id,
          type: notifData.type,
          title: notifData.title,
          body: notifData.body,
          data: {
            appointmentId: appointment._id,
            clinicId: appointment.clinic,
            petId: appointment.pet,
          },
        });

        const actor = await User.findById(req.user.id).select(
          'name profileImage',
        );
        sendToUser(notifData.recipient.toString(), 'notification', {
          ...notification.toObject(),
          sender: actor
            ? {
                _id: actor._id,
                name: actor.name,
                profileImage: actor.profileImage,
              }
            : null,
        });
      }

      // If cancelled, broadcast that the slot is now free again
      if (status === 'cancelled') {
        const dateStr = appointment.date.toISOString().split('T')[0];
        broadcastSlotUpdate(appointment.clinic.toString(), dateStr, {
          timeSlot: appointment.timeSlot,
          status: 'available',
        });
      }
    } catch (notifErr) {
      console.error('Notification send error (non-blocking):', notifErr);
    }

    res.json({ success: true, appointment: populated });
  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/appointments/vet/clients â€” Vet's client list (pets with confirmed/completed appointments)
// ========================================
router.get('/vet/clients', protect, async (req, res) => {
  try {
    // Find all appointments for this vet that are confirmed or completed
    const appointments = await Appointment.find({
      vet: req.user.id,
      status: { $in: ['confirmed', 'completed'] },
    })
      .populate(
        'pet',
        'name species breed profileImage dateOfBirth weight gender',
      )
      .populate('user', 'name profileImage email phone city country')
      .populate('clinic', 'clinicName')
      .sort({ date: -1 })
      .lean();

    // Build a unique client list grouped by pet
    const clientMap = new Map();
    for (const appt of appointments) {
      if (!appt.pet) continue;
      const petId = appt.pet._id.toString();
      if (!clientMap.has(petId)) {
        clientMap.set(petId, {
          pet: appt.pet,
          owner: appt.user,
          clinic: appt.clinic,
          lastAppointment: {
            _id: appt._id,
            date: appt.date,
            service: appt.service,
            status: appt.status,
          },
          appointmentCount: 1,
        });
      } else {
        clientMap.get(petId).appointmentCount += 1;
      }
    }

    const clients = Array.from(clientMap.values());
    res.json({ success: true, clients });
  } catch (error) {
    console.error('Get vet clients error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/appointments/vet/pet/:petId/records â€” Vet can view a client pet's health records
// ========================================
const HealthRecord = require('../models/HealthRecord');

router.get('/vet/pet/:petId/records', protect, async (req, res) => {
  try {
    // Verify this vet has a confirmed/completed appointment with this pet
    const hasAccess = await Appointment.findOne({
      vet: req.user.id,
      pet: req.params.petId,
      status: { $in: ['confirmed', 'completed'] },
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this pet's records. Only pets with confirmed appointments are accessible.",
      });
    }

    const records = await HealthRecord.find({ pet: req.params.petId })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    const pet = await Pet.findById(req.params.petId)
      .populate('owner', 'name profileImage email phone')
      .lean();

    res.json({ success: true, records, pet });
  } catch (error) {
    console.error('Get vet pet records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// POST /api/appointments/vet/pet/:petId/records â€” Vet can add a health record for a client's pet
// ========================================
router.post('/vet/pet/:petId/records', protect, async (req, res) => {
  try {
    // Verify this vet has a confirmed/completed appointment with this pet
    const hasAccess = await Appointment.findOne({
      vet: req.user.id,
      pet: req.params.petId,
      status: { $in: ['confirmed', 'completed'] },
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this pet's records.",
      });
    }

    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const ALLOWED_HEALTH_RECORD_FIELDS = [
      'recordType',
      'title',
      'description',
      'date',
      'veterinarian',
      'vaccination',
      'examination',
      'laboratory',
      'prescription',
      'surgery',
      'attachments',
      'notes',
      'followUpDate',
      'followUpNotes',
      'cost',
    ];
    const picked = {};
    for (const key of ALLOWED_HEALTH_RECORD_FIELDS) {
      if (req.body[key] !== undefined) picked[key] = req.body[key];
    }

    const record = await HealthRecord.create({
      ...picked,
      pet: req.params.petId,
      owner: pet.owner, // The pet's actual owner
    });

    // Send notification to the pet owner about the new record
    try {
      const vet = await User.findById(req.user.id).select('name');
      const notification = await Notification.create({
        recipient: pet.owner,
        sender: req.user.id,
        type: 'appointment_completed',
        title: 'New Medical Record',
        body: `Dr. ${vet?.name || 'Your vet'} added a new ${req.body.recordType || 'medical'} record for ${pet.name}.`,
        data: { petId: pet._id },
      });

      sendToUser(pet.owner.toString(), 'notification', {
        ...notification.toObject(),
        sender: vet ? { _id: vet._id, name: vet.name } : null,
      });
    } catch (notifErr) {
      console.error('Record notification error (non-blocking):', notifErr);
    }

    res.status(201).json({ success: true, record });
  } catch (error) {
    console.error('Vet create health record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
