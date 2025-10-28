// controllers/settingsController.js
const ContractorSettings = require('../models/ContractorSettings');
const Tenant = require('../models/Tenant');

/**
 * Get contractor settings
 * GET /api/settings
 */
const getSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    let settings = await ContractorSettings.findOne({
      where: { tenantId },
      include: [{
        model: Tenant,
        attributes: ['id', 'companyName', 'email', 'phoneNumber', 'businessAddress', 'tradeType']
      }]
    });

    // If no settings exist, create default settings
    if (!settings) {
      settings = await ContractorSettings.create({
        tenantId,
        defaultMarkupPercentage: 30.00,
        taxRatePercentage: 8.25,
        depositPercentage: 50.00,
        paymentTerms: '- 50% deposit required to begin work\n- Remaining balance due upon completion\n- Net 30 payment terms for approved commercial accounts',
        warrantyTerms: '- 2-year warranty on all interior work\n- 5-year warranty on exterior work\n- Warranty covers peeling, cracking, and fading under normal conditions',
        generalTerms: '- All work performed by licensed and insured contractors\n- Customer responsible for moving furniture and personal items\n- Weather delays may affect exterior project timelines',
        businessHours: 'Monday-Friday: 8:00 AM - 6:00 PM',
        quoteValidityDays: 30
      });

      // Reload with tenant info
      settings = await ContractorSettings.findOne({
        where: { tenantId },
        include: [{
          model: Tenant,
          attributes: ['id', 'companyName', 'email', 'phoneNumber', 'businessAddress', 'tradeType']
        }]
      });
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve settings'
    });
  }
};

/**
 * Update company information
 * PUT /api/settings/company
 */
// const updateCompanyInfo = async (req, res) => {
//   try {
//     const tenantId = req.user.tenantId;
//     const {
//       companyName,
//       email,
//       phoneNumber,
//       businessAddress,
//       tradeType
//     } = req.body;

//     const tenant = await Tenant.findByPk(tenantId);
//     if (!tenant) {
//       return res.status(404).json({
//         success: false,
//         message: 'Tenant not found'
//       });
//     }

//     await tenant.update({
//       companyName: companyName || tenant.companyName,
//       email: email || tenant.email,
//       phoneNumber: phoneNumber || tenant.phoneNumber,
//       businessAddress: businessAddress !== undefined ? businessAddress : tenant.businessAddress,
//       tradeType: tradeType || tenant.tradeType
//     });

//     res.json({
//       success: true,
//       message: 'Company information updated successfully',
//       data: tenant
//     });
//   } catch (error) {
//     console.error('Update company info error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update company information'
//     });
//   }
// };

/**
 * Update contractor settings
 * PUT /api/settings
 */
const updateSettings = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      defaultMarkupPercentage,
      taxRatePercentage,
      depositPercentage,
      paymentTerms,
      warrantyTerms,
      generalTerms,
      businessHours,
      quoteValidityDays
    } = req.body;

    let settings = await ContractorSettings.findOne({
      where: { tenantId }
    });

    if (!settings) {
      // Create if doesn't exist
      settings = await ContractorSettings.create({
        tenantId,
        defaultMarkupPercentage: defaultMarkupPercentage || 30.00,
        taxRatePercentage: taxRatePercentage || 8.25,
        depositPercentage: depositPercentage || 50.00,
        paymentTerms,
        warrantyTerms,
        generalTerms,
        businessHours,
        quoteValidityDays: quoteValidityDays || 30
      });
    } else {
      // Update existing
      await settings.update({
        defaultMarkupPercentage: defaultMarkupPercentage !== undefined ? defaultMarkupPercentage : settings.defaultMarkupPercentage,
        taxRatePercentage: taxRatePercentage !== undefined ? taxRatePercentage : settings.taxRatePercentage,
        depositPercentage: depositPercentage !== undefined ? depositPercentage : settings.depositPercentage,
        paymentTerms: paymentTerms !== undefined ? paymentTerms : settings.paymentTerms,
        warrantyTerms: warrantyTerms !== undefined ? warrantyTerms : settings.warrantyTerms,
        generalTerms: generalTerms !== undefined ? generalTerms : settings.generalTerms,
        businessHours: businessHours !== undefined ? businessHours : settings.businessHours,
        quoteValidityDays: quoteValidityDays !== undefined ? quoteValidityDays : settings.quoteValidityDays
      });
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};

/**
 * Update company info
 * PUT /api/settings/company
 */
const updateCompanyInfo = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      companyName,
      email,
      phoneNumber,
      businessAddress,
      tradeType
    } = req.body;

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    await tenant.update({
      companyName: companyName || tenant.companyName,
      email: email || tenant.email,
      phoneNumber: phoneNumber || tenant.phoneNumber,
      businessAddress: businessAddress !== undefined ? businessAddress : tenant.businessAddress,
      tradeType: tradeType || tenant.tradeType
    });

    res.json({
      success: true,
      message: 'Company information updated successfully',
      data: tenant
    });
  } catch (error) {
    console.error('Update company info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company information'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  updateCompanyInfo
};
