-- Migration: Create brands and product_prices tables
-- Description: Add support for brand management and per-sheen product pricing

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for brands
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands(is_active);

-- Add brand_id column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES brands(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sheen_options TEXT;

-- Create product_prices table
CREATE TABLE IF NOT EXISTS product_prices (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sheen VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, sheen)
);

-- Add indexes for product_prices
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_sheen ON product_prices(sheen);

-- Insert default brands
INSERT INTO brands (name, description) VALUES
  ('Sherwin-Williams', 'Professional paint solutions'),
  ('Benjamin Moore', 'Premium quality paints'),
  ('Behr', 'Affordable quality paints'),
  ('Valspar', 'Trusted paint brand'),
  ('PPG Paints', 'Industrial and professional paints')
ON CONFLICT (name) DO NOTHING;

-- Create trigger to update updated_at timestamp for brands
CREATE OR REPLACE FUNCTION update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_brands_updated_at();

-- Create trigger to update updated_at timestamp for product_prices
CREATE OR REPLACE FUNCTION update_product_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_prices_updated_at
  BEFORE UPDATE ON product_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_product_prices_updated_at();

-- Comments for documentation
COMMENT ON TABLE brands IS 'Paint manufacturer brands';
COMMENT ON TABLE product_prices IS 'Product pricing by sheen type';
COMMENT ON COLUMN products.brand_id IS 'Reference to brands table';
COMMENT ON COLUMN products.sheen_options IS 'Comma-separated list of available sheen options';
COMMENT ON COLUMN product_prices.sheen IS 'Sheen type: Flat, Matte, Eggshell, Satin, Semi-Gloss, Gloss';
