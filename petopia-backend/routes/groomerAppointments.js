const express = require('express');
const GroomerAppointment = require('../models/GroomerAppointment');
const GroomerShop = require('../models/GroomerShop');
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
// GET /api/groomer-appointments/slots/:shopId â€” Available slots for a date
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// POST /api/groomer-appointments â€” Book a grooming appointment
// ========================================
router.post('/', protect, async (req, res) => {
  let balanceDeducted = false;
  let price = 0;

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

    // Verify pet ownership â€” user can only book for their own pets
    const Pet = require('../models/Pet');
    const pet = await Pet.findById(petId);
    if (!pet || pet.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to book for this pet',
      });
    }

    const shopService = shop.services.find(
      (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
    );

    // If exact match not found, try matching individual service names (multi-service booking)
    let matchedServices = [];
    if (shopService) {
      matchedServices = [shopService];
    } else {
      // Split comma-separated service names and look up each
      const serviceNames = serviceName
        .split(',')
        .map((n) => n.trim().toLowerCase());
      matchedServices = serviceNames
        .map((name) => shop.services.find((s) => s.name.toLowerCase() === name))
        .filter(Boolean);
    }

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

    // ── Pet Dollar reservation (funds held until groomer accepts/declines) ──
    if (matchedServices.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one valid service to book.',
      });
    }

    const servicePrice = matchedServices.reduce(
      (sum, s) => sum + (s.price || 0),
      0,
    );
    if (!servicePrice || servicePrice <= 0) {
      return res.status(400).json({
        success: false,
        message:
          'The selected service(s) do not have a valid price. Cannot book.',
      });
    }

    price = Math.round(servicePrice * 100) / 100;
    const primaryService = matchedServices[0];

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

    balanceDeducted = true;

    const totalDuration = matchedServices.reduce(
      (sum, s) => sum + (s.duration || 0),
      0,
    );

    const appointment = await GroomerAppointment.create({
      shop: shopId,
      groomer: shop.owner,
      user: req.user.id,
      pet: petId,
      date: appointmentDate,
      timeSlot,
      service: {
        name: serviceName,
        duration: totalDuration || shop.appointmentDuration,
        price: price,
      },
      reason: reason || '',
      status: 'pending',
    });

    // Record reservation transaction (funds held, not yet transferred to groomer)
    await WalletTransaction.create({
      user: req.user.id,
      type: 'reservation',
      amount: -price,
      balanceAfter: updatedBuyer.petDollars,
      description: `Reserved P$${price.toFixed(2)} for grooming — ${serviceName} at ${shop.shopName}`,
      reference: {
        entityType: 'groomer_appointment',
        entityId: appointment._id,
      },
      commission: {
        rate: 0.07,
        platformAmount: null,
        sellerAmount: null,
        sellerId: shop.owner,
      },
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

    // Rollback P$ if balance was deducted but booking failed
    if (balanceDeducted) {
      try {
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { petDollars: price },
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
// GET /api/groomer-appointments/my â€” User's grooming appointments
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

    const appointments = await GroomerAppointment.find(filter)
      .populate('shop', 'shopName phone address logo')
      .populate('pet', 'name species breed profileImage')
      .populate('groomer', 'name profileImage')
      .sort({ date: 1, 'timeSlot.start': 1 })
      .lean();

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('Get my groomer appointments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/groomer-appointments/groomer â€” Groomer's appointments
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

    if (typeof status === 'string') {
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PUT /api/groomer-appointments/:id/status â€” Update status
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

    // ── Financial logic based on status transition ──
    const servicePrice = appointment.service?.price;
    if (servicePrice && servicePrice > 0) {
      const price = Math.round(servicePrice * 100) / 100;

      if (status === 'confirmed') {
        // ACCEPT: Mark reservation as accepted (funds stay reserved until completed)
        await WalletTransaction.findOneAndUpdate(
          {
            'reference.entityId': appointment._id,
            'reference.entityType': 'groomer_appointment',
            type: 'reservation',
            status: 'pending',
          },
          { status: 'accepted' },
        );
      } else if (status === 'completed') {
        // COMPLETE: Transfer reserved funds to groomer (93%) — platform keeps 7%
        const split = calculateCommission(price);

        // Credit the groomer
        const updatedGroomer = await User.findByIdAndUpdate(
          appointment.groomer,
          { $inc: { petDollars: split.sellerAmount } },
          { new: true, select: 'petDollars' },
        );

        // Mark reservation as completed
        await WalletTransaction.findOneAndUpdate(
          {
            'reference.entityId': appointment._id,
            'reference.entityType': 'groomer_appointment',
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
          description: `Grooming appointment completed — ${appointment.service.name}`,
          reference: {
            entityType: 'groomer_appointment',
            entityId: appointment._id,
          },
          commission: {
            rate: split.commissionRate,
            platformAmount: split.platformAmount,
            sellerAmount: split.sellerAmount,
            sellerId: appointment.groomer,
          },
          status: 'completed',
        });

        // Record groomer's incoming transaction
        if (updatedGroomer) {
          await WalletTransaction.create({
            user: appointment.groomer,
            type: 'transfer_in',
            amount: split.sellerAmount,
            balanceAfter: updatedGroomer.petDollars,
            description: `Grooming payment — ${appointment.service.name} (P$${price.toFixed(2)}, 7% platform fee deducted)`,
            reference: {
              entityType: 'groomer_appointment',
              entityId: appointment._id,
            },
            commission: {
              rate: split.commissionRate,
              platformAmount: split.platformAmount,
              sellerAmount: split.sellerAmount,
              sellerId: appointment.groomer,
            },
            status: 'completed',
          });
        }
      } else if (status === 'no-show') {
        // NO-SHOW: Refund reserved funds to pet owner
        const reservationTx = await WalletTransaction.findOne({
          'reference.entityId': appointment._id,
          'reference.entityType': 'groomer_appointment',
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
              description: `Refund — grooming appointment no-show (${appointment.service.name})`,
              reference: {
                entityType: 'groomer_appointment',
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
          'reference.entityType': 'groomer_appointment',
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
              description: `Refund — grooming appointment ${isGroomer ? 'declined' : 'cancelled'} (${appointment.service.name})`,
              reference: {
                entityType: 'groomer_appointment',
                entityId: appointment._id,
              },
              status: 'completed',
            });
          }
        }
      }
    }

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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/groomer-appointments/groomer/clients â€” Groomer's client list
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
