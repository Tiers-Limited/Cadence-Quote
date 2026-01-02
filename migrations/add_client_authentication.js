// Migration to add authentication fields to clients table

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add authentication fields to clients table
    await queryInterface.addColumn('clients', 'password', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Hashed password for client portal access'
    });

    await queryInterface.addColumn('clients', 'has_portal_access', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'Whether client has been granted portal access'
    });

    await queryInterface.addColumn('clients', 'portal_invited_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When invitation email was sent'
    });

    await queryInterface.addColumn('clients', 'portal_activated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When client first logged into portal'
    });

    await queryInterface.addColumn('clients', 'email_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'Whether email has been verified'
    });

    await queryInterface.addColumn('clients', 'email_verified_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('clients', 'verification_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('clients', 'verification_token_expiry', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('clients', 'password_reset_token', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('clients', 'password_reset_expiry', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('clients', 'last_login_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Add index for verification token lookups
    await queryInterface.addIndex('clients', ['verification_token']);
    await queryInterface.addIndex('clients', ['password_reset_token']);
    await queryInterface.addIndex('clients', ['has_portal_access']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('clients', ['verification_token']);
    await queryInterface.removeIndex('clients', ['password_reset_token']);
    await queryInterface.removeIndex('clients', ['has_portal_access']);

    // Remove columns
    await queryInterface.removeColumn('clients', 'password');
    await queryInterface.removeColumn('clients', 'has_portal_access');
    await queryInterface.removeColumn('clients', 'portal_invited_at');
    await queryInterface.removeColumn('clients', 'portal_activated_at');
    await queryInterface.removeColumn('clients', 'email_verified');
    await queryInterface.removeColumn('clients', 'email_verified_at');
    await queryInterface.removeColumn('clients', 'verification_token');
    await queryInterface.removeColumn('clients', 'verification_token_expiry');
    await queryInterface.removeColumn('clients', 'password_reset_token');
    await queryInterface.removeColumn('clients', 'password_reset_expiry');
    await queryInterface.removeColumn('clients', 'last_login_at');
  }
};
