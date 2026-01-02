import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Typography, Space, message, Spin, Alert, Divider } from 'antd';
import { FiCreditCard, FiLock, FiCheckCircle } from 'react-icons/fi';
import { apiService } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;

function DepositPayment() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  useEffect(() => {
    // Check if returning from Stripe
    const success = searchParams.get('success');
    const paymentIntentId = searchParams.get('payment_intent');
    
    if (success === 'true' && paymentIntentId) {
      handlePaymentSuccess(paymentIntentId);
    }
  }, [searchParams]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/customer/proposals/${proposalId}`);
      if (response.success) {
        setProposal(response.data);
        
        // Check if already paid
        if (response.data.depositVerified) {
          setPaymentSuccess(true);
        }
      }
    } catch (error) {
      message.error('Failed to load proposal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async () => {
    try {
      setProcessing(true);
      
      const response = await apiService.post(`/customer/proposals/${proposalId}/create-payment-intent`, {
        tier: proposal.selectedTier
      });

      if (response.success && response.data.clientSecret) {
        setPaymentIntent(response.data);
        
        // For demo purposes, simulate payment success after 2 seconds
        // In production, you would integrate with Stripe Elements here
        setTimeout(() => {
          handlePaymentSuccess('demo_payment_intent_' + Date.now());
        }, 2000);
      }
    } catch (error) {
      message.error('Failed to initiate payment: ' + error.message);
      setProcessing(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      setProcessing(true);
      
      const response = await apiService.post(`/customer/proposals/${proposalId}/verify-deposit`, {
        paymentIntentId
      });

      if (response.success) {
        setPaymentSuccess(true);
        message.success(response.message || 'Payment successful! Portal is now open.');
        
        // Redirect after 3 seconds
        setTimeout(() => {
          if (response.data.redirectTo) {
            navigate(response.data.redirectTo);
          } else {
            navigate(`/portal/finish-standards/${proposalId}`);
          }
        }, 3000);
      }
    } catch (error) {
      message.error('Payment verification failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading payment details..." />
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

  if (paymentSuccess) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="text-center">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div className="text-green-500 text-6xl">
              <FiCheckCircle />
            </div>
            
            <Title level={2} className="text-green-600">Payment Successful!</Title>
            
            <Alert
              message="Your Customer Portal is Now Open"
              description="You now have access to select your paint products, colors, and sheens for your project."
              type="success"
              showIcon
            />

            <Paragraph>
              <Text strong>Deposit Amount:</Text> ${parseFloat(proposal.depositAmount).toFixed(2)}
            </Paragraph>

            <Paragraph>
              <Text strong>Portal Valid Until:</Text>{' '}
              {proposal.portalClosedAt 
                ? new Date(proposal.portalClosedAt).toLocaleDateString()
                : 'See contractor for details'}
            </Paragraph>

            <Divider />

            <Title level={4}>Next Steps:</Title>
            <ol className="text-left max-w-md mx-auto">
              <li className="mb-2">Acknowledge the finish standards</li>
              <li className="mb-2">Select products for each area</li>
              <li className="mb-2">Choose colors and sheens</li>
              <li className="mb-2">Submit your selections</li>
            </ol>

            <Button 
              type="primary" 
              size="large"
              onClick={() => navigate(`/portal/finish-standards/${proposalId}`)}
            >
              Continue to Finish Standards
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Title level={2}>Deposit Payment</Title>
          <Paragraph type="secondary">
            Proposal #{proposal.quoteNumber}
          </Paragraph>
        </Card>

        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div className="flex justify-between items-center">
              <Text strong>Selected Tier:</Text>
              <Text className="text-lg">{proposal.selectedTier?.toUpperCase()}</Text>
            </div>

            <div className="flex justify-between items-center">
              <Text strong>Project Total:</Text>
              <Text className="text-lg">${parseFloat(proposal.total).toFixed(2)}</Text>
            </div>

            <Divider />

            <div className="flex justify-between items-center">
              <Text strong className="text-xl">Deposit Amount:</Text>
              <Title level={3} className="text-green-600 m-0">
                ${parseFloat(proposal.depositAmount).toFixed(2)}
              </Title>
            </div>

            <Alert
              message="Secure Payment"
              description="Your payment is processed securely through Stripe. Your portal will open immediately after payment confirmation."
              type="info"
              showIcon
              icon={<FiLock />}
            />
          </Space>
        </Card>

        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Title level={4}>What Happens After Payment?</Title>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <Text strong>Instant Portal Access</Text>
                  <Paragraph type="secondary" className="mb-0">
                    Your customer portal opens immediately
                  </Paragraph>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <Text strong>Email Confirmation</Text>
                  <Paragraph type="secondary" className="mb-0">
                    Receipt and portal access link sent to your email
                  </Paragraph>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <Text strong>Make Your Selections</Text>
                  <Paragraph type="secondary" className="mb-0">
                    Choose products, colors, and sheens for your project
                  </Paragraph>
                </div>
              </div>
            </div>
          </Space>
        </Card>

        <Card>
          <div className="text-center">
            <Button
              type="primary"
              size="large"
              icon={<FiCreditCard />}
              onClick={initiatePayment}
              loading={processing}
              className="w-full sm:w-auto px-12"
            >
              {processing ? 'Processing Payment...' : 'Pay Deposit Now'}
            </Button>

            <Paragraph type="secondary" className="mt-4 mb-0">
              <FiLock className="inline mr-1" />
              Secured by Stripe
            </Paragraph>
          </div>
        </Card>

        <div className="text-center">
          <Button type="link" onClick={() => navigate(`/portal/proposal/${proposalId}`)}>
            ← Back to Proposal
          </Button>
        </div>
      </Space>
    </div>
  );
}

export default DepositPayment;
