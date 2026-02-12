const sequelize = require('./config/database');

async function debugSchema() {
    try {
        const [results] = await sequelize.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('quotes', 'product_configs', 'labor_rates', 'jobs', 'magic_links')
        `);

        const schema = {};
        results.forEach(row => {
            if (!schema[row.table_name]) schema[row.table_name] = [];
            schema[row.table_name].push(row.column_name);
        });

        console.log(JSON.stringify(schema, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

debugSchema();
