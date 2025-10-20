// controllers/productController.js
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');

/**
 * Get all products for a tenant
 * GET /api/products
 */
const getProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { category, tier, brand, isActive } = req.query;

    const where = { tenantId };

    // Apply filters
    if (category) where.category = category;
    if (tier) where.tier = tier;
    if (brand) where.brand = brand;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const products = await Product.findAll({
      where,
      order: [['category', 'ASC'], ['tier', 'ASC'], ['name', 'ASC']]
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products'
    });
  }
};

/**
 * Get single product by ID
 * GET /api/products/:id
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const product = await Product.findOne({
      where: { id, tenantId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product'
    });
  }
};

/**
 * Create new product
 * POST /api/products
 */
const createProduct = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      name,
      description,
      brand,
      category,
      tier,
      sheen,
      pricePerGallon,
      coverageRate
    } = req.body;

    // Validation
    if (!name || !brand || !category || !tier || !sheen || !pricePerGallon) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['name', 'brand', 'category', 'tier', 'sheen', 'pricePerGallon']
      });
    }

    const product = await Product.create({
      tenantId,
      name,
      description,
      brand,
      category,
      tier,
      sheen,
      pricePerGallon,
      coverageRate: coverageRate || 400,
      isActive: true,
      isSystemDefault: false
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => ({
          field: e.path,
          message: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create product'
    });
  }
};

/**
 * Update product
 * PUT /api/products/:id
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const {
      name,
      description,
      brand,
      category,
      tier,
      sheen,
      pricePerGallon,
      coverageRate,
      isActive
    } = req.body;

    const product = await Product.findOne({
      where: { id, tenantId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update product
    await product.update({
      name: name || product.name,
      description: description !== undefined ? description : product.description,
      brand: brand || product.brand,
      category: category || product.category,
      tier: tier || product.tier,
      sheen: sheen || product.sheen,
      pricePerGallon: pricePerGallon || product.pricePerGallon,
      coverageRate: coverageRate || product.coverageRate,
      isActive: isActive !== undefined ? isActive : product.isActive
    });

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    });
  }
};

/**
 * Delete product
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const product = await Product.findOne({
      where: { id, tenantId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.destroy();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    });
  }
};

/**
 * Get product categories
 * GET /api/products/categories
 */
const getProductCategories = async (req, res) => {
  res.json({
    success: true,
    data: [
      { value: 'wall_paint', label: 'Wall Paints' },
      { value: 'ceiling_paint', label: 'Ceiling Paints' },
      { value: 'trim_paint', label: 'Trim Paints' },
      { value: 'primer', label: 'Primers' },
      { value: 'custom', label: 'Custom' }
    ]
  });
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductCategories
};
