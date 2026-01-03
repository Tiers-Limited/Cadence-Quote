import { Modal, Radio, Card, Typography, Space, Button, Alert, message } from 'antd';
import { FiArrowUp, FiArrowDown, FiDollarSign, FiAlertCircle } from 'react-icons/fi';
import { useState } from 'react';

const { Title, Text, Paragraph } = Typography;

function TierChangeModal({ visible, onClose, currentTier, proposal, onConfirm }) {
  const [newTier, setNewTier] = useState(null);
  const [loading, setLoading] = useState(false);

  const tierOrder = { good: 1, better: 2, best: 3 };

  const getTierPricing = (tier) => {
    if (!proposal?.tiers || !tier) return null;
    return proposal.tiers[tier];
  };

  const calculateChange = () => {
    if (!currentTier || !newTier) return null;

    const currentPricing = getTierPricing(currentTier);
    const newPricing = getTierPricing(newTier);

    if (!currentPricing || !newPricing) return null;

    const totalDiff = newPricing.total - currentPricing.total;
    const depositDiff = newPricing.deposit - currentPricing.deposit;
    const isUpgrade = tierOrder[newTier] > tierOrder[currentTier];
    const isDowngrade = tierOrder[newTier] < tierOrder[currentTier];

    return {
      totalDiff,
      depositDiff,
      isUpgrade,
      isDowngrade,
      currentTotal: currentPricing.total,
      newTotal: newPricing.total,
      currentDeposit: currentPricing.deposit,
      newDeposit: newPricing.deposit
    };
  };

  const handleConfirm = async () => {
    if (!newTier) {
      message.warning('Please select a new tier');
      return;
    }

    const change = calculateChange();
    if (!change) return;

    setLoading(true);
    try {
      await onConfirm(newTier, change);
      onClose();
      setNewTier(null);
    } catch (error) {
      message.error('Failed to process tier change: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewTier(null);
    onClose();
  };

  const change = calculateChange();

  return (
    <Modal
      title="Change Your Quality Tier"
      open={visible}
      onCancel={handleCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          disabled={!newTier || newTier === currentTier}
          onClick={handleConfirm}
        >
          {change?.isUpgrade ? 'Upgrade & Pay Difference' : change?.isDowngrade ? 'Request Downgrade' : 'Confirm'}
        </Button>
      ]}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Current Tier */}
        <Alert
          message={
            <Space>
              <Text strong>Current Tier:</Text>
              <Text>{currentTier?.toUpperCase()}</Text>
            </Space>
          }
          type="info"
          showIcon
        />

        {/* Tier Selection */}
        <div>
          <Title level={5}>Select New Tier</Title>
          <Radio.Group
            value={newTier}
            onChange={(e) => setNewTier(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* GOOD Tier */}
              {proposal?.tiers?.good && (
                <Card
                  size="small"
                  className={`${newTier === 'good' ? 'border-blue-500 border-2' : ''}`}
                  style={{ opacity: currentTier === 'good' ? 0.6 : 1 }}
                >
                  <Radio value="good" disabled={currentTier === 'good'}>
                    <Space>
                      <Text strong>GOOD</Text>
                      <Text type="secondary">
                        ${proposal.tiers.good.total.toLocaleString()}
                      </Text>
                      {currentTier === 'good' && <Text type="secondary">(Current)</Text>}
                    </Space>
                  </Radio>
                </Card>
              )}

              {/* BETTER Tier */}
              {proposal?.tiers?.better && (
                <Card
                  size="small"
                  className={`${newTier === 'better' ? 'border-blue-500 border-2' : ''}`}
                  style={{ opacity: currentTier === 'better' ? 0.6 : 1 }}
                >
                  <Radio value="better" disabled={currentTier === 'better'}>
                    <Space>
                      <Text strong>BETTER</Text>
                      <Text type="secondary">
                        ${proposal.tiers.better.total.toLocaleString()}
                      </Text>
                      {currentTier === 'better' && <Text type="secondary">(Current)</Text>}
                    </Space>
                  </Radio>
                </Card>
              )}

              {/* BEST Tier */}
              {proposal?.tiers?.best && (
                <Card
                  size="small"
                  className={`${newTier === 'best' ? 'border-blue-500 border-2' : ''}`}
                  style={{ opacity: currentTier === 'best' ? 0.6 : 1 }}
                >
                  <Radio value="best" disabled={currentTier === 'best'}>
                    <Space>
                      <Text strong>BEST</Text>
                      <Text type="secondary">
                        ${proposal.tiers.best.total.toLocaleString()}
                      </Text>
                      {currentTier === 'best' && <Text type="secondary">(Current)</Text>}
                    </Space>
                  </Radio>
                </Card>
              )}
            </Space>
          </Radio.Group>
        </div>

        {/* Change Summary */}
        {change && newTier && newTier !== currentTier && (
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="flex items-center justify-between">
                <Text strong>Change Type:</Text>
                <Space>
                  {change.isUpgrade ? (
                    <>
                      <FiArrowUp style={{ color: '#52c41a' }} />
                      <Text style={{ color: '#52c41a' }}>UPGRADE</Text>
                    </>
                  ) : (
                    <>
                      <FiArrowDown style={{ color: '#faad14' }} />
                      <Text style={{ color: '#faad14' }}>DOWNGRADE</Text>
                    </>
                  )}
                </Space>
              </div>

              <div className="flex items-center justify-between">
                <Text strong>Current Total:</Text>
                <Text>${change.currentTotal.toLocaleString()}</Text>
              </div>

              <div className="flex items-center justify-between">
                <Text strong>New Total:</Text>
                <Text>${change.newTotal.toLocaleString()}</Text>
              </div>

              <div className="flex items-center justify-between">
                <Text strong>Difference:</Text>
                <Text strong style={{ color: change.totalDiff > 0 ? '#52c41a' : '#f5222d' }}>
                  {change.totalDiff > 0 ? '+' : ''}${Math.abs(change.totalDiff).toLocaleString()}
                </Text>
              </div>

              {change.isUpgrade && (
                <Alert
                  message="Upgrade Payment Required"
                  description={
                    <Space direction="vertical">
                      <Text>
                        You will need to pay the additional deposit amount of{' '}
                        <Text strong>${Math.abs(change.depositDiff).toLocaleString()}</Text>
                      </Text>
                      <Text type="secondary">
                        Total additional payment: ${Math.abs(change.totalDiff).toLocaleString()}
                      </Text>
                    </Space>
                  }
                  type="warning"
                  showIcon
                  icon={<FiDollarSign />}
                />
              )}

              {change.isDowngrade && (
                <Alert
                  message="Contractor Approval Required"
                  description="Downgrade requests must be approved by your contractor. You will be contacted to discuss this change and any applicable refund."
                  type="info"
                  showIcon
                  icon={<FiAlertCircle />}
                />
              )}
            </Space>
          </Card>
        )}
      </Space>
    </Modal>
  );
}

export default TierChangeModal;
