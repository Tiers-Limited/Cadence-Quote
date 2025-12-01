// src/components/QuoteBuilder/CustomerInfoStep.jsx
import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Alert, Modal, Card, Row, Col, Typography } from 'antd';
import { UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Text } = Typography;

// US States
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Phone formatting utilities
const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, '');
  const cleanDigits = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits;
  
  if (cleanDigits.length >= 6) {
    return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}`;
  } else if (cleanDigits.length >= 3) {
    return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3)}`;
  }
  return cleanDigits;
};

const isValidPhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10;
};

const isValidZip = (zip) => {
  return /^\d{5}$/.test(zip);
};

const CustomerInfoStep = ({ 
  formData, 
  onUpdate, 
  onNext, 
  pricingSchemes,
  onDetectClient,
  detectedClient,
  onClientDetectionResponse,
}) => {
  const [form] = Form.useForm();
  const [errors, setErrors] = useState({});
  const [showClientModal, setShowClientModal] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    // Set initial form values
    form.setFieldsValue({
      customerName: formData.customerName || '',
      customerEmail: formData.customerEmail || '',
      customerPhone: formData.customerPhone || '',
      street: formData.street || '',
      city: formData.city || '',
      state: formData.state || '',
      zipCode: formData.zipCode || '',
      pricingSchemeId: formData.pricingSchemeId || undefined,
    });
  }, [formData, form]);

  // Show modal when client is detected
  useEffect(() => {
    if (detectedClient && detectedClient.exists) {
      setShowClientModal(true);
    }
  }, [detectedClient]);

  const handleFieldChange = (field, value) => {
    // Clear error for this field
    setErrors(prev => ({ ...prev, [field]: null }));
    
    // Update form data
    onUpdate({ [field]: value });
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    form.setFieldValue('customerPhone', formatted);
    handleFieldChange('customerPhone', formatted);
  };

  const handleEmailBlur = async () => {
    const email = form.getFieldValue('customerEmail');
    const phone = form.getFieldValue('customerPhone');
    
    if (email || phone) {
      setIsDetecting(true);
      try {
        await onDetectClient(email, phone);
      } catch (error) {
        console.error('Client detection error:', error);
      } finally {
        setIsDetecting(false);
      }
    }
  };

  const handleClientModalResponse = (useExisting) => {
    setShowClientModal(false);
    onClientDetectionResponse(useExisting);
    
    if (useExisting && detectedClient?.client) {
      // Populate form with existing client data
      form.setFieldsValue({
        customerName: detectedClient.client.name,
        customerEmail: detectedClient.client.email,
        customerPhone: detectedClient.client.phone,
        street: detectedClient.client.street,
        city: detectedClient.client.city,
        state: detectedClient.client.state,
        zipCode: detectedClient.client.zip,
      });
      
      // Update form data
      onUpdate({
        customerName: detectedClient.client.name,
        customerEmail: detectedClient.client.email,
        customerPhone: detectedClient.client.phone,
        street: detectedClient.client.street,
        city: detectedClient.client.city,
        state: detectedClient.client.state,
        zipCode: detectedClient.client.zip,
        clientId: detectedClient.client.id,
      });
    }
  };

  const validateForm = () => {
    const values = form.getFieldsValue();
    const newErrors = {};

    if (!values.customerName?.trim()) {
      newErrors.customerName = 'Customer name is required';
    }

    if (!values.customerEmail?.trim()) {
      newErrors.customerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail)) {
      newErrors.customerEmail = 'Invalid email format';
    }

    if (!values.customerPhone?.trim()) {
      newErrors.customerPhone = 'Phone number is required';
    } else if (!isValidPhone(values.customerPhone)) {
      newErrors.customerPhone = 'Phone number must be 10 digits';
    }

    if (!values.street?.trim()) {
      newErrors.street = 'Street address is required';
    }

    if (!values.city?.trim()) {
      newErrors.city = 'City is required';
    }

    if (!values.state) {
      newErrors.state = 'State is required';
    }

    if (!values.zipCode?.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    } else if (!isValidZip(values.zipCode)) {
      newErrors.zipCode = 'ZIP code must be 5 digits';
    }

    if (!values.pricingSchemeId) {
      newErrors.pricingSchemeId = 'Pricing scheme is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  return (
    <div className="customer-info-step">
      <Alert
        message="Step 1: Customer Information"
        description="All information will be saved to the client profile and used in proposals and job orders."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        size="large"
      >
        <Card title="Contact Information" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Customer Name"
                name="customerName"
                validateStatus={errors.customerName ? 'error' : ''}
                help={errors.customerName}
                required
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="John Doe"
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Email Address"
                name="customerEmail"
                validateStatus={errors.customerEmail ? 'error' : ''}
                help={errors.customerEmail}
                required
              >
                <Input
                  prefix={<MailOutlined />}
                  type="email"
                  placeholder="john@example.com"
                  onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                  onBlur={handleEmailBlur}
                  loading={isDetecting}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Phone Number"
                name="customerPhone"
                validateStatus={errors.customerPhone ? 'error' : ''}
                help={errors.customerPhone}
                required
              >
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="(555) 123-4567"
                  onChange={handlePhoneChange}
                  maxLength={14}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Property Address" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Street Address"
                name="street"
                validateStatus={errors.street ? 'error' : ''}
                help={errors.street}
                required
              >
                <Input
                  prefix={<HomeOutlined />}
                  placeholder="123 Main Street"
                  onChange={(e) => handleFieldChange('street', e.target.value)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="City"
                name="city"
                validateStatus={errors.city ? 'error' : ''}
                help={errors.city}
                required
              >
                <Input
                  placeholder="Austin"
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label="State"
                name="state"
                validateStatus={errors.state ? 'error' : ''}
                help={errors.state}
                required
              >
                <Select
                  placeholder="Select State"
                  showSearch
                  onChange={(value) => handleFieldChange('state', value)}
                >
                  {US_STATES.map(state => (
                    <Option key={state} value={state}>{state}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item
                label="ZIP Code"
                name="zipCode"
                validateStatus={errors.zipCode ? 'error' : ''}
                help={errors.zipCode}
                required
              >
                <Input
                  placeholder="78701"
                  maxLength={5}
                  onChange={(e) => handleFieldChange('zipCode', e.target.value)}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Pricing Configuration" style={{ marginBottom: 24 }}>
          <Form.Item
            label="Pricing Scheme"
            name="pricingSchemeId"
            validateStatus={errors.pricingSchemeId ? 'error' : ''}
            help={errors.pricingSchemeId || "This determines how pricing is calculated for this quote"}
            required
          >
            <Select
              placeholder="Select Pricing Scheme"
              onChange={(value) => handleFieldChange('pricingSchemeId', value)}
            >
              {pricingSchemes?.map(scheme => (
                <Option key={scheme.id} value={scheme.id}>
                  {scheme.name} - {scheme.type.replace(/_/g, ' ').toUpperCase()}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Button type="primary" size="large" onClick={handleNext}>
            Next: Job Type
          </Button>
        </div>
      </Form>

      {/* Existing Client Detection Modal */}
      <Modal
        title="Existing Client Found"
        open={showClientModal}
        onOk={() => handleClientModalResponse(true)}
        onCancel={() => handleClientModalResponse(false)}
        okText="Use Existing Profile"
        cancelText="Create New Client"
      >
        <p>
          A client with this email or phone number already exists in your system:
        </p>
        {detectedClient?.client && (
          <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px' }}>
            <p><strong>Name:</strong> {detectedClient.client.name}</p>
            <p><strong>Email:</strong> {detectedClient.client.email}</p>
            <p><strong>Phone:</strong> {detectedClient.client.phone}</p>
            <p><strong>Address:</strong> {detectedClient.client.street}, {detectedClient.client.city}, {detectedClient.client.state} {detectedClient.client.zip}</p>
            {detectedClient.client.quotes?.length > 0 && (
              <p><strong>Previous Quotes:</strong> {detectedClient.client.quotes.length}</p>
            )}
          </div>
        )}
        <p style={{ marginTop: 16 }}>
          Would you like to load this existing profile or create a new client?
        </p>
      </Modal>
    </div>
  );
};

export default CustomerInfoStep;
