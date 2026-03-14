/**
 * One-off: set quantity to 1 for purchase items that have quantity 0 or null.
 * Run against production: DATABASE_URL=<prod> node backend/scripts/fix-purchase-quantities.js
 */

const db = require('../models');

function normalizeDetails(details) {
  if (!details || typeof details !== 'object') return details;
  const out = { ...details };

  // Multiple items: details.items[]
  if (Array.isArray(out.items) && out.items.length > 0) {
    out.items = out.items.map((item) => {
      const qty = Number(item.quantity);
      const fixed = { ...item };
      if (!Number.isFinite(qty) || qty < 1) {
        fixed.quantity = 1;
      }
      return fixed;
    });
    return out;
  }

  // Single item: details.item, details.price, details.quantity
  if (out.item != null && (out.price != null || out.amount != null)) {
    const qty = Number(out.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      out.quantity = 1;
    }
    return out;
  }

  return out;
}

async function main() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected.\n');

    const submissions = await db.CashSubmission.findAll({
      where: { submissionType: 'purchases' },
      order: [['id', 'ASC']],
      raw: true
    });

    console.log(`Found ${submissions.length} purchase submission(s).\n`);

    let updated = 0;
    for (const row of submissions) {
      const details = row.details;
      const normalized = normalizeDetails(details);
      if (JSON.stringify(normalized) === JSON.stringify(details)) continue; // no change

      await db.CashSubmission.update(
        { details: normalized },
        { where: { id: row.id } }
      );
      console.log(`Updated submission id=${row.id} (amount=${row.amount}).`);
      updated++;
    }

    console.log(`\nDone. Updated ${updated} of ${submissions.length} purchase(s).`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

main();
