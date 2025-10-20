import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Card, message, Popconfirm, Tag, Tooltip, Space } from 'antd'
import { FiFileText, FiPlus, FiEdit2, FiTrash2, FiCopy, FiExternalLink } from 'react-icons/fi'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'

function LeadFormsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [leadForms, setLeadForms] = useState([])

  useEffect(() => {
    fetchLeadForms()
  }, [])

  const fetchLeadForms = async () => {
    setLoading(true)
    try {
      const response = await apiService.get('/lead-forms')
      if (response.success) {
        setLeadForms(response.data)
      }
    } catch (error) {
      message.error('Failed to load lead forms: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (formId) => {
    try {
      const response = await apiService.delete(`/lead-forms/${formId}`)
      if (response.success) {
        message.success('Lead form deleted successfully')
        fetchLeadForms()
      }
    } catch (error) {
      message.error('Failed to delete lead form: ' + error.message)
    }
  }

  const handleCopyUrl = (publicUrl) => {
    const fullUrl = `${window.location.origin}/lead/${publicUrl}`
    navigator.clipboard.writeText(fullUrl)
    message.success('Public URL copied to clipboard!')
  }

  const handleOpenPublicForm = (publicUrl) => {
    window.open(`/lead/${publicUrl}`, '_blank')
  }

  const columns = [
    {
      title: 'Form Name',
      dataIndex: 'formName',
      key: 'formName',
      render: (name) => <span className="font-semibold">{name}</span>,
    },
    {
      title: 'Form Title',
      dataIndex: 'formTitle',
      key: 'formTitle',
    },
    {
      title: 'Fields',
      dataIndex: 'formFields',
      key: 'formFields',
      render: (fields) => `${fields?.length || 0} fields`,
    },
    {
      title: 'Submissions',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
      sorter: (a, b) => a.submissionCount - b.submissionCount,
      render: (count) => (
        <Tag color="blue">{count || 0}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Public URL',
      dataIndex: 'publicUrl',
      key: 'publicUrl',
      render: (url) => (
        <Space>
          <Tooltip title="Copy URL">
            <Button
              type="text"
              size="small"
              icon={<FiCopy />}
              onClick={() => handleCopyUrl(url)}
            />
          </Tooltip>
          <Tooltip title="Open in new tab">
            <Button
              type="text"
              size="small"
              icon={<FiExternalLink />}
              onClick={() => handleOpenPublicForm(url)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<FiEdit2 />}
            onClick={() => navigate(`/lead-forms/edit/${record.id}`)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Lead Form"
            description="Are you sure? This will not delete existing submissions."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<FiTrash2 />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <MainLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FiFileText className="text-3xl text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">Lead Forms</h1>
              </div>
              <p className="text-gray-600">
                Create custom lead capture forms with unique public URLs
              </p>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<FiPlus />}
              onClick={() => navigate('/lead-forms/create')}
            >
              Create Lead Form
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-gray-600 text-sm mb-1">Total Forms</div>
            <div className="text-3xl font-bold text-gray-900">
              {leadForms.length}
            </div>
          </Card>
          <Card>
            <div className="text-gray-600 text-sm mb-1">Active Forms</div>
            <div className="text-3xl font-bold text-green-600">
              {leadForms.filter(f => f.isActive).length}
            </div>
          </Card>
          <Card>
            <div className="text-gray-600 text-sm mb-1">Total Submissions</div>
            <div className="text-3xl font-bold text-blue-600">
              {leadForms.reduce((sum, f) => sum + (f.submissionCount || 0), 0)}
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={leadForms}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} forms`,
            }}
          />
        </Card>
      </div>
    </MainLayout>
  )
}

export default LeadFormsPage
