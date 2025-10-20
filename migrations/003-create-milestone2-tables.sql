-- Migration: Create products, contractor settings, pricing schemes, and leads tables
-- Date: 2025-10-18
-- Description: Milestone 2 - Contractor Admin Catalog, Pricing & Lead Capture

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'wall_paint',
  tier VARCHAR(50) NOT NULL DEFAULT 'default',
  sheen VARCHAR(50) NOT NULL DEFAULT 'eggshell',
  price_per_gallon DECIMAL(10, 2) NOT NULL,
  coverage_rate INTEGER NOT NULL DEFAULT 400,
  is_active BOOLEAN DEFAULT TRUE,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT products_category_check CHECK (category IN ('wall_paint', 'ceiling_paint', 'trim_paint', 'primer', 'custom')),
  CONSTRAINT products_tier_check CHECK (tier IN ('good', 'better', 'best', 'default', 'upgrade')),
  CONSTRAINT products_sheen_check CHECK (sheen IN ('flat', 'matte', 'eggshell', 'satin', 'semi-gloss', 'gloss'))
);

CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_tier ON products(tier);

-- Create contractor_settings table
CREATE TABLE IF NOT EXISTS contractor_settings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  default_markup_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
  tax_rate_percentage DECIMAL(5, 2) NOT NULL DEFAULT 8.25,
  deposit_percentage DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
  payment_terms TEXT,
  warranty_terms TEXT,
  general_terms TEXT,
  business_hours VARCHAR(255),
  quote_validity_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_contractor_settings_tenant_id ON contractor_settings(tenant_id);

-- Create pricing_schemes table
CREATE TABLE IF NOT EXISTS pricing_schemes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  pricing_rules JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT pricing_schemes_type_check CHECK (type IN ('sqft_turnkey', 'sqft_labor_only', 'hourly_time_materials', 'unit_based'))
);

CREATE INDEX idx_pricing_schemes_tenant_id ON pricing_schemes(tenant_id);
CREATE INDEX idx_pricing_schemes_type ON pricing_schemes(type);
CREATE INDEX idx_pricing_schemes_is_default ON pricing_schemes(is_default);

-- Create lead_forms table
CREATE TABLE IF NOT EXISTS lead_forms (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  form_name VARCHAR(255) NOT NULL,
  form_title VARCHAR(255) NOT NULL,
  form_description TEXT,
  public_url VARCHAR(255),
  form_fields JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lead_forms_tenant_id ON lead_forms(tenant_id);
CREATE UNIQUE INDEX idx_lead_forms_public_url ON lead_forms(public_url);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES "Tenants"(id) ON DELETE CASCADE,
  lead_form_id INTEGER REFERENCES lead_forms(id) ON DELETE SET NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  project_type VARCHAR(100),
  message TEXT,
  form_data JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  source VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT leads_status_check CHECK (status IN ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost'))
);

CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_form_id ON leads(lead_form_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Insert default products (system defaults)
INSERT INTO products (tenant_id, name, description, brand, category, tier, sheen, price_per_gallon, coverage_rate, is_system_default)
SELECT 
  t.id,
  'ProMar 200',
  'Zero VOC, professional finish',
  'Sherwin-Williams',
  'wall_paint',
  'good',
  'eggshell',
  29.95,
  400,
  TRUE
FROM "Tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.tenant_id = t.id AND p.name = 'ProMar 200'
);
