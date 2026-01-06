import { EventEmitter } from 'events';

// Global event emitter for notification events
// This allows the notification handler to trigger the overlay
export const notificationEvents = new EventEmitter();

