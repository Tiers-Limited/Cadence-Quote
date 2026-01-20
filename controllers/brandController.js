const Brand = require('../models/Brand');
const CacheManager = require('../optimization/cache/CacheManager');

const { Op } = require('sequelize');

// Initialize cache manager
const cache = new CacheManager();
cache.initialize();

// Optimized: Get all brands with optional search and pagination
exports.getAllBrands = async (req, res) => {
  try {
    const { 
      search, 
      page, 
      limit, 
      includeProducts = 'false',
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    // Create cache key based on query parameters
    const cacheKey = `brands:all:${JSON.stringify({ search, page, limit, includeProducts, sortBy, sortOrder })}`;
    
    // Use cache wrapper for the query
    const result = await cache.cacheQuery(
      cacheKey,
      async () => {
        const where = { isActive: true };

        // Search functionality
        if (search && search.trim()) {
          where[Op.or] = [
            { name: { [Op.iLike]: `%${search.trim()}%` } },
            { description: { [Op.iLike]: `%${search.trim()}%` } },
          ];
        }

        const queryOptions = {
          where,
          attributes: ['id', 'name', 'description', 'createdAt'],
          order: [[sortBy, sortOrder.toUpperCase()]],
        };

        // Pagination (optional - if not provided, return all)
        if (page && limit) {
          const offset = (parseInt(page) - 1) * parseInt(limit);
          queryOptions.limit = parseInt(limit);
          queryOptions.offset = offset;
          queryOptions.distinct = true;

          const { count, rows } = await Brand.findAndCountAll(queryOptions);

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
        }

        // No pagination - return all (for dropdowns)
        const brands = await Brand.findAll(queryOptions);

        return {
          success: true,
          data: brands
        };
      },
      300, // 5 minutes TTL
      ['brands'] // Cache tags for invalidation
    );

    res.json(result);
  } catch (error) {
    console.error('Get all brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands',
      error: error.message
    });
  }
};

exports.getBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const brand = await Brand.findByPk(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    res.json({
      success: true,
      data: brand
    });
  } catch (error) {
    console.error('Get brand by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand',
      error: error.message
    });
  }
};

exports.createBrand = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required'
      });
    }

    // Check if brand already exists
    const existingBrand = await Brand.findOne({ where: { name } });
    if (existingBrand) {
      return res.status(400).json({
        success: false,
        message: 'Brand with this name already exists'
      });
    }

    const brand = await Brand.create({
      name,
      description
    });

    // Invalidate brands cache
    await cache.invalidateByTags(['brands']);

    res.status(201).json({
      success: true,
      data: brand,
      message: 'Brand created successfully'
    });
  } catch (error) {
    console.error('Create brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create brand',
      error: error.message
    });
  }
};

exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const brand = await Brand.findByPk(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Check if new name conflicts with existing brand
    if (name && name !== brand.name) {
      const existingBrand = await Brand.findOne({ where: { name } });
      if (existingBrand) {
        return res.status(400).json({
          success: false,
          message: 'Brand with this name already exists'
        });
      }
    }

    await brand.update({
      name: name || brand.name,
      description: description !== undefined ? description : brand.description,
      isActive: isActive !== undefined ? isActive : brand.isActive
    });

    // Invalidate brands cache
    await cache.invalidateByTags(['brands']);

    res.json({
      success: true,
      data: brand,
      message: 'Brand updated successfully'
    });
  } catch (error) {
    console.error('Update brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update brand',
      error: error.message
    });
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findByPk(id);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Soft delete by setting isActive to false
    await brand.update({ isActive: false });

    // Invalidate brands cache
    await cache.invalidateByTags(['brands']);

    res.json({
      success: true,
      message: 'Brand deleted successfully'
    });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete brand',
      error: error.message
    });
  }
};

exports.seedBrands = async (req, res) => {
  try {
    const defaultBrands = [
      { name: 'Sherwin-Williams', description: 'Professional paint solutions' },
      { name: 'Benjamin Moore', description: 'Premium quality paints' },
      { name: 'Behr', description: 'Affordable quality paints' },
      { name: 'Valspar', description: 'Trusted paint brand' },
      { name: 'PPG Paints', description: 'Industrial and professional paints' }
    ];

    const createdBrands = [];
    
    for (const brandData of defaultBrands) {
      const [brand, created] = await Brand.findOrCreate({
        where: { name: brandData.name },
        defaults: brandData
      });
      
      if (created) {
        createdBrands.push(brand);
      }
    }

    res.json({
      success: true,
      data: createdBrands,
      message: `${createdBrands.length} brands seeded successfully`
    });
  } catch (error) {
    console.error('Seed brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed brands',
      error: error.message
    });
  }
};
