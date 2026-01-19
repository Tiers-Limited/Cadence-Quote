/**
 * Script to seed default pricing schemes for all existing tenants
 * Run this once to update existing database
 */

const { createDefaultPricingSchemesForTenant } = require('./20250113-create-default-pricing-schemes');
const models = require('../models');
const { Tenant } = models;

async function seedAllTenants() {
  try {
    console.log('🌱 Starting pricing schemes seeding for all tenants...');
    
    // Get all active tenants
    const tenants = await Tenant.findAll({
      where: { isActive: true },
      attributes: ['id', 'companyName']
    });

    console.log(`Found ${tenants.length} tenants to process`);

    let successCount = 0;
    let skipCount = 0;

    for (const tenant of tenants) {
      try {
        console.log(`Processing tenant: ${tenant.companyName} (ID: ${tenant.id})`);
        await createDefaultPricingSchemesForTenant(tenant.id, models);
        successCount++;
        console.log(`✓ Successfully processed tenant ${tenant.id}`);
      } catch (error) {
        if (error.message && error.message.includes('already exist')) {
          skipCount++;
          console.log(`⊘ Skipped tenant ${tenant.id} (already has schemes)`);
        } else {
          console.error(`✗ Error processing tenant ${tenant.id}:`, error.message);
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`Total tenants: ${tenants.length}`);
    console.log(`Successfully seeded: ${successCount}`);
    console.log(`Skipped (already exists): ${skipCount}`);
    console.log(`Failed: ${tenants.length - successCount - skipCount}`);
    
    console.log('\n✅ Seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeder
seedAllTenants();
