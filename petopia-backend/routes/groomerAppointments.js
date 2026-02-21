const express = require('express');
const GroomerAppointment = require('../models/GroomerAppointment');
const GroomerShop = require('../models/GroomerShop');
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
// GET /api/groomer-appointments/slots/:shopId — Available slots for a date
// ========================================
router.get('/slots/:shopId', protect, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: 'Date is required (YYYY-MM-DD)' });
    }

    const shop = await GroomerShop.findById(req.params.shopId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Groomer shop not found' });
    }

    const targetDate = new Date(date + 'T00:00:00.000Z');
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const allSlots = generateTimeSlots(
      shop.workingHours,
      shop.appointmentDuration,
      targetDate,
    );

    const booked = await GroomerAppointment.find({
      shop: req.params.shopId,
      date: { $gte: targetDate, $lt: nextDay },
      status: { $in: ['pending', 'confirmed'] },
    }).select('timeSlot');

    const bookedStarts = new Set(booked.map((a) => a.timeSlot.start));

    const available = allSlots.map((slot) => ({
      ...slot,
      available: !bookedStarts.has(slot.start),
    }));

    res.json({
      success: true,
      date,
      shopName: shop.shopName,
      appointmentDuration: shop.appointmentDuration,
      slots: available,
    });
  } catch (error) {
    console.error('Get groomer slots error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// POST /api/groomer-appointments — Book a grooming appointment
// ========================================
router.post('/', protect, async (req, res) => {
  try {
    const { shopId, petId, date, timeSlot, serviceName, reason } = req.body;

    if (!shopId || !petId || !date || !timeSlot?.start || !serviceName) {
      return res.status(400).json({
        success: false,
        message: 'shopId, petId, date, timeSlot, and serviceName are required',
      });
    }

    const shop = await GroomerShop.findById(shopId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Groomer shop not found' });
    }

    // Can't book own shop
    if (shop.owner.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book an appointment at your own shop',
      });
    }

    const shopService = shop.services.find(
      (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
    );

    const appointmentDate = new Date(date + 'T00:00:00.000Z');

    const existing = await GroomerAppointment.findOne({
      shop: shopId,
      date: appointmentDate,
      'timeSlot.start': timeSlot.start,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'This time slot is already booked' });
    }

    const appointment = await GroomerAppointment.create({
      shop: shopId,
      groomer: shop.owner,
      user: req.user.id,
      pet: petId,
      date: appointmentDate,
      timeSlot,
      service: {
        name: serviceName,
        duration: shopService?.duration || shop.appointmentDuration,
        price: shopService?.price || null,
      },
      reason: reason || '',
      status: 'pending',
    });

    const populated = await GroomerAppointment.findById(appointment._id)
      .populate('shop', 'shopName phone address')
      .populate('pet', 'name species breed')
      .populate('user', 'name profileImage')
      .populate('groomer', 'name profileImage');

    // --- Send real-time notification to the groomer ---
    try {
      const booker = await User.findById(req.user.id).select('name');
      const pet = await Pet.findById(petId).select('name species');
      const dateStr = new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const notification = await Notification.create({
        recipient: shop.owner,
        sender: req.user.id,
        type: 'appointment_booked',
        title: 'New Grooming Appointment',
        body: `${booker?.name || 'A user'} booked ${pet?.name || 'a pet'} for ${serviceName} on ${dateStr} at ${timeSlot.start}`,
        data: {
          appointmentId: appointment._id,
          shopId: shop._id,
          petId,
        },
      });

      sendToUser(shop.owner.toString(), 'notification', {
        ...notification.toObject(),
        sender: { _id: req.user.id, name: booker?.name },
      });
    } catch (notifErr) {
      console.error('Notification send error (non-blocking):', notifErr);
    }

    res.status(201).json({ success: true, appointment: populated });
  } catch (error) {
    console.error('Book groomer appointment error:', error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: 'This time slot is already booked' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/groomer-appointments/my — User's grooming appointments
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

    const appointments = await GroomerAppointment.find(filter)
      .populate('shop', 'shopName phone address logo')
      .populate('pet', 'name species breed profileImage')
      .populate('groomer', 'name profileImage')
      .sort({ date: 1, 'timeSlot.start': 1 })
      .lean();

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('Get my groomer appointments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/groomer-appointments/groomer — Groomer's appointments
// ========================================
router.get('/groomer', protect, async (req, res) => {
  try {
    const { date, status } = req.query;
    const filter = { groomer: req.user.id };

    if (date) {
      const targetDate = new Date(date + 'T00:00:00.000Z');
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: targetDate, $lt: nextDay };
    }

    if (status) {
      filter.status = status;
    }

    const appointments = await GroomerAppointment.find(filter)
      .populate('shop', 'shopName')
      .populate('pet', 'name species breed profileImage')
      .populate('user', 'name profileImage phone')
      .sort({ date: 1, 'timeSlot.start': 1 })
      .lean();

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('Get groomer appointments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// PUT /api/groomer-appointments/:id/status — Update status
// ========================================
router.put('/:id/status', protect, async (req, res) => {
  try {
    const appointment = await GroomerAppointment.findById(req.params.id);

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: 'Appointment not found' });
    }

    const isGroomer = appointment.groomer.toString() === req.user.id;
    const isUser = appointment.user.toString() === req.user.id;

    if (!isGroomer && !isUser) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { status, cancellationReason, notes } = req.body;

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

    if (['confirmed', 'completed', 'no-show'].includes(status) && !isGroomer) {
      return res.status(403).json({
        success: false,
        message: 'Only the groomer can perform this action',
      });
    }

    appointment.status = status;
    if (status === 'cancelled') {
      appointment.cancelledBy = isGroomer ? 'groomer' : 'user';
      appointment.cancellationReason = cancellationReason || '';
    }
    if (notes) {
      appointment.notes = notes;
    }

    await appointment.save();

    const populated = await GroomerAppointment.findById(appointment._id)
      .populate('shop', 'shopName phone address')
      .populate('pet', 'name species breed')
      .populate('user', 'name profileImage')
      .populate('groomer', 'name profileImage');

    // --- Send real-time notification on status change ---
    try {
      const notifMap = {
        confirmed: {
          recipient: appointment.user,
          type: 'appointment_confirmed',
          title: 'Grooming Appointment Confirmed',
          body: `Your grooming appointment at ${populated.shop?.shopName || 'the shop'} on ${new Date(appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${appointment.timeSlot.start} has been confirmed!`,
        },
        cancelled: {
          recipient: isGroomer ? appointment.user : appointment.groomer,
          type: 'appointment_cancelled',
          title: 'Grooming Appointment Cancelled',
          body: `A grooming appointment for ${populated.pet?.name || 'a pet'} on ${new Date(appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${appointment.timeSlot.start} has been cancelled${cancellationReason ? ': ' + cancellationReason : '.'}`,
        },
        completed: {
          recipient: appointment.user,
          type: 'appointment_completed',
          title: 'Grooming Completed',
          body: `Your grooming appointment for ${populated.pet?.name || 'your pet'} at ${populated.shop?.shopName || 'the shop'} has been marked as completed.`,
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
            shopId: appointment.shop,
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
    } catch (notifErr) {
      console.error('Notification send error (non-blocking):', notifErr);
    }

    res.json({ success: true, appointment: populated });
  } catch (error) {
    console.error('Update groomer appointment status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/groomer-appointments/groomer/clients — Groomer's client list
// ========================================
router.get('/groomer/clients', protect, async (req, res) => {
  try {
    const appointments = await GroomerAppointment.find({
      groomer: req.user.id,
      status: { $in: ['confirmed', 'completed'] },
    })
      .populate(
        'pet',
        'name species breed profileImage dateOfBirth weight gender',
      )
      .populate('user', 'name profileImage email phone city country')
      .populate('shop', 'shopName')
      .sort({ date: -1 })
      .lean();

    const clientMap = new Map();
    for (const appt of appointments) {
      if (!appt.pet) continue;
      const petId = appt.pet._id.toString();
      if (!clientMap.has(petId)) {
        clientMap.set(petId, {
          pet: appt.pet,
          owner: appt.user,
          shop: appt.shop,
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
    console.error('Get groomer clients error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
