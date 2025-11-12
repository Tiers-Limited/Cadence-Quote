const GlobalColor = require('../models/GlobalColor');
const Brand = require('../models/Brand');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const sequelize = require('../config/database');

// Get all global colors (optimized with pagination and search)
exports.getAllGlobalColors = async (req, res) => {
  try {
    const { 
      brandId, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;
    
    const where = { isActive: true };
    
    // Apply filters
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    }
    
    // Optimized search - search in name and code
    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { code: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Separate count and data queries for better performance
    // Use Promise.all to run them in parallel
    const [count, rows] = await Promise.all([
      GlobalColor.count({ where }), // Fast count without joins
      GlobalColor.findAll({
        where,
        include: [{ 
          model: Brand, 
          as: 'brand',
          attributes: ['id', 'name'], // Only fetch needed fields
          required: false
        }],
        attributes: [
          'id',
          'brandId',
          'name',
          'code',
          'hexValue',
          'red',
          'green',
          'blue',
          'sampleImage',
          'crossBrandMappings',
          'createdAt'
        ],
        limit: parseInt(limit),
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        subQuery: false, // Disable subquery for better performance
      })
    ]);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
        hasMore: offset + rows.length < count,
      },
    });
  } catch (error) {
    console.error('Get global colors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global colors',
      error: error.message,
    });
  }
};

// Get global color by ID
exports.getGlobalColorById = async (req, res) => {
  try {
    const { id } = req.params;

    const color = await GlobalColor.findByPk(id, {
      include: [{ model: Brand, as: 'brand' }],
    });

    if (!color) {
      return res.status(404).json({
        success: false,
        message: 'Global color not found',
      });
    }

    res.json({
      success: true,
      data: color,
    });
  } catch (error) {
    console.error('Get global color error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global color',
      error: error.message,
    });
  }
};

// Create global color
exports.createGlobalColor = async (req, res) => {
  try {
    const { brandId, name, code, hexValue, red, green, blue, sampleImage, crossBrandMappings } = req.body;

    // Validation
    if (!brandId || !name || !code) {
      return res.status(400).json({
        success: false,
        message: 'BrandId, name, and code are required',
      });
    }

    const color = await GlobalColor.create({
      brandId,
      name,
      code,
      hexValue: hexValue || null,
      red: red || null,
      green: green || null,
      blue: blue || null,
      sampleImage: sampleImage || null,
      crossBrandMappings: crossBrandMappings || [],
      isActive: true,
    });

    const colorWithBrand = await GlobalColor.findByPk(color.id, {
      include: [{ model: Brand, as: 'brand' }],
    });

    res.status(201).json({
      success: true,
      message: 'Global color created successfully',
      data: colorWithBrand,
    });
  } catch (error) {
    console.error('Create global color error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global color',
      error: error.message,
    });
  }
};

// Update global color
exports.updateGlobalColor = async (req, res) => {
  try {
    const { id } = req.params;
    const { brandId, name, code, hexValue, red, green, blue, sampleImage, crossBrandMappings, isActive } = req.body;

    const color = await GlobalColor.findByPk(id);

    if (!color) {
      return res.status(404).json({
        success: false,
        message: 'Global color not found',
      });
    }

    await color.update({
      brandId: brandId || color.brandId,
      name: name || color.name,
      code: code || color.code,
      hexValue: hexValue !== undefined ? hexValue : color.hexValue,
      red: red !== undefined ? red : color.red,
      green: green !== undefined ? green : color.green,
      blue: blue !== undefined ? blue : color.blue,
      sampleImage: sampleImage !== undefined ? sampleImage : color.sampleImage,
      crossBrandMappings: crossBrandMappings !== undefined ? crossBrandMappings : color.crossBrandMappings,
      isActive: isActive !== undefined ? isActive : color.isActive,
    });

    const updatedColor = await GlobalColor.findByPk(id, {
      include: [{ model: Brand, as: 'brand' }],
    });

    res.json({
      success: true,
      message: 'Global color updated successfully',
      data: updatedColor,
    });
  } catch (error) {
    console.error('Update global color error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global color',
      error: error.message,
    });
  }
};

// Delete global color (soft delete)
exports.deleteGlobalColor = async (req, res) => {
  try {
    const { id } = req.params;

    const color = await GlobalColor.findByPk(id);

    if (!color) {
      return res.status(404).json({
        success: false,
        message: 'Global color not found',
      });
    }

    await color.update({ isActive: false });

    res.json({
      success: true,
      message: 'Global color deleted successfully',
    });
  } catch (error) {
    console.error('Delete global color error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete global color',
      error: error.message,
    });
  }
};

