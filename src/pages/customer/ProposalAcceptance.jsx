// src/pages/customer/ProposalAcceptance.jsx
// Customer proposal acceptance with deposit payment

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Radio, Spin, Result, Alert, Divider, Descriptions, Modal, message, Progress } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { customerPortalAPI } from '../../services/customerPortalAPI';
import { apiService } from '../../services/apiService';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';
import { useAbortableEffect, isAbortError } from '../../hooks/useAbortableEffect';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Payment Form Component
const PaymentForm = ({ clientSecret, amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (processing || paymentSubmitted) {
      message.info('Payment is already being processed. Please wait...');
      return;
    }

    if (!stripe || !elements) {
      message.warning('Payment form not ready. Please wait a moment.');
      return;
    }

    setProcessing(true);
    setPaymentSubmitted(true);
    message.loading({ content: 'Processing your deposit payment...', key: 'payment-process', duration: 0 });

    try {
      const cardElement = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            // Add billing details if available
          }
        },
      });

      if (result.error) {
        message.destroy('payment-process');
        // Handle specific error types
        if (result.error.code === 'card_declined') {
          onError('Your card was declined. Please check your card details or try a different card.');
        } else if (result.error.code === 'expired_card') {
          onError('Your card has expired. Please use a different card.');
        } else if (result.error.code === 'incorrect_cvc') {
          onError('The security code (CVC) is incorrect. Please check and try again.');
        } else if (result.error.code === 'insufficient_funds') {
          onError('Insufficient funds. Please use a different card.');
        } else if (result.error.code === 'processing_error') {
          onError('An error occurred while processing your card. Please try again.');
        } else {
          onError(result.error.message || 'Payment failed. Please check your card details and try again.');
        }
        setProcessing(false);
        setPaymentSubmitted(false);
      } else if (result.paymentIntent.status === 'succeeded') {
        message.success({ content: '✓ Payment successful! Verifying and unlocking portal...', key: 'payment-process', duration: 2 });
        setVerifying(true);
        onSuccess(result.paymentIntent.id);
      } else if (result.paymentIntent.status === 'processing') {
        message.loading({ content: 'Payment is processing. Please wait...', key: 'payment-process', duration: 0 });
        setTimeout(() => checkPaymentStatus(result.paymentIntent.id), 3000);
      } else if (result.paymentIntent.status === 'requires_payment_method') {
        message.destroy('payment-process');
        onError('Payment failed. Please check your card details or try a different card.');
        setProcessing(false);
        setPaymentSubmitted(false);
      } else {
        message.destroy('payment-process');
        onError(`Payment status: ${result.paymentIntent.status}. Please contact support.`);
        setProcessing(false);
        setPaymentSubmitted(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      message.destroy('payment-process');
      onError(err.message || 'Payment processing failed. Please try again.');
      setProcessing(false);
      setPaymentSubmitted(false);
    }
  };

  const checkPaymentStatus = async (paymentIntentId) => {
    try {
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      
      if (paymentIntent.status === 'succeeded') {
        message.success({ content: '✓ Payment successful! Verifying and unlocking portal...', key: 'payment-process', duration: 2 });
        setVerifying(true);
        onSuccess(paymentIntent.id);
      } else if (paymentIntent.status === 'processing') {
        setTimeout(() => checkPaymentStatus(paymentIntentId), 3000);
      } else {
        message.destroy('payment-process');
        onError('Payment could not be completed.');
        setProcessing(false);
        setPaymentSubmitted(false);
      }
    } catch (err) {
      console.error('Status check error:', err);
      message.destroy('payment-process');
      onError('Failed to verify payment status.');
      setProcessing(false);
      setPaymentSubmitted(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {verifying && (
        <Alert
          message="Verifying Payment"
          description="Please wait while we verify your payment and unlock your portal access..."
          type="info"
          showIcon
          icon={<Spin />}
          className="mb-4"
        />
      )}
      
      <div 
        className="border rounded-lg p-4 mb-6 transition-all duration-300"
        style={{
          borderColor: processing ? '#1890ff' : '#d9d9d9',
          backgroundColor: processing ? '#f0f5ff' : '#ffffff',
          borderWidth: processing ? '2px' : '1px',
          opacity: processing ? 0.7 : 1,
          boxShadow: processing ? '0 0 0 3px rgba(24, 144, 255, 0.1)' : 'none'
        }}
      >
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased',
                '::placeholder': {
                  color: '#9ca3af',
                },
                padding: '12px 0',
              },
              invalid: {
                color: '#ef4444',
                iconColor: '#ef4444'
              },
              complete: {
                color: '#10b981'
              }
            },
            hidePostalCode: false,
          }}
        />
      </div>

      {processing && (
        <div className="mb-6">
          <Progress 
            percent={verifying ? 100 : 66} 
            status={verifying ? 'success' : 'active'}
            showInfo={false}
            strokeColor={{
              '0%': '#1890ff',
              '100%': '#52c41a',
            }}
          />
          <p className="text-center text-gray-600 text-sm mt-2">
            {verifying ? '🔓 Unlocking your portal access...' : '💳 Processing your payment...'}
          </p>
        </div>
      )}

      <Alert
        message="🔒 Secure Deposit Payment"
        description={
          <div>
            <p className="mb-2">Your payment information is encrypted and secure.</p>
            <p className="text-xs text-gray-600 mb-0">
              ✓ PCI-DSS Compliant • ✓ SSL Encrypted • ✓ Powered by Stripe
            </p>
          </div>
        }
        type="info"
        className="mb-6"
      />
      
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={processing || verifying}
        disabled={!stripe || processing || verifying}
        icon={<DollarOutlined />}
        className="h-12 text-lg font-semibold"
        style={{
          background: processing || verifying ? undefined : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          border: 'none'
        }}
      >
        {processing ? '⏳ Processing Payment...' : 
         verifying ? '🔓 Unlocking Portal...' :
         `Pay Deposit $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </Button>

      <p className="text-center text-gray-500 text-xs mt-4 mb-0">
        By completing this payment, you confirm your acceptance of the proposal terms and initiate your project.
      </p>
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
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  useAbortableEffect((signal) => {
    fetchProposal(signal);
  }, [proposalId]);

  const fetchProposal = async (signalsignal) => {
    try {
      setLoading(true);
      const response = await customerPortalAPI.getProposal(proposalId, { signal });
      
      if (signal && signal.aborted) return;
      
      const payload = response.data?.data || response.data || response;
      setProposal(payload);

      // Track quote view (fire-and-forget)
      try {
        await apiService.post(`/customer/quotes/${proposalId}/view`, {}, { signal });
      } catch (viewError) {
        // Silently fail - tracking is not critical
        console.debug('Quote view tracking failed:', viewError);
      }

      // Populate deposit/selection state from payload
      if (payload) {
        // Set selected tier if already chosen
        if (payload.gbbSelectedTier || payload.selectedTier) {
          setSelectedTier(payload.gbbSelectedTier || payload.selectedTier);
        } else if (payload.productStrategy === 'GBB') {
          // Default to 'good' for GBB quotes if no tier selected
          setSelectedTier('good');
        }
        
        // Set deposit amount - use the effective deposit for selected tier
        if (payload.depositAmount) {
          setDepositAmount(payload.depositAmount);
        }
      }
    } catch (err) {
      if (isAbortError(err)) {
        console.log('Fetch proposal aborted');
        return;
      }
      console.error('Error fetching proposal:', err);
      setError(err.response?.data?.message || 'Failed to load proposal');
    } finally {
      if (signal && !signal.aborted) {
        setLoading(false);
      }
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
      message.loading({ content: 'Preparing your proposal...', key: 'accept-proposal', duration: 0 });
      
      const response = await customerPortalAPI.acceptProposal(proposalId, { selectedTier });
      
      console.log('Accept proposal response:', response); // Debug log
      
      // Check if payment is already completed
      if (response.paymentCompleted) {
        message.destroy('accept-proposal');
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
      
      // Store payment intent details from response
      const paymentData = response.payment || response.data?.payment;
      const clientSecretValue = paymentData?.clientSecret;
      const depositAmountValue = paymentData?.amount;
      
      console.log('Payment data:', { clientSecretValue, depositAmountValue }); // Debug log
      
      if (!clientSecretValue || !depositAmountValue) {
        throw new Error('Invalid payment response from server');
      }
      
      setClientSecret(clientSecretValue);
      setDepositAmount(depositAmountValue);
      
      message.success({ content: 'Proposal accepted! Please complete your deposit payment.', key: 'accept-proposal', duration: 3 });
      
      // Move to payment step
      setPaymentStep(true);
      setAccepting(false);
    } catch (err) {
      console.error('Error accepting proposal:', err);
      message.destroy('accept-proposal');
      Modal.error({
        title: 'Error',
        content: err.response?.data?.message || err.message || 'Failed to accept proposal',
      });
      setAccepting(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    setVerifyingPayment(true);
    message.loading({ content: 'Verifying payment and unlocking portal...', key: 'verify-payment', duration: 0 });
    
    try {
      const response = await customerPortalAPI.confirmDepositPayment(proposalId, { paymentIntentId });
      
      message.success({ content: '🎉 Payment verified! Portal unlocked successfully!', key: 'verify-payment', duration: 3 });
      setSuccess(true);
      setVerifyingPayment(false);
      
      // Redirect to selections after 3 seconds
      setTimeout(() => {
        navigate(`/portal/proposals/${proposalId}/selections`);
      }, 3000);
    } catch (err) {
      console.error('Error confirming payment:', err);
      message.destroy('verify-payment');
      setVerifyingPayment(false);
      
      const errorMessage = err.response?.data?.message || 'Payment was successful but failed to update. Please contact support.';
      const errorCode = err.response?.data?.code;
      
      if (errorCode === 'ALREADY_VERIFIED') {
        Modal.info({
          title: 'Payment Already Verified',
          content: 'Your payment has already been verified. Redirecting to selections...',
          onOk: () => navigate(`/portal/proposals/${proposalId}/selections`)
        });
      } else {
        Modal.error({
          title: 'Payment Verification Error',
          content: (
            <div>
              <p>{errorMessage}</p>
              <p className="mt-3 text-gray-600 text-sm">
                Transaction ID: <strong>{paymentIntentId}</strong>
              </p>
              <p className="mt-2 text-gray-600 text-sm">
                Please save this ID and contact support if needed.
              </p>
            </div>
          )
        });
      }
    }
  };

  const handlePaymentError = (errorMessage) => {
    Modal.error({
      title: 'Payment Failed',
      content: (
        <div>
          <p className="mb-3">{errorMessage}</p>
          <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm">
            <p className="font-semibold mb-2">What to do next:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Check your card details and try again</li>
              <li>Ensure you have sufficient funds</li>
              <li>Try a different card if the issue persists</li>
              <li>Contact your bank if you continue to experience issues</li>
            </ul>
          </div>
        </div>
      ),
      okText: 'Try Again',
      width: 500
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <Card className="max-w-md w-full text-center shadow-xl">
          <Result
            status="success"
            title={
              <div>
                <div className="text-3xl mb-2">🎉</div>
                <div>Deposit Payment Successful!</div>
              </div>
            }
            subTitle={
              <div className="space-y-2">
                <p>Your payment has been verified and your portal is now unlocked!</p>
                <p className="text-gray-600">Redirecting to product selection...</p>
                <Progress 
                  percent={100}
                  status="success"
                  strokeColor="#52c41a"
                  showInfo={false}
                  className="mt-4"
                />
              </div>
            }
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          />
        </Card>
      </div>
    );
  }

  // Show verifying payment overlay
  if (verifyingPayment) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        <Card className="max-w-md w-full text-center shadow-xl">
          <div className="mb-6">
            <Spin size="large" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">
              🔓 Unlocking Your Portal
            </h2>
            <p className="text-gray-600 mb-4">
              Please wait while we verify your payment and unlock access to the product selection portal...
            </p>
            <Progress 
              percent={66}
              status="active"
              strokeColor={{
                '0%': '#1890ff',
                '100%': '#52c41a',
              }}
              className="mb-4"
            />
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800 mb-2">
                ⏳ This usually takes just a few moments
              </p>
              <p className="text-xs text-blue-600">
                Please don't close this window or press the back button
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (paymentStep) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Spin spinning={verifyingPayment} tip="Verifying payment and unlocking portal..." size="large">
          <Card 
            title={
              <div className="flex items-center gap-2">
                <DollarOutlined className="text-green-600" />
                <span>Complete Your Deposit Payment</span>
              </div>
            }
          >
            <Alert
              message="Almost There!"
              description={
                <div>
                  <p className="mb-2">Complete your deposit payment to unlock the full interactive portal.</p>
                  <div className="mt-3 p-3 bg-green-50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Deposit Amount:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    <p className="mb-1">✓ Confirms your project acceptance</p>
                    <p className="mb-1">✓ Unlocks product selection portal</p>
                    <p className="mb-0">✓ Starts your selection period</p>
                  </div>
                </div>
              }
              type="info"
              showIcon
              className="mb-6"
            />
            
            {clientSecret ? (
              <Elements stripe={stripePromise}>
                <PaymentForm
                  clientSecret={clientSecret}
                  amount={depositAmount}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>
            ) : (
              <div className="text-center py-8">
                <Spin size="large" tip="Loading secure payment form..." />
              </div>
            )}
            
            <Divider />
            
            <div className="text-center">
              <Button
                type="link"
                onClick={() => setPaymentStep(false)}
                disabled={verifyingPayment}
              >
                ← Back to Proposal
              </Button>
            </div>
          </Card>
        </Spin>
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
