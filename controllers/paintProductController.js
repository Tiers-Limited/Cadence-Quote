const { PaintProduct } = require('../models/PaintProduct');

const paintProductController = {
  // Get all products
  getAllProducts: async (req, res) => {
    try {
      const products = await PaintProduct.findAll({
        where: { tenantId: req.tenant.id }
      });
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get a single product
  getProduct: async (req, res) => {
    try {
      const product = await PaintProduct.findOne({
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });
      
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      
      res.json({ success: true, data: product });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create a new product
  createProduct: async (req, res) => {
    try {
      const product = await PaintProduct.create({
        ...req.body,
        tenantId: req.tenant.id
      });
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Update a product
  updateProduct: async (req, res) => {
    try {
      const [updated] = await PaintProduct.update(req.body, {
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      
      const product = await PaintProduct.findByPk(req.params.id);
      res.json({ success: true, data: product });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Delete a product
  deleteProduct: async (req, res) => {
    try {
      const deleted = await PaintProduct.destroy({
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });
      
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      
      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get products by tier (Good/Better/Best)
  getProductsByTier: async (req, res) => {
    try {
      const products = await PaintProduct.findAll({
        where: { 
          tenantId: req.tenant.id,
          tier: req.params.tier
        }
      });
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get products by category (interior, exterior, etc.)
  getProductsByCategory: async (req, res) => {
    try {
      const products = await PaintProduct.findAll({
        where: { 
          tenantId: req.tenant.id,
          category: req.params.category
        }
      });
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = paintProductController;