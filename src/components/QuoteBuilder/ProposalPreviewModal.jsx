// src/components/QuoteBuilder/ProposalPreviewModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Spin, Typography, Divider, Row, Col, Card, Image, Alert } from 'antd';
import { apiService } from '../../services/apiService';

const { Title, Paragraph, Text } = Typography;

const ProposalPreviewModal = ({ visible, onClose, quoteData, calculatedQuote }) => {
  const [proposalDefaults, setProposalDefaults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchProposalDefaults();
    }
  }, [visible]);

  const fetchProposalDefaults = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/proposal-defaults');
      setProposalDefaults(response.data);
    } catch (error) {
      console.error('Error fetching proposal defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!proposalDefaults || loading) {
    return (
      <Modal
        title="Proposal Preview"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Loading proposal template..." />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Proposal Preview"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      bodyStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      <div style={{ padding: '20px' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {proposalDefaults.companyLogo && (
            <Image 
              src={proposalDefaults.companyLogo} 
              alt="Company Logo" 
              style={{ maxWidth: 200, marginBottom: 16 }}
              preview={false}
            />
          )}
          <Title level={2} style={{ marginBottom: 8 }}>
            {proposalDefaults.proposalTitle || 'Professional Painting Proposal'}
          </Title>
          <Text type="secondary">{proposalDefaults.tagline}</Text>
        </div>

        {/* Opening Message */}
        {proposalDefaults.openingMessage && (
          <Card style={{ marginBottom: 24 }}>
            <Paragraph>{proposalDefaults.openingMessage}</Paragraph>
          </Card>
        )}

        {/* Customer Information */}
        <Card title="Project Information" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Text strong>Customer:</Text> {quoteData.customerName}
            </Col>
            <Col span={12}>
              <Text strong>Email:</Text> {quoteData.customerEmail}
            </Col>
            <Col span={12}>
              <Text strong>Phone:</Text> {quoteData.customerPhone}
            </Col>
            <Col span={12}>
              <Text strong>Job Type:</Text> {quoteData.jobType === 'interior' ? 'Interior' : 'Exterior'}
            </Col>
            <Col span={24}>
              <Text strong>Address:</Text> {quoteData.street}, {quoteData.city}, {quoteData.state} {quoteData.zipCode}
            </Col>
          </Row>
        </Card>

        {/* Cost Summary */}
        {calculatedQuote && (
          <Card title="Investment Summary" style={{ marginBottom: 24 }}>
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Text>Labor:</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text>${calculatedQuote.laborTotal?.toFixed(2)}</Text>
              </Col>
              <Col span={12}>
                <Text>Materials:</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text>${calculatedQuote.materialTotal?.toFixed(2)}</Text>
              </Col>
              {calculatedQuote.prepTotal > 0 && (
                <>
                  <Col span={12}>
                    <Text>Prep Work:</Text>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <Text>${calculatedQuote.prepTotal?.toFixed(2)}</Text>
                  </Col>
                </>
              )}
              {calculatedQuote.addOnsTotal > 0 && (
                <>
                  <Col span={12}>
                    <Text>Additional Services:</Text>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <Text>${calculatedQuote.addOnsTotal?.toFixed(2)}</Text>
                  </Col>
                </>
              )}
              <Col span={12}>
                <Text>Overhead & Expenses:</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text>${calculatedQuote.overhead?.toFixed(2)}</Text>
              </Col>
              <Col span={24}>
                <Divider style={{ margin: '8px 0' }} />
              </Col>
              <Col span={12}>
                <Text strong>Total Investment:</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Title level={4} style={{ margin: 0, color: '#3f8600' }}>
                  ${calculatedQuote.total?.toFixed(2)}
                </Title>
              </Col>
            </Row>
          </Card>
        )}

        {/* Process Overview */}
        {proposalDefaults.processOverview && (
          <Card title="Our Process" style={{ marginBottom: 24 }}>
            <Paragraph style={{ whiteSpace: 'pre-line' }}>
              {proposalDefaults.processOverview}
            </Paragraph>
          </Card>
        )}

        {/* Warranty Information */}
        {proposalDefaults.warrantyDetails && (
          <Card title="Warranty & Guarantee" style={{ marginBottom: 24 }}>
            <Paragraph style={{ whiteSpace: 'pre-line' }}>
              {proposalDefaults.warrantyDetails}
            </Paragraph>
          </Card>
        )}

        {/* Payment Terms */}
        {proposalDefaults.paymentTerms && (
          <Card title="Payment Terms" style={{ marginBottom: 24 }}>
            <Paragraph style={{ whiteSpace: 'pre-line' }}>
              {proposalDefaults.paymentTerms}
            </Paragraph>
          </Card>
        )}

        {/* Responsibilities */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {proposalDefaults.contractorResponsibilities && (
            <Col span={12}>
              <Card title="Our Responsibilities" size="small">
                <Paragraph style={{ whiteSpace: 'pre-line' }}>
                  {proposalDefaults.contractorResponsibilities}
                </Paragraph>
              </Card>
            </Col>
          )}
          {proposalDefaults.clientResponsibilities && (
            <Col span={12}>
              <Card title="Your Responsibilities" size="small">
                <Paragraph style={{ whiteSpace: 'pre-line' }}>
                  {proposalDefaults.clientResponsibilities}
                </Paragraph>
              </Card>
            </Col>
          )}
        </Row>

        {/* Policies */}
        {(proposalDefaults.cancellationPolicy || proposalDefaults.changeOrderPolicy) && (
          <Card title="Policies" style={{ marginBottom: 24 }}>
            {proposalDefaults.cancellationPolicy && (
              <>
                <Title level={5}>Cancellation Policy</Title>
                <Paragraph style={{ whiteSpace: 'pre-line' }}>
                  {proposalDefaults.cancellationPolicy}
                </Paragraph>
              </>
            )}
            {proposalDefaults.changeOrderPolicy && (
              <>
                <Title level={5}>Change Order Policy</Title>
                <Paragraph style={{ whiteSpace: 'pre-line' }}>
                  {proposalDefaults.changeOrderPolicy}
                </Paragraph>
              </>
            )}
          </Card>
        )}

        {/* Portfolio Section */}
        {proposalDefaults.pastProjects && proposalDefaults.pastProjects.length > 0 && (
          <Card title="Our Work" style={{ marginBottom: 24 }}>
            <Row gutter={[16, 16]}>
              {proposalDefaults.pastProjects.slice(0, 6).map((project, index) => (
                <Col span={8} key={index}>
                  <Card size="small" hoverable>
                    {project.image && (
                      <Image 
                        src={project.image} 
                        alt={project.title}
                        style={{ width: '100%', height: 150, objectFit: 'cover' }}
                      />
                    )}
                    <Title level={5} style={{ marginTop: 8 }}>{project.title}</Title>
                    <Text type="secondary">{project.description}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* Testimonials */}
        {proposalDefaults.testimonials && proposalDefaults.testimonials.length > 0 && (
          <Card title="What Our Clients Say" style={{ marginBottom: 24 }}>
            {proposalDefaults.testimonials.slice(0, 3).map((testimonial, index) => (
              <div key={index} style={{ marginBottom: 16 }}>
                <Paragraph italic>"{testimonial.quote}"</Paragraph>
                <Text strong>- {testimonial.author}</Text>
                {testimonial.project && <Text type="secondary"> ({testimonial.project})</Text>}
                {index < proposalDefaults.testimonials.length - 1 && <Divider />}
              </div>
            ))}
          </Card>
        )}

        {/* Acceptance Section */}
        {proposalDefaults.acceptanceInstructions && (
          <Alert
            message="Next Steps"
            description={proposalDefaults.acceptanceInstructions}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Disclaimers */}
        {proposalDefaults.disclaimers && (
          <Card size="small" style={{ backgroundColor: '#f5f5f5' }}>
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-line' }}>
              {proposalDefaults.disclaimers}
            </Text>
          </Card>
        )}

        {/* Footer */}
        {proposalDefaults.closingMessage && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Paragraph>{proposalDefaults.closingMessage}</Paragraph>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ProposalPreviewModal;
