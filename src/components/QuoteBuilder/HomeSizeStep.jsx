import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Radio, Card, Space, Alert, Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

const HomeSizeStep = ({ formData, setFormData, onNext, onPrevious, pricingSchemes }) => {
  const [form] = Form.useForm();
  const [estimatedPrice, setEstimatedPrice] = useState(null);

  useEffect(() => {
    // Initialize form with existing data
    form.setFieldsValue({
      homeSqft: formData.homeSqft || '',
      jobScope: formData.jobScope || 'both',
      numberOfStories: formData.numberOfStories || 1,
      conditionModifier: formData.conditionModifier || 'average',
    });
    
    // Calculate estimate if homeSqft exists
    if (formData.homeSqft && formData.homeSqft > 0) {
      calculateEstimate(formData);
    }
  }, [formData, form]);

  const handleFormChange = (changedValues, allValues) => {
    setFormData({
      ...formData,
      ...allValues,
    });

    // Calculate estimated price if home sqft is provided
    if (allValues.homeSqft && allValues.homeSqft > 0) {
      calculateEstimate(allValues);
    }
  };

  const calculateEstimate = (values) => {
    const { homeSqft, jobScope, conditionModifier } = values;
    
    // Get turnkey rate from selected pricing scheme
    const selectedScheme = pricingSchemes?.find(s => s.id === formData.pricingSchemeId);
    const rules = selectedScheme?.pricingRules || {};
    
    let baseRate = rules.turnkeyRate || 3.50;
    
    // Adjust for scope
    if (jobScope === 'interior' && rules.interiorRate) {
      baseRate = rules.interiorRate;
    } else if (jobScope === 'exterior' && rules.exteriorRate) {
      baseRate = rules.exteriorRate;
    }
    
    // Adjust for condition
    const conditionMultipliers = {
      excellent: 0.9,
      good: 0.95,
      average: 1.0,
      fair: 1.1,
      poor: 1.25,
    };
    
    const finalRate = baseRate * (conditionMultipliers[conditionModifier] || 1.0);
    const estimate = homeSqft * finalRate;
    
    setEstimatedPrice(estimate);
  };

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
            label="Job Scope"
            name="jobScope"
            extra="What areas will be painted?"
          >
            <Radio.Group size="large" buttonStyle="solid">
              <Radio.Button value="interior">Interior Only</Radio.Button>
              <Radio.Button value="exterior">Exterior Only</Radio.Button>
              <Radio.Button value="both">Both</Radio.Button>
            </Radio.Group>
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
              <Radio.Button value="excellent">Excellent</Radio.Button>
              <Radio.Button value="good">Good</Radio.Button>
              <Radio.Button value="average">Average</Radio.Button>
              <Radio.Button value="fair">Fair</Radio.Button>
              <Radio.Button value="poor">Poor</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {estimatedPrice && (
            <Alert
              message="Estimated Price Range"
              description={
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    ${estimatedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    This is a preliminary estimate. Final pricing will be calculated with markups, overhead, and taxes.
                  </div>
                </div>
              }
              type="success"
              showIcon
              className="mt-6"
            />
          )}
        </Form>
    

      <Card className="mt-4" size="small">
        <div className="text-sm text-gray-600">
          <strong>Note:</strong> Turnkey pricing includes all labor and materials in a single rate. 
          Your final quote will include detailed breakdowns with markups, overhead, profit margins, 
          and applicable taxes.
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
