import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Typography, Space, message, Spin, Alert, Divider } from 'antd';
import { FiCreditCard, FiLock, FiCheckCircle } from 'react-icons/fi';
import { apiService } from '../../services/apiService';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const { Title, Text, Paragraph } = Typography;

// Card element styling
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      padding: '10px 12px',
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

// Payment form component (needs Stripe hooks)
function PaymentForm({ proposal, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    // PREVENT DOUBLE SUBMISSION
    if (processing || paymentSubmitted) {
      return;
    }

    if (!stripe || !elements) {
      message.warning('Payment form not ready. Please wait a moment.');
      return;
    }

    setProcessing(true);
    setPaymentSubmitted(true);

    try {
      const cardElement = elements.getElement(CardElement);

      // Check if payment intent already succeeded (page refresh/retry case)
      // First try to retrieve the payment intent status
      const clientSecret = proposal.clientSecret;
      const paymentIntentId = clientSecret.split('_secret_')[0];

      // Confirm the payment (Stripe handles idempotency)
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: proposal.customerEmail,
            },
          },
        }
      );

      if (error) {
        // Handle specific error types
        if (error.code === 'payment_intent_unexpected_state') {
          // Payment already succeeded - retrieve and verify
          message.info('Verifying your payment...');
          const { paymentIntent: existingPI } = await stripe.retrievePaymentIntent(clientSecret);
          
          if (existingPI && existingPI.status === 'succeeded') {
            message.success('Payment already completed!');
            onSuccess(existingPI.id);
            return;
          }
        }
        
        message.error(error.message || 'Payment failed');
        setProcessing(false);
        setPaymentSubmitted(false);
        return;
      }

      // Handle different payment statuses
      if (paymentIntent.status === 'succeeded') {
        message.success('Payment successful!');
        onSuccess(paymentIntent.id);
      } else if (paymentIntent.status === 'processing') {
        message.loading('Payment is processing. Please wait...');
        // Poll for status update
        setTimeout(() => checkPaymentStatus(paymentIntentId), 3000);
      } else if (paymentIntent.status === 'requires_payment_method') {
        message.error('Payment failed. Please try with a different card.');
        setProcessing(false);
        setPaymentSubmitted(false);
      } else {
        message.warning(`Payment status: ${paymentIntent.status}. Please contact support.`);
        setProcessing(false);
        setPaymentSubmitted(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      message.error('Payment processing failed. Please try again.');
      setProcessing(false);
      setPaymentSubmitted(false);
    }
  };

  const checkPaymentStatus = async (paymentIntentId) => {
    try {
      const { paymentIntent } = await stripe.retrievePaymentIntent(proposal.clientSecret);
      
      if (paymentIntent.status === 'succeeded') {
        message.success('Payment successful!');
        onSuccess(paymentIntent.id);
      } else if (paymentIntent.status === 'processing') {
        setTimeout(() => checkPaymentStatus(paymentIntentId), 3000);
      } else {
        message.error('Payment could not be completed.');
        setProcessing(false);
        setPaymentSubmitted(false);
      }
    } catch (err) {
      console.error('Status check error:', err);
      setProcessing(false);
      setPaymentSubmitted(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ 
          padding: '12px', 
          border: '1px solid #d9d9d9', 
          borderRadius: '8px',
          backgroundColor: '#fafafa'
        }}>
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        
        <Alert
          message="Test Card Numbers"
          description={
            <div>
              <div>Success: 4242 4242 4242 4242</div>
              <div>Decline: 4000 0000 0000 0002</div>
              <div>Use any future expiry date and any 3-digit CVC</div>
            </div>
          }
          type="info"
          showIcon
        />

        <Button
          type="primary"
          size="large"
          htmlType="submit"
          icon={<FiCreditCard />}
          loading={processing}
          disabled={!stripe || processing}
          className="w-full"
        >
          {processing ? 'Processing Payment...' : `Pay $${parseFloat(proposal.depositAmount).toFixed(2)}`}
        </Button>
      </Space>
    </form>
  );
}


