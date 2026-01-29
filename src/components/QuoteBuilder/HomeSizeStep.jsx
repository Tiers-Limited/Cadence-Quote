import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Radio, Card, Space, Alert, Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

const HomeSizeStep = ({ formData, setFormData, onNext, onPrevious, pricingSchemes }) => {
  const [form] = Form.useForm();
  const [estimatedPrice, setEstimatedPrice] = useState(null);

  // Property condition multipliers per requirements
  const conditionMultipliers = {
    excellent: 1.00,
    good: 1.05,
    average: 1.12,
    fair: 1.25,
    poor: 1.45,
  };

  useEffect(() => {
    // Initialize form with existing data
    form.setFieldsValue({
      homeSqft: formData.homeSqft || '',
      numberOfStories: formData.numberOfStories || 1,
      conditionModifier: formData.conditionModifier || 'average',
    });
    
  }, [formData, form, pricingSchemes]);

  const handleFormChange = (changedValues, allValues) => {
    setFormData({
      ...formData,
      ...allValues,
    });

    // No client-side baseRate: turnkey base rate will be applied from contractor settings on the server
  };

  // We do not compute a client-side estimate here because the base rate comes from contractor settings.
  // The server will calculate an accurate turnkey estimate using tenant settings.

  const handleNext = async () => {
    try {
      await form.validateFields();
      if (onNext) onNext();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      
        <Alert
          message="Turnkey Pricing Selected"
          description="With turnkey pricing, we only need your home's total square footage and scope. No need for detailed room measurements."
          type="info"
          showIcon
          className="mb-6"
        />

        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleFormChange}
        >
          <Form.Item
            label="Total Home Square Footage"
            name="homeSqft"
            rules={[
              { required: true, message: 'Please enter home square footage' },
              { type: 'number', min: 100, message: 'Must be at least 100 sq ft' }
            ]}
            extra="Enter the total living area of your home"
          >
            <InputNumber
              size="large"
              style={{ width: '100%' }}
              placeholder="e.g., 2500"
              min={0}
              addonAfter="sq ft"
            />
          </Form.Item>

          <Form.Item
            label="Number of Stories"
            name="numberOfStories"
            extra="How many floors does your home have?"
          >
            <Radio.Group size="large">
              <Radio.Button value={1}>Single Story</Radio.Button>
              <Radio.Button value={2}>Two Story</Radio.Button>
              <Radio.Button value={3}>Three Story+</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="Property Condition"
            name="conditionModifier"
            extra="Current condition affects preparation requirements"
          >
            <Radio.Group size="large" buttonStyle="solid">
              <Radio.Button value="excellent">Excellent (1.00x)</Radio.Button>
              <Radio.Button value="good">Good (1.05x)</Radio.Button>
              <Radio.Button value="average">Average (1.12x)</Radio.Button>
              <Radio.Button value="fair">Fair (1.25x)</Radio.Button>
              <Radio.Button value="poor">Poor (1.45x)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Alert
            message="Turnkey Rate Applied by Contractor"
            description="The base rate per square foot is provided by the contractor's settings and will be applied when the quote is calculated. Enter your home's square footage to proceed."
            type="info"
            showIcon
            className="mt-6"
          />
        </Form>
    

      <Card className="mt-4" size="small">
        <div className="text-sm text-gray-600">
          <strong>Turnkey Pricing:</strong> This all-inclusive rate covers everything needed for your project - 
          labor, materials, preparation, overhead, profit, and tax. The price you see is the price you pay.
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button size="large" onClick={onPrevious}>
          Previous
        </Button>
        <Button 
          type="primary" 
          size="large" 
          onClick={handleNext}
          disabled={!formData.homeSqft || formData.homeSqft < 100}
        >
          Next: Products
        </Button>
      </div>
    </div>
  );
};

export default HomeSizeStep;
