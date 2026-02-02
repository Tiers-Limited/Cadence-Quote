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
  DatePicker,
  InputNumber,
  Form,
  Modal,
  Select,
  Row,
  Col,
  Progress
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  EditOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DownloadOutlined,
  LoadingOutlined
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
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [downloadingDoc, setDownloadingDoc] = useState(null)
  const [customerSelections, setCustomerSelections] = useState(null)
  const [selectionsLoading, setSelectionsLoading] = useState(false)
  const [schedulingJob, setSchedulingJob] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [approvingSelections, setApprovingSelections] = useState(false)

  useEffect(() => {
    if (jobId) {
      fetchJobDetails()
      fetchJobDocuments()
      fetchCustomerSelections()
    }
  }, [jobId])

  const fetchJobDetails = async () => {
    try {
      setLoading(true)
      const response = await jobsService.getJobById(jobId)
      if (response.success) {
        setJob(response.data)
        // Refresh customer selections if they exist
        if (response.data.customerSelectionsComplete) {
          fetchCustomerSelections()
        }
      }
    } catch (error) {
      message.error('Failed to load job details: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchJobDocuments = async () => {
    try {
      setDocumentsLoading(true)
      const response = await jobsService.getJobDocuments(jobId)
      if (response.success && response.documents) {
        // Convert documents object to array format
        const docsArray = Object.entries(response.documents)
          .filter(([key]) => key !== 'generatedAt') // Exclude generatedAt
          .map(([type, doc]) => ({
            type,
            title: doc.title,
            url: doc.url,
            available: doc.available,
            generatedAt: response.documents.generatedAt
          }))
          .filter(doc => doc.available) // Only show available documents
        
        setDocuments(docsArray)
      }
    } catch (error) {
      console.error('Failed to load job documents:', error)
      // Don't show error message - documents might not be generated yet
      setDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }

  const handleDownloadDocument = async (documentType) => {
    try {
      setDownloadingDoc(documentType)
      
      // Convert camelCase to kebab-case for API
      const apiDocumentType = documentType.replace(/([A-Z])/g, '-$1').toLowerCase()
      
      const response = await jobsService.downloadJobDocument(jobId, apiDocumentType)
      
      // Create blob and download
      const blob = new Blob([response], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${apiDocumentType}-${jobId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      message.success('Document downloaded successfully')
    } catch (error) {
      message.error('Failed to download document: ' + error.message)
    } finally {
      setDownloadingDoc(null)
    }
  }

  const fetchCustomerSelections = async () => {
    try {
      setSelectionsLoading(true)
      const response = await jobsService.getCustomerSelections(jobId)
      if (response.success) {
        setCustomerSelections(response.data)
      }
    } catch (error) {
      console.error('Failed to load customer selections:', error)
      setCustomerSelections(null)
    } finally {
      setSelectionsLoading(false)
    }
  }

  const handleGenerateDocuments = async () => {
    try {
      setDocumentsLoading(true)
      const response = await jobsService.generateJobDocuments(jobId)
      if (response.success) {
        message.success('Job documents generated successfully')
        fetchJobDocuments()
      }
    } catch (error) {
      message.error('Failed to generate documents: ' + error.message)
    } finally {
      setDocumentsLoading(false)
    }
  }

  const handleRegenerateDocuments = async () => {
    Modal.confirm({
      title: 'Regenerate Documents',
      content: 'This will regenerate all job documents with the latest data. Continue?',
      onOk: async () => {
        try {
          setDocumentsLoading(true)
          const response = await jobsService.generateJobDocuments(jobId)
          if (response.success) {
            message.success('Job documents regenerated successfully')
            fetchJobDocuments()
          }
        } catch (error) {
          message.error('Failed to regenerate documents: ' + error.message)
        } finally {
          setDocumentsLoading(false)
        }
      }
    })
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

  // Auto-calculate duration when dates change
  const handleDateChange = () => {
    const startDate = form.getFieldValue('scheduledStartDate')
    const endDate = form.getFieldValue('scheduledEndDate')
    
    if (startDate && endDate) {
      const duration = endDate.diff(startDate, 'day') + 1 // Include both start and end day
      if (duration > 0) {
        form.setFieldsValue({ estimatedDuration: duration })
      }
    }
  }

  // Disable dates before today
  const disabledStartDate = (current) => {
    return current && current < dayjs().startOf('day')
  }

  // Disable dates before start date
  const disabledEndDate = (current) => {
    const startDate = form.getFieldValue('scheduledStartDate')
    if (!current) return false
    
    // Can't be before today
    if (current < dayjs().startOf('day')) return true
    
    // Can't be before start date
    if (startDate && current < startDate.startOf('day')) return true
    
    return false
  }

  const handleScheduleSubmit = async values => {
    try {
      setSchedulingJob(true)
      message.loading({ content: 'Scheduling job...', key: 'schedule-job', duration: 0 })
      
      const scheduleData = {
        scheduledStartDate: values.scheduledStartDate?.toISOString(),
        scheduledEndDate: values.scheduledEndDate?.toISOString(),
        estimatedDuration: values.estimatedDuration
      }

      const response = await jobsService.updateJobSchedule(jobId, scheduleData)
      if (response.success) {
        message.success({ content: '✓ Job scheduled successfully!', key: 'schedule-job', duration: 3 })
        setSchedulingModalVisible(false)
        form.resetFields()
        // Update local state immediately for UI responsiveness
        setJob(prevJob => ({
          ...prevJob,
          ...scheduleData,
          status: prevJob.status === 'selections_complete' ? 'scheduled' : prevJob.status
        }))
        // Then fetch fresh data from server
        await fetchJobDetails()
      }
    } catch (error) {
      message.destroy('schedule-job')
      message.error({ content: 'Failed to schedule job: ' + error.message, duration: 4 })
    } finally {
      setSchedulingJob(false)
    }
  }

  const handleStatusUpdate = () => {
    setStatusModalVisible(true)
  }

  const handleStatusSubmit = async values => {
    try {
      setUpdatingStatus(true)
      message.loading({ content: 'Updating job status...', key: 'update-status', duration: 0 })
      
      const response = await jobsService.updateJobStatus(jobId, values.status)
      if (response.success) {
        message.success({ content: '✓ Job status updated successfully!', key: 'update-status', duration: 3 })
        setStatusModalVisible(false)
        // Update local state immediately
        setJob(prevJob => ({
          ...prevJob,
          status: values.status
        }))
        await fetchJobDetails()
      }
    } catch (error) {
      message.destroy('update-status')
      message.error({ content: 'Failed to update status: ' + error.message, duration: 4 })
    } finally {
      setUpdatingStatus(false)
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
          size='large'
        >
          Back to Jobs
        </Button>
        <Card className='shadow-sm'>
          <div className='flex justify-between items-start'>
            <div>
              <Title level={2} style={{ marginBottom: 8 }}>{job.jobNumber}</Title>
              {job.quote && <Text type='secondary' style={{ fontSize: 16 }}>{job.quote.projectName}</Text>}
            </div>
            <Space>
              <Tag
                color={jobsService.getStatusColor(job.status)}
                style={{ fontSize: 16, padding: '8px 16px', borderRadius: 8 }}
              >
                {jobsService.getStatusLabel(job.status)}
              </Tag>
            </Space>
          </div>
        </Card>
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

          {/* Job Progress Tracker - Only show if job is scheduled */}
          {job.scheduledStartDate && (
            <Card title='Job Progress by Area' className='mb-4'>
              <JobProgressTracker
                jobId={jobId}
                job={job}
                onProgressUpdate={fetchJobDetails}
              />
            </Card>
          )}
          
          {!job.scheduledStartDate && (
            <Card title='Job Progress by Area' className='mb-4'>
              <Alert
                message="Job Not Scheduled"
                description="Schedule the job to start tracking progress by area."
                type="info"
                showIcon
              />
            </Card>
          )}
        </Col>

        {/* Right Column */}
        <Col xs={24} lg={8}>
          {/* Quick Actions */}
          <Card title='Quick Actions' className='mb-4'>
            <Space direction='vertical' style={{ width: '100%' }} size='middle'>
              <Button
                block
                size='large'
                icon={updatingStatus ? <LoadingOutlined /> : <EditOutlined />}
                onClick={handleStatusUpdate}
                loading={updatingStatus}
                disabled={updatingStatus}
              >
                Update Job Status
              </Button>
              <Button
                block
                size='large'
                icon={schedulingJob ? <LoadingOutlined /> : <CalendarOutlined />}
                onClick={handleScheduleJob}
                loading={schedulingJob}
                disabled={schedulingJob}
              >
                {job.scheduledStartDate ? 'Update Schedule' : 'Schedule Job'}
              </Button>
              {job.customerSelectionsComplete && (
                <Button
                  block
                  size='large'
                  type='primary'
                  icon={approvingSelections ? <LoadingOutlined /> : <CheckCircleOutlined />}
                  loading={approvingSelections}
                  disabled={approvingSelections}
                  onClick={async () => {
                    Modal.confirm({
                      title: 'Approve Customer Selections',
                      content: 'Approve customer selections and lock the portal? This will notify the customer and they will no longer be able to make changes.',
                      okText: 'Approve & Lock',
                      cancelText: 'Cancel',
                      onOk: async () => {
                        try {
                          setApprovingSelections(true)
                          message.loading({ content: 'Approving selections...', key: 'approve-selections', duration: 0 })
                          const response = await jobsService.approveSelections(jobId)
                          if (response.success) {
                            message.success({ content: '✓ Selections approved and portal locked!', key: 'approve-selections', duration: 3 })
                            await fetchJobDetails()
                          }
                        } catch (err) {
                          message.destroy('approve-selections')
                          message.error({ content: 'Failed to approve selections: ' + err.message, duration: 4 })
                        } finally {
                          setApprovingSelections(false)
                        }
                      }
                    })
                  }}
                >
                  Approve Customer Selections
                </Button>
              )}
            </Space>
          </Card>

          {/* Customer Selections */}
          <Card title='Customer Selections' className='mb-4'>
            {selectionsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="Loading selections..." />
              </div>
            ) : (
              <Space direction='vertical' style={{ width: '100%' }} size="middle">
                <div className='flex justify-between items-center'>
                  <Text>Selections Status:</Text>
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
                
                {/* Show customer selections if available */}
                {job.customerSelectionsComplete && customerSelections && customerSelections.length > 0 && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Selected Products:</Text>
                    <Space direction='vertical' style={{ width: '100%' }} size="small">
                      {customerSelections.map((selection, index) => (
                        <div key={index} style={{ padding: '8px', background: '#fafafa', borderRadius: 4 }}>
                          <Text strong style={{ fontSize: 13 }}>{selection.areaName}</Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type='secondary' style={{ fontSize: 12 }}>
                              {selection.productName || 'Product not specified'}
                            </Text>
                          </div>
                          {selection.colorName && (
                            <div>
                              <Text style={{ fontSize: 12 }}>Color: {selection.colorName}</Text>
                            </div>
                          )}
                          {selection.sheen && (
                            <div>
                              <Text style={{ fontSize: 12 }}>Sheen: {selection.sheen}</Text>
                            </div>
                          )}
                        </div>
                      ))}
                    </Space>
                  </div>
                )}
                
                {!job.customerSelectionsComplete && (
                  <Alert
                    message="Waiting for Customer"
                    description="Customer has not yet completed their product selections."
                    type="info"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}
              </Space>
            )}
          </Card>

          {/* Job Documents */}
          <Card 
            title={
              <Space>
                <FileTextOutlined />
                <span>Job Documents</span>
              </Space>
            } 
            className='mb-4'
            extra={
              job?.depositPaid && (
                <Space>
                  {documents.length === 0 ? (
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={handleGenerateDocuments}
                      loading={documentsLoading}
                    >
                      Generate Documents
                    </Button>
                  ) : (
                    <Button 
                      size="small"
                      onClick={handleRegenerateDocuments}
                      loading={documentsLoading}
                    >
                      Regenerate
                    </Button>
                  )}
                </Space>
              )
            }
          >
            {!job?.depositPaid ? (
              <Alert
                message="Documents Not Available"
                description="Job documents will be available after the customer accepts the quote and pays the deposit."
                type="info"
                showIcon
              />
            ) : documentsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="Loading documents..." />
              </div>
            ) : documents.length === 0 ? (
              <Alert
                message="No Documents Generated"
                description="Click 'Generate Documents' to create work order, material list, and paint product order."
                type="warning"
                showIcon
              />
            ) : (
              <Space direction='vertical' style={{ width: '100%' }} size="small">
                {documents.map((doc) => (
                  <div 
                    key={doc.type}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <Space>
                      <FileTextOutlined style={{ fontSize: 16, color: '#1890ff' }} />
                      <div>
                        <Text strong>{doc.title}</Text>
                        {doc.generatedAt && (
                          <div>
                            <Text type='secondary' style={{ fontSize: 12 }}>
                              Generated: {new Date(doc.generatedAt).toLocaleDateString()}
                            </Text>
                          </div>
                        )}
                      </div>
                    </Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownloadDocument(doc.type)}
                      loading={downloadingDoc === doc.type}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* Schedule Modal */}
      <Modal
        title={
          <Space>
            <CalendarOutlined />
            <span>{job.scheduledStartDate ? 'Update Job Schedule' : 'Schedule Job'}</span>
          </Space>
        }
        open={schedulingModalVisible}
        onCancel={() => {
          if (!schedulingJob) {
            setSchedulingModalVisible(false)
            form.resetFields()
          }
        }}
        footer={null}
        width={600}
        maskClosable={!schedulingJob}
        closable={!schedulingJob}
      >
        <Spin spinning={schedulingJob} tip="Scheduling job...">
          <Form form={form} layout='vertical' onFinish={handleScheduleSubmit}>
            <Alert
              message="Schedule Information"
              description="Set the start date, end date, and the duration will be calculated automatically. All dates must be today or in the future."
              type="info"
              showIcon
              className="mb-4"
            />
            
            <Form.Item
              name='scheduledStartDate'
              label='Start Date'
              rules={[
                { required: true, message: 'Please select start date' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve()
                    if (value.isBefore(dayjs().startOf('day'))) {
                      return Promise.reject(new Error('Start date cannot be in the past'))
                    }
                    return Promise.resolve()
                  }
                }
              ]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                size='large'
                format='MMM DD, YYYY'
                disabled={schedulingJob}
                disabledDate={disabledStartDate}
                onChange={handleDateChange}
                placeholder='Select start date'
              />
            </Form.Item>

            <Form.Item 
              name='scheduledEndDate' 
              label='End Date (Optional)'
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve()
                    const startDate = form.getFieldValue('scheduledStartDate')
                    if (startDate && value.isBefore(startDate.startOf('day'))) {
                      return Promise.reject(new Error('End date cannot be before start date'))
                    }
                    if (value.isBefore(dayjs().startOf('day'))) {
                      return Promise.reject(new Error('End date cannot be in the past'))
                    }
                    return Promise.resolve()
                  }
                }
              ]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                size='large'
                format='MMM DD, YYYY'
                disabled={schedulingJob}
                disabledDate={disabledEndDate}
                onChange={handleDateChange}
                placeholder='Select end date'
              />
            </Form.Item>

            <Form.Item 
              name='estimatedDuration' 
              label='Estimated Duration (days)'
              tooltip='Automatically calculated from start and end dates, or enter manually'
            >
              <InputNumber 
                min={1} 
                style={{ width: '100%' }} 
                size='large'
                placeholder='e.g., 5 (auto-calculated if end date is set)'
                disabled={schedulingJob}
              />
            </Form.Item>

            {schedulingJob && (
              <div className="mb-4">
                <Progress percent={66} status="active" showInfo={false} />
                <p className="text-center text-gray-600 text-sm mt-2">Updating schedule...</p>
              </div>
            )}

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button 
                  onClick={() => {
                    setSchedulingModalVisible(false)
                    form.resetFields()
                  }}
                  disabled={schedulingJob}
                >
                  Cancel
                </Button>
                <Button 
                  type='primary' 
                  htmlType='submit'
                  loading={schedulingJob}
                  disabled={schedulingJob}
                  size='large'
                >
                  {schedulingJob ? 'Scheduling...' : 'Save Schedule'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>Update Job Status</span>
          </Space>
        }
        open={statusModalVisible}
        onCancel={() => {
          if (!updatingStatus) {
            setStatusModalVisible(false)
          }
        }}
        footer={null}
        maskClosable={!updatingStatus}
        closable={!updatingStatus}
      >
        <Spin spinning={updatingStatus} tip="Updating status...">
          <Form layout='vertical' onFinish={handleStatusSubmit}>
            <Alert
              message="Current Status"
              description={
                <Space>
                  <span>Current status:</span>
                  <Tag color={jobsService.getStatusColor(job.status)}>
                    {jobsService.getStatusLabel(job.status)}
                  </Tag>
                </Space>
              }
              type="info"
              showIcon
              className="mb-4"
            />
            
            <Form.Item
              name='status'
              label='Select New Status'
              rules={[{ required: true, message: 'Please select a status' }]}
            >
              <Select 
                size='large'
                placeholder='Choose a status...'
                disabled={updatingStatus}
              >
                <Select.Option value='deposit_paid'>💰 Deposit Paid</Select.Option>
                <Select.Option value='selections_complete'>
                  ✓ Selections Complete
                </Select.Option>
                <Select.Option value='scheduled'>📅 Scheduled</Select.Option>
                <Select.Option value='in_progress'>🚧 In Progress</Select.Option>
                <Select.Option value='paused'>⏸️ Paused</Select.Option>
                <Select.Option value='completed'>✅ Completed</Select.Option>
                <Select.Option value='on_hold'>⏳ On Hold</Select.Option>
              </Select>
            </Form.Item>

            {updatingStatus && (
              <div className="mb-4">
                <Progress percent={66} status="active" showInfo={false} />
                <p className="text-center text-gray-600 text-sm mt-2">Updating job status...</p>
              </div>
            )}

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button 
                  onClick={() => setStatusModalVisible(false)}
                  disabled={updatingStatus}
                >
                  Cancel
                </Button>
                <Button 
                  type='primary' 
                  htmlType='submit'
                  loading={updatingStatus}
                  disabled={updatingStatus}
                  size='large'
                >
                  {updatingStatus ? 'Updating...' : 'Update Status'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </div>
  )
}

export default JobDetailPage