function DepositPayment() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);

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
      setLoading(true);
      
      const response = await apiService.post(`/customer/proposals/${proposalId}/create-payment-intent`, {
        tier: proposal.selectedTier
      });

      if (response.success && response.data.clientSecret) {
        // Initialize Stripe with publishable key
        const stripe = await loadStripe(response.data.publishableKey);
        setStripePromise(stripe);
        
        // Store client secret in proposal
        setProposal(prev => ({
          ...prev,
          clientSecret: response.data.clientSecret
        }));
        
        message.success('Payment form ready');
      } else {
        message.error('Failed to initialize payment');
      }
    } catch (error) {
      message.error('Failed to initiate payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId) => {
    try {
      setLoading(true);
      
      const response = await apiService.post(`/customer/proposals/${proposalId}/verify-deposit`, {
        paymentIntentId
      });

      if (response.success) {
        setPaymentSuccess(true);
        
        // Handle already processed case (idempotency)
        if (response.data?.alreadyProcessed) {
          message.info('Payment already verified. Redirecting to portal...');
        } else {
          message.success(response.message || 'Payment successful! Portal is now open.');
        }
        
        // Redirect after 2 seconds
        setTimeout(() => {
          if (response.data.redirectTo) {
            navigate(response.data.redirectTo);
          } else {
            navigate(`/portal/finish-standards/${proposalId}`);
          }
        }, 2000);
      } else {
        // Handle specific error codes from backend
        const errorCode = response.code;
        
        if (errorCode === 'PAYMENT_CONFLICT') {
          message.error('This deposit has already been paid. Please contact support if you believe this is an error.');
        } else if (errorCode === 'PAYMENT_PROCESSING') {
          message.loading('Payment is still processing. Please wait...');
          // Retry after 3 seconds
          setTimeout(() => handlePaymentSuccess(paymentIntentId), 3000);
          return; // Don't set loading to false
        } else if (errorCode === 'AMOUNT_MISMATCH' || errorCode === 'PROPOSAL_MISMATCH') {
          message.error('Payment verification failed. Please contact support with reference: ' + paymentIntentId);
        } else if (errorCode === 'DATABASE_UPDATE_FAILED') {
          message.error('Your payment was successful but there was an issue opening your portal. Please contact support with reference: ' + paymentIntentId);
        } else {
          message.error(response.message || 'Failed to verify payment. Please contact support.');
        }
        
        setPaymentSuccess(false);
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      
      // Handle network errors
      if (error.response?.status === 409) {
        message.error('Payment already processed. Redirecting to portal...');
        setTimeout(() => navigate(`/portal/finish-standards/${proposalId}`), 2000);
      } else if (error.response?.status === 202) {
        message.loading('Payment is processing. Please wait...');
        setTimeout(() => handlePaymentSuccess(paymentIntentId), 3000);
        return;
      } else {
        message.error('Failed to verify payment: ' + (error.message || 'Network error'));
      }
    } finally {
      setLoading(false);
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
          <Title level={4}>Payment Information</Title>
          {!proposal.clientSecret ? (
            <div className="text-center">
              <Button
                type="primary"
                size="large"
                icon={<FiCreditCard />}
                onClick={initiatePayment}
                loading={loading}
                className="w-full sm:w-auto px-12"
              >
                {loading ? 'Loading Payment Form...' : 'Continue to Payment'}
              </Button>

              <Paragraph type="secondary" className="mt-4 mb-0">
                <FiLock className="inline mr-1" />
                Secured by Stripe
              </Paragraph>
            </div>
          ) : (
            stripePromise && (
              <Elements stripe={stripePromise}>
                <PaymentForm 
                  proposal={proposal} 
                  onSuccess={handlePaymentSuccess} 
                />
              </Elements>
            )
          )}
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
