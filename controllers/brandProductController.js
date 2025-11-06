// controllers/brandProductController.js
const Product = require('../models/Product');
const ProductPrice = require('../models/ProductPrice');
const Brand = require('../models/Brand');

const XLSX = require('xlsx');
const sequelize = require('../config/database');

// ============ BRAND CONTROLLERS ============

exports.getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
      include: [{
        model: Product,
        as: 'products',
        where: { isActive: true },
        required: false,
        attributes: ['id', 'name']
      }]
    });

    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Get all brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands',
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

    await brand.update({ isActive: false });

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

// ============ PRODUCT CONTROLLERS ============

exports.getAllProductsByBrand = async (req, res) => {
  try {
    const { brandId } = req.query;
    console.log('brandId:', brandId);
    
    if (!brandId) {
      return res.status(400).json({
        success: false,
        message: 'Brand ID is required'
      });
    }

    const products = await Product.findAll({
      where: { 
        brandId,
        isActive: true 
      },
      include: [
        {
          model: Brand,
          as: 'brandDetails',
          attributes: ['id', 'name']
        },
        {
          model: ProductPrice,
          as: 'prices'
        }
      ],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get products by brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

exports.getProductWithPrices = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id, {
      include: [
        {
          model: Brand,
          as: 'brandDetails'
        },
        {
          model: ProductPrice,
          as: 'prices'
        }
      ]
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
    console.error('Get product with prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
      error: error.message
    });
  }
};

exports.createProductWithPrices = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { brandId, name, sheenOptions, description, prices } = req.body;
    const tenantId = req.user.tenantId;

    if (!brandId || !name) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Brand ID and product name are required'
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

    // Create product
    const product = await Product.create({
      tenantId,
      brandId,
      name,
      sheenOptions,
      description,
      brand: brand.name, // Store brand name for backwards compatibility
      pricePerGallon: 0 // Default price
    }, { transaction: t });

    // Create prices if provided
    if (prices && Array.isArray(prices) && prices.length > 0) {
      const priceRecords = prices
        .filter(p => p.sheen && p.price)
        .map(p => ({
          productId: product.id,
          sheen: p.sheen,
          price: parseFloat(p.price)
        }));
      
      if (priceRecords.length > 0) {
        await ProductPrice.bulkCreate(priceRecords, { transaction: t });
      }
    }

    await t.commit();

    // Fetch the created product with associations
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        { model: Brand, as: 'brandDetails' },
        { model: ProductPrice, as: 'prices' }
      ]
    });

    res.status(201).json({
      success: true,
      data: createdProduct,
      message: 'Product created successfully'
    });
  } catch (error) {
    await t.rollback();
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

exports.updateProductPrices = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { prices } = req.body;
    const tenantId = req.user.tenantId;

    if (!prices || !Array.isArray(prices)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Prices array is required'
      });
    }

    const product = await Product.findOne({
      where: { id, tenantId }
    });
    
    if (!product) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete existing prices
    await ProductPrice.destroy({
      where: { productId: id },
      transaction: t
    });

    // Create new prices
    const priceRecords = prices
      .filter(p => p.sheen && p.price)
      .map(p => ({
        productId: id,
        sheen: p.sheen,
        price: parseFloat(p.price)
      }));
    
    if (priceRecords.length > 0) {
      await ProductPrice.bulkCreate(priceRecords, { transaction: t });
    }

    await t.commit();

    // Fetch updated product with prices
    const updatedProduct = await Product.findByPk(id, {
      include: [
        { model: Brand, as: 'brandDetails' },
        { model: ProductPrice, as: 'prices' }
      ]
    });

    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product prices updated successfully'
    });
  } catch (error) {
    await t.rollback();
    console.error('Update product prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product prices',
      error: error.message
    });
  }
};

exports.bulkUploadProducts = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { brandId } = req.body;
    const tenantId = req.user.tenantId;
    
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
        console.log("Row",row)
        const productName = row['Product Name'] || row['product_name'] || row['name'];
        const sheenOptions = row['Sheen Options / Finish Type'] || row['sheen_options'] || row['Sheens'] || '';
        
        if (!productName) {
          errors.push(`Row ${i + 2}: Product name is missing`);
          continue;
        }

        // Create product
        const product = await Product.create({
          tenantId,
          brandId,
          name: productName.trim(),
          sheenOptions: sheenOptions.trim(),
          description: row.description || '',
          brand: brand.name,
          pricePerGallon: 0
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
    console.error('Bulk upload products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload products',
      error: error.message
    });
  }
};

exports.deleteProduct = async (req, res) => {
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

    // Soft delete
    await product.update({ isActive: false });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};
