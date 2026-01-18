/**
 * Script to create branch ID 4 (if needed) and consolidate all orders to it
 * This will first try to create branch 4, then consolidate
 * Run with: node backend/scripts/create-branch-4-and-consolidate.js
 */

const db = require('../models');

async function createBranch4AndConsolidate() {
  try {
    console.log('🔄 Starting branch consolidation to ID 4...');
    
    // First, check if branch 4 exists
    let branch4 = await db.Branch.findByPk(4);
    
    if (!branch4) {
      console.log('📝 Branch ID 4 does not exist. Creating it...');
      
      // Get the first active branch as template, or use defaults
      const templateBranch = await db.Branch.findOne({
        where: { isActive: true },
        order: [['id', 'ASC']]
      });
      
      // Create branch 4
      // Note: We can't directly set ID 4 with auto-increment, so we'll use raw SQL
      const [result] = await db.sequelize.query(`
        INSERT INTO branches (id, name, address, "isActive", "createdAt", "updatedAt")
        VALUES (4, 'Main Branch', 'Nairobi, Kenya', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING *;
      `);
      
      if (result && result.length > 0) {
        branch4 = await db.Branch.findByPk(4);
        console.log(`✅ Created branch: ${branch4.name} (ID: 4)`);
      } else {
        // If ID 4 already exists (unlikely), fetch it
        branch4 = await db.Branch.findByPk(4);
        if (branch4) {
          console.log(`✅ Found existing branch: ${branch4.name} (ID: 4)`);
        } else {
          console.error('❌ Failed to create branch ID 4');
          process.exit(1);
        }
      }
    } else {
      console.log(`✅ Branch already exists: ${branch4.name} (ID: 4)`);
    }
    
    // Get count of orders before update
    const totalOrders = await db.Order.count();
    const ordersWithOtherBranches = await db.Order.count({
      where: {
        [db.Sequelize.Op.or]: [
          { branchId: { [db.Sequelize.Op.ne]: 4 } },
          { branchId: null }
        ]
      }
    });
    
    console.log(`📊 Total orders: ${totalOrders}`);
    console.log(`📊 Orders that need updating: ${ordersWithOtherBranches}`);
    
    // Update all orders to branch_id 4 (including null ones)
    console.log('\n📝 Updating all orders to branch_id 4...');
    const [updatedCount] = await db.Order.update(
      { branchId: 4 },
      { 
        where: {
          [db.Sequelize.Op.or]: [
            { branchId: { [db.Sequelize.Op.ne]: 4 } },
            { branchId: null }
          ]
        }
      }
    );
    
    console.log(`✅ Updated ${updatedCount} orders to branch_id 4`);
    
    // Get list of all branches except ID 4
    const branchesToDelete = await db.Branch.findAll({
      where: {
        id: { [db.Sequelize.Op.ne]: 4 }
      }
    });
    
    console.log(`\n🗑️  Found ${branchesToDelete.length} branches to delete:`);
    branchesToDelete.forEach(branch => {
      console.log(`   - ${branch.name} (ID: ${branch.id})`);
    });
    
    // Delete all branches except ID 4
    if (branchesToDelete.length > 0) {
      const branchIdsToDelete = branchesToDelete.map(b => b.id);
      
      console.log('\n🗑️  Deleting branches...');
      const deletedCount = await db.Branch.destroy({
        where: {
          id: { [db.Sequelize.Op.in]: branchIdsToDelete }
        }
      });
      
      console.log(`✅ Deleted ${deletedCount} branches`);
    } else {
      console.log('\n✅ No branches to delete (only branch 4 exists)');
    }
    
    // Verify final state
    const remainingBranches = await db.Branch.findAll();
    const ordersWithBranch4 = await db.Order.count({ where: { branchId: 4 } });
    
    console.log('\n📊 Final Status:');
    console.log(`   Branches remaining: ${remainingBranches.length}`);
    remainingBranches.forEach(branch => {
      console.log(`   - ${branch.name} (ID: ${branch.id})`);
    });
    console.log(`   Orders with branch_id 4: ${ordersWithBranch4} / ${totalOrders}`);
    
    console.log('\n✅ Branch consolidation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error consolidating branches:', error);
    process.exit(1);
  }
}

// Run the script
createBranch4AndConsolidate();
