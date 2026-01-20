// services/documentService.js
// Generates work orders, material lists, and store order sheets using existing PDF service

const { htmlToPdfBuffer } = require('./pdfService');
const path = require('path');
const fs = require('fs');

class DocumentService {
  constructor() {
    // Ensure temp directory exists
    this.tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Generate Work Order HTML
   */
  generateWorkOrderHTML(proposal) {
    const areas = proposal.areas || [];
    
    const areasHTML = areas.map((area, index) => `
      <div class="area-section">
        <h3 style="color: #2563eb; margin-bottom: 8px;">
          ${index + 1}. ${area.name || 'Unnamed Area'}
        </h3>
        ${area.sqft ? `<p><strong>Square Footage:</strong> ${area.sqft} sq ft</p>` : ''}
        
        ${area.customerSelections ? `
          <div style="margin-left: 20px;">
            <p style="margin: 5px 0;"><strong>Product Specifications:</strong></p>
            <p style="margin: 3px 0;">• Brand: ${area.customerSelections.brand || 'Not selected'}</p>
            <p style="margin: 3px 0;">• Product: ${area.customerSelections.product || 'Not selected'}</p>
            <p style="margin: 3px 0;">• Color: ${area.customerSelections.color || 'Not selected'}</p>
            <p style="margin: 3px 0;">• Sheen: ${area.customerSelections.sheen || 'Not selected'}</p>
            ${area.customerSelections.selectedAt ? `
              <p style="margin: 3px 0; font-size: 0.85em; color: #666;">
                Selected: ${new Date(area.customerSelections.selectedAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
              </p>
            ` : ''}
          </div>
        ` : `
          <p style="color: red; margin-left: 20px;">No product selections made</p>
        `}
        
        ${area.surfaces && area.surfaces.length > 0 ? `
          <div style="margin-left: 20px; margin-top: 10px;">
            <p style="margin: 5px 0;"><strong>Surfaces:</strong></p>
            ${area.surfaces.map(surface => `
              <p style="margin: 3px 0;">• ${surface.type || 'Unknown'}: ${surface.sqft || 0} sq ft</p>
            `).join('')}
          </div>
        ` : ''}
      </div>
      ${index < areas.length - 1 ? '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />' : ''}
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }
          h1 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .company-info {
            text-align: center;
            margin-bottom: 30px;
            font-size: 0.9em;
            color: #6b7280;
          }
          .section-title {
            font-size: 1.2em;
            font-weight: bold;
            margin: 20px 0 10px 0;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
          }
          .info-item {
            margin: 5px 0;
          }
          .area-section {
            margin-bottom: 25px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #1f2937;
            text-align: center;
            font-size: 0.8em;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>WORK ORDER</h1>
        <div class="company-info">
          <p>Cadence Painting</p>
          <p>Professional Painting Services</p>
        </div>

        <div class="section-title">Project Information</div>
        <div class="info-grid">
          <div class="info-item"><strong>Quote Number:</strong> ${proposal.quoteNumber}</div>
          <div class="info-item"><strong>Date:</strong> ${new Date().toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</div>
          <div class="info-item"><strong>Customer:</strong> ${proposal.customerName}</div>
          <div class="info-item"><strong>Selected Tier:</strong> ${proposal.selectedTier?.toUpperCase() || 'N/A'}</div>
          ${proposal.customerEmail ? `<div class="info-item"><strong>Email:</strong> ${proposal.customerEmail}</div>` : ''}
          ${proposal.customerPhone ? `<div class="info-item"><strong>Phone:</strong> ${proposal.customerPhone}</div>` : ''}
        </div>

        ${proposal.street || proposal.city ? `
          <div class="info-item">
            <strong>Property Address:</strong><br />
            ${proposal.street || ''}<br />
            ${proposal.city && proposal.state ? `${proposal.city}, ${proposal.state}` : proposal.city || proposal.state || ''} 
            ${proposal.zipCode || ''}
          </div>
        ` : ''}

        <div class="section-title">Product Selections by Area</div>
        ${areasHTML || '<p style="color: red;">No areas defined</p>'}

        <div class="footer">
          <p>This work order is valid for the scope and specifications outlined above.</p>
          <p>Any changes to products or colors must be approved in writing.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate Material List HTML
   */
  generateMaterialListHTML(proposal) {
    const areas = proposal.areas || [];
    const materialMap = new Map();

    // Aggregate materials across all areas
    areas.forEach(area => {
      if (area.customerSelections) {
        const key = `${area.customerSelections.brand}|${area.customerSelections.product}|${area.customerSelections.color}|${area.customerSelections.sheen}`;
        if (!materialMap.has(key)) {
          materialMap.set(key, {
            brand: area.customerSelections.brand,
            product: area.customerSelections.product,
            color: area.customerSelections.color,
            sheen: area.customerSelections.sheen,
            areas: [],
            totalSqft: 0
          });
        }
        const material = materialMap.get(key);
        material.areas.push(area.name);
        material.totalSqft += Number.parseFloat(area.sqft) || 0;
      }
    });

    const materialsHTML = Array.from(materialMap.entries()).map(([_, material], index) => {
      const estimatedGallons = Math.ceil(material.totalSqft / 350);
      return `
        <div class="material-item">
          <h3 style="color: #2563eb;">Item ${index + 1}</h3>
          <p><strong>Brand:</strong> ${material.brand}</p>
          <p><strong>Product:</strong> ${material.product}</p>
          <p><strong>Color:</strong> ${material.color}</p>
          <p><strong>Sheen:</strong> ${material.sheen}</p>
          <p><strong>Total Coverage:</strong> ${material.totalSqft.toFixed(2)} sq ft</p>
          <p style="font-size: 1.1em;"><strong>Estimated Quantity:</strong> ${estimatedGallons} gallon${estimatedGallons > 1 ? 's' : ''}</p>
          <p style="font-size: 0.9em; color: #6b7280;">Used in: ${material.areas.join(', ')}</p>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }
          h1 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .company-info {
            text-align: center;
            margin-bottom: 30px;
            font-size: 0.9em;
            color: #6b7280;
          }
          .section-title {
            font-size: 1.2em;
            font-weight: bold;
            margin: 20px 0 10px 0;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
          }
          .material-item {
            background: #f9fafb;
            padding: 15px;
            margin-bottom: 15px;
            border-left: 4px solid #2563eb;
          }
          .material-item p {
            margin: 5px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #1f2937;
            text-align: center;
            font-size: 0.8em;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>MATERIAL LIST</h1>
        <div class="company-info">
          <p>Cadence Painting</p>
        </div>

        <div class="section-title">Project Information</div>
        <p><strong>Quote Number:</strong> ${proposal.quoteNumber}</p>
        <p><strong>Customer:</strong> ${proposal.customerName}</p>
        <p><strong>Tier:</strong> ${proposal.selectedTier?.toUpperCase() || 'N/A'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</p>

        <div class="section-title">Materials Required</div>
        ${materialsHTML || '<p style="color: red;">No materials selected</p>'}

        <div class="section-title">Additional Materials</div>
        <p>☐ Primer (if required)</p>
        <p>☐ Caulk</p>
        <p>☐ Painter's Tape</p>
        <p>☐ Drop Cloths</p>
        <p>☐ Sandpaper</p>
        <p>☐ Wood Filler (if needed)</p>

        <div class="footer">
          <p>Please verify quantities before ordering. Coverage may vary based on surface condition.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate Store Order Sheet HTML
   */
  generateStoreOrderHTML(proposal) {
    const areas = proposal.areas || [];
    const materialMap = new Map();

    // Aggregate materials
    areas.forEach(area => {
      if (area.customerSelections) {
        const key = `${area.customerSelections.brand}|${area.customerSelections.product}|${area.customerSelections.color}|${area.customerSelections.sheen}`;
        if (!materialMap.has(key)) {
          materialMap.set(key, {
            brand: area.customerSelections.brand,
            product: area.customerSelections.product,
            color: area.customerSelections.color,
            sheen: area.customerSelections.sheen,
            totalSqft: 0
          });
        }
        const material = materialMap.get(key);
        material.totalSqft += Number.parseFloat(area.sqft) || 0;
      }
    });

    const orderItemsHTML = Array.from(materialMap.entries()).map(([_, material], index) => {
      const estimatedGallons = Math.ceil(material.totalSqft / 350);
      return `
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${index + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${material.brand}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${material.product}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${material.color}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${material.sheen}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${estimatedGallons}g</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }
          h1 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 10px;
          }
          .company-info {
            text-align: center;
            margin-bottom: 30px;
            font-size: 0.9em;
            color: #6b7280;
          }
          .section-title {
            font-size: 1.2em;
            font-weight: bold;
            margin: 20px 0 10px 0;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th {
            background-color: #2563eb;
            color: white;
            padding: 10px;
            text-align: left;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #1f2937;
            text-align: center;
            font-size: 0.8em;
            color: #6b7280;
          }
          .notes {
            background: #f9fafb;
            padding: 15px;
            margin: 20px 0;
            border-left: 4px solid #2563eb;
          }
        </style>
      </head>
      <body>
        <h1>STORE ORDER SHEET</h1>
        <div class="company-info">
          <p>Cadence Painting - Professional Painting Services</p>
        </div>

        <div class="section-title">Order Information</div>
        <p><strong>Order Reference:</strong> ${proposal.quoteNumber}</p>
        <p><strong>Customer Name:</strong> ${proposal.customerName}</p>
        <p><strong>Order Date:</strong> ${new Date().toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</p>
        <p><strong>Project Tier:</strong> ${proposal.selectedTier?.toUpperCase() || 'N/A'}</p>

        <div class="section-title">Order Items</div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Brand</th>
              <th>Product</th>
              <th>Color</th>
              <th>Sheen</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHTML || '<tr><td colspan="6" style="color: red; text-align: center;">No items</td></tr>'}
          </tbody>
        </table>

        <div class="notes">
          <div class="section-title">Special Instructions</div>
          <p>☐ Please verify color formulas before mixing</p>
          <p>☐ Confirm sheen availability for selected products</p>
          <p>☐ Contact if substitutions are necessary</p>
        </div>

        <div class="section-title">Store Use Only</div>
        <p>Order Taken By: _________________________   Date: ____________</p>
        <p>Order Ready By: _________________________   Time: ____________</p>
        <p>Customer Pickup / Delivery (circle one)</p>

        <div class="footer">
          <p>Please keep a copy of this order sheet for your records.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate and save Work Order PDF
   */
  async generateWorkOrder(proposal) {
    const html = this.generateWorkOrderHTML(proposal);
    const pdfBuffer = await htmlToPdfBuffer(html);
    const fileName = `work-order-${proposal.quoteNumber}.pdf`;
    const filePath = path.join(this.tempDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
  }

  /**
   * Generate and save Material List PDF
   */
  async generateMaterialList(proposal) {
    const html = this.generateMaterialListHTML(proposal);
    const pdfBuffer = await htmlToPdfBuffer(html);
    const fileName = `material-list-${proposal.quoteNumber}.pdf`;
    const filePath = path.join(this.tempDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
  }

  /**
   * Generate and save Store Order PDF
   */
  async generateStoreOrder(proposal) {
    const html = this.generateStoreOrderHTML(proposal);
    const pdfBuffer = await htmlToPdfBuffer(html);
    const fileName = `store-order-${proposal.quoteNumber}.pdf`;
    const filePath = path.join(this.tempDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
  }

  /**
   * Clean up temporary PDF file
   */
  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Error cleaning up PDF file:', error);
    }
  }
}

module.exports = new DocumentService();
