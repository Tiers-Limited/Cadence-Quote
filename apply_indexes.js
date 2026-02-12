const sequelize = require('./config/database');

async function applyIndexes() {
    try {
        console.log('🚀 Starting Index Optimization...');

        const queries = [
            // quotes Indexes
            'CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status_created ON "quotes" (tenant_id, status, created_at);',
            'CREATE INDEX IF NOT EXISTS idx_quotes_tenant_active_status ON "quotes" (tenant_id, is_active, status);',
            'CREATE INDEX IF NOT EXISTS idx_quotes_tenant_created ON "quotes" (tenant_id, created_at);',

            // product_configs Indexes
            'CREATE INDEX IF NOT EXISTS idx_productconfigs_tenant_active ON "product_configs" (tenant_id, is_active);',

            // labor_rates Indexes
            'CREATE INDEX IF NOT EXISTS idx_laborrates_tenant_active ON "labor_rates" (tenant_id, is_active);',

            // jobs Indexes
            'CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON "jobs" (tenant_id, status);',
            'CREATE INDEX IF NOT EXISTS idx_jobs_tenant_payment ON "jobs" (tenant_id, final_payment_status, final_payment_transaction_id);',
            'CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON "jobs" (scheduled_start_date);',

            // magic_links Indexes
            'CREATE INDEX IF NOT EXISTS idx_magiclinks_token_expiry ON "magic_links" (token, "expiresAt");'
        ];

        for (const query of queries) {
            console.log(`🔧 Executing: ${query}`);
            await sequelize.query(query);
        }

        console.log('✅ Index Optimization Complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Index Optimization Failed:', error);
        process.exit(1);
    }
}

applyIndexes();
