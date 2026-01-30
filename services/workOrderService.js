// services/workOrderService.js
// Work Order & Paint Product Order Form Generation
// Crew-facing and Store-facing documents

const { htmlToPdfBuffer } = require('./pdfService');

class WorkOrderService {
  /**
   * Generate Work Order PDF (Crew-Facing)
   * No pricing or sales language - pure execution document
   */
  async generateWorkOrder({ job, quote, contractorInfo }) {
    const html = await this.generateWorkOrderHTML({ job, quote, contractorInfo });
    return await htmlToPdfBuffer(html);
  }

  /**
   * Generate Paint Product Order Form PDF (Store-Facing)
   * Counter-order logic for paint stores
   */
  async generateProductOrderForm({ job, quote, contractorInfo }) {
    const html = await this.generateProductOrderHTML({ job, quote, contractorInfo });
    return await htmlToPdfBuffer(html);
  }

  /**
   * Generate Material List (organized by product, color, sheen)
   */
  async generateMaterialList({ job, quote, contractorInfo }) {
    const html = await this.generateMaterialListHTML({ job, quote, contractorInfo });
    return await htmlToPdfBuffer(html);
  }

  /**
   * Work Order HTML Generation
   */
  async generateWorkOrderHTML({ job, quote, contractorInfo = {} }) {
    const company = this.getCompanyProfile(contractorInfo);
    const jobCore = this.getJobCore(job, quote);
    const areas = await this.extractAreasWithSelections(quote, job);
    const materialTotals = this.aggregateMaterials(areas);
    const specialInstructions = this.compileSpecialInstructions(quote, job);
    const scopes = this.deriveScopes(job, quote);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getWorkOrderStyles()}
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="header-left">
              ${company.logo ? `<img src="${company.logo}" alt="Logo" class="logo" />` : ''}
              <div class="company-name">${company.name}</div>
              <div class="company-details">
                ${company.address || ''}${company.address ? '<br/>' : ''}
                ${[company.phone, company.email].filter(Boolean).join(' • ')}
              </div>
            </div>
            <div class="header-right">
              <div class="title">WORK ORDER</div>
              <div class="meta-row"><span class="label">Job #:</span> ${jobCore.jobNumber}</div>
              <div class="meta-row"><span class="label">Date Created:</span> ${jobCore.createdDate}</div>
            </div>
          </div>

          <!-- Customer & Job Information -->
          <div class="info-section">
            <h2>Customer & Job Information</h2>
            <table class="info-table">
              <tr>
                <td><strong>Customer:</strong></td>
                <td>${jobCore.customerName}</td>
                <td><strong>Phone:</strong></td>
                <td>${jobCore.customerPhone}</td>
              </tr>
              <tr>
                <td><strong>Address:</strong></td>
                <td colspan="3">${jobCore.jobAddress}</td>
              </tr>
              <tr>
                <td><strong>Email:</strong></td>
                <td>${jobCore.customerEmail}</td>
                <td><strong>Job Type:</strong></td>
                <td>${this.getAreaType(jobCore.jobType)}</td>
              </tr>
              <tr>
                <td><strong>Accepted Quote #:</strong></td>
                <td>${jobCore.acceptedQuote}</td>
                <td><strong>Invoice #:</strong></td>
                <td>${jobCore.invoiceNumber}</td>
              </tr>
              <tr>
                <td><strong>Estimated Duration:</strong></td>
                <td>${jobCore.estimatedDuration ? `${jobCore.estimatedDuration} days` : '—'}</td>
                <td><strong>Scheduled Dates:</strong></td>
                <td>${jobCore.scheduled}</td>
              </tr>
            </table>
          </div>

          <!-- Project Summary -->
          <div class="summary-section">
            <h2>Project Summary</h2>
            <div class="summary-grid">
              <div><strong>Job Type:</strong> ${this.getAreaType(jobCore.jobType)}</div>
              <div><strong>Estimated Duration:</strong> ${jobCore.estimatedDuration ? `${jobCore.estimatedDuration} days` : '—'}</div>
              <div><strong>Scheduled:</strong> ${jobCore.scheduled}</div>
              <div><strong>Job Address:</strong> ${jobCore.jobAddress}</div>
            </div>
          </div>

