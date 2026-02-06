import React, { useState, useEffect } from 'react';
import {
  Card,
  Radio,
  Button,
  message,
  Spin,
  Switch,
  Select,
  Row,
  Col,
  Typography,
  Divider,
  Modal,
  Space
} from 'antd';
import { FiSave, FiEye, FiSettings } from 'react-icons/fi';
import { apiService } from '../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;

const PROPOSAL_TEMPLATES = [
  {
    id: 'classic-professional',
    name: 'Classic/Professional',
    description: 'Traditional layout with formal typography and structured sections (Current Default)',
    preview: '/images/templates/classic-preview.png',
    features: ['Company branding', 'Detailed scope', 'GBB pricing', 'Warranty terms', 'Formal presentation']
  },
  {
    id: 'modern-minimal',
    name: 'Modern/Minimal',
    description: 'Clean layout with ample whitespace and contemporary design elements',
    preview: '/images/templates/modern-preview.png',
    features: ['Visual hierarchy', 'Clean typography', 'Streamlined layout', 'Contemporary design']
  },
  {
    id: 'detailed-comprehensive',
    name: 'Detailed/Comprehensive',
    description: 'Expanded sections for specifications, terms, and detailed breakdowns',
    preview: '/images/templates/detailed-preview.png',
    features: ['Comprehensive terms', 'Detailed specifications', 'Full breakdowns', 'Legal emphasis']
  },
  {
    id: 'simple-budget',
    name: 'Simple/Budget-friendly',
    description: 'Concise layout focusing on essential pricing and product information',
    preview: '/images/templates/simple-preview.png',
    features: ['Essential info only', 'Quick overview', 'Budget-focused', 'Easy to read']
  }
];

const COLOR_SCHEMES = [
  { value: 'blue', label: 'Professional Blue', color: '#1890ff' },
  { value: 'green', label: 'Success Green', color: '#52c41a' },
  { value: 'orange', label: 'Warm Orange', color: '#fa8c16' },
  { value: 'purple', label: 'Creative Purple', color: '#722ed1' },
  { value: 'gray', label: 'Neutral Gray', color: '#595959' }
];

