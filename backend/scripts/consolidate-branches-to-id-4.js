/**
 * Script to consolidate all orders to branch_id 4 and delete other branches
 * Run with: node backend/scripts/consolidate-branches-to-id-4.js
 */

const db = require('../models');

async function consolidateBranches() {
  try {
    console.log('🔄 Starting branch consolidation...');
    
    // First, check if branch 4 exists
    let targetBranch = await db.Branch.findByPk(4);
    
    if (!targetBranch) {
      console.log('⚠️  Branch ID 4 does not exist. Checking available branches...');
      
      // Find the first active branch, or fall back to branch with ID 1
      targetBranch = await db.Branch.findOne({
        where: { isActive: true },
        order: [['id', 'ASC']]
      });
      
      if (!targetBranch) {
        targetBranch = await db.Branch.findByPk(1);
      }
      
      if (!targetBranch) {
        console.error('❌ Error: No branches found in database!');
        process.exit(1);
      }
      
      console.log(`⚠️  Branch ID 4 not found. Using branch: ${targetBranch.name} (ID: ${targetBranch.id})`);
      console.log(`   Note: Orders will be set to branch ID ${targetBranch.id}, not 4.`);
      console.log(`   You can manually update branch ID in database if needed.\n`);
    } else {
      console.log(`✅ Found branch: ${targetBranch.name} (ID: 4)`);
    }
    
    // Get count of orders before update
    const totalOrders = await db.Order.count();
    const ordersWithOtherBranches = await db.Order.count({
      where: {
        branchId: {
          [db.Sequelize.Op.ne]: 4,
          [db.Sequelize.Op.ne]: null
        }
      }
    });
    
    console.log(`📊 Total orders: ${totalOrders}`);
    console.log(`📊 Orders with other branches (not 4): ${ordersWithOtherBranches}`);
    
    const targetBranchId = targetBranch.id;
    
    // Update all orders to target branch (including null ones)
    console.log(`\n📝 Updating all orders to branch_id ${targetBranchId}...`);
    const [updatedCount] = await db.Order.update(
      { branchId: targetBranchId },
      { 
        where: {
          [db.Sequelize.Op.or]: [
            { branchId: { [db.Sequelize.Op.ne]: targetBranchId } },
            { branchId: null }
          ]
        }
      }
    );
    
    console.log(`✅ Updated ${updatedCount} orders to branch_id ${targetBranchId}`);
    
    // Get list of all branches except target branch
    const branchesToDelete = await db.Branch.findAll({
      where: {
        id: { [db.Sequelize.Op.ne]: targetBranchId }
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
    const ordersWithTargetBranch = await db.Order.count({ where: { branchId: targetBranchId } });
    
    console.log('\n📊 Final Status:');
    console.log(`   Branches remaining: ${remainingBranches.length}`);
    remainingBranches.forEach(branch => {
      console.log(`   - ${branch.name} (ID: ${branch.id})`);
    });
    console.log(`   Orders with branch_id ${targetBranchId}: ${ordersWithTargetBranch} / ${totalOrders}`);
    
    console.log('\n✅ Branch consolidation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error consolidating branches:', error);
    process.exit(1);
  }
}

// Run the script
consolidateBranches();
