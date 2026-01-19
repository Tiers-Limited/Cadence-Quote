// src/pages/customer/ProposalAcceptance.jsx
// Customer proposal acceptance with deposit payment

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Radio, Spin, Result, Alert, Divider, Descriptions, Modal } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { customerPortalAPI } from '../../services/customerPortalAPI';
import { apiService } from '../../services/apiService';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Payment Form Component
const PaymentForm = ({ clientSecret, amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (result.error) {
        onError(result.error.message);
      } else if (result.paymentIntent.status === 'succeeded') {
        onSuccess(result.paymentIntent.id);
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
     <div className="bg-white border mb-8 border-gray-300 rounded-lg p-4 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200">
  <CardElement 
    options={{
      style: {
        base: {
          fontSize: '16px',
          color: '#1f2937',
          '::placeholder': {
            color: '#9ca3af',
          },
          padding: '10px 0',          // vertical spacing inside Stripe fields
        },
        invalid: {
          color: '#ef4444',
        },
      },
      hidePostalCode: false,
    }}
  />
</div>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={processing}
        disabled={!stripe || processing}
        icon={<DollarOutlined />}
      >
        Pay Deposit ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Button>
    </form>
  );
};

const ProposalAcceptance = () => {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentStep, setPaymentStep] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await customerPortalAPI.getProposal(proposalId);
      const payload = response.data?.data || response.data || response;
      setProposal(payload);

      // Track quote view (fire-and-forget)
      try {
        await apiService.post(`/customer/quotes/${proposalId}/view`);
      } catch (viewError) {
        // Silently fail - tracking is not critical
        console.debug('Quote view tracking failed:', viewError);
      }

      // Populate deposit/selection state from payload
      if (payload) {
        if (payload.depositAmount) setDepositAmount(payload.depositAmount);
        if (payload.selectedTier) setSelectedTier(payload.selectedTier);
        // If product strategy GBB and no selected tier, default
        if (payload.productStrategy === 'GBB' && !payload.selectedTier) {
          setSelectedTier('good');
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching proposal:', err);
      setError(err.response?.data?.message || 'Failed to load proposal');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (proposal.productStrategy === 'GBB' && !selectedTier) {
      Modal.error({
        title: 'Selection Required',
        content: 'Please select a pricing tier (Good, Better, or Best) before accepting.',
      });
      return;
    }

    try {
      setAccepting(true);
      const response = await customerPortalAPI.acceptProposal(proposalId, { selectedTier });
      
      // Check if payment is already completed
      if (response.paymentCompleted) {
        Modal.success({
          title: 'Payment Already Completed',
          content: 'Your deposit has already been paid. Redirecting to product selections...',
          onOk: () => navigate(`/portal/proposals/${proposalId}/selections`),
        });
        setTimeout(() => {
          navigate(`/portal/proposals/${proposalId}/selections`);
        }, 2000);
        return;
      }
      
      // Store payment intent details
      setClientSecret(response.payment.clientSecret);
      setDepositAmount(response.payment.amount);
      
      // Move to payment step
      setPaymentStep(true);
      setAccepting(false);
    } catch (err) {
      console.error('Error accepting proposal:', err);
      Modal.error({
        title: 'Error',
        content: err.response?.data?.message || 'Failed to accept proposal',
      });
      setAccepting(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      await customerPortalAPI.confirmDepositPayment(proposalId, { paymentIntentId });
      
      setSuccess(true);
      
      // Redirect to selections after 3 seconds
      setTimeout(() => {
        navigate(`/portal/proposals/${proposalId}/selections`);
      }, 3000);
    } catch (err) {
      console.error('Error confirming payment:', err);
      Modal.error({
        title: 'Payment Confirmation Error',
        content: 'Payment was successful but failed to update. Please contact support.',
      });
    }
  };

  const handlePaymentError = (errorMessage) => {
    Modal.error({
      title: 'Payment Failed',
      content: errorMessage,
    });
  };

  const handleReject = async () => {
    if (!rejectReason) {
      Modal.error({
        title: 'Reason Required',
        content: 'Please provide a reason for rejecting this proposal.',
      });
      return;
    }

    try {
      setRejecting(true);
      await customerPortalAPI.rejectProposal(proposalId, {
        reason: rejectReason,
        comments: '',
      });
      
      Modal.success({
        title: 'Proposal Rejected',
        content: 'Thank you for your response. We have notified the contractor.',
        onOk: () => navigate('/customer/dashboard'),
      });
    } catch (err) {
      console.error('Error rejecting proposal:', err);
      Modal.error({
        title: 'Error',
        content: err.response?.data?.message || 'Failed to reject proposal',
      });
    } finally {
      setRejecting(false);
      setShowRejectModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="Error Loading Proposal"
        subTitle={error}
      />
    );
  }

  if (success) {
    return (
      <Result
        status="success"
        title="Deposit Payment Successful!"
        subTitle="Redirecting to product selection..."
        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
      />
    );
  }

  if (paymentStep) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card title="Complete Deposit Payment">
          <Alert
            message="Almost Done!"
            description={`Please complete your deposit payment of $${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to proceed with product selections.`}
            type="info"
            showIcon
            className="mb-6"
          />
          
          <Elements stripe={stripePromise}>
            <PaymentForm
              clientSecret={clientSecret}
              amount={depositAmount}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>
          
          <div className="mt-4 text-center text-gray-500 text-sm">
            <p>🔒 Your payment information is secure and encrypted</p>
          </div>
        </Card>
      </div>
    );
  }

  const getTierPrice = (tier) => {
    if (!proposal) return 0;
    if (proposal.tiers && proposal.tiers[tier]) {
      return proposal.tiers[tier].total;
    }
    if (proposal.pricingTiers && proposal.pricingTiers[tier]) {
      return proposal.pricingTiers[tier].total;
    }
    return proposal.total;
  };

  const getTierDeposit = (tier) => {
    if (!proposal) return 0;
    if (proposal.tiers && proposal.tiers[tier]) {
      return proposal.tiers[tier].deposit;
    }
    if (proposal.pricingTiers && proposal.pricingTiers[tier]) {
      return proposal.pricingTiers[tier].deposit;
    }
    return proposal.depositAmount || 0;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card title={`Proposal #${proposal.quoteNumber}`}>
        <Alert
          message="Review Your Proposal"
          description="Please review the proposal details below and select a pricing tier if applicable."
          type="info"
          showIcon
          className="mb-6"
        />

        <Descriptions bordered column={1}>
          <Descriptions.Item label="Customer Name">{proposal.customerName}</Descriptions.Item>
          <Descriptions.Item label="Project Address">
            {[proposal.street, proposal.city, proposal.state, proposal.zipCode].filter(Boolean).join(', ')}
          </Descriptions.Item>
          <Descriptions.Item label="Status">{proposal.status}</Descriptions.Item>
          <Descriptions.Item label="Valid Until">
            {proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'No expiration'}
          </Descriptions.Item>
        </Descriptions>

        {proposal.productStrategy === 'GBB' && (
          <div className="mt-6">
            <Divider>Select Your Pricing Tier</Divider>
            <Radio.Group
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['good', 'better', 'best'].map((tier) => (
                  <Card
                    key={tier}
                    className={`cursor-pointer transition-all ${
                      selectedTier === tier ? 'border-blue-500 shadow-lg' : ''
                    }`}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <Radio value={tier} className="mb-3">
                      <span className="text-lg font-semibold capitalize">{tier}</span>
                    </Radio>
                    <div className="text-lg text-gray-700 mb-1">
                      Total: <span className="text-2xl font-bold text-blue-600">${getTierPrice(tier)?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || 'N/A'}</span>
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      Deposit: <strong>${getTierDeposit(tier)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="text-sm text-gray-600">
                      {proposal.tiers?.[tier]?.description ||
                        (tier === 'good' && 'Quality products at a great value') ||
                        (tier === 'better' && 'Premium products for enhanced durability') ||
                        (tier === 'best' && 'Top-tier products for maximum longevity')}
                    </div>
                  </Card>
                ))}
              </div>
            </Radio.Group>
          </div>
        )}

        {proposal.productStrategy !== 'GBB' && (
          <div className="mt-6">
            <Divider>Total Investment</Divider>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">
                ${proposal.total?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-gray-600 mt-2">Total Project Cost</p>
            </div>
          </div>
        )}

        <Divider />

        {proposal.status === 'accepted' && !proposal.depositVerified && (
          <Alert
            message="Payment Pending"
            description="You've accepted this proposal but haven't completed the deposit payment yet. Click below to resume the payment process."
            type="warning"
            showIcon
            className="mb-4"
          />
        )}

        {proposal.depositVerified && (
          <Alert
            message="Deposit Paid"
            description={`Your deposit of $${(proposal.depositAmount || depositAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} has been received.`}
            type="success"
            showIcon
            className="mb-4"
          />
        )}

        <div className="flex gap-4 justify-center">
          {proposal.depositVerified ? (
            <>
              {proposal.selectionsComplete && proposal.job?.id ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate(`/portal/job/${proposal.job.id}`)}
                >
                  Track Job
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate(`/portal/proposals/${proposalId}/selections`)}
                >
                  Proceed to Selections
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleAccept}
                loading={accepting}
              >
                {proposal.status === 'accepted' && !proposal.depositVerified
                  ? 'Resume Payment'
                  : 'Accept Proposal & Pay Deposit'}
              </Button>
              <Button
                danger
                size="large"
                icon={<CloseCircleOutlined />}
                onClick={() => setShowRejectModal(true)}
                loading={rejecting}
                disabled={proposal.status === 'accepted'}
              >
                Reject Proposal
              </Button>
            </>
          )}
        </div>
      </Card>

      <Modal
        title="Reject Proposal"
        open={showRejectModal}
        onOk={handleReject}
        onCancel={() => setShowRejectModal(false)}
        confirmLoading={rejecting}
      >
        <p className="mb-4">Please let us know why you're rejecting this proposal:</p>
        <Radio.Group
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          className="w-full"
        >
          <div className="space-y-2">
            <Radio value="price_too_high">Price is too high</Radio>
            <Radio value="timeline_issue">Timeline doesn't work</Radio>
            <Radio value="scope_change">Need to change project scope</Radio>
            <Radio value="found_alternative">Found another contractor</Radio>
            <Radio value="other">Other reason</Radio>
          </div>
        </Radio.Group>
      </Modal>
    </div>
  );
};

export default ProposalAcceptance;
