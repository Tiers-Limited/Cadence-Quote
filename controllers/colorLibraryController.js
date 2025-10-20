const { ColorLibrary } = require('../models/ColorLibrary');
const { Op } = require('sequelize');

const colorLibraryController = {
  // Get colors by brand
  getColorsByBrand: async (req, res) => {
    try {
      const { brand } = req.params;
      const colors = await ColorLibrary.findAll({
        where: { 
          tenantId: req.tenant.id,
          brand: {
            [Op.iLike]: `%${brand}%` // Case-insensitive search
          }
        },
        order: [['colorName', 'ASC']]
      });
      res.json({ success: true, data: colors });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get colors by family/collection
  getColorsByFamily: async (req, res) => {
    try {
      const { family } = req.params;
      const colors = await ColorLibrary.findAll({
        where: { 
          tenantId: req.tenant.id,
          colorFamily: {
            [Op.iLike]: `%${family}%` // Case-insensitive search
          }
        },
        order: [['colorName', 'ASC']]
      });
      res.json({ success: true, data: colors });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
  // Get all colors
  getAllColors: async (req, res) => {
    try {
      const colors = await ColorLibrary.findAll({
        where: { tenantId: req.tenant.id }
      });
      res.json({ success: true, data: colors });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get a single color
  getColor: async (req, res) => {
    try {
      const color = await ColorLibrary.findOne({
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });
      
      if (!color) {
        return res.status(404).json({ success: false, error: 'Color not found' });
      }
      
      res.json({ success: true, data: color });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create a new color
  createColor: async (req, res) => {
    try {
      const color = await ColorLibrary.create({
        ...req.body,
        tenantId: req.tenant.id
      });
      res.status(201).json({ success: true, data: color });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Update a color
  updateColor: async (req, res) => {
    try {
      const [updated] = await ColorLibrary.update(req.body, {
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Color not found' });
      }

      const color = await ColorLibrary.findByPk(req.params.id);
      res.json({ success: true, data: color });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Delete a color
  deleteColor: async (req, res) => {
    try {
      const deleted = await ColorLibrary.destroy({
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Color not found' });
      }

      res.json({ success: true, message: 'Color deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Update a color
  updateColor: async (req, res) => {
    try {
      const [updated] = await ColorLibrary.update(req.body, {
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Color not found' });
      }
      
      const color = await ColorLibrary.findByPk(req.params.id);
      res.json({ success: true, data: color });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  // Delete a color
  deleteColor: async (req, res) => {
    try {
      const deleted = await ColorLibrary.destroy({
        where: { 
          id: req.params.id,
          tenantId: req.tenant.id
        }
      });
      
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Color not found' });
      }
      
      res.json({ success: true, message: 'Color deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get colors by brand
  getColorsByBrand: async (req, res) => {
    try {
      const colors = await ColorLibrary.findAll({
        where: { 
          tenantId: req.tenant.id,
          brand: req.params.brand
        }
      });
      res.json({ success: true, data: colors });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get colors by family
  getColorsByFamily: async (req, res) => {
    try {
      const colors = await ColorLibrary.findAll({
        where: { 
          tenantId: req.tenant.id,
          colorFamily: req.params.family
        }
      });
      res.json({ success: true, data: colors });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = colorLibraryController;