          <!-- Scope of Work (Internal) -->
          <div class="section">
            <h2>Scope of Work (Internal)</h2>
            <div class="scope-line"><strong>Primary Scope:</strong> ${scopes.primary}</div>
            <div class="scope-line"><strong>Secondary Scope:</strong> ${scopes.secondary}</div>
          </div>

          <!-- Work Items Breakdown -->
          <div class="section">
            <h2>Work Items Breakdown</h2>
            <table class="work-table">
              <thead>
                <tr>
                  <th>Area / Room</th>
                  <th>Surface</th>
                  <th>Product</th>
                  <th>Sheen</th>
                  <th>Color</th>
                  <th>Swatch</th>
                </tr>
              </thead>
              <tbody>
                ${areas.length > 0 ? areas.map(area => this.renderWorkItem(area)).join('') : `
                  <tr>
                    <td colspan="6" style="padding: 20px; text-align: center; color: #666;">No work items specified</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <!-- Materials / Selections (Totals) -->
          <div class="section">
            <h2>Materials / Selections (Totals)</h2>
            <table class="materials-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Sheen</th>
                  <th>Color</th>
                  <th>Total Gallons</th>
                </tr>
              </thead>
              <tbody>
                ${materialTotals.length > 0 ? materialTotals.map(m => `
                  <tr>
                    <td>${m.product}</td>
                    <td>${m.sheen}</td>
                    <td>${m.colorLabel}</td>
                    <td class="text-center">${m.gallons} gal</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="4" style="padding: 20px; text-align: center; color: #666;">No materials specified</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <!-- Special Instructions -->
          ${specialInstructions.length > 0 ? `
            <div class="section">
              <h2>Special Instructions</h2>
              <ul class="instructions-list">
                ${specialInstructions.map(inst => `<li>${inst}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Crew Assignment -->
          <div class="section">
            <h2>Crew Assignment</h2>
            <div class="crew-box">
              <div class="crew-line">
                <strong>Crew Lead:</strong> ${job.crewLead || '_____________________'}
              </div>
              <div class="crew-line">
                <strong>Crew Members:</strong> ${this.formatCrewMembers(job.crewMembers) || '_____________________'}
              </div>
            </div>
          </div>

          <!-- Completion -->
          <div class="section">
            <h2>Completion</h2>
            <div class="completion-box">
              <div class="signature-line">
                <strong>Completed Date:</strong> _____________________
              </div>
              <div class="signature-line">
                <strong>Crew Lead Signature:</strong> _____________________
              </div>
              <div class="signature-line">
                <strong>Completion Notes:</strong>
                <div class="notes-area">
                  _______________________________________________________________<br/>
                  _______________________________________________________________<br/>
                  _______________________________________________________________
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Paint Product Order Form HTML Generation (Store-Facing)
   */
  async generateProductOrderHTML({ job, quote, contractorInfo = {} }) {
    const company = this.getCompanyProfile(contractorInfo);
    const jobCore = this.getJobCore(job, quote);
    const paintItems = await this.aggregatePaintItems(quote, job);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getProductOrderStyles()}
        </style>
      </head>
      <body>
        <div class="order-container">
          <!-- Header -->
            <div class="order-header">
              <h1>PAINT PRODUCT ORDER FORM</h1>
              <div class="company-info">
                <strong>${company.name}</strong><br/>
                ${company.address ? `${company.address}<br/>` : ''}
                ${[company.phone, company.email].filter(Boolean).join(' • ')}
              </div>
            </div>

          <!-- Job Information -->
          <div class="job-info-section">
            <div class="section-header-bar">
              <h3>Job Information</h3>
            </div>
            <table class="job-info-table">
              <tr>
                <td><strong>Job Number:</strong></td>
                <td>${jobCore.jobNumber}</td>
                <td><strong>Invoice Number:</strong></td>
                <td>${jobCore.invoiceNumber}</td>
              </tr>
              <tr>
                <td><strong>Job Address:</strong></td>
                <td colspan="3">${jobCore.jobAddress}</td>
              </tr>
            </table>
          </div>

          <!-- Paint Order Details -->
          <div class="order-section">
            <div class="section-header-bar">
              <h3>Paint Order Details</h3>
            </div>
            <table class="paint-order-table">
              <thead>
                <tr>
                  <th>Qty (Gal)</th>
                  <th>Product</th>
                  <th>Int / Ext</th>
                  <th>Sheen</th>
                  <th>Color #</th>
                  <th>Color Name</th>
                </tr>
              </thead>
              <tbody>
                ${paintItems.length > 0 ? paintItems.map(item => `
                  <tr>
                    <td class="qty-cell">${item.quantity}</td>
                    <td class="center-cell">${item.product}</td>
                    <td class="center-cell">${item.type}</td>
                    <td class="center-cell">${item.sheen}</td>
                    <td class="color-cell">${item.colorNumber || ''}</td>
                    <td class="center-cell">${item.colorName}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" class="center-cell" style="padding: 20px; color: #666;">No items</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <!-- Authorization -->
          <div class="auth-section">
            <div class="section-header-bar">
              <h3>Authorization</h3>
            </div>
            <div class="signature-grid">
              <div class="signature-item">
                <label>Ordered By:</label>
                <div class="signature-line">_____________________________________</div>
              </div>
              <div class="signature-item">
                <label>Date:</label>
                <div class="signature-line">_____________________________________</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="order-footer">
            <p><strong>Note:</strong> Please verify all color numbers before mixing. Contact us immediately if there are any questions.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Material List HTML Generation
   */
  async generateMaterialListHTML({ job = {}, quote, contractorInfo = {} }) {
    const materials = await this.aggregateMaterialsDetailed(quote, job);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getWorkOrderStyles()}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MATERIAL LIST</h1>
            <div class="job-info">
              <div><strong>Job #:</strong> ${job.jobNumber}</div>
              <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</div>
            </div>
          </div>

          <div class="section">
            <h2>Paint Materials</h2>
            <table class="materials-table">
              <thead>
                <tr>
                  <th>Product / Brand</th>
                  <th>Type</th>
                  <th>Sheen</th>
                  <th>Color</th>
                  <th>Color #</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                ${materials.paint.map(m => `
                  <tr>
                    <td>${m.product}</td>
                    <td>${m.type}</td>
                    <td>${m.sheen}</td>
                    <td>${m.colorName}</td>
                    <td>${m.colorNumber || ''}</td>
                    <td class="text-center">${m.quantity} gal</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          ${materials.supplies.length > 0 ? `
            <div class="section">
              <h2>Supplies & Sundries</h2>
              <ul>
                ${materials.supplies.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  getCompanyProfile(contractorInfo = {}) {
    return {
      logo: contractorInfo.logo || contractorInfo.companyLogoUrl || '',
      name: contractorInfo.companyName || 'Professional Painting Co.',
      address: contractorInfo.businessAddress || contractorInfo.address || '',
      phone: contractorInfo.phone || contractorInfo.phoneNumber || '',
      email: contractorInfo.email || contractorInfo.companyEmail || '',
    };
  }

  getJobCore(job = {}, quote = {}) {
    const jobNumber = job.jobNumber || `JOB-${quote.quoteNumber || 'PENDING'}`;
    return {
      jobNumber,
      invoiceNumber: quote.invoiceNumber || quote.quoteNumber || job.invoiceNumber || jobNumber,
      jobAddress: job.jobAddress || this.formatAddress(quote),
      jobType: (job.jobType || quote.jobType || quote.jobScope || 'interior').toLowerCase(),
      estimatedDuration: job.estimatedDuration || quote.estimatedDuration || '',
      scheduled: this.formatSchedule(job),
      createdDate: this.formatDate(job.createdAt || new Date()),
      acceptedQuote: quote.quoteNumber || 'Pending',
      customerName: quote.customerName || job.customerName || '',
      customerPhone: quote.customerPhone || job.customerPhone || '',
      customerEmail: quote.customerEmail || job.customerEmail || '',
      companyName: quote.companyName || '',
    };
  }

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  formatAddress(quote = {}) {
    if (quote.jobAddress) return quote.jobAddress;
    const parts = [quote.street, quote.city, quote.state, quote.zipCode].filter(Boolean);
    return parts.join(', ');
  }

  getAreaType(jobType = 'interior') {
    const normalized = String(jobType || '').toLowerCase();
    if (normalized === 'exterior') return 'Exterior';
    if (normalized === 'both' || normalized === 'interior / exterior') return 'Interior / Exterior';
    return 'Interior';
  }

  resolveGallons(area = {}, selection = {}) {
    const explicit = selection.quantityGallons || area.quantityGallons;
    if (explicit !== undefined && explicit !== null && !Number.isNaN(Number(explicit))) {
      return Math.max(0, Number(explicit));
    }
    const sqft = area.sqft || selection.sqft || 400;
    return Math.max(1, Math.ceil(Number(sqft) / 350));
  }

  deriveScopes(job = {}, quote = {}) {
    const primary = job.primaryScope || quote.primaryScope || 'Prep and repaint all interior walls, ceilings, and trim in specified areas.';
    const secondary = job.secondaryScope || quote.secondaryScope || 'Minor drywall patching, caulking, and touch-ups as needed.';
    return { primary, secondary };
  }

  async extractAreasWithSelections(quote, job) {
    const areas = [];
    
    // Get customer selections from database
    const CustomerSelection = require('../models/CustomerSelection');
    const ProductConfig = require('../models/ProductConfig');
    const GlobalProduct = require('../models/GlobalProduct');
    const Brand = require('../models/Brand');
    
    let customerSelections = [];
    if (job && job.quoteId) {
      customerSelections = await CustomerSelection.findAll({
        where: {
          quoteId: job.quoteId,
          tenantId: job.tenantId
        },
        order: [['areaId', 'ASC']]
      });
    }
    
    // Parse productSets if it's a string
    let productSets = quote.productSets;
    if (typeof productSets === 'string') {
      try {
        productSets = JSON.parse(productSets);
      } catch (e) {
        console.error('Failed to parse productSets:', e);
        productSets = [];
      }
    }
    if (!Array.isArray(productSets)) {
      productSets = [];
    }
    
    // IMPORTANT: Use selectedTier from Job model (saved during deposit payment)
    const selectedTier = job?.selectedTier || 'better';
    const productStrategy = quote.productStrategy;
    
    console.info(`[WorkOrderService] Job ${job?.id}: selectedTier=${selectedTier}, productStrategy=${productStrategy}`);
    
    // Build a map of areaId/surfaceType to product info
    const productMap = new Map();
    const productIds = new Set();

    for (const productSet of productSets) {
      const areaId = productSet.areaId || productSet.id;
      const surfaceType = productSet.surfaceType || productSet.type || 'general';
      const products = productSet.products || {};

      let productId = null;
      if (productStrategy === 'GBB') {
        // Use the tier from Job model (customer's selected tier)
        productId = products[selectedTier];
      } else {
        productId = products.single || products.good || products.better || products.best;
      }

      if (productId) {
        // Create multiple keys for better matching
        if (areaId) {
          const key1 = `${areaId}_${surfaceType}`;
          productMap.set(key1, productId);
        }
        productMap.set(surfaceType, productId);
        const normalizedSurface = String(surfaceType).toLowerCase().replace(/\s+/g, '');
        productMap.set(normalizedSurface, productId);
        productIds.add(productId);
      }
    }

    // Fetch all product configs in one query
    const productConfigs = await ProductConfig.findAll({
      where: { id: Array.from(productIds) },
      include: [
        {
          model: GlobalProduct,
          as: 'globalProduct',
          include: [{
            model: Brand,
            as: 'brand',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    // Create a map of productId to product details
    const productDetailsMap = new Map();
    productConfigs.forEach(config => {
      const productName = config.isCustom && config.customProduct 
        ? config.customProduct.name 
        : config.globalProduct?.name || 'Unknown Product';
      
      const brandName = config.isCustom && config.customProduct
        ? config.customProduct.brandName
        : config.globalProduct?.brand?.name || '';

      productDetailsMap.set(config.id, {
        productName,
        brandName
      });
    });
    
    // Process customer selections
    customerSelections.forEach(selection => {
      // Try to find product info from productSets using multiple key strategies
      let productId = null;
      
      // Strategy 1: Try areaId_surfaceType
      if (selection.areaId) {
        const key1 = `${selection.areaId}_${selection.surfaceType}`;
        productId = productMap.get(key1);
      }
      
      // Strategy 2: Try just surfaceType
      if (!productId && selection.surfaceType) {
        productId = productMap.get(selection.surfaceType);
      }
      
      // Strategy 3: Try normalized surfaceType
      if (!productId && selection.surfaceType) {
        const normalizedSurface = String(selection.surfaceType).toLowerCase().replace(/\s+/g, '');
        productId = productMap.get(normalizedSurface);
      }
      
      const productDetails = productId ? productDetailsMap.get(productId) : null;
      
      areas.push({
        name: selection.areaName,
        surface: selection.surfaceType || 'Surface',
        product: productDetails?.productName || selection.productName || 'Not selected',
        brandName: productDetails?.brandName || '',
        sheen: selection.sheen || 'Not selected',
        colorName: selection.colorName || 'Not selected',
        colorNumber: selection.colorNumber || '',
        swatch: selection.colorHex || null,
        gallons: selection.quantityGallons || 0,
        type: this.getAreaType(job?.jobType || quote.jobType || quote.jobScope),
      });
    });
    
    // Fallback: If no customer selections, try to extract from productSets
    if (areas.length === 0) {
      const pricingSchemeType = quote.pricingScheme?.type || quote.pricingSchemeType;
      const isFlatRate = pricingSchemeType === 'flat_rate_unit';
      const isAreaWise = ['production_based', 'rate_based_sqft', 'rate_based'].includes(pricingSchemeType);
      
      if (isFlatRate) {
        // Flat rate: Extract products from productSets
        productSets.forEach(set => {
          if (!set.products) return;
          
          const category = set.category || 'Interior';
          const label = set.label || set.surfaceType || 'Unknown';
          
          // Use selectedTier from Job model
          const selectedProduct = set.products[selectedTier];
          
          if (selectedProduct) {
            areas.push({
              name: label,
              surface: label,
              product: selectedProduct.productName || selectedProduct.name || 'Not selected',
              sheen: selectedProduct.sheen || 'Not selected',
              colorName: selectedProduct.color || selectedProduct.colorName || 'Not selected',
              colorNumber: selectedProduct.colorNumber || '',
              swatch: selectedProduct.colorHex || null,
              gallons: this.resolveGallons({}, selectedProduct),
              type: category.charAt(0).toUpperCase() + category.slice(1),
            });
          }
        });
      } else if (isAreaWise) {
        // Area-wise pricing: Extract from areas and match with productSets
        if (quote.areas && Array.isArray(quote.areas)) {
          quote.areas.forEach(area => {
            if (!area.laborItems || area.laborItems.length === 0) return;
            
            area.laborItems.forEach(item => {
              if (!item.selected) return;
              
              const surfaceType = item.categoryName;
              const productSet = productSets.find(ps => 
                ps.areaId === area.id && ps.surfaceType === surfaceType
              ) || productSets.find(ps => 
                !ps.areaId && ps.surfaceType === surfaceType
              );
              
              if (productSet && productSet.products) {
                const selectedProduct = productSet.products[selectedTier];
                
                if (selectedProduct) {
                  areas.push({
                    name: area.name || 'Unnamed Area',
                    surface: surfaceType,
                    product: selectedProduct.productName || selectedProduct.name || 'Not selected',
                    sheen: selectedProduct.sheen || 'Not selected',
                    colorName: selectedProduct.color || selectedProduct.colorName || 'Not selected',
                    colorNumber: selectedProduct.colorNumber || '',
                    swatch: selectedProduct.colorHex || null,
                    gallons: this.resolveGallons(area, selectedProduct),
                    type: this.getAreaType(job?.jobType || quote.jobType || quote.jobScope),
                  });
                }
              }
            });
          });
        }
      } else {
        // Turnkey: Global products from productSets
        productSets.forEach(ps => {
          const surfaceLabel = ps.surfaceType || ps.label;
          if (!surfaceLabel || !ps.products) return;
          
          const selectedProduct = ps.products[selectedTier];
          
          if (selectedProduct) {
            areas.push({
              name: surfaceLabel,
              surface: surfaceLabel,
              product: selectedProduct.productName || selectedProduct.name || 'Not selected',
              sheen: selectedProduct.sheen || 'Not selected',
              colorName: selectedProduct.color || selectedProduct.colorName || 'Not selected',
              colorNumber: selectedProduct.colorNumber || '',
              swatch: selectedProduct.colorHex || null,
              gallons: this.resolveGallons({}, selectedProduct),
              type: this.getAreaType(job?.jobType || quote.jobType || quote.jobScope),
            });
          }
        });
      }
    }
    
    return areas;
    
    return areas;
  }

  aggregateMaterials(areas) {
    const totalsMap = new Map();
    
    areas.forEach(area => {
      const key = `${area.product}|${area.sheen}|${area.colorName}|${area.colorNumber}`;
      if (!totalsMap.has(key)) {
        totalsMap.set(key, {
          product: area.product,
          sheen: area.sheen,
          colorName: area.colorName,
          colorNumber: area.colorNumber,
          gallons: 0,
          colorLabel: this.formatColorLabel(area.colorName, area.colorNumber),
        });
      }
      totalsMap.get(key).gallons += Number(area.gallons || 0);
    });

    return Array.from(totalsMap.values());
  }

  async aggregatePaintItems(quote, job) {
    const areas = await this.extractAreasWithSelections(quote, job);
    const itemsMap = new Map();

    areas.forEach(area => {
      const key = `${area.product}|${area.type}|${area.sheen}|${area.colorName}|${area.colorNumber}`;
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          product: area.product || 'Unknown',
          type: area.type,
          sheen: area.sheen || '',
          colorNumber: area.colorNumber || '',
          colorName: area.colorName || '',
          quantity: 0,
        });
      }
      itemsMap.get(key).quantity += Number(area.gallons || 0);
    });

    return Array.from(itemsMap.values()).map(item => ({
      ...item,
      quantity: Number(item.quantity || 0),
    }));
  }

  async aggregateMaterialsDetailed(quote, job) {
    const paintItems = await this.aggregatePaintItems(quote, job);
    
    return {
      paint: paintItems.length > 0 ? paintItems : [{
        product: 'No products selected',
        type: 'N/A',
        sheen: 'N/A',
        colorName: 'N/A',
        colorNumber: '',
        quantity: 0
      }],
      supplies: [
        'Painter\'s tape',
        'Drop cloths',
        'Sandpaper (various grits)',
        'Spackle/filler',
        'Primer (as needed)',
        'Brushes and rollers',
      ],
    };
  }

  compileSpecialInstructions(quote = {}, job = {}) {
    const instructions = new Set();
    instructions.add('Patch, sand, and caulk as needed throughout project');
    instructions.add('Protect floors and furniture daily');
    instructions.add('Customer works from home – keep noise minimal before 9 AM');
    instructions.add('Dog on premises – coordinate entry with homeowner');

    [
      quote.customerNotes,
      quote.clientNotes,
      job.specialInstructions,
      job.crewNotes,
      job.contractorNotes,
      job.customerNotes,
    ].filter(Boolean).forEach(note => instructions.add(String(note)));

    return Array.from(instructions);
  }

  renderWorkItem(area) {
    const swatchStyle = area.swatch ? `style="background:${area.swatch}; width:14px; height:14px; display:inline-block; border:1px solid #ccc; border-radius:2px;"` : '';
    return `
      <tr>
        <td>${area.name}</td>
        <td>${area.surface}</td>
        <td>${area.product}</td>
        <td>${area.sheen}</td>
        <td>${this.formatColorLabel(area.colorName, area.colorNumber)}</td>
        <td class="text-center">${area.swatch ? `<span ${swatchStyle}></span>` : ''}</td>
      </tr>
    `;
  }

  formatCrewMembers(members) {
    if (!members) return '';
    if (Array.isArray(members)) return members.join(', ');
    return String(members);
  }

  formatColorLabel(name, number) {
    if (!name && !number) return '';
    if (name && number) return `${name} (${number})`;
    return name || number;
  }

  formatSchedule(job = {}) {
    if (job.scheduledStartDate && job.scheduledEndDate) {
      const start = this.formatDate(job.scheduledStartDate);
      const end = this.formatDate(job.scheduledEndDate);
      return `${start} – ${end}`;
    }
    if (job.scheduledStartDate) {
      return this.formatDate(job.scheduledStartDate);
    }
    return 'Not scheduled';
  }

  // ============================================================================
  // STYLES
  // ============================================================================

  getWorkOrderStyles() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 12px; color: #0f172a; background: #fff; }
      .container { max-width: 8.5in; margin: 0 auto; padding: 0.55in; background: #fff; border: 1px solid #e2e8f0; }
      .header { display: flex; justify-content: space-between; margin-bottom: 26px; padding-bottom: 16px; border-bottom: 4px solid #d8efe9; }
      .header-left .logo { max-height: 60px; margin-bottom: 10px; }
      .header-left .company-name { font-size: 18px; font-weight: bold; color: #0f172a; }
      .header-left .company-details { font-size: 11px; color: #475569; margin-top: 5px; line-height: 1.4; }
      .header-right { text-align: right; }
      .header-right .title { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: 0.4px; }
      .meta-row { font-size: 11px; color: #1e293b; margin-top: 6px; }
      .meta-row .label { display: inline-block; min-width: 70px; color: #0ea5e9; font-weight: 700; }
      .info-section, .section, .summary-section { margin-bottom: 18px; page-break-inside: avoid; }
      .info-section h2, .section h2, .summary-section h2 { font-size: 15px; font-weight: 700; margin-bottom: 8px; background: #e8f4f4; padding: 8px 10px; color: #0f172a; border-radius: 3px; }
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { padding: 6px 9px; border: 1px solid #dfe7ef; font-size: 12px; }
      .info-table td:nth-child(odd) { font-weight: 700; width: 18%; background: #f5faf8; color: #0f172a; }
      .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; font-size: 12px; padding: 6px 2px; }
      .summary-grid div { background: #f5faf8; border: 1px solid #d8efe9; padding: 8px; border-radius: 3px; }
      .scope-line { padding: 6px 4px; font-size: 12px; }
      .work-table, .materials-table { width: 100%; border-collapse: collapse; }
      .work-table th, .materials-table th { background: #1f2937; color: #fff; padding: 9px; text-align: left; font-weight: 700; letter-spacing: 0.2px; }
      .work-table td, .materials-table td { padding: 7px 9px; border: 1px solid #e2e8f0; font-size: 12px; }
      .work-table tbody tr:nth-child(even), .materials-table tbody tr:nth-child(even) { background: #f8fafc; }
      .text-center { text-align: center; }
      .instructions-list { margin-left: 18px; line-height: 1.8; }
      .instructions-list li { margin: 4px 0; }
      .crew-box, .completion-box { padding: 14px; border: 2px solid #d8efe9; border-radius: 4px; background: #f8fdfb; }
      .crew-line, .signature-line { margin: 10px 0; }
      .notes-area { margin-top: 6px; line-height: 1.6; }
      @media print {
        .container { padding: 0.35in; }
        .section { page-break-inside: avoid; }
      }
    `;
  }

  getProductOrderStyles() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 12px; color: #0f172a; background: #fff; }
      .order-container { max-width: 6.8in; margin: 0 auto; padding: 0.55in; }
      .order-header { text-align: center; margin-bottom: 28px; padding-bottom: 14px; border-bottom: 3px solid #d8efe9; }
      .order-header h1 { font-size: 24px; margin-bottom: 12px; letter-spacing: 0.5px; }
      .company-info { font-size: 11px; line-height: 1.6; color: #334155; }
      .section-header-bar { background: #cffafe; padding: 8px 12px; text-align: center; margin-bottom: 12px; border-radius: 3px; }
      .section-header-bar h3 { font-size: 14px; margin: 0; color: #0f172a; font-weight: 700; }
      .job-info-section { margin-bottom: 22px; }
      .job-info-table { width: 100%; border-collapse: collapse; }
      .job-info-table td { padding: 6px 8px; font-size: 12px; }
      .job-info-table td:nth-child(odd) { font-weight: 700; width: 26%; color: #0f172a; }
      .order-section { margin-bottom: 22px; }
      .paint-order-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .paint-order-table th { background: #1f2937; color: #fff; padding: 9px; text-align: center; font-weight: 700; }
      .paint-order-table td { padding: 8px; border: 1px solid #e2e8f0; text-align: center; font-size: 12px; }
      .paint-order-table tbody tr:nth-child(even) { background: #f8fafc; }
      .qty-cell { font-weight: 700; }
      .center-cell { text-align: center; }
      .color-cell { font-family: 'Courier New', monospace; font-weight: 700; }
      .auth-section { margin-bottom: 24px; }
      .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 12px; }
      .signature-item label { display: block; font-weight: 700; margin-bottom: 6px; }
      .signature-line { border-bottom: 2px solid #0f172a; padding-top: 18px; }
      .order-footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #475569; }
      @media print {
        .order-container { padding: 0.35in; }
      }
    `;
  }
}

module.exports = new WorkOrderService();
