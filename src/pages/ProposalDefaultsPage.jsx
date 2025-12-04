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
  const [activeTab, setActiveTab] = useState('messaging');
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
          {/* 1. Messaging & Introduction */}
          <TabPane tab="Messaging" key="messaging">
            <Card>
              <Form.Item
                label="Default Welcome Message"
                name="defaultWelcomeMessage"
                tooltip="Intro text shown at top of every proposal"
              >
                <TextArea rows={4} placeholder="Thank you for considering us..." />
              </Form.Item>

              <Form.Item
                label="About Us Summary"
                name="aboutUsSummary"
                tooltip="Your company background automatically added to proposals"
              >
                <TextArea rows={6} placeholder="We are a professional painting company..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Messaging Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 2. Processes */}
          <TabPane tab="Processes" key="processes">
            <Card>
              <Form.Item label="Interior Process" name="interiorProcess">
                <TextArea rows={6} placeholder="1. Surface preparation..." />
              </Form.Item>

              <Form.Item label="Exterior Process" name="exteriorProcess">
                <TextArea rows={6} placeholder="1. Power washing..." />
              </Form.Item>

              <Form.Item label="Cabinet Process" name="cabinetProcess">
                <TextArea rows={6} placeholder="1. Remove hardware..." />
              </Form.Item>

              <Form.Item label="Trim Process" name="trimProcess">
                <TextArea rows={6} placeholder="1. Surface cleaning..." />
              </Form.Item>

              <Form.Item label="Drywall Repair Process" name="drywallRepairProcess">
                <TextArea rows={6} placeholder="1. Assessment of damage..." />
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
                <TextArea rows={6} placeholder="2-Year Workmanship Warranty..." />
              </Form.Item>

              <Form.Item label="Premium Warranty" name="premiumWarranty">
                <TextArea rows={6} placeholder="5-Year Premium Warranty..." />
              </Form.Item>

              <Form.Item label="Exterior Warranty" name="exteriorWarranty">
                <TextArea rows={6} placeholder="5-Year Exterior Warranty..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Warranty Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 4. Payments */}
          <TabPane tab="Payments" key="payments">
            <Card>
              <Form.Item label="Payment Terms" name="paymentTermsText">
                <TextArea rows={6} placeholder="- 50% deposit required..." />
              </Form.Item>

              <Form.Item label="Payment Methods" name="paymentMethods">
                <TextArea rows={6} placeholder="We accept: Credit/Debit, ACH..." />
              </Form.Item>

              <Form.Item label="Late Payment Policy" name="latePaymentPolicy">
                <TextArea rows={4} placeholder="Late fees of 1.5% per month..." />
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
                <TextArea rows={8} placeholder="Client agrees to: Move furniture..." />
              </Form.Item>

              <Form.Item label="Contractor Responsibilities" name="contractorResponsibilities">
                <TextArea rows={8} placeholder="We guarantee: Arrive on time..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Responsibility Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 6. Policies */}
          <TabPane tab="Policies" key="policies">
            <Card>
              <Form.Item label="Touch-Up Policy" name="touchUpPolicy">
                <TextArea rows={3} />
              </Form.Item>

              <Form.Item label="Final Walkthrough Policy" name="finalWalkthroughPolicy">
                <TextArea rows={3} />
              </Form.Item>

              <Form.Item label="Change Order Policy" name="changeOrderPolicy">
                <TextArea rows={3} />
              </Form.Item>

              <Form.Item label="Color Disclaimer" name="colorDisclaimer">
                <TextArea rows={2} />
              </Form.Item>

              <Form.Item label="Surface Condition Disclaimer" name="surfaceConditionDisclaimer">
                <TextArea rows={2} />
              </Form.Item>

              <Form.Item label="Paint Failure Disclaimer" name="paintFailureDisclaimer">
                <TextArea rows={2} />
              </Form.Item>

              <Form.Item label="General Proposal Disclaimer" name="generalProposalDisclaimer">
                <TextArea rows={2} />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Policy Defaults
              </Button>
            </Card>
          </TabPane>

          {/* 7. Product Setup */}
          <TabPane tab="Product Setup" key="products">
            <Card>
              <Form.Item label="Product Strategy" name="gbbSetupEnabled" valuePropName="checked">
                <Switch checkedChildren="GBB Enabled" unCheckedChildren="GBB Disabled" />
              </Form.Item>

              <Form.Item label="Single System" name="singleSystemEnabled" valuePropName="checked">
                <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Product Setup
              </Button>
            </Card>
          </TabPane>

          {/* 8. GBB Defaults */}
          <TabPane tab="GBB Defaults" key="gbb">
            <Card title="Good-Better-Best Product Defaults">
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

          {/* 9. Acceptance */}
          <TabPane tab="Acceptance" key="acceptance">
            <Card>
              <Form.Item label="Legal Acknowledgement Text" name="legalAcknowledgement">
                <TextArea rows={4} placeholder="By signing below, you acknowledge..." />
              </Form.Item>

              <Form.Item label="Signature Statement" name="signatureStatement">
                <TextArea rows={3} placeholder="Digital signatures are legally binding..." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving} icon={<FiSave />}>
                Save Acceptance Defaults
              </Button>
            </Card>
          </TabPane>
        </Tabs>
      </Form>
    </div>
  );
}

export default ProposalDefaultsPage;
