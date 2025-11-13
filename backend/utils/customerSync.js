const { Op } = require('sequelize');
const db = require('../models');

const normalizePhoneNumber = (rawPhone) => {
  if (rawPhone === null || rawPhone === undefined) {
    return null;
  }

  const phoneStr = String(rawPhone).trim();
  if (!phoneStr) {
    return null;
  }

  const digits = phoneStr.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('254') && digits.length > 12) {
    return digits.slice(0, 12);
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `254${digits}`;
  }

  if (digits.length === 10 && digits.startsWith('7')) {
    return `254${digits.slice(1)}`;
  }

  return digits;
};

const generatePhoneVariants = (rawPhone) => {
  if (rawPhone === null || rawPhone === undefined) {
    return [];
  }

  const phoneStr = String(rawPhone);
  if (!phoneStr) {
    return [];
  }

  const variants = new Set();
  const trimmed = phoneStr.trim();
  if (trimmed) {
    variants.add(trimmed);
  }

  const normalized = normalizePhoneNumber(phoneStr);
  if (normalized) {
    variants.add(normalized);
    const localNine = normalized.slice(-9);
    if (localNine) {
      variants.add(localNine);
      variants.add(`0${localNine}`);
      variants.add(`254${localNine}`);
      variants.add(`+254${localNine}`);
    }
  }

  const digits = phoneStr.replace(/\D/g, '');
  if (digits) {
    variants.add(digits);
    if (digits.startsWith('0')) {
      variants.add(`254${digits.slice(1)}`);
    } else if (digits.length === 9) {
      variants.add(`254${digits}`);
      variants.add(`0${digits}`);
    } else if (digits.startsWith('254')) {
      const local = digits.slice(3);
      if (local) {
        variants.add(local);
        variants.add(`0${local}`);
      }
    }
  }

  return Array.from(variants).filter(Boolean);
};

const sanitizeUsername = (value) => {
  if (!value) {
    return null;
  }
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '');
};

const ensureUniqueValue = async (field, value, targetId, transaction) => {
  if (!value) return true;

  const existing = await db.Customer.findOne({
    where: { [field]: value },
    transaction,
    attributes: ['id']
  });

  return !existing || existing.id === targetId;
};

const applyUpdates = async (target, fields, options = {}) => {
  const { email, phone, customerName, usernameHints } = fields;
  const { transaction } = options;
  const updates = {};

  if (email && !target.email) {
    if (await ensureUniqueValue('email', email, target.id, transaction)) {
      updates.email = email;
    } else {
      console.warn('[customerSync] Skipping email update due to duplicate', {
        customerId: target.id,
        email
      });
    }
  }

  if (phone && !target.phone) {
    if (await ensureUniqueValue('phone', phone, target.id, transaction)) {
      updates.phone = phone;
    } else {
      console.warn('[customerSync] Skipping phone update due to duplicate', {
        customerId: target.id,
        phone
      });
    }
  }

  if (customerName && customerName !== target.customerName) {
    updates.customerName = customerName;
  }

  if (!target.username && Array.isArray(usernameHints) && usernameHints.length) {
    for (const hint of usernameHints) {
      if (!hint) continue;
      const available = await ensureUniqueValue('username', hint, target.id, transaction);
      if (available) {
        updates.username = hint;
        break;
      }
    }
  }

  if (Object.keys(updates).length) {
    await target.update(updates, { transaction });
  }

  return target;
};

const ensureCustomerFromOrder = async (order, options = {}) => {
  if (!order) {
    return null;
  }

  const transaction = options.transaction || null;
  const orderData = order.toJSON ? order.toJSON() : order;

  const customerName =
    typeof orderData.customerName === 'string'
      ? orderData.customerName.trim()
      : orderData.customerName != null
      ? String(orderData.customerName).trim()
      : null;

  const email =
    typeof orderData.customerEmail === 'string'
      ? orderData.customerEmail.trim().toLowerCase()
      : orderData.customerEmail != null
      ? String(orderData.customerEmail).trim().toLowerCase()
      : null;

  const phone = normalizePhoneNumber(orderData.customerPhone);

  const usernameHints = [
    email,
    phone,
    customerName ? customerName.replace(/\s+/g, '') : null,
    orderData.customerPhone ? String(orderData.customerPhone).trim() : null,
    orderData.customerEmail ? String(orderData.customerEmail).trim().toLowerCase() : null,
    orderData.id ? `customer-${orderData.id}` : null
  ]
    .map(sanitizeUsername)
    .filter(Boolean);

  const lookupConditions = [];
  if (email) {
    lookupConditions.push({ email });
    lookupConditions.push({ username: email });
  }
  if (phone) {
    lookupConditions.push({ phone });
    lookupConditions.push({ username: phone });
  }

  usernameHints.forEach((hint) => {
    lookupConditions.push({ username: hint });
  });

  let customer = null;
  if (lookupConditions.length) {
    customer = await db.Customer.findOne({
      where: {
        [Op.or]: lookupConditions
      },
      transaction
    });
  }

  if (!customer) {
    let usernameCandidate = null;

    for (const hint of usernameHints) {
      if (!hint) {
        continue;
      }
      const existing = await db.Customer.findOne({
        where: { username: hint },
        transaction
      });
      if (!existing) {
        usernameCandidate = hint;
        break;
      }
    }

    if (!usernameCandidate) {
      let counter = 0;
      while (counter < 5) {
        const candidate =
          usernameHints[0] || `customer-${orderData.id || Date.now()}-${counter || ''}`;
        const sanitizedCandidate = sanitizeUsername(candidate || '');
        if (sanitizedCandidate) {
          const existing = await db.Customer.findOne({
            where: { username: sanitizedCandidate },
            transaction
          });
          if (!existing) {
            usernameCandidate = sanitizedCandidate;
            break;
          }
        }
        counter += 1;
      }
    }

    if (!usernameCandidate) {
      usernameCandidate = `customer-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    try {
      customer = await db.Customer.create(
        {
          username: usernameCandidate,
          customerName: customerName || null,
          email: email || null,
          phone: phone || null,
          hasSetPassword: false
        },
        { transaction }
      );
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        customer = await db.Customer.findOne({
          where: {
            [Op.or]: lookupConditions
          },
          transaction
        });
        if (!customer) {
          throw error;
        }
        await applyUpdates(customer, { email, phone, customerName, usernameHints }, { transaction });
      } else {
        throw error;
      }
    }
  } else {
    await applyUpdates(customer, { email, phone, customerName, usernameHints }, { transaction });
  }

  return customer;
};

const syncCustomersFromOrders = async () => {
  const orders = await db.Order.findAll({
    attributes: ['id', 'customerName', 'customerPhone', 'customerEmail', 'createdAt'],
    order: [['createdAt', 'ASC']]
  });

  for (const order of orders) {
    await ensureCustomerFromOrder(order);
  }
};

module.exports = {
  ensureCustomerFromOrder,
  syncCustomersFromOrders,
  normalizePhoneNumber,
  generatePhoneVariants
};






