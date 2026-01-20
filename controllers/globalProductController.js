const GlobalProduct = require('../models/GlobalProduct');
const Brand = require('../models/Brand');
const CacheManager = require('../optimization/cache/CacheManager');

const { Op } = require('sequelize');
const XLSX = require('xlsx');
const sequelize  = require('../config/database');

// Initialize cache manager
const cache = new CacheManager();
cache.initialize();

// Cache keys and TTL
const CACHE_KEYS = {
  GLOBAL_PRODUCTS: (filters) => `global-products:all:${JSON.stringify(filters)}`,
  GLOBAL_PRODUCT: (id) => `global-product:${id}`,
  BRANDS_LIST: () => 'global-products:brands'
};

const CACHE_TTL = {
  PRODUCTS: 600, // 10 minutes
  PRODUCT_DETAIL: 1800, // 30 minutes
  BRANDS: 1800 // 30 minutes
};

// Get all global products (optimized with pagination and search)
exports.getAllGlobalProducts = async (req, res) => {
  try {
    const { 
      brandId, 
      category, 
      tier, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    // Create cache key based on all filters
    const filters = { brandId, category, tier, search, page, limit, sortBy, sortOrder };
    const cacheKey = CACHE_KEYS.GLOBAL_PRODUCTS(filters);
    
    // Try to get from cache first
    const cachedResult = await cache.cacheQuery(
      cacheKey,
      async () => {
        const where = { isActive: true };
        
        // Apply filters
        if (brandId && brandId !== 'all') {
          if (brandId === 'custom') {
            where.brandId = null;
            where.customBrand = { [Op.ne]: null };
          } else {
            where.brandId = brandId;
          }
        }
        
        if (category) where.category = category;
        if (tier) where.tier = tier;
        
        // Optimized search - search in name, customBrand, and notes
        if (search && search.trim()) {
          where[Op.or] = [
            { name: { [Op.iLike]: `%${search.trim()}%` } },
            { customBrand: { [Op.iLike]: `%${search.trim()}%` } },
            { notes: { [Op.iLike]: `%${search.trim()}%` } },
          ];
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Separate count and data queries for better performance
        // Use Promise.all to run them in parallel
        const [count, rows] = await Promise.all([
          GlobalProduct.count({ where }), // Fast count without joins
          GlobalProduct.findAll({
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
              'customBrand', 
              'name', 
              'category', 
              'tier', 
              'sheenOptions', 
              'notes',
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
      CACHE_TTL.PRODUCTS,
      ['global-products']
    );

    res.json(cachedResult);
  } catch (error) {
    console.error('Get global products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global products',
      error: error.message,
    });
  }
};

// Get global product by ID
exports.getGlobalProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = CACHE_KEYS.GLOBAL_PRODUCT(id);

    const result = await cache.cacheQuery(
      cacheKey,
      async () => {
        const product = await GlobalProduct.findByPk(id, {
          include: [{ 
            model: Brand, 
            as: 'brand',
            attributes: ['id', 'name']
          }]
        });

        if (!product) {
          return null;
        }

        return {
          success: true,
          data: product,
        };
      },
      CACHE_TTL.PRODUCT_DETAIL,
      ['global-products', `product:${id}`]
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Global product not found',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get global product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global product',
      error: error.message,
    });
  }
};

// Create global product
exports.createGlobalProduct = async (req, res) => {
  try {
    const { brandId, customBrand, name, category, tier, sheenOptions, notes } = req.body;

    // Validation
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required',
      });
    }

    if (!brandId && !customBrand) {
      return res.status(400).json({
        success: false,
        message: 'Either brandId or customBrand is required',
      });
    }

    const product = await GlobalProduct.create({
      brandId: brandId || null,
      customBrand: customBrand || null,
      name,
      category,
      tier: tier || null,
      sheenOptions: sheenOptions || null,
      notes: notes || null,
      isActive: true,
    });

    const productWithBrand = await GlobalProduct.findByPk(product.id, {
      include: [{ model: Brand, as: 'brand' }],
    });

    // Invalidate global products cache
    await cache.invalidateByTags(['global-products']);

    res.status(201).json({
      success: true,
      message: 'Global product created successfully',
      data: productWithBrand,
    });
  } catch (error) {
    console.error('Create global product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create global product',
      error: error.message,
    });
  }
};

