// pages/JobDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Button,
  Typography,
  Space,
  Descriptions,
  Tag,
  message,
  Spin,
  Alert,
  Divider,
  DatePicker,
  InputNumber,
  Input,
  Form,
  Modal,
  Select,
  Row,
  Col
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ToolOutlined
} from '@ant-design/icons'

import { jobsService } from '../services/jobsService'
import dayjs from 'dayjs'
import JobProgressTracker from '../components/JobProgressTracker'

const { Title, Text, Paragraph } = Typography

function JobDetailPage () {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState(null)
  const [schedulingModalVisible, setSchedulingModalVisible] = useState(false)
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (jobId) {
      fetchJobDetails()
    }
  }, [jobId])

  const fetchJobDetails = async () => {
    try {
      setLoading(true)
      const response = await jobsService.getJobById(jobId)
      if (response.success) {
        setJob(response.data)
      }
    } catch (error) {
      message.error('Failed to load job details: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleScheduleJob = () => {
    form.setFieldsValue({
      scheduledStartDate: job.scheduledStartDate
        ? dayjs(job.scheduledStartDate)
        : null,
      scheduledEndDate: job.scheduledEndDate
        ? dayjs(job.scheduledEndDate)
        : null,
      estimatedDuration: job.estimatedDuration || null
    })
    setSchedulingModalVisible(true)
  }

  const handleScheduleSubmit = async values => {
    try {
      const scheduleData = {
        scheduledStartDate: values.scheduledStartDate?.toISOString(),
        scheduledEndDate: values.scheduledEndDate?.toISOString(),
        estimatedDuration: values.estimatedDuration
      }

      const response = await jobsService.updateJobSchedule(jobId, scheduleData)
      if (response.success) {
        message.success('Job scheduled successfully')
        setSchedulingModalVisible(false)
        fetchJobDetails()
      }
    } catch (error) {
      message.error('Failed to schedule job: ' + error.message)
    }
  }

  const handleStatusUpdate = () => {
    setStatusModalVisible(true)
  }

  const handleStatusSubmit = async values => {
    try {
      const response = await jobsService.updateJobStatus(jobId, values.status)
      if (response.success) {
        message.success('Job status updated successfully')
        setStatusModalVisible(false)
        fetchJobDetails()
      }
    } catch (error) {
      message.error('Failed to update status: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Spin size='large' tip='Loading job details...' />
      </div>
    )
  }

  if (!job) {
    return (
      <div className='p-6'>
        <Card>
          <Title level={3}>Job Not Found</Title>
          <Button onClick={() => navigate('/jobs')}>Back to Jobs</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className='p-6'>
      {/* Header */}
      <div className='mb-6'>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/jobs')}
          className='mb-4'
        >
          Back to Jobs
        </Button>
        <div className='flex justify-between items-start'>
          <div>
            <Title level={2}>{job.jobNumber}</Title>
            {job.quote && <Text type='secondary'>{job.quote.projectName}</Text>}
          </div>
          <Space>
            <Tag
              color={jobsService.getStatusColor(job.status)}
              style={{ fontSize: 16, padding: '4px 12px' }}
            >
              {jobsService.getStatusLabel(job.status)}
            </Tag>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left Column */}
        <Col xs={24} lg={16}>
          {/* Job Details */}
          <Card title='Job Details' className='mb-4'>
            <Descriptions column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label='Customer' span={2}>
                <Space direction='vertical' size={0}>
                  <Text strong>{job.customerName || job.client?.name}</Text>
                  <Text type='secondary'>
                    {job.customerEmail || job.client?.email}
                  </Text>
                  {(job.customerPhone || job.client?.phone) && (
                    <Text type='secondary'>
                      {job.customerPhone || job.client?.phone}
                    </Text>
                  )}
                </Space>
              </Descriptions.Item>

              <Descriptions.Item label='Job Address' span={2}>
                {job.jobAddress ||
                  (job.client
                    ? [
                        job.client.street,
                        job.client.city,
                        job.client.state,
                        job.client.zip
                      ]
                        .filter(Boolean)
                        .join(', ')
                    : job.quote?.projectAddress || (
                        <Text type='secondary'>No address specified</Text>
                      ))}
              </Descriptions.Item>

              <Descriptions.Item label='Created'>
                {new Date(job.createdAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
              </Descriptions.Item>

              <Descriptions.Item label='Quote Number'>
                {job.quote?.quoteNumber}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Scheduling */}
          <Card
            title={
              <>
                <CalendarOutlined /> Schedule
              </>
            }
            extra={
              <Button
                type='primary'
                icon={<EditOutlined />}
                onClick={handleScheduleJob}
                size='small'
              >
                Edit Schedule
              </Button>
            }
            className='mb-4'
          >
            <Descriptions column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label='Start Date'>
                {job.scheduledStartDate ? (
                  <Text strong>
                    {new Date(job.scheduledStartDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
                  </Text>
                ) : (
                  <Text type='secondary'>Not scheduled</Text>
                )}
              </Descriptions.Item>

              <Descriptions.Item label='End Date'>
                {job.scheduledEndDate ? (
                  <Text strong>
                    {new Date(job.scheduledEndDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
                  </Text>
                ) : (
                  <Text type='secondary'>Not scheduled</Text>
                )}
              </Descriptions.Item>

              <Descriptions.Item label='Duration'>
                {job.estimatedDuration ? (
                  <Text>{job.estimatedDuration} days</Text>
                ) : (
                  <Text type='secondary'>Not specified</Text>
                )}
              </Descriptions.Item>

              <Descriptions.Item label='Actual Start'>
                {job.actualStartDate ? (
                  <Text>
                    {new Date(job.actualStartDate).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
                  </Text>
                ) : (
                  <Text type='secondary'>Not started</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Job Progress Tracker */}
          {job.quote?.areas && job.quote.areas.length > 0 && (
            <Card title='Job Progress by Area' className='mb-4'>
              <JobProgressTracker
                jobId={jobId}
                job={job}
                onProgressUpdate={fetchJobDetails}
              />
            </Card>
          )}
        </Col>

        {/* Right Column */}
        <Col xs={24} lg={8}>
          {/* Quick Actions */}
          <Card title='Quick Actions' className='mb-4'>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Button
                block
                icon={<EditOutlined />}
                onClick={handleStatusUpdate}
              >
                Update Status
              </Button>
              <Button
                block
                icon={<CalendarOutlined />}
                onClick={handleScheduleJob}
              >
                Schedule Job
              </Button>
              <Button
                block
                type='primary'
                onClick={async () => {
                  Modal.confirm({
                    title: 'Approve selections',
                    content: 'Approve customer selections and lock the portal? This will notify the customer.',
                    onOk: async () => {
                      try {
                        const response = await jobsService.approveSelections(jobId)
                        if (response.success) {
                          message.success('Selections approved')
                          fetchJobDetails()
                        }
                      } catch (err) {
                        message.error('Failed to approve selections: ' + err.message)
                      }
                    }
                  })
                }}
              >
                Approve Selections
              </Button>
              <Button
                block
                onClick={async () => {
                  try {
                    const currentlyVisible = !!job?.quote?.portalOpen
                    const response = await jobsService.setJobVisibility(jobId, !currentlyVisible)
                    if (response.success) {
                      message.success(!currentlyVisible ? 'Portal opened for customer' : 'Portal hidden from customer')
                      fetchJobDetails()
                    }
                  } catch (err) {
                    message.error('Failed to update portal visibility: ' + err.message)
                  }
                }}
              >
                {job?.quote?.portalOpen ? 'Hide Portal from Customer' : 'Open Portal for Customer'}
              </Button>
            </Space>
          </Card>

          {/* Customer Selections */}
          <Card title='Customer Selections' className='mb-4'>
            <Space direction='vertical' style={{ width: '100%' }}>
              <div className='flex justify-between items-center'>
                <Text>Selections Complete:</Text>
                {job.customerSelectionsComplete ? (
                  <Tag color='success' icon={<CheckCircleOutlined />}>
                    Complete
                  </Tag>
                ) : (
                  <Tag color='warning'>Pending</Tag>
                )}
              </div>
              {job.customerSelectionsSubmittedAt && (
                <Text type='secondary' style={{ fontSize: 12 }}>
                  Submitted:{' '}
                  {new Date(
                    job.customerSelectionsSubmittedAt
                  ).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}
                </Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Schedule Modal */}
      <Modal
        title='Schedule Job'
        open={schedulingModalVisible}
        onCancel={() => setSchedulingModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout='vertical' onFinish={handleScheduleSubmit}>
          <Form.Item
            name='scheduledStartDate'
            label='Start Date'
            rules={[{ required: true, message: 'Please select start date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name='scheduledEndDate' label='End Date'>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name='estimatedDuration' label='Estimated Duration (days)'>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setSchedulingModalVisible(false)}>
                Cancel
              </Button>
              <Button type='primary' htmlType='submit'>
                Save Schedule
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        title='Update Job Status'
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form layout='vertical' onFinish={handleStatusSubmit}>
          <Form.Item
            name='status'
            label='New Status'
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select>
              <Select.Option value='deposit_paid'>Deposit Paid</Select.Option>
              <Select.Option value='selections_complete'>
                Selections Complete
              </Select.Option>
              <Select.Option value='scheduled'>Scheduled</Select.Option>
              <Select.Option value='in_progress'>In Progress</Select.Option>
              <Select.Option value='paused'>Paused</Select.Option>
              <Select.Option value='completed'>Completed</Select.Option>
              <Select.Option value='on_hold'>On Hold</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setStatusModalVisible(false)}>
                Cancel
              </Button>
              <Button type='primary' htmlType='submit'>
                Update Status
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default JobDetailPage
