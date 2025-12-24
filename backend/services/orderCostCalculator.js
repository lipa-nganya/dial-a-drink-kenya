/**
 * Order Cost Calculator Service
 * 
 * Calculates the full server cost of an order from placement to completion.
 * Tracks:
 * - Database operations (queries, writes, transactions)
 * - External API calls (SMS, M-Pesa, Push Notifications)
 * - Compute time
 * - Network/bandwidth
 * - Storage
 */

// Exchange rate: 1 USD = 130 KES (approximate)
const USD_TO_KES_RATE = 130;

// Cost constants (in KES - Kenyan Shillings)
const COSTS = {
  // Database costs (per operation)
  // Assuming PostgreSQL on Cloud SQL or similar
  // Converted from USD: $0.000001 = 0.00013 KES per read
  DB_READ: 0.00013,      // 0.00013 KES per read query (~0.13 KES per million reads)
  DB_WRITE: 0.0013,      // 0.0013 KES per write (~1.3 KES per million writes)
  DB_TRANSACTION: 0.0065, // 0.0065 KES per transaction (~6.5 KES per million transactions)
  
  // External API costs
  SMS_COST: 0.35,        // 0.35 KES per SMS (Advanta SMS pricing)
  MPESA_STK_PUSH: 0.0,   // M-Pesa STK Push is free (no per-transaction fee)
  MPESA_CALLBACK: 0.0,   // M-Pesa callbacks are free
  PUSH_NOTIFICATION: 0.0, // Expo push notifications are free
  
  // Compute costs (per millisecond of execution)
  // Assuming Cloud Run or similar serverless: ~$0.0000001 per ms = 0.000013 KES per ms
  COMPUTE_PER_MS: 0.000013,
  
  // Network/bandwidth costs (per KB)
  // Assuming ~$0.12 per GB = 0.0000156 KES per KB
  NETWORK_PER_KB: 0.0000156,
  
  // Storage costs (per KB per day)
  // Assuming ~$0.02 per GB per month = ~0.000000091 KES per KB per day
  STORAGE_PER_KB_PER_DAY: 0.000000091,
  
  // Socket.IO/WebSocket costs (per message)
  SOCKET_MESSAGE: 0.00013, // Minimal cost for WebSocket messages
};

class OrderCostTracker {
  constructor(orderId) {
    this.orderId = orderId;
    this.startTime = Date.now();
    this.costs = {
      database: {
        reads: 0,
        writes: 0,
        transactions: 0,
        cost: 0
      },
      externalAPIs: {
        sms: 0,
        mpesaStkPush: 0,
        mpesaCallbacks: 0,
        pushNotifications: 0,
        cost: 0
      },
      compute: {
        milliseconds: 0,
        cost: 0
      },
      network: {
        kilobytes: 0,
        cost: 0
      },
      storage: {
        kilobytes: 0,
        days: 0,
        cost: 0
      },
      socket: {
        messages: 0,
        cost: 0
      },
      total: 0
    };
    this.operations = [];
  }

  /**
   * Track a database read operation
   */
  trackDBRead(description = 'Database read') {
    this.costs.database.reads++;
    this.costs.database.cost += COSTS.DB_READ;
    this.operations.push({
      type: 'db_read',
      description,
      cost: COSTS.DB_READ,
      timestamp: Date.now()
    });
  }

  /**
   * Track a database write operation
   */
  trackDBWrite(description = 'Database write') {
    this.costs.database.writes++;
    this.costs.database.cost += COSTS.DB_WRITE;
    this.operations.push({
      type: 'db_write',
      description,
      cost: COSTS.DB_WRITE,
      timestamp: Date.now()
    });
  }

  /**
   * Track a database transaction
   */
  trackDBTransaction(description = 'Database transaction') {
    this.costs.database.transactions++;
    this.costs.database.cost += COSTS.DB_TRANSACTION;
    this.operations.push({
      type: 'db_transaction',
      description,
      cost: COSTS.DB_TRANSACTION,
      timestamp: Date.now()
    });
  }

  /**
   * Track SMS sent
   */
  trackSMS(description = 'SMS sent') {
    this.costs.externalAPIs.sms++;
    this.costs.externalAPIs.cost += COSTS.SMS_COST;
    this.operations.push({
      type: 'sms',
      description,
      cost: COSTS.SMS_COST,
      timestamp: Date.now()
    });
  }

