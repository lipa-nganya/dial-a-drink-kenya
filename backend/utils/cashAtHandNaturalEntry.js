const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('./orderFinancials');

const isPayNowDeliveryFeeSettlement = (tx) => {
  const n = tx.notes || '';
  return n.includes('Cash at hand − 50% delivery fee') || n.includes('Pay Now: 50% delivery fee - cash at hand');
};

/**
 * Recompute the natural (non-override) cash-at-hand line for one entryKey.
 * Matches logic in routes/driver-wallet.js GET /:driverId/cash-at-hand.
 * @returns {Promise<{
 *   entryKey: string,
 *   type: string,
 *   naturalDebit: number|null,
 *   naturalCredit: number|null,
 *   naturalAmount: number
 * }|null>}
 */
async function getNaturalCashAtHandEntry(driverId, entryKey) {
  const did = parseInt(driverId, 10);
  if (!Number.isFinite(did) || did < 1) return null;

  const mCod = /^cod_order:(\d+)$/.exec(entryKey);
  const mSet = /^settlement_tx:(\d+)$/.exec(entryKey);
  const mSub = /^submission:(\d+)$/.exec(entryKey);

  const completionLedgerRows = await db.Transaction.findAll({
    where: {
      driverId: did,
      transactionType: 'cash_settlement',
      paymentProvider: 'order_completion',
      status: { [Op.in]: ['completed', 'pending'] }
    },
    attributes: ['orderId']
  });
  const orderIdsWithCompletionLedger = new Set(
    (completionLedgerRows || []).map((t) => t.orderId).filter(Boolean)
  );

  const cashSettlementsNegative = await db.Transaction.findAll({
    where: {
      driverId: did,
      transactionType: 'cash_settlement',
      status: { [Op.in]: ['completed', 'pending'] },
      amount: { [Op.lt]: 0 }
    },
    attributes: ['orderId']
  });
  const orderIdsWithSettlementFromTx = new Set(
    (cashSettlementsNegative || []).map((tx) => tx.orderId).filter(Boolean)
  );

  if (mCod) {
    const orderId = parseInt(mCod[1], 10);
    const order = await db.Order.findOne({
      where: {
        id: orderId,
        driverId: did,
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      attributes: ['id', 'territoryDeliveryFee', 'deliveryAddress']
    });
    if (!order) return null;
    // NOTE: The cash-at-hand endpoint may emit `cod_order:<orderId>` both for synthetic COD rows
    // and for persisted completion-ledger rows (paymentProvider='order_completion').
    // Admin overrides must be able to target either representation, so we do NOT reject when
    // an order_completion ledger exists.

    let orderValue = 0;
    let withheldAmount = 0;
    let netChange = 0;
    try {
      const breakdown = await getOrderFinancialBreakdown(order.id);
      const itemsTotal = parseFloat(breakdown.itemsTotal || 0) || 0;
      const convenienceFee = parseFloat(breakdown.deliveryFee || 0) || 0;
      const territoryFee = parseFloat(order.territoryDeliveryFee ?? convenienceFee) || 0;
      orderValue = itemsTotal + convenienceFee;
      withheldAmount = territoryFee * 0.5;
      netChange = orderValue - withheldAmount;
    } catch (e) {
      return null;
    }

    return {
      entryKey,
      type: 'cash_received',
      naturalDebit: withheldAmount,
      naturalCredit: orderValue,
      naturalAmount: netChange
    };
  }

  if (mSet) {
    const txId = parseInt(mSet[1], 10);
    const tx = await db.Transaction.findOne({
      where: { id: txId, driverId: did, transactionType: 'cash_settlement' },
      include: [
        { model: db.Order, as: 'order', attributes: ['id', 'deliveryAddress', 'territoryDeliveryFee'], required: false }
      ]
    });
    if (!tx) return null;

    const txAmount = parseFloat(tx.amount) || 0;
    const entryType = txAmount < 0 || isPayNowDeliveryFeeSettlement(tx) ? 'cash_sent' : 'cash_received';

    if (entryType === 'cash_received' && tx.orderId) {
      try {
        const breakdown = await getOrderFinancialBreakdown(tx.orderId);
        const itemsTotal = parseFloat(breakdown.itemsTotal || 0) || 0;
        const convenienceFee = parseFloat(breakdown.deliveryFee || 0) || 0;
        const orderValue = itemsTotal + convenienceFee;
        return {
          entryKey,
          type: 'cash_received',
          naturalDebit: null,
          naturalCredit: orderValue,
          naturalAmount: Math.abs(txAmount)
        };
      } catch (e) {
        return {
          entryKey,
          type: 'cash_received',
          naturalDebit: null,
          naturalCredit: null,
          naturalAmount: Math.abs(txAmount)
        };
      }
    }

    return {
      entryKey,
      type: entryType,
      naturalDebit: entryType === 'cash_sent' ? Math.abs(txAmount) : null,
      naturalCredit: null,
      naturalAmount: Math.abs(txAmount)
    };
  }

  if (mSub) {
    const subId = parseInt(mSub[1], 10);
    const submission = await db.CashSubmission.findOne({
      where: { id: subId, driverId: did, status: 'approved' },
      attributes: ['id', 'amount', 'createdAt', 'submissionType', 'details']
    });
    if (!submission) return null;
    if (
      submission.submissionType === 'order_payment' &&
      submission.details?.orderId != null &&
      orderIdsWithSettlementFromTx.has(submission.details.orderId)
    ) {
      return null;
    }

    const amt = parseFloat(submission.amount || 0) || 0;
    return {
      entryKey,
      type: 'cash_submission',
      naturalDebit: amt,
      naturalCredit: null,
      naturalAmount: amt
    };
  }

  return null;
}

/**
 * Effective net for one line after applying optional debit/credit overrides (same rules as driver-wallet GET merge).
 * @param {{ type: string, naturalDebit: number|null, naturalCredit: number|null, naturalAmount: number }} natural
 * @param {{ debitAmount?: number|null, creditAmount?: number|null }|null} o
 */
function computeEffectiveNet(natural, o) {
  if (!natural) return 0;
  if (!o) return natural.naturalAmount;

  const e = {
    type: natural.type,
    debitAmount: natural.naturalDebit,
    creditAmount: natural.naturalCredit
  };
  if (o.debitAmount != null) e.debitAmount = parseFloat(o.debitAmount);
  if (o.creditAmount != null) e.creditAmount = parseFloat(o.creditAmount);

  if (natural.type === 'cash_received' && (o.debitAmount != null || o.creditAmount != null)) {
    const d = parseFloat(e.debitAmount != null ? e.debitAmount : 0);
    const c = parseFloat(e.creditAmount != null ? e.creditAmount : 0);
    return c - d;
  }
  if (o.debitAmount != null && natural.type !== 'cash_received') {
    return Math.abs(parseFloat(o.debitAmount));
  }
  return natural.naturalAmount;
}

module.exports = { getNaturalCashAtHandEntry, computeEffectiveNet };
