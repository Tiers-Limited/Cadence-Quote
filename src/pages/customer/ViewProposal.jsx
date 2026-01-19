import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Radio, Typography, Space, message, Spin, Alert, Tag, Modal } from 'antd';
import { FiCheckCircle, FiDollarSign, FiEdit } from 'react-icons/fi';
import { magicLinkApiService } from '../../services/magicLinkApiService';
import PortalStatusIndicator from '../../components/PortalStatusIndicator';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';
import TierChangeModal from '../../components/TierChangeModal';

const { Title, Text, Paragraph } = Typography;

function ViewProposal() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [tierChangeModalVisible, setTierChangeModalVisible] = useState(false);
  const [productsMap, setProductsMap] = useState({});

  useEffect(() => {
    fetchProposal();
    fetchProducts();
  }, [proposalId]);

  const fetchProducts = async () => {
    try {
      const response = await magicLinkApiService.get('/api/customer-portal/product-configs');
      if (response.success) {
        const productMap = {};
        (response.data || []).forEach(config => {
          // Map by config ID
          productMap[config.id] = {
            brandName: config.globalProduct?.brand?.name || 'Unknown',
            productName: config.globalProduct?.name || 'Unknown',
            fullName: `${config.globalProduct?.brand?.name || ''} ${config.globalProduct?.name || ''}`.trim()
          };
          // Also map by globalProductId
          if (config.globalProductId) {
            productMap[config.globalProductId] = {
              brandName: config.globalProduct?.brand?.name || 'Unknown',
              productName: config.globalProduct?.name || 'Unknown',
              fullName: `${config.globalProduct?.brand?.name || ''} ${config.globalProduct?.name || ''}`.trim()
            };
          }
        });
        setProductsMap(productMap);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await magicLinkApiService.get(`/api/customer-portal/proposals/${proposalId}`);
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

  // If deposit is paid but finish-standards not acknowledged, redirect customer
  useEffect(() => {
    if (!loading && proposal && proposal.depositVerified && !proposal.finishStandardsAcknowledged) {
      navigate(`/portal/finish-standards/${proposalId}`);
    }
  }, [loading, proposal, navigate, proposalId]);

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
      const response = await magicLinkApiService.post(`/api/customer-portal/proposals/${proposalId}/accept`, {
        selectedTier
      });
      
      if (response.success) {
        message.success('Proposal accepted! Redirecting to deposit payment...');
        setAcceptModalVisible(false);
        
        // Redirect to deposit payment page after 1.5 seconds
        setTimeout(() => {
          navigate(`/portal/payment/${proposalId}`);
        }, 1500);
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
          const response = await magicLinkApiService.post(`/api/customer-portal/proposals/${proposalId}/decline`);
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

  const handleTierChangeConfirm = async (newTier, change) => {
    try {
      if (change.isUpgrade) {
        // For upgrades, redirect to payment page with additional amount
        const response = await magicLinkApiService.post(`/api/customer-portal/proposals/${proposalId}/upgrade-tier`, {
          newTier,
          additionalAmount: change.depositDiff
        });

        if (response.success) {
          message.success('Redirecting to payment for tier upgrade...');
          // Redirect to payment page with upgrade information
          navigate(`/portal/payment/${proposalId}?upgrade=true&newTier=${newTier}`);
        }
      } else if (change.isDowngrade) {
        // For downgrades, send request to contractor
        const response = await magicLinkApiService.post(`/api/customer-portal/proposals/${proposalId}/request-tier-change`, {
          newTier,
          reason: 'Customer requested downgrade'
        });

        if (response.success) {
          message.success('Downgrade request sent to contractor for approval');
          fetchProposal(); // Refresh proposal data
        }
      }
    } catch (error) {
      throw error;
    }
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
                Proposal #{proposal.id} • Created {new Date(proposal.createdAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
              </Text>
            </div>
            <Tag color={proposal.status === 'accepted' ? 'green' : 'orange'}>
              {proposal.status?.toUpperCase()}
            </Tag>
          </div>
        </Card>

        {/* Portal Status Indicator */}
        <PortalStatusIndicator proposal={proposal} />

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
          {proposal.depositVerified && (
            <Alert
              message="Tier Selection Locked"
              description="Your tier selection is locked after deposit verification. Contact your contractor if you need to change tiers."
              type="info"
              showIcon
              icon={<FiCheckCircle />}
              style={{ marginBottom: 16 }}
            />
          )}
          
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
                        <Space>
                          <Title level={4}>GOOD – Clean and Functional</Title>
                          {proposal.depositVerified && selectedTier === 'good' && (
                            <Tag color="green" icon={<FiCheckCircle />}>Current</Tag>
                          )}
                        </Space>
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
                        <Space>
                          <Title level={4}>BETTER – Smooth and Consistent</Title>
                          {proposal.depositVerified && selectedTier === 'better' && (
                            <Tag color="green" icon={<FiCheckCircle />}>Current</Tag>
                          )}
                        </Space>
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
                        <Space>
                          <Title level={4}>BEST – High End Finish</Title>
                          {proposal.depositVerified && selectedTier === 'best' && (
                            <Tag color="green" icon={<FiCheckCircle />}>Current</Tag>
                          )}
                        </Space>
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
          
          {/* Change Tier Button */}
          {proposal.depositVerified && proposal.selectedTier && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button
                icon={<FiEdit />}
                onClick={() => setTierChangeModalVisible(true)}
              >
                Request Tier Change
              </Button>
            </div>
          )}
        </Card>

        {/* Project Scope */}
        {proposal.scope && (
          <Card title="Project Scope">
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {proposal.scope}
            </Paragraph>
          </Card>
        )}

        {/* Detailed Project Breakdown */}
        {proposal.areas && proposal.areas.length > 0 && (
          <Card title="Detailed Project Breakdown">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {proposal.areas.map((area, areaIdx) => {
                const items = area.laborItems || area.items || [];
                const selectedItems = items.filter(item => item.selected);
                
                if (selectedItems.length === 0) return null;
                
                return (
                  <div key={areaIdx} style={{ borderLeft: '3px solid #1890ff', paddingLeft: 16 }}>
                    <Title level={5} style={{ marginBottom: 12 }}>{area.name || `Area ${areaIdx + 1}`}</Title>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {selectedItems.map((item, itemIdx) => {
                        // Properly format unit display
                        let unit = 'items';
                        if (item.measurementUnit === 'sqft') {
                          unit = 'sq ft';
                        } else if (item.measurementUnit === 'linear_foot') {
                          unit = 'linear feet';
                        } else if (item.measurementUnit === 'unit') {
                          unit = 'units';
                        } else if (item.measurementUnit === 'hour') {
                          unit = 'hours';
                        } else if (item.unit) {
                          // Fallback to item.unit if measurementUnit is not set
                          unit = item.unit === 'sqft' ? 'sq ft' : 
                                item.unit === 'linear_foot' ? 'linear feet' : 
                                item.unit === 'unit' ? 'units' : 
                                item.unit;
                        }
                        
                        const coats = item.numberOfCoats > 0 ? ` • ${item.numberOfCoats} coat${item.numberOfCoats > 1 ? 's' : ''}` : '';
                        const gallons = item.gallons > 0 ? ` • ${Math.ceil(item.gallons)} gallon${Math.ceil(item.gallons) > 1 ? 's' : ''}` : '';
                        
                        return (
                          <div key={itemIdx} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Text strong>{item.categoryName}</Text>
                            <br />
                            <Text type="secondary">
                              {item.quantity} {unit}{coats}{gallons}
                            </Text>
                          </div>
                        );
                      })}
                    </Space>
                  </div>
                );
              })}
            </Space>
          </Card>
        )}

        {/* Product Information by Tier */}
        {proposal.productSets && proposal.productSets.length > 0 && (
          <Card title="Paint Products by Quality Tier">
            <Alert
              message="Product Selection"
              description="The products listed below correspond to each quality tier. Your selected tier determines which products will be used for your project."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* GOOD Tier Products */}
              <div>
                <Title level={5} style={{ color: '#52c41a', marginBottom: 12 }}>GOOD Tier Products</Title>
                {proposal.productSets.map((set, idx) => {
                  const goodProduct = set.products?.good || set.goodProduct || 
                                     (Array.isArray(set.products) ? set.products.find(p => p.tier === 'Good') : null);
                  
                  let productName = 'Product not selected';
                  if (goodProduct) {
                    const productId = goodProduct.productId || goodProduct.globalProductId || goodProduct.id;
                    if (productId && productsMap[productId]) {
                      productName = productsMap[productId].fullName;
                    } else if (goodProduct.name) {
                      productName = goodProduct.name;
                    } else if (goodProduct.productName) {
                      productName = goodProduct.productName;
                    }
                  }
                  
                  return (
                    <div key={`good-${idx}`} style={{ padding: '8px 12px', background: '#f6ffed', borderRadius: 4, marginBottom: 8 }}>
                      <Text strong>{set.surfaceType}: </Text>
                      <Text>{productName}</Text>
                    </div>
                  );
                })}
              </div>

              {/* BETTER Tier Products */}
              <div>
                <Title level={5} style={{ color: '#1890ff', marginBottom: 12 }}>BETTER Tier Products</Title>
                {proposal.productSets.map((set, idx) => {
                  const betterProduct = set.products?.better || set.betterProduct || 
                                       (Array.isArray(set.products) ? set.products.find(p => p.tier === 'Better') : null);
                  
                  let productName = 'Product not selected';
                  if (betterProduct) {
                    const productId = betterProduct.productId || betterProduct.globalProductId || betterProduct.id;
                    if (productId && productsMap[productId]) {
                      productName = productsMap[productId].fullName;
                    } else if (betterProduct.name) {
                      productName = betterProduct.name;
                    } else if (betterProduct.productName) {
                      productName = betterProduct.productName;
                    }
                  }
                  
                  return (
                    <div key={`better-${idx}`} style={{ padding: '8px 12px', background: '#e6f7ff', borderRadius: 4, marginBottom: 8 }}>
                      <Text strong>{set.surfaceType}: </Text>
                      <Text>{productName}</Text>
                    </div>
                  );
                })}
              </div>

              {/* BEST Tier Products */}
              <div>
                <Title level={5} style={{ color: '#faad14', marginBottom: 12 }}>BEST Tier Products</Title>
                {proposal.productSets.map((set, idx) => {
                  const bestProduct = set.products?.best || set.bestProduct || 
                                     (Array.isArray(set.products) ? set.products.find(p => p.tier === 'Best') : null);
                  
                  let productName = 'Product not selected';
                  if (bestProduct) {
                    const productId = bestProduct.productId || bestProduct.globalProductId || bestProduct.id;
                    if (productId && productsMap[productId]) {
                      productName = productsMap[productId].fullName;
                    } else if (bestProduct.name) {
                      productName = bestProduct.name;
                    } else if (bestProduct.productName) {
                      productName = bestProduct.productName;
                    }
                  }
                  
                  return (
                    <div key={`best-${idx}`} style={{ padding: '8px 12px', background: '#fffbe6', borderRadius: 4, marginBottom: 8 }}>
                      <Text strong>{set.surfaceType}: </Text>
                      <Text>{productName}</Text>
                    </div>
                  );
                })}
              </div>
            </Space>
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
        {(proposal.status === 'sent' || proposal.status === 'pending') && (
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

      {/* Tier Change Modal */}
      <TierChangeModal
        visible={tierChangeModalVisible}
        onClose={() => setTierChangeModalVisible(false)}
        currentTier={proposal?.selectedTier}
        proposal={proposal}
        onConfirm={handleTierChangeConfirm}
      />
    </div>
  );
}

export default ViewProposal;