  /**
   * Track M-Pesa STK Push
   */
  trackMpesaSTKPush(description = 'M-Pesa STK Push') {
    this.costs.externalAPIs.mpesaStkPush++;
    this.costs.externalAPIs.cost += COSTS.MPESA_STK_PUSH;
    this.operations.push({
      type: 'mpesa_stk_push',
      description,
      cost: COSTS.MPESA_STK_PUSH,
      timestamp: Date.now()
    });
  }

  /**
   * Track M-Pesa callback
   */
  trackMpesaCallback(description = 'M-Pesa callback') {
    this.costs.externalAPIs.mpesaCallbacks++;
    this.costs.externalAPIs.cost += COSTS.MPESA_CALLBACK;
    this.operations.push({
      type: 'mpesa_callback',
      description,
      cost: COSTS.MPESA_CALLBACK,
      timestamp: Date.now()
    });
  }

  /**
   * Track push notification
   */
  trackPushNotification(description = 'Push notification') {
    this.costs.externalAPIs.pushNotifications++;
    this.costs.externalAPIs.cost += COSTS.PUSH_NOTIFICATION;
    this.operations.push({
      type: 'push_notification',
      description,
      cost: COSTS.PUSH_NOTIFICATION,
      timestamp: Date.now()
    });
  }

  /**
   * Track compute time
   */
  trackComputeTime(milliseconds) {
    this.costs.compute.milliseconds += milliseconds;
    this.costs.compute.cost += milliseconds * COSTS.COMPUTE_PER_MS;
  }

  /**
   * Track network usage
   */
  trackNetwork(kilobytes, description = 'Network transfer') {
    this.costs.network.kilobytes += kilobytes;
    this.costs.network.cost += kilobytes * COSTS.NETWORK_PER_KB;
    this.operations.push({
      type: 'network',
      description,
      kilobytes,
      cost: kilobytes * COSTS.NETWORK_PER_KB,
      timestamp: Date.now()
    });
  }

  /**
   * Track storage usage
   */
  trackStorage(kilobytes, days = 1) {
    this.costs.storage.kilobytes += kilobytes;
    this.costs.storage.days = Math.max(this.costs.storage.days, days);
    this.costs.storage.cost += kilobytes * days * COSTS.STORAGE_PER_KB_PER_DAY;
  }

  /**
   * Track Socket.IO message
   */
  trackSocketMessage(description = 'Socket message') {
    this.costs.socket.messages++;
    this.costs.socket.cost += COSTS.SOCKET_MESSAGE;
    this.operations.push({
      type: 'socket',
      description,
      cost: COSTS.SOCKET_MESSAGE,
      timestamp: Date.now()
    });
  }

  /**
   * Calculate total cost
   */
  calculateTotal() {
    this.costs.total = 
      this.costs.database.cost +
      this.costs.externalAPIs.cost +
      this.costs.compute.cost +
      this.costs.network.cost +
      this.costs.storage.cost +
      this.costs.socket.cost;
    
    return this.costs.total;
  }

  /**
   * Get cost summary
   */
  getSummary() {
    const totalTime = Date.now() - this.startTime;
    this.trackComputeTime(totalTime);
    this.calculateTotal();

    return {
      orderId: this.orderId,
      duration: {
        milliseconds: totalTime,
        seconds: (totalTime / 1000).toFixed(2),
        minutes: (totalTime / 60000).toFixed(2)
      },
      costs: {
        ...this.costs,
        breakdown: {
          database: {
            operations: this.costs.database.reads + this.costs.database.writes + this.costs.database.transactions,
            cost: this.costs.database.cost,
            percentage: (this.costs.database.cost / this.costs.total * 100).toFixed(2)
          },
          externalAPIs: {
            operations: this.costs.externalAPIs.sms + this.costs.externalAPIs.mpesaStkPush + 
                       this.costs.externalAPIs.mpesaCallbacks + this.costs.externalAPIs.pushNotifications,
            cost: this.costs.externalAPIs.cost,
            percentage: (this.costs.externalAPIs.cost / this.costs.total * 100).toFixed(2)
          },
          compute: {
            milliseconds: this.costs.compute.milliseconds,
            cost: this.costs.compute.cost,
            percentage: (this.costs.compute.cost / this.costs.total * 100).toFixed(2)
          },
          network: {
            kilobytes: this.costs.network.kilobytes,
            cost: this.costs.network.cost,
            percentage: (this.costs.network.cost / this.costs.total * 100).toFixed(2)
          },
          storage: {
            kilobytes: this.costs.storage.kilobytes,
            days: this.costs.storage.days,
            cost: this.costs.storage.cost,
            percentage: (this.costs.storage.cost / this.costs.total * 100).toFixed(2)
          },
          socket: {
            messages: this.costs.socket.messages,
            cost: this.costs.socket.cost,
            percentage: (this.costs.socket.cost / this.costs.total * 100).toFixed(2)
          }
        }
      },
      operations: this.operations,
      totalCost: {
        kes: this.costs.total,
        usd: (this.costs.total / USD_TO_KES_RATE).toFixed(6),
        formatted: `KES ${this.costs.total.toFixed(4)} ($${(this.costs.total / USD_TO_KES_RATE).toFixed(6)})`
      }
    };
  }
}

/**
 * Calculate cost for order creation
 */
function calculateOrderCreationCost(orderData) {
  const tracker = new OrderCostTracker(orderData.id || 'pending');
  
  // Database operations during order creation
  // Settings lookups (2 reads)
  tracker.trackDBRead('Settings lookup (testMode, maxTip)');
  tracker.trackDBRead('Settings lookup (deliveryFee)');
  
  // Drink lookups (N reads for N items)
  const itemCount = orderData.items?.length || 1;
  for (let i = 0; i < itemCount; i++) {
    tracker.trackDBRead(`Drink lookup for item ${i + 1}`);
  }
  
  // Category lookup for delivery fee calculation
  tracker.trackDBRead('Category lookup for delivery fee');
  
  // Branch assignment (multiple reads)
  tracker.trackDBRead('Branch lookup (closest branch)');
  tracker.trackDBRead('Branch fallback lookup');
  
  // Driver assignment (reads)
  tracker.trackDBRead('Driver lookup (nearest active)');
  tracker.trackDBRead('HOLD driver lookup (if needed)');
  
  // Order creation transaction
  tracker.trackDBTransaction('Order creation transaction');
  
  // Order writes
  tracker.trackDBWrite('Order creation');
  tracker.trackDBWrite('Customer sync/creation');
  for (let i = 0; i < itemCount; i++) {
    tracker.trackDBWrite(`OrderItem creation ${i + 1}`);
  }
  
  // Order reload with includes
  tracker.trackDBRead('Order reload with items and driver');
  
  // Socket.IO messages
  tracker.trackSocketMessage('Socket: new-order to admin');
  if (orderData.driverId && orderData.driverId !== 'HOLD') {
    tracker.trackSocketMessage('Socket: order-assigned to driver');
  }
  
  // Push notification (if driver assigned)
  if (orderData.driverId && orderData.driverId !== 'HOLD') {
    tracker.trackPushNotification('Push notification to driver');
  }
  
  // SMS notifications (if enabled)
  const smsCount = orderData.smsNotificationsSent || 0;
  for (let i = 0; i < smsCount; i++) {
    tracker.trackSMS(`SMS notification ${i + 1}`);
  }
  
  // Network: Estimate ~5KB for order creation request/response
  tracker.trackNetwork(5, 'Order creation API request/response');
  
  // Storage: Estimate order size (~2KB) stored indefinitely
  tracker.trackStorage(2, 365); // Store for 1 year
  
  return tracker.getSummary();
}

/**
 * Calculate cost for payment processing (M-Pesa STK Push)
 */
function calculatePaymentCost(orderId, paymentMethod) {
  const tracker = new OrderCostTracker(orderId);
  
  // Database operations
  tracker.trackDBRead('Order lookup for payment');
  tracker.trackDBRead('Order financial breakdown');
  tracker.trackDBRead('Settings lookup (driverPay)');
  tracker.trackDBWrite('Transaction creation (payment)');
  tracker.trackDBWrite('Transaction creation (delivery)');
  tracker.trackDBWrite('Transaction creation (tip, if applicable)');
  tracker.trackDBWrite('Order notes update');
  
  // M-Pesa operations
  if (paymentMethod === 'mobile_money') {
    tracker.trackMpesaSTKPush('M-Pesa STK Push initiation');
    tracker.trackMpesaCallback('M-Pesa payment callback');
    
    // M-Pesa callback processing
    tracker.trackDBRead('Transaction lookup for callback');
    tracker.trackDBRead('Order lookup for callback');
    tracker.trackDBWrite('Transaction status update');
    tracker.trackDBWrite('Order payment status update');
    tracker.trackDBWrite('Driver delivery transaction update');
  }
  
  // Socket messages
  tracker.trackSocketMessage('Socket: payment-confirmed');
  
  // Network: Estimate ~3KB for payment API calls
  tracker.trackNetwork(3, 'Payment API request/response');
  
  return tracker.getSummary();
}

