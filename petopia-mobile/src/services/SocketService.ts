import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

// Strip /api from the API URL to get the base server URL
const WS_URL = API_BASE_URL.replace('/api', '');

let socket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Connect to the WebSocket server with auth token
 */
export function connectSocket(token: string): Socket {
  // Don't reconnect if already connected with the same token
  if (socket?.connected && currentToken === token) {
    return socket;
  }

  // Disconnect existing socket if token changed
  if (socket) {
    socket.disconnect();
  }

  currentToken = token;
  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[WS] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.log('[WS] Connection error:', err.message);
  });

  return socket;
}

/**
 * Get the current socket instance (or null)
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Disconnect and clean up the socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}

/**
 * Watch a clinic's slots for a specific date (for real-time booking updates)
 */
export function watchClinicSlots(clinicId: string, date: string): void {
  socket?.emit('watch_slots', { clinicId, date });
}

/**
 * Stop watching a clinic's slots
 */
export function unwatchClinicSlots(clinicId: string, date: string): void {
  socket?.emit('unwatch_slots', { clinicId, date });
}

/**
 * Notify that a slot has been booked.
 * NOTE: slot_booked is now handled server-side only for security.
 * The server broadcasts slot_taken after a confirmed REST API booking.
 * This function is kept for backward compatibility but is a no-op.
 */
export function emitSlotBooked(
  clinicId: string,
  date: string,
  timeSlot: { start: string; end: string },
): void {
  // Server-side only — do nothing from client
}

// ========================================
// Chat helpers
// ========================================

export function joinConversation(conversationId: string): void {
  socket?.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('leave_conversation', conversationId);
}

export function emitTyping(conversationId: string, isTyping: boolean): void {
  socket?.emit('typing', { conversationId, isTyping });
}