// Update global product
exports.updateGlobalProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { brandId, customBrand, name, category, tier, sheenOptions, notes, isActive } = req.body;

    const product = await GlobalProduct.findByPk(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Global product not found',
      });
    }

    await product.update({
      brandId: brandId !== undefined ? brandId : product.brandId,
      customBrand: customBrand !== undefined ? customBrand : product.customBrand,
      name: name || product.name,
      category: category || product.category,
      tier: tier !== undefined ? tier : product.tier,
      sheenOptions: sheenOptions !== undefined ? sheenOptions : product.sheenOptions,
      notes: notes !== undefined ? notes : product.notes,
      isActive: isActive !== undefined ? isActive : product.isActive,
    });

    const updatedProduct = await GlobalProduct.findByPk(id, {
      include: [{ model: Brand, as: 'brand' }],
    });

    // Invalidate global products cache
    await cache.invalidateByTags(['global-products', `product:${id}`]);

    res.json({
      success: true,
      message: 'Global product updated successfully',
      data: updatedProduct,
    });
  } catch (error) {
    console.error('Update global product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global product',
      error: error.message,
    });
  }
};

// Delete global product (soft delete)
exports.deleteGlobalProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await GlobalProduct.findByPk(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Global product not found',
      });
    }

    await product.update({ isActive: false });

    // Invalidate global products cache
    await cache.invalidateByTags(['global-products', `product:${id}`]);

    res.json({
      success: true,
      message: 'Global product deleted successfully',
    });
  } catch (error) {
    console.error('Delete global product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete global product',
      error: error.message,
    });
  }
};

// Bulk import global products
exports.bulkImportGlobalProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Products array is required',
      });
    }

    const created = [];
    const errors = [];

    for (const productData of products) {
      try {
        const product = await GlobalProduct.create({
          brandId: productData.brandId || null,
          customBrand: productData.customBrand || null,
          name: productData.name,
          category: productData.category,
          tier: productData.tier || null,
          sheenOptions: productData.sheenOptions || null,
          notes: productData.notes || null,
          isActive: true,
        });
        created.push(product);
      } catch (err) {
        errors.push({
          product: productData.name,
          error: err.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Imported ${created.length} products`,
      data: {
        created: created.length,
        errors: errors.length,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import products',
      error: error.message,
    });
  }
};

// Bulk upload global products from Excel/CSV file
exports.bulkUploadGlobalProducts = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { brandId } = req.body;
    
    if (!brandId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Brand ID is required'
      });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }

    // Verify brand exists
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Parse Excel/CSV file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'File is empty'
      });
    }

    const createdProducts = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        const productName = row['Product Name'] || row['product_name'] || row['name'];
        const category = row['Category'] || row['category'];
        const tier = row['Tier'] || row['tier'];
        const sheenOptions = row['Sheen Options'] || row['sheen_options'] || row['Sheens'] || '';
        const notes = row['Notes'] || row['notes'] || '';
        
        if (!productName) {
          errors.push(`Row ${i + 2}: Product name is missing`);
          continue;
        }

        // Create global product
        const product = await GlobalProduct.create({
          brandId,
          name: productName.trim(),
          category: category? category?.trim() : "Interior",
          tier: tier ? tier?.trim() : null,
          sheenOptions: sheenOptions?.trim(),
          notes: notes?.trim(),
          isActive: true
        }, { transaction: t });

        createdProducts.push(product);
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    await t.commit();

    res.json({
      success: true,
      data: {
        created: createdProducts.length,
        products: createdProducts,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `${createdProducts.length} products uploaded successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    });
  } catch (error) {
    await t.rollback();
    console.error('Bulk upload global products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload products',
      error: error.message
    });
  }
};

// Bulk update product tiers
exports.bulkUpdateProductTiers = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required and cannot be empty'
      });
    }

    // Validate all updates
    for (const update of updates) {
      if (!update.id) {
        return res.status(400).json({
          success: false,
          message: 'Each update must have an id'
        });
      }
      
      if (update.tier && !['Good', 'Better', 'Best'].includes(update.tier)) {
        return res.status(400).json({
          success: false,
          message: 'Tier must be Good, Better, or Best'
        });
      }
    }

    // Perform bulk update
    const results = [];
    for (const update of updates) {
      const product = await GlobalProduct.findByPk(update.id, { transaction: t });
      
      if (!product) {
        results.push({
          id: update.id,
          success: false,
          message: 'Product not found'
        });
        continue;
      }

      await product.update({
        tier: update.tier || null
      }, { transaction: t });

      results.push({
        id: update.id,
        success: true,
        tier: product.tier
      });
    }

    await t.commit();

    res.json({
      success: true,
      data: results,
      message: `Successfully updated ${results.filter(r => r.success).length} product tiers`
    });
  } catch (error) {
    await t.rollback();
    console.error('Bulk update product tiers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product tiers',
      error: error.message
    });
  }
};