/**
 * Calculate cost for order status updates
 */
function calculateStatusUpdateCost(orderId, statusUpdates) {
  const tracker = new OrderCostTracker(orderId);
  
  // Each status update
  statusUpdates.forEach((status, index) => {
    tracker.trackDBRead(`Order lookup for status update ${index + 1}`);
    tracker.trackDBWrite(`Order status update to ${status}`);
    tracker.trackSocketMessage(`Socket: order-status-updated (${status})`);
  });
  
  // Additional operations for completion
  if (statusUpdates.includes('completed')) {
    tracker.trackDBRead('Order lookup for completion');
    tracker.trackDBRead('Driver status check');
    tracker.trackDBWrite('Wallet credit operations');
    tracker.trackDBWrite('Inventory decrease');
    tracker.trackDBRead('Transaction lookups for wallet credit');
    tracker.trackDBWrite('Transaction updates for wallet credit');
  }
  
  // Network: Estimate ~2KB per status update
  tracker.trackNetwork(2 * statusUpdates.length, 'Status update API calls');
  
  return tracker.getSummary();
}

/**
 * Calculate full order lifecycle cost
 */
function calculateFullOrderCost(orderData) {
  const tracker = new OrderCostTracker(orderData.id);
  
  // Order creation costs
  const creationCost = calculateOrderCreationCost(orderData);
  
  // Payment costs (if pay_now)
  let paymentCost = null;
  if (orderData.paymentType === 'pay_now' && orderData.paymentMethod === 'mobile_money') {
    paymentCost = calculatePaymentCost(orderData.id, 'mobile_money');
  }
  
  // Status update costs (typical flow: pending -> confirmed -> preparing -> out_for_delivery -> delivered -> completed)
  const statusUpdates = ['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed'];
  const statusUpdateCost = calculateStatusUpdateCost(orderData.id, statusUpdates);
  
  // Combine all costs
  const totalCost = 
    creationCost.costs.total +
    (paymentCost ? paymentCost.costs.total : 0) +
    statusUpdateCost.costs.total;
  
  return {
    orderId: orderData.id,
    breakdown: {
      creation: creationCost,
      payment: paymentCost,
      statusUpdates: statusUpdateCost
    },
    total: {
      kes: totalCost,
      usd: (totalCost / USD_TO_KES_RATE).toFixed(6),
      formatted: `KES ${totalCost.toFixed(4)} ($${(totalCost / USD_TO_KES_RATE).toFixed(6)})`
    },
    summary: {
      databaseOperations: 
        creationCost.costs.database.reads + creationCost.costs.database.writes + creationCost.costs.database.transactions +
        (paymentCost ? paymentCost.costs.database.reads + paymentCost.costs.database.writes + paymentCost.costs.database.transactions : 0) +
        statusUpdateCost.costs.database.reads + statusUpdateCost.costs.database.writes + statusUpdateCost.costs.database.transactions,
      externalAPICalls:
        creationCost.costs.externalAPIs.sms + creationCost.costs.externalAPIs.mpesaStkPush + creationCost.costs.externalAPIs.pushNotifications +
        (paymentCost ? paymentCost.costs.externalAPIs.mpesaStkPush + paymentCost.costs.externalAPIs.mpesaCallbacks : 0),
      socketMessages:
        creationCost.costs.socket.messages +
        (paymentCost ? paymentCost.costs.socket.messages : 0) +
        statusUpdateCost.costs.socket.messages
    }
  };
}

module.exports = {
  OrderCostTracker,
  calculateOrderCreationCost,
  calculatePaymentCost,
  calculateStatusUpdateCost,
  calculateFullOrderCost,
  COSTS,
  USD_TO_KES_RATE
};

