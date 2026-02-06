// src/pages/customer/JobTracking.jsx
// Customer job status tracking and final payment

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Timeline,
  Tag,
  Button,
  Descriptions,
  Spin,
  Result,
  Modal,
  Alert,
  Divider,
  message,
  Progress,
  Grid
} from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  CalendarOutlined
} from '@ant-design/icons'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { customerPortalAPI } from '../../services/customerPortalAPI'
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader'
import JobProgressView from '../../components/CustomerPortal/JobProgressView'

const { useBreakpoint } = Grid
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Final Payment Form Component
const FinalPaymentForm = ({ clientSecret, amount, onSuccess, onError, isMobile }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()

    // Prevent double submission
    if (processing || paymentSubmitted) {
      message.info('Payment is already being processed. Please wait...')
      return
    }

    if (!stripe || !elements) {
      message.warning('Payment form not ready. Please wait a moment.')
      return
    }

    setProcessing(true)
    setPaymentSubmitted(true)
    message.loading({ content: 'Processing your payment securely...', key: 'payment-process', duration: 0 })

    try {
      const cardElement = elements.getElement(CardElement)
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            // Add any billing details if available
          }
        }
      })

      if (result.error) {
        message.destroy('payment-process')
        // Handle specific error types
        if (result.error.code === 'card_declined') {
          onError('Your card was declined. Please check your card details or try a different card.')
        } else if (result.error.code === 'expired_card') {
          onError('Your card has expired. Please use a different card.')
        } else if (result.error.code === 'incorrect_cvc') {
          onError('The security code (CVC) is incorrect. Please check and try again.')
        } else if (result.error.code === 'processing_error') {
          onError('An error occurred while processing your card. Please try again.')
        } else {
          onError(result.error.message || 'Payment failed. Please check your card details and try again.')
        }
        setProcessing(false)
        setPaymentSubmitted(false)
      } else if (result.paymentIntent.status === 'succeeded') {
        message.success({ content: '✓ Payment successful! Verifying...', key: 'payment-process', duration: 2 })
        setVerifying(true)
        onSuccess(result.paymentIntent.id)
      } else if (result.paymentIntent.status === 'processing') {
        message.loading({ content: 'Payment is processing. Please wait...', key: 'payment-process', duration: 0 })
        // Poll for status
        setTimeout(() => checkPaymentStatus(result.paymentIntent.id), 3000)
      } else if (result.paymentIntent.status === 'requires_payment_method') {
        message.destroy('payment-process')
        onError('Payment failed. Please check your card details or try a different card.')
        setProcessing(false)
        setPaymentSubmitted(false)
      } else {
        message.destroy('payment-process')
        onError(`Payment status: ${result.paymentIntent.status}. Please contact support.`)
        setProcessing(false)
        setPaymentSubmitted(false)
      }
    } catch (err) {
      console.error('Payment error:', err)
      message.destroy('payment-process')
      onError(err.message || 'Payment processing failed. Please try again.')
      setProcessing(false)
      setPaymentSubmitted(false)
    }
  }

  const checkPaymentStatus = async (paymentIntentId) => {
    try {
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret)
      
      if (paymentIntent.status === 'succeeded') {
        message.success({ content: '✓ Payment successful! Verifying...', key: 'payment-process', duration: 2 })
        setVerifying(true)
        onSuccess(paymentIntent.id)
      } else if (paymentIntent.status === 'processing') {
        setTimeout(() => checkPaymentStatus(paymentIntentId), 3000)
      } else {
        message.destroy('payment-process')
        onError('Payment could not be completed.')
        setProcessing(false)
        setPaymentSubmitted(false)
      }
    } catch (err) {
      console.error('Status check error:', err)
      message.destroy('payment-process')
      onError('Failed to verify payment status.')
      setProcessing(false)
      setPaymentSubmitted(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {verifying && (
        <Alert
          message="Verifying Payment"
          description="Please wait while we verify your payment..."
          type="info"
          showIcon
          icon={<Spin />}
          className="mb-4"
          style={{ fontSize: isMobile ? '12px' : '14px' }}
        />
      )}
      
      <div 
        className='rounded-lg mb-4'
        style={{
          padding: isMobile ? '12px' : '16px',
          border: processing ? '2px solid #1890ff' : '1px solid #d9d9d9',
          backgroundColor: processing ? '#f0f5ff' : '#fafafa',
          transition: 'all 0.3s ease',
          opacity: processing ? 0.7 : 1
        }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: isMobile ? '14px' : '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' },
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased',
                padding: isMobile ? '10px 0' : '12px 0'
              },
              invalid: { 
                color: '#9e2146',
                iconColor: '#9e2146'
              },
              complete: {
                color: '#52c41a'
              }
            },
            hidePostalCode: true
          }}
        />
      </div>

      {processing && (
        <div className="mb-4">
          <Progress 
            percent={verifying ? 100 : 66} 
            status={verifying ? 'success' : 'active'}
            showInfo={false}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <p className="text-center text-gray-600 mt-2" style={{ fontSize: isMobile ? '11px' : '13px' }}>
            {verifying ? 'Verifying payment...' : 'Processing payment...'}
          </p>
        </div>
      )}

      <Alert
        message="Secure Payment"
        description="Your payment is processed securely through Stripe. All card information is encrypted."
        type="info"
        showIcon
        className="mb-4"
        style={{ fontSize: isMobile ? '12px' : '14px' }}
      />
      
      <Button
        type='primary'
        htmlType='submit'
        size={isMobile ? 'middle' : 'large'}
        block
        loading={processing || verifying}
        disabled={!stripe || processing || verifying || !(Number(amount) > 0)}
        icon={<DollarOutlined />}
        style={{
          height: isMobile ? '44px' : '48px',
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 600
        }}
      >
        {processing ? 'Processing Payment...' : 
         verifying ? 'Verifying...' :
         `Pay Final Balance $${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
      </Button>

      <p className="text-center text-gray-500 mt-3 mb-0" style={{ fontSize: isMobile ? '10px' : '11px' }}>
        By clicking "Pay Final Balance", you authorize the final payment for your completed project.
      </p>
    </form>
  )
}

const JobTracking = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [showPayment, setShowPayment] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [initiatingPayment, setInitiatingPayment] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)

  useEffect(() => {
    fetchJobDetails()
  }, [jobId])

  const fetchJobDetails = async () => {
    try {
      setLoading(true)
      const response = await customerPortalAPI.getJobDetails(jobId)
      // API returns {success: true, data: job}
      setJob(response.data || response.job)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching job:', err)
      setError(err.response?.data?.message || 'Failed to load job details')
      setLoading(false)
    }
  }

  const handleInitiatePayment = async () => {
    try {
      setInitiatingPayment(true)
      message.loading({ content: 'Preparing payment form...', key: 'init-payment', duration: 0 })
      
      const response = await customerPortalAPI.createFinalPayment(jobId)
      
      if (response.payment && response.payment.clientSecret) {
        setClientSecret(response.payment.clientSecret)
        setShowPayment(true)
        message.success({ content: 'Payment form ready - please enter your card details', key: 'init-payment', duration: 3 })
      } else {
        throw new Error('Invalid payment response')
      }
    } catch (err) {
      console.error('Error creating payment:', err)
      message.destroy('init-payment')
      
      const errorMessage = err.response?.data?.message || err.message || 'Failed to initiate payment'
      
      Modal.error({
        title: 'Payment Initialization Failed',
        content: errorMessage,
        okText: 'Try Again'
      })
    } finally {
      setInitiatingPayment(false)
    }
  }

  const handlePaymentSuccess = async paymentIntentId => {
    try {
      setConfirmingPayment(true)
      message.loading({ content: 'Confirming payment and updating job status...', key: 'confirm-payment', duration: 0 })
      
      const response = await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId })
      
      message.destroy('confirm-payment')
      setPaymentComplete(true)
      setShowPayment(false)

      Modal.success({
        title: '🎉 Payment Complete!',
        content: (
          <div>
            <p>Thank you for your payment! Your project is now fully complete.</p>
            <p className="mt-2">A receipt has been sent to your email.</p>
            <p className="mt-2 text-gray-600 text-sm">Transaction ID: {paymentIntentId}</p>
          </div>
        ),
        okText: 'View Job Details',
        onOk: () => {
          fetchJobDetails()
          setConfirmingPayment(false)
        }
      })
    } catch (err) {
      console.error('Error confirming payment:', err)
      message.destroy('confirm-payment')
      setConfirmingPayment(false)
      
      const errorMessage = err.response?.data?.message || 'Failed to confirm payment'
      const errorCode = err.response?.data?.code
      
      if (errorCode === 'ALREADY_PAID') {
        Modal.info({
          title: 'Payment Already Recorded',
          content: 'This payment has already been recorded. Your job is complete.',
          onOk: () => fetchJobDetails()
        })
      } else {
        Modal.error({
          title: 'Payment Confirmation Error',
          content: (
            <div>
              <p>{errorMessage}</p>
              <p className="mt-2 text-gray-600 text-sm">
                Your payment was successful but we couldn't update the job status automatically.
              </p>
              <p className="mt-2 text-gray-600 text-sm">
                Please contact support with this transaction ID: <strong>{paymentIntentId}</strong>
              </p>
            </div>
          )
        })
      }
    }
  }

  const handlePaymentError = errorMessage => {
    Modal.error({
      title: 'Payment Failed',
      content: (
        <div>
          <p>{errorMessage}</p>
          <p className="mt-3 text-gray-600 text-sm">
            Please check your card details and try again. If the problem persists, 
            contact your bank or try a different payment method.
          </p>
        </div>
      ),
      okText: 'Try Again',
      width: 500
    })
  }

  const getStatusColor = status => {
    const colors = {
      pending: 'orange',
      scheduled: 'blue',
      in_progress: 'cyan',
      completed: 'green',
      on_hold: 'red',
      cancelled: 'red'
    }
    return colors[status] || 'default'
  }

  const getStatusIcon = status => {
    if (status === 'completed') return <CheckCircleOutlined />
    return <ClockCircleOutlined />
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen' style={{ padding: isMobile ? '20px' : '0' }}>
        <Spin size='large' tip={isMobile ? "Loading..." : "Loading job details..."} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: isMobile ? '100%' : '800px', margin: '0 auto', padding: isMobile ? '16px' : '24px' }}>
        <Result
          status='error'
          title='Error Loading Job'
          subTitle={error}
          extra={
            <Button
              type='primary'
              onClick={() => navigate('/portal/dashboard')}
              block={isMobile}
            >
              Back to Dashboard
            </Button>
          }
        />
      </div>
    )
  }

  if (showPayment) {
    return (
      <div style={{ maxWidth: isMobile ? '100%' : '800px', margin: '0 auto', padding: isMobile ? '12px' : '24px' }}>
        <Spin spinning={confirmingPayment} tip="Confirming payment and updating job status..." size="large">
          <Card 
            title={
              <div className="flex items-center gap-2" style={{ fontSize: isMobile ? '15px' : '16px' }}>
                <DollarOutlined className="text-green-600" />
                <span>Complete Final Payment</span>
              </div>
            }
          >
            <Alert
              message='Final Payment Required'
              description={
                <div>
                  <p style={{ fontSize: isMobile ? '13px' : '14px' }}>Your project is complete! Please submit the final payment to close out the job.</p>
                  <div className="mt-3 bg-blue-50 rounded" style={{ padding: isMobile ? '10px' : '12px' }}>
                    <div className="flex justify-between items-center" style={{ flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? '8px' : '0' }}>
                      <span className="font-semibold" style={{ fontSize: isMobile ? '13px' : '14px' }}>Amount Due:</span>
                      <span className="font-bold text-green-600" style={{ fontSize: isMobile ? '20px' : '24px' }}>
                        ${Number(job?.balanceRemaining || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              }
              type='info'
              showIcon
              className='mb-6'
              style={{ fontSize: isMobile ? '12px' : '14px' }}
            />

            {clientSecret ? (
              <Elements stripe={stripePromise}>
                <FinalPaymentForm
                  clientSecret={clientSecret}
                  amount={job.balanceRemaining}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  isMobile={isMobile}
                />
              </Elements>
            ) : (
              <div className="text-center py-8">
                <Spin size="large" tip="Loading payment form..." />
              </div>
            )}

            <Button
              type='link'
              onClick={() => setShowPayment(false)}
              className='mt-4 block text-center w-full'
              disabled={confirmingPayment}
              style={{ fontSize: isMobile ? '13px' : '14px' }}
            >
              ← Back to Job Details
            </Button>
          </Card>
        </Spin>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '12px' : '24px' }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? '8px' : '0' }}>
            <span style={{ fontSize: isMobile ? '16px' : '18px' }}>Job #{job.jobNumber}</span>
            <Tag
              color={getStatusColor(job.status)}
              icon={getStatusIcon(job.status)}
              style={{ fontSize: isMobile ? '11px' : '14px', padding: isMobile ? '2px 8px' : '4px 12px' }}
            >
              {job.status.replace('_', ' ').toUpperCase()}
            </Tag>
          </div>
        }
      >
        {/* Job Details */}
        <Descriptions bordered column={1} size={isMobile ? 'small' : 'default'} labelStyle={{ fontSize: isMobile ? '12px' : '14px', fontWeight: 600 }} contentStyle={{ fontSize: isMobile ? '12px' : '14px' }}>
          <Descriptions.Item label='Job Title'>
            {job.jobTitle}
          </Descriptions.Item>
          <Descriptions.Item label='Address'>
            {[
              job.address.street,
              job.address.city,
              job.address.state,
              job.address.zipCode
            ]
              .filter(Boolean)
              .join(', ')}
          </Descriptions.Item>
          {job.scheduledStartDate && (
            <Descriptions.Item
              label='Scheduled Start'
              icon={<CalendarOutlined />}
            >
              {new Date(job.scheduledStartDate).toLocaleDateString('en-US', {
                weekday: isMobile ? undefined : 'long',
                year: 'numeric',
                month: isMobile ? 'short' : 'long',
                day: 'numeric'
              })}
            </Descriptions.Item>
          )}
          {job.scheduledEndDate && (
            <Descriptions.Item label='Scheduled End'>
              {new Date(job.scheduledEndDate).toLocaleDateString('en-US', {
                weekday: isMobile ? undefined : 'long',
                year: 'numeric',
                month: isMobile ? 'short' : 'long',
                day: 'numeric'
              })}
            </Descriptions.Item>
          )}
          {job.estimatedDuration && (
            <Descriptions.Item label='Estimated Duration'>
              {job.estimatedDuration}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider style={{ fontSize: isMobile ? '14px' : '16px' }}>Payment Information</Divider>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '12px' : '16px', marginBottom: isMobile ? '16px' : '24px' }}>
          <Card>
            <div className='text-center'>
              <p className='text-gray-600 mb-2' style={{ fontSize: isMobile ? '12px' : '14px' }}>Total</p>
              <p className='font-bold text-blue-600' style={{ fontSize: isMobile ? '18px' : '24px', margin: 0 }}>
                $
                {Number(job.total || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2
                })}
              </p>
            </div>
          </Card>
          <Card>
            <div className='text-center'>
              <p className='text-gray-600 mb-2' style={{ fontSize: isMobile ? '12px' : '14px' }}>Deposit Paid</p>
              <p className='font-bold text-green-600' style={{ fontSize: isMobile ? '18px' : '24px', margin: 0 }}>
                $
                {Number(job.depositAmount || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2
                })}
              </p>
            </div>
          </Card>
          <Card>
            <div className='text-center'>
              <p className='text-gray-600 mb-2' style={{ fontSize: isMobile ? '12px' : '14px' }}>Remaining Balance</p>
              <p className='font-bold text-orange-600' style={{ fontSize: isMobile ? '18px' : '24px', margin: 0 }}>
                $
                {Number(job.balanceRemaining || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2
                })}
              </p>
            </div>
          </Card>
        </div>

        {/* Job Progress Section */}
        {(job.status === 'in_progress' || job.status === 'completed' || job.status === 'scheduled') && (
          <>
            <Divider style={{ fontSize: isMobile ? '14px' : '16px' }}>Project Progress</Divider>
            <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
              <JobProgressView job={job} />
            </div>
          </>
        )}

        {/* Final Payment CTA */}
        {job.status === 'completed' &&
          job.finalPaymentStatus === 'pending' &&
          job.balanceRemaining > 0 && (
            <Alert
              message='Final Payment Required'
              description='Your project is complete! Please submit the final payment to close out the job.'
              type='warning'
              showIcon
              action={
                <Button
                  type='primary'
                  size={isMobile ? 'middle' : 'large'}
                  onClick={handleInitiatePayment}
                  icon={<DollarOutlined />}
                  loading={initiatingPayment}
                  disabled={initiatingPayment}
                  block={isMobile}
                  style={{ fontSize: isMobile ? '13px' : '14px' }}
                >
                  {initiatingPayment ? 'Preparing...' : 'Pay Now'}
                </Button>
              }
              style={{ marginBottom: isMobile ? '16px' : '24px', fontSize: isMobile ? '12px' : '14px' }}
            />
          )}

        {job.finalPaymentStatus === 'paid' && (
          <Alert
            message='Payment Complete'
            description='Thank you! All payments have been received. Your project is fully complete.'
            type='success'
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: isMobile ? '16px' : '24px', fontSize: isMobile ? '12px' : '14px' }}
          />
        )}

        <Divider style={{ fontSize: isMobile ? '14px' : '16px' }}>Job Timeline</Divider>

        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <div>
                  <p className='font-semibold' style={{ fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>Job Created</p>
                  <p className='text-gray-600' style={{ fontSize: isMobile ? '11px' : '13px', margin: 0 }}>
                    Your selections were submitted and locked
                  </p>
                </div>
              )
            },
            job.scheduledStartDate && {
              color:
                job.status === 'scheduled' ||
                job.status === 'in_progress' ||
                job.status === 'completed'
                  ? 'green'
                  : 'gray',
              children: (
                <div>
                  <p className='font-semibold' style={{ fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>Scheduled</p>
                  <p className='text-gray-600' style={{ fontSize: isMobile ? '11px' : '13px', margin: 0 }}>
                    Start date:{' '}
                    {new Date(job.scheduledStartDate).toLocaleDateString(
                      'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }
                    )}
                  </p>
                </div>
              )
            },
            job.status === 'in_progress' || job.status === 'completed'
              ? {
                  color: 'green',
                  children: (
                    <div>
                      <p className='font-semibold' style={{ fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>Work In Progress</p>
                      <p className='text-gray-600' style={{ fontSize: isMobile ? '11px' : '13px', margin: 0 }}>
                        Our team is working on your project
                      </p>
                    </div>
                  )
                }
              : null,
            job.status === 'completed' && {
              color: 'green',
              icon: <CheckCircleOutlined />,
              children: (
                <div>
                  <p className='font-semibold' style={{ fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>Project Completed</p>
                  <p className='text-gray-600' style={{ fontSize: isMobile ? '11px' : '13px', margin: 0 }}>
                    Work has been finished
                  </p>
                </div>
              )
            },
            job.finalPaymentStatus === 'paid' && {
              color: 'green',
              icon: <CheckCircleOutlined />,
              children: (
                <div>
                  <p className='font-semibold' style={{ fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>Final Payment Received</p>
                  <p className='text-gray-600' style={{ fontSize: isMobile ? '11px' : '13px', margin: 0 }}>
                    Paid on{' '}
                    {new Date(job.finalPaymentDate).toLocaleDateString(
                      'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }
                    )}
                  </p>
                </div>
              )
            }
          ].filter(Boolean)}
        />
      </Card>
    </div>
  )
}

export default JobTracking
