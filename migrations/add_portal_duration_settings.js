// Migration to add portal duration control fields to ContractorSettings

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add portal duration fields to contractor_settings table
    await queryInterface.addColumn('contractor_settings', 'portal_duration_days', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 14,
      comment: 'Number of days customer portal remains open after deposit'
    });

    await queryInterface.addColumn('contractor_settings', 'portal_auto_lock', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      comment: 'Automatically lock portal after duration expires'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove portal duration fields
    await queryInterface.removeColumn('contractor_settings', 'portal_duration_days');
    await queryInterface.removeColumn('contractor_settings', 'portal_auto_lock');
  }
};
