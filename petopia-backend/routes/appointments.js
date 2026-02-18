const express = require('express');
const Appointment = require('../models/Appointment');
const VetClinic = require('../models/VetClinic');
const Pet = require('../models/Pet');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { sendToUser, broadcastSlotUpdate } = require('../socket');

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
// GET /api/appointments/slots/:clinicId — Available slots for a date
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// POST /api/appointments — Book an appointment
// ========================================
router.post('/', protect, async (req, res) => {
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
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: 'This time slot is already booked' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/appointments/my — User's appointments
// ========================================
router.get('/my', protect, async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    const filter = { user: req.user.id };

    if (status) {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/appointments/vet — Vet's appointments
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

    if (status) {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// PUT /api/appointments/:id/status — Update status
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/appointments/vet/clients — Vet's client list (pets with confirmed/completed appointments)
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/appointments/vet/pet/:petId/records — Vet can view a client pet's health records
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// POST /api/appointments/vet/pet/:petId/records — Vet can add a health record for a client's pet
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

    const record = await HealthRecord.create({
      ...req.body,
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
    res
      .status(500)
      .json({ success: false, message: error.message || 'Server error' });
  }
});

module.exports = router;
