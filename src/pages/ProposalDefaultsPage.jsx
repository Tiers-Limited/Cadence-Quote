import { useState, useEffect } from 'react';
import { Card, Tabs, Form, Input, Button, message, Spin, Switch, InputNumber, Select } from 'antd';
import { FiSave, FiFileText, FiDollarSign, FiPackage } from 'react-icons/fi';
import { apiService } from '../services/apiService';

const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

function ProposalDefaultsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('introduction');
  const [form] = Form.useForm();
  const [gbbDefaults, setGbbDefaults] = useState([]);
  const [globalProducts, setGlobalProducts] = useState([]);

  useEffect(() => {
    fetchProposalDefaults();
    fetchGBBDefaults();
    fetchGlobalProducts();
  }, []);

  const fetchProposalDefaults = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/proposal-defaults');
      if (response.success) {
        form.setFieldsValue(response.data);
      }
    } catch (error) {
      message.error('Failed to load proposal defaults: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGBBDefaults = async () => {
    try {
      const response = await apiService.get('/gbb-defaults');
      if (response.success) {
        setGbbDefaults(response.data);
      }
    } catch (error) {
      console.error('Failed to load GBB defaults:', error);
    }
  };

  const fetchGlobalProducts = async () => {
    try {
      const response = await apiService.get('/global-products?limit=1000');
      if (response.success) {
        setGlobalProducts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleSave = async (values) => {
    try {
      setSaving(true);
      const response = await apiService.put('/proposal-defaults', values);
      if (response.success) {
        message.success('Proposal defaults saved successfully');
      }
    } catch (error) {
      message.error('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGBBDefaults = async () => {
    try {
      setSaving(true);
      const response = await apiService.put('/gbb-defaults', { defaults: gbbDefaults });
      if (response.success) {
        message.success('GBB defaults saved successfully');
      }
    } catch (error) {
      message.error('Failed to save GBB defaults: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGBBChange = (surfaceType, tier, field, value) => {
    setGbbDefaults(prev =>
      prev.map(item =>
        item.surfaceType === surfaceType
          ? { ...item, [`${tier}${field.charAt(0).toUpperCase() + field.slice(1)}`]: value }
          : item
      )
    );
  };

  const surfaceTypeLabels = {
    interior_walls: 'Interior Walls',
    interior_trim_doors: 'Interior Trim & Doors',
    interior_ceilings: 'Interior Ceilings',
    cabinets: 'Cabinets',
    exterior_siding: 'Exterior Siding',
    exterior_trim: 'Exterior Trim'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proposal Defaults</h1>
        <p className="text-gray-600 mt-1">
          Configure default content and settings that auto-populate in your proposals
        </p>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* 1. Company Introduction (Combined Messaging) */}
          <TabPane tab="Company Introduction" key="introduction">
            <Card>
              <Form.Item
                label="Company Introduction"
                name="companyIntroduction"
                tooltip="Combined welcome message and about us - shown at top of every proposal"
              >
                <TextArea 
                  rows={10} 
                  placeholder="Thank you for considering us for your painting project...&#10;&#10;About Us:&#10;We are a professional painting company with years of experience..." 
                />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Company Introduction
              </Button>
            </Card>
          </TabPane>

          {/* 2. Processes (All subcategories) */}
          <TabPane tab="Processes" key="processes">
            <Card>
              <Form.Item label="Interior Process" name="interiorProcess">
                <TextArea rows={5} placeholder="1. Surface preparation...&#10;2. Priming...&#10;3. Painting..." />
              </Form.Item>

              <Form.Item label="Exterior Process" name="exteriorProcess">
                <TextArea rows={5} placeholder="1. Power washing...&#10;2. Surface prep...&#10;3. Priming..." />
              </Form.Item>

              <Form.Item label="Drywall Process" name="drywallProcess">
                <TextArea rows={5} placeholder="1. Assessment of damage...&#10;2. Repair work...&#10;3. Finishing..." />
              </Form.Item>

              <Form.Item label="Cabinet Process" name="cabinetProcess">
                <TextArea rows={5} placeholder="1. Remove hardware...&#10;2. Cleaning and prep...&#10;3. Priming..." />
              </Form.Item>

              <Form.Item label="Trim Process" name="trimProcess">
                <TextArea rows={5} placeholder="1. Surface cleaning...&#10;2. Sanding...&#10;3. Priming..." />
              </Form.Item>

              <Form.Item label="Ceiling Process" name="ceilingProcess">
                <TextArea rows={5} placeholder="1. Surface preparation...&#10;2. Priming...&#10;3. Painting..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Process Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 3. Warranty */}
          <TabPane tab="Warranty" key="warranty">
            <Card>
              <Form.Item label="Standard Warranty" name="standardWarranty">
                <TextArea rows={6} placeholder="2-Year Workmanship Warranty...&#10;Coverage details...&#10;Exclusions..." />
              </Form.Item>

              <Form.Item label="Premium Warranty" name="premiumWarranty">
                <TextArea rows={6} placeholder="5-Year Premium Warranty...&#10;Extended coverage...&#10;Additional benefits..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Warranty Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 4. Payments */}
          <TabPane tab="Payments" key="payments">
            <Card>
              <Form.Item label="Payment Terms & Schedule" name="paymentTermsSchedule">
                <TextArea 
                  rows={8} 
                  placeholder="Payment Schedule:&#10;- 50% deposit required to begin work&#10;- 25% at project midpoint&#10;- 25% upon completion&#10;&#10;Terms:&#10;- Payment due within 3 business days of invoice&#10;- Late fees of 1.5% per month may apply" 
                />
              </Form.Item>

              <Form.Item label="Payment Methods" name="paymentMethods">
                <TextArea 
                  rows={5} 
                  placeholder="We accept the following payment methods:&#10;- Credit/Debit Cards (Visa, MasterCard, American Express)&#10;- ACH/Bank Transfer&#10;- Cash or Check&#10;- Financing options available" 
                />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Payment Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 5. Responsibilities */}
          <TabPane tab="Responsibilities" key="responsibilities">
            <Card>
              <Form.Item label="Client Responsibilities" name="clientResponsibilities">
                <TextArea rows={8} placeholder="Client agrees to:&#10;- Move furniture and personal items from work areas&#10;- Provide access to water and electricity&#10;- Ensure pets are secured&#10;- Clear work areas of obstacles..." />
              </Form.Item>

              <Form.Item label="Contractor Responsibilities" name="contractorResponsibilities">
                <TextArea rows={8} placeholder="We guarantee to:&#10;- Arrive on time and ready to work&#10;- Protect your property with drop cloths and coverings&#10;- Clean up daily and thoroughly at project completion&#10;- Maintain professional conduct..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Responsibility Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 6. Product Setup & GBB Defaults (Combined) */}
          <TabPane tab="Product Setup & GBB" key="products">
            <Card title="Product Strategy Configuration">
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <Form.Item label="Product Strategy" name="gbbSetupEnabled" valuePropName="checked" className="mb-2">
                  <Switch checkedChildren="GBB Enabled" unCheckedChildren="GBB Disabled" />
                </Form.Item>

                <Form.Item label="Single System" name="singleSystemEnabled" valuePropName="checked" className="mb-0">
                  <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>
              </div>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />} className="mb-6">
                Save Product Setup
              </Button>
            </Card>

            <Card title="Good-Better-Best Product Defaults" className="mt-4">
              <p className="text-gray-600 mb-6">
                Set default products and pricing for each surface type. These will auto-populate during quoting.
              </p>

              {gbbDefaults.map((item) => (
                <Card key={item.surfaceType} className="mb-4" size="small" title={surfaceTypeLabels[item.surfaceType]}>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Good Tier */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Good</h4>
                      <Select
                        className="w-full mb-2"
                        placeholder="Select Product"
                        value={item.goodProductId}
                        onChange={(value) => handleGBBChange(item.surfaceType, 'good', 'productId', value)}
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {globalProducts.map((product) => (
                          <Option key={product.id} value={product.id}>
                            {product.name}
                          </Option>
                        ))}
                      </Select>
                      <InputNumber
                        className="w-full"
                        prefix="$"
                        placeholder="Price/Gallon"
                        value={item.goodPricePerGallon}
                        onChange={(value) => handleGBBChange(item.surfaceType, 'good', 'pricePerGallon', value)}
                      />
                    </div>

                    {/* Better Tier */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Better</h4>
                      <Select
                        className="w-full mb-2"
                        placeholder="Select Product"
                        value={item.betterProductId}
                        onChange={(value) => handleGBBChange(item.surfaceType, 'better', 'productId', value)}
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {globalProducts.map((product) => (
                          <Option key={product.id} value={product.id}>
                            {product.name}
                          </Option>
                        ))}
                      </Select>
                      <InputNumber
                        className="w-full"
                        prefix="$"
                        placeholder="Price/Gallon"
                        value={item.betterPricePerGallon}
                        onChange={(value) => handleGBBChange(item.surfaceType, 'better', 'pricePerGallon', value)}
                      />
                    </div>

                    {/* Best Tier */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Best</h4>
                      <Select
                        className="w-full mb-2"
                        placeholder="Select Product"
                        value={item.bestProductId}
                        onChange={(value) => handleGBBChange(item.surfaceType, 'best', 'productId', value)}
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {globalProducts.map((product) => (
                          <Option key={product.id} value={product.id}>
                            {product.name}
                          </Option>
                        ))}
                      </Select>
                      <InputNumber
                        className="w-full"
                        prefix="$"
                        placeholder="Price/Gallon"
                        value={item.bestPricePerGallon}
                        onChange={(value) => handleGBBChange(item.surfaceType, 'best', 'pricePerGallon', value)}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              <Button type="primary" onClick={handleSaveGBBDefaults} loading={saving} icon={<FiSave />} className="mt-4">
                Save GBB Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 7. Acceptance & Signature Agreement (Combined) */}
          <TabPane tab="Acceptance" key="acceptance">
            <Card>
              <Form.Item 
                label="Acceptance & Signature Agreement" 
                name="acceptanceSignatureAgreement"
                tooltip="Combined legal acknowledgement and signature statement"
              >
                <TextArea 
                  rows={8} 
                  placeholder="ACCEPTANCE & SIGNATURE AGREEMENT&#10;&#10;By signing below, you acknowledge that you have read, understood, and agree to all terms and conditions outlined in this proposal.&#10;&#10;Legal Acknowledgement:&#10;This agreement constitutes a binding contract between the parties...&#10;&#10;Digital Signature Statement:&#10;Digital signatures are legally binding and carry the same weight as handwritten signatures..." 
                />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Acceptance Agreement
              </Button>
            </Card>
          </TabPane>
        </Tabs>
      </Form>
    </div>
  );
}

export default ProposalDefaultsPage;