const ProposalTemplatesConfig = ({ onSave }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('classic-professional');
  const [templateSettings, setTemplateSettings] = useState({
    showCompanyLogo: true,
    showAreaBreakdown: true,
    showProductDetails: true,
    showWarrantySection: true,
    colorScheme: 'blue'
  });
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [availableTemplates, setAvailableTemplates] = useState(PROPOSAL_TEMPLATES);

  // Helper function to generate preview HTML
  const generatePreviewHTML = (sampleData, templateId) => {
    const colorSchemes = {
      blue: '#1890ff',
      green: '#52c41a',
      orange: '#fa8c16',
      purple: '#722ed1',
      gray: '#595959'
    };

    const primaryColor = colorSchemes[templateSettings.colorScheme] || '#1890ff';
    
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            @page { size: A4; margin: 24px; }
            body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; padding: 16px; }
            .page { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .muted { color: #666; }
            .title { font-size: 22px; font-weight: 700; color: ${primaryColor}; margin: 8px 0 12px; }
            .section-title { font-size: 18px; font-weight: 700; color: ${primaryColor}; margin: 20px 0 8px; }
            .label { font-weight: 600; }
            .small { font-size: 12px; }
            .pre { white-space: pre-line; }
            .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 8px 0; }
            .row { display: flex; gap: 12px; align-items: center; }
            .space { height: 8px; }
            .header {
              display: grid; grid-template-columns: 64px 1fr; gap: 12px;
              align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px;
            }
            .logo { width: 64px; height: 64px; object-fit: contain; border: 1px solid #eee; background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; }
            .gbb { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .gbb .head { background: ${primaryColor}; color: #fff; text-align: left; padding: 8px; font-weight: 600; font-size: 13px; }
            .gbb .cell { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; vertical-align: top; }
            .list { margin: 6px 0 6px 18px; }
            .kv { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="page">
            <div>
              <div class="header">
                ${templateSettings.showCompanyLogo ? 
                  (sampleData.company.logoUrl ? 
                    `<img class="logo" src="${sampleData.company.logoUrl}" />` : 
                    '<div class="logo">LOGO</div>') : 
                  '<div></div>'
                }
                <div>
                  <div style="font-size:18px; font-weight:700;">${sampleData.company.name}</div>
                  <div class="small muted">Phone: ${sampleData.company.phone} • Email: ${sampleData.company.email}</div>
                  <div class="small muted">${sampleData.company.addressLine1}, ${sampleData.company.addressLine2}</div>
                </div>
              </div>

              <div class="title">Project Proposal</div>
              <div class="kv small"><span class="label">Invoice:</span> ${sampleData.proposal.invoiceNumber}</div>
              <div class="kv small"><span class="label">Date:</span> ${sampleData.proposal.date}</div>
              <div class="kv small"><span class="label">Customer:</span> ${sampleData.proposal.customerName}</div>
              <div class="kv small"><span class="label">Project Address:</span> ${sampleData.proposal.projectAddress}</div>

              <div class="section-title">Introduction</div>
              <div class="small pre">${sampleData.introduction.welcomeMessage}</div>
              <div class="small pre muted" style="margin-top:6px;">${sampleData.introduction.aboutUsSummary}</div>

              <div class="section-title">Scope of Work</div>
              <div class="small label">Interior Process</div>
              <div class="small pre">${sampleData.scope.interiorProcess}</div>
              <div class="small label" style="margin-top:6px;">Exterior Process</div>
              <div class="small pre">${sampleData.scope.exteriorProcess}</div>

              ${templateSettings.showAreaBreakdown ? `
                <div class="section-title">Area Breakdown</div>
                <ul class="list">
                  ${sampleData.areaBreakdown.map(area => `<li>${area}</li>`).join('')}
                </ul>
              ` : ''}

              ${templateSettings.showProductDetails ? `
                <div class="section-title">Product Selection (GBB)</div>
              ` : ''}
            </div>

            <div>
              ${templateSettings.showProductDetails ? `
                <table class="gbb">
                  <thead>
                    <tr>
                      <th class="head">Surface</th>
                      <th class="head">Good</th>
                      <th class="head">Better</th>
                      <th class="head">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sampleData.gbb.rows.map(row => `
                      <tr>
                        <td class="cell label">${row.label}</td>
                        <td class="cell">${row.good}</td>
                        <td class="cell">${row.better}</td>
                        <td class="cell">${row.best}</td>
                      </tr>
                    `).join('')}
                    <tr>
                      <td class="cell label">Investment</td>
                      <td class="cell">$${sampleData.gbb.investment.good.toLocaleString()}</td>
                      <td class="cell">$${sampleData.gbb.investment.better.toLocaleString()}</td>
                      <td class="cell">$${sampleData.gbb.investment.best.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              ` : ''}

              <div class="card small">
                <div class="kv"><span class="label">Selected Option:</span> ${sampleData.proposal.selectedOption}</div>
                <div class="kv"><span class="label">Total Investment:</span> $${sampleData.proposal.totalInvestment.toLocaleString()}</div>
                <div class="kv"><span class="label">Deposit:</span> $${sampleData.proposal.depositAmount.toLocaleString()}</div>
              </div>

              ${templateSettings.showWarrantySection ? `
                <div class="section-title">Warranty</div>
                <div class="small pre">${sampleData.warranty.standard}</div>
                <div class="small pre" style="margin-top:6px;">${sampleData.warranty.exterior}</div>
              ` : ''}

              <div class="section-title">Responsibilities</div>
              <div class="small pre"><span class="label">Client:</span> ${sampleData.responsibilities.client}</div>
              <div class="small pre" style="margin-top:6px;"><span class="label">Contractor:</span> ${sampleData.responsibilities.contractor}</div>

              <div class="section-title">Acceptance</div>
              <div class="small pre">${sampleData.acceptance.acknowledgement}</div>
              <div class="small pre" style="margin-top:10px;"><span class="label">Payment Terms</span>
${sampleData.payment.paymentTermsText}</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  useEffect(() => {
    fetchCurrentSettings();
    fetchAvailableTemplates();
  }, []);

  const fetchAvailableTemplates = async () => {
    try {
      const response = await apiService.get('/settings/templates');
      if (response.success && response.data) {
        setAvailableTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch available templates:', error);
      // Use default templates if API fails
      setAvailableTemplates(PROPOSAL_TEMPLATES);
    }
  };

  const fetchCurrentSettings = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/settings');
      if (response.success && response.data) {
        setSelectedTemplate(response.data.selectedProposalTemplate || 'classic-professional');
        setTemplateSettings({
          ...templateSettings,
          ...response.data.proposalTemplateSettings
        });
      }
    } catch (error) {
      console.error('Failed to fetch template settings:', error);
      message.error('Failed to load template settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save template preference
      const templateResponse = await apiService.post('/settings/template', {
        templateId: selectedTemplate
      });

      // Save template settings
      const settingsResponse = await apiService.put('/settings', {
        proposalTemplateSettings: templateSettings
      });

      if (templateResponse.success && settingsResponse.success) {
        message.success('Proposal template settings saved successfully');
        if (onSave) {
          onSave({
            selectedProposalTemplate: selectedTemplate,
            proposalTemplateSettings: templateSettings
          });
        }
      }
    } catch (error) {
      console.error('Failed to save template settings:', error);
      message.error('Failed to save template settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
  };

  const handleSettingChange = (key, value) => {
    setTemplateSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePreviewTemplate = async (template) => {
    setPreviewTemplate(template);
    setPreviewModalVisible(true);
    
    try {
      // Call backend API to generate preview HTML
      const response = await apiService.post('/settings/template/preview', {
        templateId: template.id,
        colorScheme: templateSettings.colorScheme
      });
      
      if (response.success && response.data) {
        // Store the generated HTML with the template
        setPreviewTemplate({ 
          ...template, 
          previewHtml: response.data.html 
        });
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
      message.error('Failed to generate template preview');
      // Keep modal open with template info even if preview fails
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spin size="large" tip="Loading template settings..." />
      </div>
    );
  }

  const selectedTemplateData = availableTemplates.find(t => t.id === selectedTemplate);

  return (
    <div className="space-y-6">
      <div>
        <Title level={3}>Proposal Templates</Title>
        <Text type="secondary">
          Choose and customize your proposal template to match your brand and presentation style.
        </Text>
      </div>

      {/* Template Selection */}
      <Card title="Select Template" className="mb-6">
        <Radio.Group
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="w-full"
        >
          <Row gutter={[16, 16]}>
            {availableTemplates.map((template) => (
              <Col xs={24} sm={12} lg={6} key={template.id}>
                <Card
                  hoverable
                  className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  style={{
                    border: selectedTemplate === template.id ? '2px solid #1890ff' : '1px solid #d9d9d9'
                  }}
                  cover={
                    <div className="template-preview h-32 bg-gray-100 flex items-center justify-center">
                      <Text type="secondary">Preview</Text>
                    </div>
                  }
                  actions={[
                    <Button
                      type="link"
                      icon={<FiEye />}
                      onClick={() => handlePreviewTemplate(template)}
                    >
                      Preview
                    </Button>
                  ]}
                >
                  <div className="text-center">
                    <Radio value={template.id} className="mb-2">
                      <Text strong>{template.name}</Text>
                    </Radio>
                    <Text type="secondary" className="text-xs block mb-2">
                      {template.description}
                    </Text>
                    <div className="template-features">
                      {template.features && template.features.map((feature, index) => (
                        <Text key={index} className="text-xs text-gray-500 block">
                          • {feature}
                        </Text>
                      ))}
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Radio.Group>
      </Card>

      {/* Template Customization */}
      <Card title="Template Customization" className="mb-6">
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">Display Options</Text>
                <Space direction="vertical" className="w-full" size="middle">
                  <div className="flex justify-between items-center py-1">
                    <Text className="text-sm sm:text-base">Show Company Logo</Text>
                    <Switch
                      checked={templateSettings.showCompanyLogo}
                      onChange={(checked) => handleSettingChange('showCompanyLogo', checked)}
                      size="default"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <Text className="text-sm sm:text-base">Show Area Breakdown</Text>
                    <Switch
                      checked={templateSettings.showAreaBreakdown}
                      onChange={(checked) => handleSettingChange('showAreaBreakdown', checked)}
                      size="default"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <Text className="text-sm sm:text-base">Show Product Details</Text>
                    <Switch
                      checked={templateSettings.showProductDetails}
                      onChange={(checked) => handleSettingChange('showProductDetails', checked)}
                      size="default"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <Text className="text-sm sm:text-base">Show Warranty Section</Text>
                    <Switch
                      checked={templateSettings.showWarrantySection}
                      onChange={(checked) => handleSettingChange('showWarrantySection', checked)}
                      size="default"
                    />
                  </div>
                </Space>
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">Color Scheme</Text>
                <Select
                  value={templateSettings.colorScheme}
                  onChange={(value) => handleSettingChange('colorScheme', value)}
                  className="w-full"
                  placeholder="Select color scheme"
                >
                  {COLOR_SCHEMES.map((scheme) => (
                    <Option key={scheme.value} value={scheme.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: scheme.color }}
                        />
                        {scheme.label}
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Current Selection Summary */}
      {selectedTemplateData && (
        <Card title="Current Selection" className="mb-6">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <div className="template-preview h-24 bg-gray-100 flex items-center justify-center mb-4">
                <Text type="secondary">Preview</Text>
              </div>
            </Col>
            <Col xs={24} md={16}>
              <Title level={4}>{selectedTemplateData.name} Template</Title>
              <Text type="secondary" className="block mb-3">
                {selectedTemplateData.description}
              </Text>
              <div className="space-y-1">
                <Text strong>Active Features:</Text>
                {Object.entries(templateSettings).map(([key, value]) => {
                  if (typeof value === 'boolean' && value) {
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                      <Text key={key} className="text-sm text-gray-600 block">
                        • {label}
                      </Text>
                    );
                  }
                  return null;
                })}
                <Text className="text-sm text-gray-600 block">
                  • Color Scheme: {COLOR_SCHEMES.find(s => s.value === templateSettings.colorScheme)?.label}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          type="primary"
          icon={<FiSave />}
          loading={saving}
          onClick={handleSaveSettings}
          size="large"
        >
          Save Template Settings
        </Button>
      </div>

      {/* Preview Modal */}
      <Modal
        title={`${previewTemplate?.name} Template Preview`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={1000}
        centered
        className="proposal-preview-modal"
      >
        {previewTemplate && (
          <div className="space-y-4">
            {previewTemplate.previewHtml ? (
              <div className="template-preview-container">
                <div 
                  className="template-preview-content"
                  style={{
                    height: '600px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    overflow: 'auto',
                    backgroundColor: '#fff'
                  }}
                >
                  <iframe
                    srcDoc={previewTemplate.previewHtml}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: '6px'
                    }}
                    title="Template Preview"
                  />
                </div>
              </div>
            ) : (
              <div className="template-preview h-96 bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <Spin size="large" tip="Generating preview..." />
                </div>
              </div>
            )}
            <Divider />
            <div>
              <Text strong>Template Features:</Text>
              <ul className="mt-2 space-y-1">
                {previewTemplate.features && previewTemplate.features.map((feature, index) => (
                  <li key={index} className="text-sm text-gray-600">
                    • {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProposalTemplatesConfig;