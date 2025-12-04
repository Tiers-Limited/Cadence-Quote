// models/ProposalDefaults.js
// Comprehensive model for all proposal default sections
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Tenant = require('./Tenant');

const ProposalDefaults = sequelize.define('ProposalDefaults', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: Tenant,
      key: 'id'
    },
    onDelete: 'CASCADE',
    field: 'tenant_id'
  },

  // ===== 1. MESSAGING & INTRODUCTION =====
  defaultWelcomeMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'default_welcome_message',
    defaultValue: 'Thank you for considering us for your painting project. We are committed to delivering exceptional quality and service.'
  },
  aboutUsSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'about_us_summary',
    defaultValue: 'We are a professional painting company with years of experience in residential and commercial projects.'
  },

  // ===== 2. PROCESSES =====
  interiorProcess: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'interior_process',
    defaultValue: `1. Surface preparation and repair
2. Masking and protection of surrounding areas
3. Primer application (if needed)
4. Two coats of premium paint
5. Final inspection and cleanup`
  },
  exteriorProcess: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'exterior_process',
    defaultValue: `1. Power washing and surface cleaning
2. Scraping and sanding loose paint
3. Caulking and weather sealing
4. Primer application
5. Two coats of exterior paint
6. Final inspection`
  },
  cabinetProcess: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cabinet_process',
    defaultValue: `1. Remove hardware and doors
2. Thorough cleaning and degreasing
3. Sanding and surface preparation
4. Primer application
5. Multiple coats of cabinet paint
6. Reinstallation and final touches`
  },
  trimProcess: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'trim_process',
    defaultValue: `1. Surface cleaning and sanding
2. Fill nail holes and imperfections
3. Caulking gaps and seams
4. Primer application (if needed)
5. Two coats of trim paint
6. Clean lines and professional finish`
  },
  drywallRepairProcess: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'drywall_repair_process',
    defaultValue: `1. Assessment of damage
2. Cut and remove damaged drywall
3. Install new drywall patch
4. Joint compound application
5. Sanding and texturing to match
6. Prime and paint to blend`
  },

  // ===== 3. WARRANTY =====
  standardWarranty: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'standard_warranty',
    defaultValue: `2-Year Workmanship Warranty
- Covers peeling, cracking, and adhesion issues
- Valid under normal wear and conditions
- Excludes damage from external factors`
  },
  premiumWarranty: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'premium_warranty',
    defaultValue: `5-Year Premium Warranty
- Extended coverage on materials and workmanship
- Includes touch-ups and minor repairs
- Priority service for warranty claims`
  },
  exteriorWarranty: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'exterior_warranty',
    defaultValue: `5-Year Exterior Warranty
- UV and weather-resistant coverage
- Protection against fading and peeling
- Annual inspection available`
  },

  // ===== 4. PAYMENTS =====
  paymentTermsText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'payment_terms_text',
    defaultValue: `- 50% deposit required to begin work
- 25% due at project midpoint
- 25% final payment upon completion
- Net 30 terms for approved commercial accounts`
  },
  paymentMethods: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'payment_methods',
    defaultValue: `We accept the following payment methods:
- Credit/Debit Cards (Visa, Mastercard, Amex)
- ACH Bank Transfer
- Check
- Cash`
  },
  latePaymentPolicy: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'late_payment_policy',
    defaultValue: `- Payments are due as specified in the payment schedule
- Late fees of 1.5% per month apply to overdue balances
- Work may be paused if payment becomes 15+ days overdue`
  },

  // ===== 5. RESPONSIBILITIES =====
  clientResponsibilities: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'client_responsibilities',
    defaultValue: `Client agrees to:
- Move or protect furniture and personal items
- Provide access to work areas and utilities
- Remove wall hangings and decorations
- Keep pets secured during work hours
- Maintain a safe work environment`
  },
  contractorResponsibilities: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'contractor_responsibilities',
    defaultValue: `We guarantee to:
- Arrive on time and work professional hours
- Protect your property with drop cloths
- Use quality materials as specified
- Clean up daily and at project completion
- Perform work to industry standards`
  },

  // ===== 6. POLICIES =====
  touchUpPolicy: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'touch_up_policy',
    defaultValue: `- Complimentary touch-ups within 30 days of completion
- Additional touch-ups available at hourly rate
- Paint samples provided for future touch-ups`
  },
  finalWalkthroughPolicy: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'final_walkthrough_policy',
    defaultValue: `- Schedule walk-through upon project completion
- Document and address any punch-list items
- Final payment due after walk-through approval
- Customer signature required for completion`
  },
  changeOrderPolicy: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'change_order_policy',
    defaultValue: `- All scope changes require written approval
- Additional work priced at standard rates
- Change orders may affect timeline
- Payment terms adjusted accordingly`
  },
  colorDisclaimer: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'color_disclaimer',
    defaultValue: `Color Disclaimer: Colors may appear different under various lighting conditions. We recommend testing samples in your space. We are not responsible for color dissatisfaction after approval.`
  },
  surfaceConditionDisclaimer: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'surface_condition_disclaimer',
    defaultValue: `Surface Condition: Pre-existing surface damage, cracks, or imperfections may remain visible or worsen after painting. Additional repair work is quoted separately.`
  },
  paintFailureDisclaimer: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'paint_failure_disclaimer',
    defaultValue: `Paint Failure: We are not responsible for paint failure due to moisture issues, substrate problems, or manufacturer defects beyond our control.`
  },
  generalProposalDisclaimer: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'general_proposal_disclaimer',
    defaultValue: `This proposal is based on accessible and visible conditions. Hidden damage or unforeseen conditions may require additional work at additional cost. Prices valid for 30 days.`
  },

  // ===== 7. PRODUCT / PRICING DEFAULTS =====
  gbbSetupEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'gbb_setup_enabled',
    comment: 'Enable Good-Better-Best product strategy'
  },
  singleSystemEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'single_system_enabled',
    comment: 'Enable single product system'
  },
  defaultProductList: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'default_product_list',
    defaultValue: [],
    comment: 'Array of default product IDs that appear first'
  },
  defaultGallonPricing: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'default_gallon_pricing',
    defaultValue: {
      good: 35,
      better: 45,
      best: 60
    },
    comment: 'Default price per gallon by tier'
  },

  // ===== 8. PORTFOLIO & EXTRAS =====
  pastProjects: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'past_projects',
    defaultValue: [],
    comment: 'Array of project images/descriptions'
  },
  testimonials: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'testimonials',
    defaultValue: [],
    comment: 'Array of customer testimonials'
  },
  companyLogo: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'company_logo',
    comment: 'URL to company logo'
  },
  brandColors: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'brand_colors',
    defaultValue: {
      primary: '#1890ff',
      secondary: '#52c41a'
    },
    comment: 'Company brand colors for proposals'
  },

  // ===== 9. ACCEPTANCE =====
  legalAcknowledgement: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'legal_acknowledgement',
    defaultValue: `By signing below, you acknowledge that you have read, understood, and agree to all terms and conditions outlined in this proposal, including payment terms, warranties, and disclaimers.`
  },
  signatureStatement: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'signature_statement',
    defaultValue: `Digital signatures are legally binding and constitute acceptance of this proposal as a binding contract.`
  },

  // Timestamps
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  timestamps: true,
  tableName: 'proposal_defaults',
  indexes: [
    {
      fields: ['tenant_id']
    }
  ]
});

ProposalDefaults.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasOne(ProposalDefaults, { foreignKey: 'tenantId', as: 'proposalDefaults' });

module.exports = ProposalDefaults;
