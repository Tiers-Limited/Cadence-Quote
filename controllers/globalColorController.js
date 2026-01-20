const GlobalColor = require('../models/GlobalColor');
const Brand = require('../models/Brand');
const CacheManager = require('../optimization/cache/CacheManager');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const sequelize = require('../config/database');

// Initialize cache manager
const cache = new CacheManager();
cache.initialize();

// Cache keys and TTL
const CACHE_KEYS = {
  GLOBAL_COLORS: (filters) => `global-colors:all:${JSON.stringify(filters)}`,
  GLOBAL_COLOR: (id) => `global-color:${id}`,
  BRAND_COLORS: (brandId) => `global-colors:brand:${brandId}`
};

const CACHE_TTL = {
  COLORS: 600, // 10 minutes
  COLOR_DETAIL: 1800, // 30 minutes
};

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
    
    // Create cache key based on all filters
    const filters = { brandId, search, page, limit, sortBy, sortOrder };
    const cacheKey = CACHE_KEYS.GLOBAL_COLORS(filters);
    
    // Try to get from cache first
    const cachedResult = await cache.cacheQuery(
      cacheKey,
      async () => {
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

        return {
          success: true,
          data: rows,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(count / parseInt(limit)),
            hasMore: offset + rows.length < count,
          },
        };
      },
      CACHE_TTL.COLORS,
      ['global-colors']
    );

    res.json(cachedResult);
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
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No data found in file',
      });
    }

    const validColors = [];
    const errors = [];

    // Process data rows - validate and prepare data
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Get values from columns (support multiple variations)
        // Use ?? (nullish coalescing) for 0 values to work correctly
        const colorName = row['Color Name'] ?? row['COLOR NAME'] ?? row['color_name'] ?? row['name'];
        const colorCode = row['Color Code'] ?? row['COLOR CODE'] ?? row['color_code'] ?? row['code'];
        let hexValue = row['Hex Value'] ?? row['HEX VALUE'] ?? row['hex_value'] ?? row['HEX'] ?? row['hex'] ?? '';
        const red = row['Red'] ?? row['RED'] ?? row['red'];
        const green = row['Green'] ?? row['GREEN'] ?? row['green'];
        const blue = row['Blue'] ?? row['BLUE'] ?? row['blue'];
        const sampleImage = row['Sample Image'] ?? row['SAMPLE IMAGE'] ?? row['sample_image'] ?? row['sampleImage'];

        // Normalize hex value
        if (hexValue) {
          hexValue = hexValue.toString().trim();
          if (hexValue && !hexValue.startsWith('#')) {
            hexValue = `#${hexValue}`;
          }
        }

        // Map CSV columns to database fields
        // For RGB values: 0 is valid (black), but empty/null/undefined should be null
        const isValidRgbValue = (val) => val !== undefined && val !== null && val !== '';
        
        const colorData = {
          brandId: Number.parseInt(brandId),
          name: colorName ? colorName.toString().trim() : '',
          code: colorCode ? colorCode.toString().trim() : '',
          hexValue: hexValue || null,
          red: isValidRgbValue(red) ? Number(red) : null,
          green: isValidRgbValue(green) ? Number(green) : null,
          blue: isValidRgbValue(blue) ? Number(blue) : null,
          sampleImage: sampleImage ? sampleImage.toString().trim() : null,
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
          name: row['Color Name'] || row['COLOR NAME'] || 'N/A',
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

