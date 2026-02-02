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
  Progress
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

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Final Payment Form Component
const FinalPaymentForm = ({ clientSecret, amount, onSuccess, onError }) => {
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
        />
      )}
      
      <div 
        className='p-4 rounded-lg mb-4'
        style={{
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
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' },
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSmoothing: 'antialiased'
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
          <p className="text-center text-gray-600 text-sm mt-2">
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
      />
      
      <Button
        type='primary'
        htmlType='submit'
        size='large'
        block
        loading={processing || verifying}
        disabled={!stripe || processing || verifying || !(Number(amount) > 0)}
        icon={<DollarOutlined />}
        className="h-12 text-lg font-semibold"
      >
        {processing ? 'Processing Payment...' : 
         verifying ? 'Verifying...' :
         `Pay Final Balance $${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
      </Button>

      <p className="text-center text-gray-500 text-xs mt-3">
        By clicking "Pay Final Balance", you authorize the final payment for your completed project.
      </p>
    </form>
  )
}

const JobTracking = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()

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
      <div className='flex items-center justify-center min-h-screen'>
        <Spin size='large' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='max-w-2xl mx-auto p-6'>
        <Result
          status='error'
          title='Error Loading Job'
          subTitle={error}
          extra={
            <Button
              type='primary'
              onClick={() => navigate('/portal/dashboard')}
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
      <div className='max-w-2xl mx-auto p-6'>
        <Spin spinning={confirmingPayment} tip="Confirming payment and updating job status..." size="large">
          <Card 
            title={
              <div className="flex items-center gap-2">
                <DollarOutlined className="text-green-600" />
                <span>Complete Final Payment</span>
              </div>
            }
          >
            <Alert
              message='Final Payment Required'
              description={
                <div>
                  <p>Your project is complete! Please submit the final payment to close out the job.</p>
                  <div className="mt-3 p-3 bg-blue-50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Amount Due:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${Number(job?.balanceRemaining || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              }
              type='info'
              showIcon
              className='mb-6'
            />

            {clientSecret ? (
              <Elements stripe={stripePromise}>
                <FinalPaymentForm
                  clientSecret={clientSecret}
                  amount={job.balanceRemaining}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
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
            >
              ← Back to Job Details
            </Button>
          </Card>
        </Spin>
      </div>
    )
  }

  return (
    <div className=' mx-auto p-6'>
      <Card
        title={
          <div className='flex items-center justify-between'>
            <span>Job #{job.jobNumber}</span>
            <Tag
              color={getStatusColor(job.status)}
              icon={getStatusIcon(job.status)}
            >
              {job.status.replace('_', ' ').toUpperCase()}
            </Tag>
          </div>
        }
      >
        {/* Job Details */}
        <Descriptions bordered column={1}>
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
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Descriptions.Item>
          )}
          {job.scheduledEndDate && (
            <Descriptions.Item label='Scheduled End'>
              {new Date(job.scheduledEndDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
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

        <Divider>Payment Information</Divider>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
          <Card>
            <div className='text-center'>
              <p className='text-gray-600 mb-2'>Total</p>
              <p className='text-2xl font-bold text-blue-600'>
                $
                {Number(job.total || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2
                })}
              </p>
            </div>
          </Card>
          <Card>
            <div className='text-center'>
              <p className='text-gray-600 mb-2'>Deposit Paid</p>
              <p className='text-2xl font-bold text-green-600'>
                $
                {Number(job.depositAmount || 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2
                })}
              </p>
            </div>
          </Card>
          <Card>
            <div className='text-center'>
              <p className='text-gray-600 mb-2'>Remaining Balance</p>
              <p className='text-2xl font-bold text-orange-600'>
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
            <Divider>Project Progress</Divider>
            <div className='mb-6'>
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
                  size='large'
                  onClick={handleInitiatePayment}
                  icon={<DollarOutlined />}
                  loading={initiatingPayment}
                  disabled={initiatingPayment}
                >
                  {initiatingPayment ? 'Preparing...' : 'Pay Now'}
                </Button>
              }
              className='mb-6'
            />
          )}

        {job.finalPaymentStatus === 'paid' && (
          <Alert
            message='Payment Complete'
            description='Thank you! All payments have been received. Your project is fully complete.'
            type='success'
            showIcon
            icon={<CheckCircleOutlined />}
            className='mb-6'
          />
        )}

        <Divider>Job Timeline</Divider>

        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <div>
                  <p className='font-semibold'>Job Created</p>
                  <p className='text-gray-600 text-sm'>
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
                  <p className='font-semibold'>Scheduled</p>
                  <p className='text-gray-600 text-sm'>
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
                      <p className='font-semibold'>Work In Progress</p>
                      <p className='text-gray-600 text-sm'>
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
                  <p className='font-semibold'>Project Completed</p>
                  <p className='text-gray-600 text-sm'>
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
                  <p className='font-semibold'>Final Payment Received</p>
                  <p className='text-gray-600 text-sm'>
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
