const db = require('../models');
const { Op } = require('sequelize');

/**
 * Usage Tracking Service
 * Tracks partner usage metrics (orders, API calls, km, drivers)
 */

/**
 * Record usage metric for a partner
 */
async function recordUsage(partnerId, metric, value, period = 'daily') {
  try {
    const now = new Date();
    let periodDate;
    
    if (period === 'daily') {
      periodDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'monthly') {
      periodDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      throw new Error(`Invalid period: ${period}`);
    }

    // Find or create usage record
    const [usage, created] = await db.PartnerUsage.findOrCreate({
      where: {
        partnerId: partnerId,
        metric: metric,
        period: period,
        periodDate: periodDate
      },
      defaults: {
        partnerId: partnerId,
        metric: metric,
        value: parseFloat(value) || 0,
        period: period,
        periodDate: periodDate
      }
    });

    if (!created) {
      // Update existing record (increment)
      await usage.update({
        value: parseFloat(usage.value) + parseFloat(value)
      });
    }

    return usage;
  } catch (error) {
    console.error('Error recording usage:', error);
    throw error;
  }
}

/**
 * Get usage statistics for a partner
 */
async function getUsageStats(partnerId, options = {}) {
  const { period = 'monthly', startDate, endDate } = options;
  
  const where = {
    partnerId: partnerId,
    period: period
  };

  if (startDate || endDate) {
    where.periodDate = {};
    if (startDate) {
      where.periodDate[Op.gte] = new Date(startDate);
    }
    if (endDate) {
      where.periodDate[Op.lte] = new Date(endDate);
    }
  }

  const usage = await db.PartnerUsage.findAll({
    where: where,
    order: [['periodDate', 'DESC']]
  });

  // Aggregate by metric
  const stats = {
    orders: 0,
    api_calls: 0,
    km: 0,
    drivers: 0,
    breakdown: {}
  };

  for (const record of usage) {
    if (stats[record.metric] !== undefined) {
      stats[record.metric] += parseFloat(record.value);
    }
    if (!stats.breakdown[record.metric]) {
      stats.breakdown[record.metric] = [];
    }
    stats.breakdown[record.metric].push({
      period: record.periodDate,
      value: parseFloat(record.value)
    });
  }

  return stats;
}

/**
 * Track API call
 */
async function trackApiCall(partnerId) {
  return await recordUsage(partnerId, 'api_calls', 1, 'daily');
}

/**
 * Track order creation
 */
async function trackOrder(partnerId) {
  return await recordUsage(partnerId, 'orders', 1, 'daily');
}

/**
 * Track distance (km)
 */
async function trackDistance(partnerId, km) {
  return await recordUsage(partnerId, 'km', km, 'daily');
}

/**
 * Track driver assignment
 */
async function trackDriver(partnerId) {
  return await recordUsage(partnerId, 'drivers', 1, 'daily');
}

module.exports = {
  recordUsage,
  getUsageStats,
  trackApiCall,
  trackOrder,
  trackDistance,
  trackDriver
};







