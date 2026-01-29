const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const JobAnalytics = sequelize.define('JobAnalytics', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    quoteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'quotes',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Tenants',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    jobPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      },
      
    },
    actualMaterialCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      
    },
    actualLaborCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      },
      
    },
    allocatedOverhead: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      },
      
    },
    netProfit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      
    },
    materialPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      },
      
    },
    laborPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      },
      
    },
    overheadPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      },
      
    },
    profitPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: -100,
        max: 100
      },
      
    },
    materialSource: {
      type: DataTypes.ENUM('actual', 'estimated'),
      allowNull: false,
      defaultValue: 'estimated',
      
    },
    laborSource: {
      type: DataTypes.ENUM('actual', 'target', 'default'),
      allowNull: false,
      defaultValue: 'default',
      
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'job_analytics',
    timestamps: true,
    indexes: [
      {
        fields: ['quoteId'],
        unique: true,
        name: 'job_analytics_quote_id_unique'
      },
      {
        fields: ['tenantId'],
        name: 'job_analytics_tenant_id_index'
      },
      {
        fields: ['calculatedAt'],
        name: 'job_analytics_calculated_at_index'
      },
      {
        fields: ['tenantId', 'calculatedAt'],
        name: 'job_analytics_tenant_calculated_index'
      }
    ],
    validate: {
      // Ensure percentages sum to approximately 100%
      percentagesTotalValid() {
        const total = parseFloat(this.materialPercentage) + 
                     parseFloat(this.laborPercentage) + 
                     parseFloat(this.overheadPercentage) + 
                     parseFloat(this.profitPercentage);
        
        if (Math.abs(total - 100) > 0.01) {
          throw new Error('Cost percentages must sum to 100%');
        }
      },
      
      // Ensure amounts sum to job price
      amountsTotalValid() {
        const materialCost = this.actualMaterialCost || 0;
        const laborCost = this.actualLaborCost || 0;
        const total = parseFloat(materialCost) + 
                     parseFloat(laborCost) + 
                     parseFloat(this.allocatedOverhead) + 
                     parseFloat(this.netProfit);
        
        if (Math.abs(total - parseFloat(this.jobPrice)) > 0.01) {
          throw new Error('Cost amounts must sum to job price');
        }
      }
    }
  });

  // Define associations
  JobAnalytics.associate = (models) => {
    // Each JobAnalytics belongs to one Quote
    JobAnalytics.belongsTo(models.Quote, {
      foreignKey: 'quoteId',
      as: 'quote',
      onDelete: 'CASCADE'
    });

    // Each JobAnalytics belongs to one Tenant
    JobAnalytics.belongsTo(models.Tenant, {
      foreignKey: 'tenantId',
      as: 'tenant',
      onDelete: 'CASCADE'
    });
  };

  // Instance methods
  JobAnalytics.prototype.getBreakdown = function() {
    return {
      materials: {
        amount: parseFloat(this.actualMaterialCost || 0),
        percentage: parseFloat(this.materialPercentage),
        source: this.materialSource
      },
      labor: {
        amount: parseFloat(this.actualLaborCost || 0),
        percentage: parseFloat(this.laborPercentage),
        source: this.laborSource
      },
      overhead: {
        amount: parseFloat(this.allocatedOverhead),
        percentage: parseFloat(this.overheadPercentage),
        source: 'target'
      },
      profit: {
        amount: parseFloat(this.netProfit),
        percentage: parseFloat(this.profitPercentage),
        source: 'calculated'
      }
    };
  };

  JobAnalytics.prototype.isHealthy = function() {
    return parseFloat(this.profitPercentage) >= 8;
  };

  JobAnalytics.prototype.getHealthStatus = function() {
    const profitPercent = parseFloat(this.profitPercentage);
    
    if (profitPercent < 8) return 'poor';
    if (profitPercent < 12) return 'fair';
    return 'good';
  };

  return JobAnalytics;
};