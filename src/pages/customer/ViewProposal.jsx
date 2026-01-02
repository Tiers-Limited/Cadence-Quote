import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Radio, Typography, Space, message, Spin, Alert, Tag, Modal } from 'antd';
import { FiCheckCircle, FiDollarSign } from 'react-icons/fi';
import { apiService } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;

function ViewProposal() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/customer/proposals/${proposalId}`);
      if (response.success) {
        setProposal(response.data);
        setSelectedTier(response.data.selectedTier || null);
      }
    } catch (error) {
      message.error('Failed to load proposal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = (e) => {
    if (proposal.depositVerified) {
      message.warning('Tier is locked after deposit payment. Contact contractor for changes.');
      return;
    }
    setSelectedTier(e.target.value);
  };

  const handleAccept = () => {
    if (!selectedTier) {
      message.warning('Please select a tier (Good, Better, or Best)');
      return;
    }
    setAcceptModalVisible(true);
  };

  const handleConfirmAccept = async () => {
    try {
      setSubmitting(true);
      const response = await apiService.post(`/customer/proposals/${proposalId}/accept`, {
        selectedTier
      });
      
      if (response.success) {
        message.success('Proposal accepted successfully');
        setAcceptModalVisible(false);
        fetchProposal();
      }
    } catch (error) {
      message.error('Failed to accept proposal: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    Modal.confirm({
      title: 'Decline Proposal',
      content: 'Are you sure you want to decline this proposal?',
      okText: 'Yes, Decline',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await apiService.post(`/customer/proposals/${proposalId}/decline`);
          if (response.success) {
            message.success('Proposal declined');
            navigate('/portal/dashboard');
          }
        } catch (error) {
          message.error('Failed to decline proposal: ' + error.message);
        }
      }
    });
  };

  const handlePayDeposit = async () => {
    if (!selectedTier && !proposal.selectedTier) {
      message.warning('Please select a tier first');
      return;
    }

    // Navigate to payment page
    navigate(`/portal/payment/${proposalId}`);
  };

  const getTierPricing = (tier) => {
    if (!proposal || !proposal.tiers) return null;
    return proposal.tiers[tier];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading proposal..." />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert message="Proposal not found" type="error" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <Title level={2}>{proposal.projectName || 'Painting Project Proposal'}</Title>
              <Text type="secondary">
                Proposal #{proposal.id} • Created {new Date(proposal.createdAt).toLocaleDateString()}
              </Text>
            </div>
            <Tag color={proposal.status === 'accepted' ? 'green' : 'orange'}>
              {proposal.status?.toUpperCase()}
            </Tag>
          </div>
        </Card>

        {/* Status Alert */}
        {proposal.status === 'accepted' && !proposal.depositVerified && (
          <Alert
            message="Proposal Accepted"
            description="Please pay the deposit to unlock the customer portal and begin making your selections."
            type="success"
            showIcon
          />
        )}

        {proposal.depositVerified && (
          <Alert
            message="Deposit Received"
            description="Thank you! Your portal is now active. Complete the finish standards acknowledgement to begin making your selections."
            type="info"
            showIcon
            action={
              <Button type="primary" onClick={() => navigate(`/portal/finish-standards/${proposalId}`)}>
                Continue
              </Button>
            }
          />
        )}

        {/* Company Introduction */}
        {proposal.companyIntroduction && (
          <Card title="Welcome">
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {proposal.companyIntroduction}
            </Paragraph>
          </Card>
        )}

        {/* Tier Selection */}
        <Card title="Select Your Quality Tier">
          <Radio.Group 
            value={selectedTier} 
            onChange={handleTierChange}
            disabled={proposal.depositVerified}
            className="w-full"
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* GOOD Tier */}
              {proposal.tiers?.good && (
                <Card className={`${selectedTier === 'good' ? 'border-blue-500 border-2' : ''}`}>
                  <Radio value="good" className="w-full">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Title level={4}>GOOD – Clean and Functional</Title>
                        <Paragraph>
                          Basic preparation focused on repainting the space cleanly. Spot patching only.
                        </Paragraph>
                      </div>
                      <div className="text-right ml-4">
                        <Text strong style={{ fontSize: '20px', color: '#52c41a' }}>
                          ${proposal.tiers.good.total.toLocaleString()}
                        </Text>
                        <br />
                        <Text type="secondary">
                          Deposit: ${proposal.tiers.good.deposit.toLocaleString()}
                        </Text>
                      </div>
                    </div>
                  </Radio>
                </Card>
              )}

              {/* BETTER Tier */}
              {proposal.tiers?.better && (
                <Card className={`${selectedTier === 'better' ? 'border-blue-500 border-2' : ''}`}>
                  <Radio value="better" className="w-full">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Title level={4}>BETTER – Smooth and Consistent</Title>
                        <Paragraph>
                          Expanded surface preparation including feather sanding. Recommended for most homes.
                        </Paragraph>
                      </div>
                      <div className="text-right ml-4">
                        <Text strong style={{ fontSize: '20px', color: '#52c41a' }}>
                          ${proposal.tiers.better.total.toLocaleString()}
                        </Text>
                        <br />
                        <Text type="secondary">
                          Deposit: ${proposal.tiers.better.deposit.toLocaleString()}
                        </Text>
                      </div>
                    </div>
                  </Radio>
                </Card>
              )}

              {/* BEST Tier */}
              {proposal.tiers?.best && (
                <Card className={`${selectedTier === 'best' ? 'border-blue-500 border-2' : ''}`}>
                  <Radio value="best" className="w-full">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Title level={4}>BEST – High End Finish</Title>
                        <Paragraph>
                          Advanced surface correction including skim coating. Best for luxury spaces.
                        </Paragraph>
                      </div>
                      <div className="text-right ml-4">
                        <Text strong style={{ fontSize: '20px', color: '#52c41a' }}>
                          ${proposal.tiers.best.total.toLocaleString()}
                        </Text>
                        <br />
                        <Text type="secondary">
                          Deposit: ${proposal.tiers.best.deposit.toLocaleString()}
                        </Text>
                      </div>
                    </div>
                  </Radio>
                </Card>
              )}
            </Space>
          </Radio.Group>
        </Card>

        {/* Project Scope */}
        {proposal.scope && (
          <Card title="Project Scope">
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {proposal.scope}
            </Paragraph>
          </Card>
        )}

        {/* Terms & Conditions */}
        {proposal.terms && (
          <Card title="Terms & Conditions">
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {proposal.terms}
            </Paragraph>
          </Card>
        )}

        {/* Actions */}
        {proposal.status === 'pending' && (
          <Card>
            <Space size="middle" className="w-full justify-end">
              <Button size="large" onClick={handleDecline}>
                Decline
              </Button>
              <Button 
                type="primary" 
                size="large" 
                icon={<FiCheckCircle />}
                onClick={handleAccept}
                disabled={!selectedTier}
              >
                Accept Proposal
              </Button>
            </Space>
          </Card>
        )}

        {proposal.status === 'accepted' && !proposal.depositVerified && (
          <Card>
            <Alert
              message={`Deposit Required: $${getTierPricing(selectedTier)?.deposit.toLocaleString() || '0'}`}
              description="Pay your deposit to unlock the customer portal and begin making your product selections."
              type="warning"
              showIcon
              action={
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<FiDollarSign />}
                  onClick={handlePayDeposit}
                >
                  Pay Deposit
                </Button>
              }
            />
          </Card>
        )}
      </Space>

      {/* Accept Confirmation Modal */}
      <Modal
        title="Accept Proposal"
        open={acceptModalVisible}
        onOk={handleConfirmAccept}
        onCancel={() => setAcceptModalVisible(false)}
        confirmLoading={submitting}
        okText="Accept Proposal"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Paragraph>
            By accepting this proposal, you agree to the scope of work, pricing, and terms & conditions outlined above.
          </Paragraph>
          <Paragraph>
            <Text strong>Selected Tier:</Text> {selectedTier?.toUpperCase()}
          </Paragraph>
          <Paragraph>
            <Text strong>Total Amount:</Text> ${getTierPricing(selectedTier)?.total.toLocaleString()}
          </Paragraph>
          <Paragraph>
            <Text strong>Required Deposit:</Text> ${getTierPricing(selectedTier)?.deposit.toLocaleString()}
          </Paragraph>
        </Space>
      </Modal>
    </div>
  );
}

export default ViewProposal;