// Add cross-brand mapping
exports.addCrossBrandMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const { mappedColorId, notes } = req.body;

    const color = await GlobalColor.findByPk(id);
    if (!color) {
      return res.status(404).json({
        success: false,
        message: 'Global color not found',
      });
    }

    const mappedColor = await GlobalColor.findByPk(mappedColorId);
    if (!mappedColor) {
      return res.status(404).json({
        success: false,
        message: 'Mapped color not found',
      });
    }

    const mappings = color.crossBrandMappings || [];
    
    // Check if mapping already exists
    const existingIndex = mappings.findIndex(m => m.colorId === mappedColorId);
    if (existingIndex >= 0) {
      mappings[existingIndex] = {
        colorId: mappedColorId,
        brandId: mappedColor.brandId,
        name: mappedColor.name,
        code: mappedColor.code,
        notes: notes || mappings[existingIndex].notes,
      };
    } else {
      mappings.push({
        colorId: mappedColorId,
        brandId: mappedColor.brandId,
        name: mappedColor.name,
        code: mappedColor.code,
        notes: notes || '',
      });
    }

    await color.update({ crossBrandMappings: mappings });

    const updatedColor = await GlobalColor.findByPk(id, {
      include: [{ model: Brand, as: 'brand' }],
    });

    res.json({
      success: true,
      message: 'Cross-brand mapping added successfully',
      data: updatedColor,
    });
  } catch (error) {
    console.error('Add cross-brand mapping error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add cross-brand mapping',
      error: error.message,
    });
  }
};

// Bulk import global colors
exports.bulkImportGlobalColors = async (req, res) => {
  try {
    const { colors } = req.body;

    if (!Array.isArray(colors) || colors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Colors array is required',
      });
    }

    const created = [];
    const errors = [];

    for (const colorData of colors) {
      try {
        const color = await GlobalColor.create({
          brandId: colorData.brandId,
          name: colorData.name,
          code: colorData.code,
          hexValue: colorData.hexValue || null,
          red: colorData.red || null,
          green: colorData.green || null,
          blue: colorData.blue || null,
          sampleImage: colorData.sampleImage || null,
          crossBrandMappings: colorData.crossBrandMappings || [],
          isActive: true,
        });
        created.push(color);
      } catch (err) {
        errors.push({
          color: colorData.name,
          error: err.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Imported ${created.length} colors`,
      data: {
        created: created.length,
        errors: errors.length,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error('Bulk import colors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import colors',
      error: error.message,
    });
  }
};

// Bulk upload global colors from Excel/CSV file
exports.bulkUploadGlobalColors = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { brandId } = req.body;
    
    if (!brandId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Brand selection is required for bulk upload',
      });
    }

    if (!req.file) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Parse Excel/CSV file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawJson || rawJson.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No data found in file',
      });
    }

    // Map headers to fields based on first row
    const headers = rawJson[0];
    const keyMap = {
      code: Object.keys(headers).find(k => headers[k] === 'Color Code' || headers[k] === 'COLOR CODE') || '__EMPTY',
      name: Object.keys(headers).find(k => headers[k] === 'Color Name' || headers[k] === 'COLOR NAME') || '__EMPTY_1',
      hexValue: Object.keys(headers).find(k => headers[k] === 'Hex Value' || headers[k] === 'HEX') || '__EMPTY_2',
      red: Object.keys(headers).find(k => headers[k] === 'Red' || headers[k] === 'RED') || '__EMPTY_3',
      green: Object.keys(headers).find(k => headers[k] === 'Green' || headers[k] === 'GREEN') || '__EMPTY_4',
      blue: Object.keys(headers).find(k => headers[k] === 'Blue' || headers[k] === 'BLUE') || '__EMPTY_5',
      sampleImage: Object.keys(headers).find(k => headers[k] === 'Sample Image' || headers[k] === 'SAMPLE IMAGE') || '__EMPTY_6',
    };

    const validColors = [];
    const errors = [];

    // Process data rows (skip header row) - validate and prepare data
    for (let i = 1; i < rawJson.length; i++) {
      const row = rawJson[i];
      try {
        // Normalize hex value
        let hexValue = row[keyMap.hexValue] || '';
        if (hexValue) {
          hexValue = hexValue.toString().trim();
          if (hexValue && !hexValue.startsWith('#')) {
            hexValue = `#${hexValue}`;
          }
        }

        // Map CSV columns to database fields
        const colorData = {
          brandId: Number.parseInt(brandId),
          name: row[keyMap.name] || '',
          code: row[keyMap.code] || '',
          hexValue: hexValue || null,
          red: row[keyMap.red] !== undefined && row[keyMap.red] !== null && row[keyMap.red] !== '' 
            ? Number(row[keyMap.red]) 
            : null,
          green: row[keyMap.green] !== undefined && row[keyMap.green] !== null && row[keyMap.green] !== '' 
            ? Number(row[keyMap.green]) 
            : null,
          blue: row[keyMap.blue] !== undefined && row[keyMap.blue] !== null && row[keyMap.blue] !== '' 
            ? Number(row[keyMap.blue]) 
            : null,
          sampleImage: row[keyMap.sampleImage] || null,
          isActive: true,
        };

        // Validate required fields
        if (!colorData.name || !colorData.code) {
          errors.push({
            row: i + 2, // Excel row number (1-indexed + header)
            name: colorData.name || 'N/A',
            error: 'Missing required fields (name or code)',
          });
          continue;
        }

        validColors.push(colorData);

      } catch (err) {
        errors.push({
          row: i + 2,
          name: row[keyMap.name] || 'N/A',
          error: err.message,
        });
      }
    }

    // Bulk insert all valid colors at once - much faster!
    let created = [];
    if (validColors.length > 0) {
      created = await GlobalColor.bulkCreate(validColors, { 
        transaction,
        validate: true,
        individualHooks: false // Skip individual hooks for better performance
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `Successfully uploaded ${created.length} colors`,
      data: {
        created: created.length,
        errors: errors.length,
        errorDetails: errors,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Bulk upload colors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload colors',
      error: error.message,
    });
  }
};

