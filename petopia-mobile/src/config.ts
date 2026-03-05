/**
 * App Configuration
 *
 * Phone and PC must be on the same WiFi network.
 */

const SERVER_HOST = '192.168.1.116';
const SERVER_PORT = '5000';

export const API_BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}/api`;

export default {
  API_BASE_URL,
};
