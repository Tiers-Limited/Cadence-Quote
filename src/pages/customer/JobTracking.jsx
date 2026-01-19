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
  Divider
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

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Final Payment Form Component
const FinalPaymentForm = ({ clientSecret, amount, onSuccess, onError }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()

    if (!stripe || !elements) return

    setProcessing(true)

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)
        }
      })

      if (result.error) {
        onError(result.error.message)
      } else if (result.paymentIntent.status === 'succeeded') {
        onSuccess(result.paymentIntent.id)
      }
    } catch (err) {
      onError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='bg-gray-50 p-4 rounded-lg mb-4'>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' }
              },
              invalid: { color: '#9e2146' }
            }
          }}
        />
      </div>
      <Button
        type='primary'
        htmlType='submit'
        size='large'
        block
        loading={processing}
        disabled={!stripe || processing || !(Number(amount) > 0)}
        icon={<DollarOutlined />}
      >
        Pay Final Balance $
        {Number(amount || 0).toLocaleString('en-US', {
          minimumFractionDigits: 2
        })}
      </Button>
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

  useEffect(() => {
    fetchJobDetails()
  }, [jobId])

  const fetchJobDetails = async () => {
    try {
      setLoading(true)
      const response = await customerPortalAPI.getJobDetails(jobId)
      setJob(response.job)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching job:', err)
      setError(err.response?.data?.message || 'Failed to load job details')
      setLoading(false)
    }
  }

  const handleInitiatePayment = async () => {
    try {
      const response = await customerPortalAPI.createFinalPayment(jobId)
      setClientSecret(response.payment.clientSecret)
      setShowPayment(true)
    } catch (err) {
      console.error('Error creating payment:', err)
      Modal.error({
        title: 'Payment Error',
        content: err.response?.data?.message || 'Failed to initiate payment'
      })
    }
  }

  const handlePaymentSuccess = async paymentIntentId => {
    try {
      await customerPortalAPI.confirmFinalPayment(jobId, { paymentIntentId })
      setPaymentComplete(true)
      setShowPayment(false)

      Modal.success({
        title: 'Payment Complete!',
        content:
          'Thank you for your payment. A receipt has been sent to your email.',
        onOk: () => fetchJobDetails()
      })
    } catch (err) {
      console.error('Error confirming payment:', err)
      Modal.error({
        title: 'Confirmation Error',
        content:
          'Payment was successful but failed to update. Please contact support.'
      })
    }
  }

  const handlePaymentError = errorMessage => {
    Modal.error({
      title: 'Payment Failed',
      content: errorMessage
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
        <Card title='Complete Final Payment'>
          <Alert
            message='Final Payment Required'
            description={`Your project is complete! Please submit the final payment of $${Number(
              job?.balanceRemaining || 0
            ).toLocaleString('en-US', {
              minimumFractionDigits: 2
            })} to close out the job.`}
            type='info'
            showIcon
            className='mb-6'
          />

          <Elements stripe={stripePromise}>
            <FinalPaymentForm
              clientSecret={clientSecret}
              amount={job.balanceRemaining}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>

          <Button
            type='link'
            onClick={() => setShowPayment(false)}
            className='mt-4 block text-center w-full'
          >
            Cancel
          </Button>
        </Card>
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
                >
                  Pay Now
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
