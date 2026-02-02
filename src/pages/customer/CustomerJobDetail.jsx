// pages/customer/CustomerJobDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Space,
  Descriptions,
  Tag,
  message,
  Spin,
  Button,
  List,
  Progress,
  Row,
  Col,
  Modal,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import { magicLinkApiService } from '../../services/magicLinkApiService';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import customerPortalAPI from '../../services/customerPortalAPI';
import { useAbortableEffect, isAbortError } from '../../hooks/useAbortableEffect';

const { Title, Text } = Typography;

function CustomerJobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);

  // Use custom hook for abortable API calls
  useAbortableEffect((signal) => {
    if (jobId) {
      fetchJobDetails(signal);
    }
  }, [jobId]);

  const fetchJobDetails = async (signal) => {
    try {
      setLoading(true);
      const response = await magicLinkApiService.get(`/api/customer-portal/jobs/${jobId}`, null, { signal });
      
      // Check if request was aborted
      if (signal && signal.aborted) {
        return;
      }
      
      if (response.success) {
        setJob(response.data);
      }
    } catch (error) {
      // Ignore abort errors (user navigated away)
      if (isAbortError(error)) {
        console.log('Fetch aborted: user navigated away');
        return;
      }
      message.error('Failed to load job details: ' + error.message);
    } finally {
      // Only update loading state if not aborted
      if (signal && !signal.aborted) {
        setLoading(false);
      }
    }
  };

  const getJobStatusText = (status) => {
    const statusTexts = {
      accepted: 'Accepted',
      pending_deposit: 'Awaiting Deposit',
      deposit_paid: 'Deposit Paid',
      selections_pending: 'Selections Pending',
      selections_complete: 'Selections Complete',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      paused: 'Paused',
      completed: 'Completed',
      invoiced: 'Invoiced',
      paid: 'Paid',
      closed: 'Closed',
      canceled: 'Canceled',
      on_hold: 'On Hold'
    };
    return statusTexts[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      accepted: 'green',
      pending_deposit: 'orange',
      deposit_paid: 'blue',
      selections_pending: 'orange',
      selections_complete: 'cyan',
      scheduled: 'blue',
      in_progress: 'processing',
      paused: 'warning',
      completed: 'success',
      invoiced: 'purple',
      paid: 'success',
      closed: 'default',
      canceled: 'error',
      on_hold: 'warning'
    };
    return colors[status] || 'default';
  };

  const getAreaStatus = (areaId) => {
    if (!job?.areaProgress || !job.areaProgress[areaId]) {
      return 'not_started';
    }
    return job.areaProgress[areaId].status;
  };

  const getAreaStatusLabel = (status) => {
    const labels = {
      not_started: 'Not Started',
      prepped: 'Prepped',
      in_progress: 'In Progress',
      touch_ups: 'Touch-Ups',
      completed: 'Completed'
    };
    return labels[status] || status;
  };

  const getAreaStatusColor = (status) => {
    const colors = {
      not_started: 'default',
      prepped: 'blue',
      in_progress: 'processing',
      touch_ups: 'warning',
      completed: 'success'
    };
    return colors[status] || 'default';
  };

  const calculateOverallProgress = () => {
    if (!job?.quote?.areas || !job.areaProgress) return 0;
    
    const completedAreas = job.quote.areas.filter(area => {
      const status = getAreaStatus(area.id);
      return status === 'completed';
    });
    
    return Math.round((completedAreas.length / job.quote.areas.length) * 100);
  };

  if (loading) {
    return (
      <div>
        
        <div className="flex items-center justify-center min-h-screen">
          <Spin size="large" tip="Loading job details..." />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <Title level={3}>Job Not Found</Title>
          <Button onClick={() => navigate('/portal/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const areas = job.quote?.areas || [];
  const overallProgress = calculateOverallProgress();

  return (
   
      <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/portal/dashboard')}
        className="mb-4"
      >
        Back to Dashboard
      </Button>

      <div className="mb-6">
        <Title level={2}>{job.jobNumber}</Title>
        <Tag color={getStatusColor(job.status)} style={{ fontSize: 14, padding: '4px 12px' }}>
          {getJobStatusText(job.status)}
        </Tag>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column */}
        <Col xs={24} lg={16}>
          {/* Job Details */}
          <Card title="Job Details" className="mb-4">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Job Name" span={2}>
                {job.jobName}
              </Descriptions.Item>
              <Descriptions.Item label="Job Number">
                {job.jobNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Quote Number">
                {job.quote?.quoteNumber || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Tag color={getStatusColor(job.status)}>
                  {getJobStatusText(job.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                ${parseFloat(job.totalAmount).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Deposit Amount">
                ${parseFloat(job.depositAmount).toFixed(2)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Schedule */}
          <Card title={<><CalendarOutlined /> Schedule</>} className="mb-4">
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Start Date">
                {job.scheduledStartDate 
                  ? new Date(job.scheduledStartDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })
                  : 'Not scheduled'}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {job.scheduledEndDate 
                  ? new Date(job.scheduledEndDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })
                  : 'Not scheduled'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {job.estimatedDuration ? `${job.estimatedDuration} days` : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Actual Start">
                {job.actualStartDate 
                  ? new Date(job.actualStartDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })
                  : 'Not started'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Job Progress */}
          {areas.length > 0 && (
            <Card title="Job Progress by Area" className="mb-4">
              <div className="mb-4">
                <Text strong style={{ fontSize: 16 }}>Overall Project Progress</Text>
                <Progress
                  percent={overallProgress}
                  status={overallProgress === 100 ? 'success' : 'active'}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                  className="mt-2"
                />
                <Text type="secondary" className="mt-2 block">
                  {areas.filter(a => getAreaStatus(a.id) === 'completed').length} of {areas.length} areas completed
                </Text>
              </div>

              <List
                dataSource={areas}
                renderItem={(area) => {
                  const currentStatus = getAreaStatus(area.id);
                  const isCompleted = currentStatus === 'completed';
                  
                  return (
                    <List.Item
                      style={{
                        backgroundColor: isCompleted ? '#f6ffed' : 'transparent',
                        border: isCompleted ? '1px solid #b7eb8f' : '1px solid #f0f0f0',
                        borderRadius: 4,
                        marginBottom: 8,
                        padding: 16
                      }}
                    >
                      <div style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                          <Space>
                            {isCompleted && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />}
                            <div>
                              <Text strong>{area.name || area.surfaceType}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {area.quantity} {area.unit}
                              </Text>
                            </div>
                          </Space>
                          
                          <Tag color={getAreaStatusColor(currentStatus)} style={{ fontSize: 14, padding: '4px 12px' }}>
                            {getAreaStatusLabel(currentStatus)}
                          </Tag>
                        </Space>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </Card>
          )}
        </Col>

        {/* Right Column */}
        <Col xs={24} lg={8}>
          {/* Customer Selections */}
          <Card title="Customer Selections" className="mb-4">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="flex justify-between items-center">
                <Text>Selections Complete:</Text>
                {job.customerSelectionsComplete ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>Complete</Tag>
                ) : (
                  <Tag color="warning">Pending</Tag>
                )}
              </div>

              {job.customerSelectionsSubmittedAt && (
                <div className="flex justify-between items-center">
                  <Text type="secondary" style={{ fontSize: 12 }}>Submitted:</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(job.customerSelectionsSubmittedAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
                  </Text>
                </div>
              )}
            </Space>
          </Card>

          {/* Quick Info */}
          <Card title="Quick Info" className="mb-4">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="flex justify-between">
                <Text type="secondary">Created:</Text>
                <Text>{new Date(job.createdAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}</Text>
              </div>
              {job.quote?.selectedTier && (
                <div className="flex justify-between">
                  <Text type="secondary">Tier Selected:</Text>
                  <Tag color="blue">{job.quote.selectedTier.toUpperCase()}</Tag>
                </div>
              )}

              {/* Pay Remaining CTA */}
              {!paymentCompleted && job.status === 'completed' && (job.finalPaymentStatus === 'pending' || job.balanceRemaining > 0) && (
                <div style={{ marginTop: 10 }}>
                  <Button type="primary" block onClick={async () => {
                    try {
                      const resp = await customerPortalAPI.createFinalPayment(job.id);
                      if (resp.success && resp.payment) {
                        setPaymentClientSecret(resp.payment.clientSecret);
                        setPaymentAmount(resp.payment.amount);
                        setStripePromise(loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY));
                        setPaymentModalVisible(true);
                      } else {
                        message.error('Unable to initiate final payment');
                      }
                    } catch (err) {
                      message.error('Failed to create payment: ' + (err.response?.data?.message || err.message));
                    }
                  }}>
                    {`Pay Remaining $${parseFloat(job.balanceRemaining || 0).toFixed(2)}`}
                  </Button>
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Final Payment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <DollarOutlined className="text-green-600" />
            <span>Complete Final Payment</span>
          </div>
        }
        open={paymentModalVisible}
        onCancel={() => {
          if (paymentInProgress) {
            message.warning('Please wait while your payment is being processed. Do not close this window.');
            return;
          }
          setPaymentModalVisible(false);
          setPaymentClientSecret(null);
        }}
        closable={!paymentInProgress}
        maskClosable={false}
        keyboard={false}
        footer={null}
        width={600}
      >
        {stripePromise && paymentClientSecret ? (
          <div>
            <Alert
              message="Final Payment"
              description={
                <div>
                  <p className="mb-2">Complete your final payment to close this project.</p>
                  <div className="mt-3 p-3 bg-green-50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Final Balance:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${parseFloat(paymentAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    <p className="mb-1">✓ Job has been completed</p>
                    <p className="mb-1">✓ Final payment closes the project</p>
                    <p className="mb-0">✓ Receipt will be sent to your email</p>
                  </div>
                </div>
              }
              type="info"
              showIcon
              className="mb-6"
            />
            <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret }}>
              <FinalPaymentForm
                jobId={job.id}
                clientSecret={paymentClientSecret}
                amount={paymentAmount}
                onSuccess={async () => {
                  setPaymentModalVisible(false);
                  setPaymentClientSecret(null);
                  setPaymentCompleted(true); // Hide payment button immediately
                  
                  // Show success message
                  Modal.success({
                    title: '🎉 Payment Successful!',
                    content: (
                      <div>
                        <p className="mb-2">Your final payment has been processed successfully.</p>
                        <p className="text-gray-600">This job has been marked as paid and closed.</p>
                      </div>
                    ),
                    okText: 'Done',
                  });
                  
                  // Refresh job details to get updated status
                  await fetchJobDetails();
                }}
                onCancel={() => {
                  if (paymentInProgress) {
                    message.warning('Please wait while your payment is being processed. Do not close this window.');
                    return;
                  }
                  setPaymentModalVisible(false);
                  setPaymentClientSecret(null);
                }}
                onPaymentStart={() => setPaymentInProgress(true)}
                onPaymentEnd={() => setPaymentInProgress(false)}
              />
            </Elements>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}><Spin /></div>
        )}
      </Modal>
    </div>
  );
}



function FinalPaymentForm({ jobId, clientSecret, amount, onSuccess, onCancel, onPaymentStart, onPaymentEnd }) {
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
    onPaymentStart && onPaymentStart();
    message.loading({ content: 'Processing your final payment...', key: 'final-payment-process', duration: 0 });

    try {
      const cardElement = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {}
        },
      });

      if (result.error) {
        message.destroy('final-payment-process');
        
        // Handle specific Stripe error when confirming an already-succeeded PaymentIntent
        if (result.error.code === 'payment_intent_unexpected_state' || (result.error.message && result.error.message.includes('already succeeded'))) {
          const paymentIntentId = result.error.payment_intent?.id || (clientSecret && clientSecret.split('_secret')[0]);
          if (paymentIntentId) {
            try {
              message.loading({ content: 'Verifying payment status...', key: 'final-payment-process', duration: 0 });
              await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId });
              message.success({ content: '✓ Payment verified successfully!', key: 'final-payment-process', duration: 2 });
              onPaymentEnd && onPaymentEnd();
              onSuccess && onSuccess();
              return;
            } catch (confirmErr) {
              Modal.error({
                title: 'Payment Verification Error',
                content: (
                  <div>
                    <p>Payment succeeded but server failed to process it.</p>
                    <p className="mt-3 text-gray-600 text-sm">
                      Transaction ID: <strong>{paymentIntentId}</strong>
                    </p>
                    <p className="mt-2 text-gray-600 text-sm">
                      Please save this ID and contact support.
                    </p>
                  </div>
                )
              });
              setProcessing(false);
              setPaymentSubmitted(false);
              onPaymentEnd && onPaymentEnd();
              return;
            }
          }
          message.error('Payment appears to have already succeeded. Please refresh or contact support.');
          setProcessing(false);
          setPaymentSubmitted(false);
          onPaymentEnd && onPaymentEnd();
          return;
        }

        // Handle specific error types
        let errorMessage = result.error.message || 'Payment failed. Please check your card details and try again.';
        if (result.error.code === 'card_declined') {
          errorMessage = 'Your card was declined. Please check your card details or try a different card.';
        } else if (result.error.code === 'expired_card') {
          errorMessage = 'Your card has expired. Please use a different card.';
        } else if (result.error.code === 'incorrect_cvc') {
          errorMessage = 'The security code (CVC) is incorrect. Please check and try again.';
        } else if (result.error.code === 'insufficient_funds') {
          errorMessage = 'Insufficient funds. Please use a different card.';
        } else if (result.error.code === 'processing_error') {
          errorMessage = 'An error occurred while processing your card. Please try again.';
        }

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
        setProcessing(false);
        setPaymentSubmitted(false);
        onPaymentEnd && onPaymentEnd();
      } else if (result.paymentIntent.status === 'succeeded') {
        message.success({ content: '✓ Payment successful! Verifying and closing job...', key: 'final-payment-process', duration: 2 });
        setVerifying(true);
        try {
          await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId: result.paymentIntent.id });
          message.success({ content: '🎉 Payment verified! Job closed successfully!', key: 'final-payment-process', duration: 3 });
          onPaymentEnd && onPaymentEnd();
          onSuccess && onSuccess();
        } catch (confirmErr) {
          message.destroy('final-payment-process');
          Modal.error({
            title: 'Payment Verification Error',
            content: (
              <div>
                <p>Payment succeeded but server failed to process it.</p>
                <p className="mt-3 text-gray-600 text-sm">
                  Transaction ID: <strong>{result.paymentIntent.id}</strong>
                </p>
                <p className="mt-2 text-gray-600 text-sm">
                  Please save this ID and contact support.
                </p>
              </div>
            )
          });
          setProcessing(false);
          setPaymentSubmitted(false);
          setVerifying(false);
          onPaymentEnd && onPaymentEnd();
        }
      } else if (result.paymentIntent.status === 'processing') {
        message.loading({ content: 'Payment is processing. Please wait...', key: 'final-payment-process', duration: 0 });
        setTimeout(() => checkPaymentStatus(result.paymentIntent.id), 3000);
      } else if (result.paymentIntent.status === 'requires_payment_method') {
        message.destroy('final-payment-process');
        Modal.error({
          title: 'Payment Failed',
          content: 'Payment failed. Please check your card details or try a different card.',
          okText: 'Try Again'
        });
        setProcessing(false);
        setPaymentSubmitted(false);
        onPaymentEnd && onPaymentEnd();
      } else {
        message.destroy('final-payment-process');
        Modal.error({
          title: 'Payment Status Unknown',
          content: `Payment status: ${result.paymentIntent.status}. Please contact support.`
        });
        setProcessing(false);
        setPaymentSubmitted(false);
        onPaymentEnd && onPaymentEnd();
      }
    } catch (err) {
      console.error('Payment error:', err);
      message.destroy('final-payment-process');
      Modal.error({
        title: 'Payment Error',
        content: err.response?.data?.message || err.message || 'Payment processing failed. Please try again.'
      });
      setProcessing(false);
      setPaymentSubmitted(false);
      onPaymentEnd && onPaymentEnd();
    }
  };

  const checkPaymentStatus = async (paymentIntentId) => {
    try {
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      
      if (paymentIntent.status === 'succeeded') {
        message.success({ content: '✓ Payment successful! Verifying and closing job...', key: 'final-payment-process', duration: 2 });
        setVerifying(true);
        try {
          await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId: paymentIntent.id });
          message.success({ content: '🎉 Payment verified! Job closed successfully!', key: 'final-payment-process', duration: 3 });
          onPaymentEnd && onPaymentEnd();
          onSuccess && onSuccess();
        } catch (confirmErr) {
          message.destroy('final-payment-process');
          Modal.error({
            title: 'Payment Verification Error',
            content: (
              <div>
                <p>Payment succeeded but server failed to process it.</p>
                <p className="mt-3 text-gray-600 text-sm">
                  Transaction ID: <strong>{paymentIntent.id}</strong>
                </p>
                <p className="mt-2 text-gray-600 text-sm">
                  Please save this ID and contact support.
                </p>
              </div>
            )
          });
          setProcessing(false);
          setPaymentSubmitted(false);
          setVerifying(false);
          onPaymentEnd && onPaymentEnd();
        }
      } else if (paymentIntent.status === 'processing') {
        setTimeout(() => checkPaymentStatus(paymentIntentId), 3000);
      } else {
        message.destroy('final-payment-process');
        Modal.error({
          title: 'Payment Failed',
          content: 'Payment could not be completed.'
        });
        setProcessing(false);
        setPaymentSubmitted(false);
        onPaymentEnd && onPaymentEnd();
      }
    } catch (err) {
      console.error('Status check error:', err);
      message.destroy('final-payment-process');
      Modal.error({
        title: 'Verification Error',
        content: 'Failed to verify payment status. Please contact support.'
      });
      setProcessing(false);
      setPaymentSubmitted(false);
      onPaymentEnd && onPaymentEnd();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {verifying && (
        <Alert
          message="Verifying Payment"
          description="Please wait while we verify your payment and close your job..."
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
            {verifying ? '🔐 Verifying and closing your job...' : '💳 Processing your payment...'}
          </p>
        </div>
      )}

      <Alert
        message="🔒 Secure Final Payment"
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
      
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button 
          onClick={() => {
            if (processing || verifying) {
              message.warning('Please wait while your payment is being processed. Do not close this window.');
              return;
            }
            onCancel && onCancel();
          }}
          disabled={processing || verifying}
        >
          Cancel
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          size="large"
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
           verifying ? '🔐 Closing Job...' :
           `Pay Final Balance $${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </Button>
      </Space>

      <p className="text-center text-gray-500 text-xs mt-4 mb-0">
        By completing this payment, you confirm the job is complete and close the project.
      </p>
    </form>
  );
}

export default CustomerJobDetail;
