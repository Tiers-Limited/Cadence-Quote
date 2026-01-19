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
  Modal
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import { magicLinkApiService } from '../../services/magicLinkApiService';
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import customerPortalAPI from '../../services/customerPortalAPI';

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

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const response = await magicLinkApiService.get(`/api/customer-portal/jobs/${jobId}`);
      if (response.success) {
        setJob(response.data);
      }
    } catch (error) {
      message.error('Failed to load job details: ' + error.message);
    } finally {
      setLoading(false);
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
              {job.status === 'completed' && (job.finalPaymentStatus === 'pending' || job.balanceRemaining > 0) && (
                <div style={{ marginTop: 10 }}>
                  <Button type="primary" onClick={async () => {
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
        title={`Pay Remaining - $${parseFloat(paymentAmount || 0).toFixed(2)}`}
        open={paymentModalVisible}
        onCancel={() => { setPaymentModalVisible(false); setPaymentClientSecret(null); }}
        footer={null}
      >
        {stripePromise && paymentClientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret }}>
            <FinalPaymentForm
              jobId={job.id}
              clientSecret={paymentClientSecret}
              amount={paymentAmount}
              onSuccess={async () => {
                setPaymentModalVisible(false);
                setPaymentClientSecret(null);
                message.success('Payment completed. Thank you!');
                await fetchJobDetails();
              }}
              onCancel={() => { setPaymentModalVisible(false); setPaymentClientSecret(null); }}
            />
          </Elements>
        ) : (
          <div style={{ textAlign: 'center' }}><Spin /></div>
        )}
      </Modal>
    </div>
  );
}



function FinalPaymentForm({ jobId, clientSecret, amount, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);

    try {
      const card = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
        }
      });

      if (result.error) {
        // Handle specific Stripe error when confirming an already-succeeded PaymentIntent
        if (result.error.code === 'payment_intent_unexpected_state' || (result.error.message && result.error.message.includes('already succeeded'))) {
          const paymentIntentId = result.error.payment_intent?.id || (clientSecret && clientSecret.split('_secret')[0]);
          if (paymentIntentId) {
            try {
              await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId });
              onSuccess && onSuccess();
              return;
            } catch (confirmErr) {
              message.error('Payment succeeded but server failed to process it. Please contact support.');
              setProcessing(false);
              return;
            }
          }
          message.error('Payment appears to have already succeeded. Please refresh or contact support if your job is not marked closed.');
          setProcessing(false);
          return;
        }

        message.error(result.error.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      const paymentIntent = result.paymentIntent;
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm via API
        await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId: paymentIntent.id });
        onSuccess && onSuccess();
      } else {
        message.error('Payment did not complete successfully');
      }
    } catch (err) {
      message.error('Payment error: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 12 }}>
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={processing}>Pay ${parseFloat(amount || 0).toFixed(2)}</Button>
      </Space>
    </form>
  );
}

export default CustomerJobDetail;
