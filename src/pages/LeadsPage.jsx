import { useState, useEffect } from 'react'
import { Table, Card, Select, Tag, Button, Modal, Form, Input, message, Space } from 'antd'
import { FiMail, FiPhone, FiCalendar } from 'react-icons/fi'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'

const { TextArea } = Input
const { Option } = Select

const STATUS_COLORS = {
  new: 'blue',
  contacted: 'cyan',
  qualified: 'green',
  quoted: 'orange',
  won: 'success',
  lost: 'default',
}

function LeadsPage() {
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [filters, setFilters] = useState({
    status: null,
    leadFormId: null,
  })

  useEffect(() => {
    fetchLeads()
    fetchStats()
  }, [filters])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.leadFormId) params.append('leadFormId', filters.leadFormId)
      
      const response = await apiService.get(`/leads?${params.toString()}`)
      if (response.success) {
        setLeads(response.data.leads)
      }
    } catch (error) {
      message.error('Failed to load leads: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiService.get('/leads/stats')
      if (response.success) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleViewLead = async (leadId) => {
    try {
      const response = await apiService.get(`/leads/${leadId}`)
      if (response.success) {
        setSelectedLead(response.data)
        form.setFieldsValue({
          status: response.data.status,
          notes: response.data.notes,
        })
        setIsModalVisible(true)
      }
    } catch (error) {
      message.error('Failed to load lead details: ' + error.message)
    }
  }

  const handleUpdateLead = async (values) => {
    try {
      const response = await apiService.put(`/leads/${selectedLead.id}`, values)
      if (response.success) {
        message.success('Lead updated successfully')
        setIsModalVisible(false)
        fetchLeads()
        fetchStats()
      }
    } catch (error) {
      message.error('Failed to update lead: ' + error.message)
    }
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => record.formData?.fullName || 'N/A',
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div className="space-y-1">
          {record.formData?.email && (
            <div className="flex items-center gap-1 text-sm">
              <FiMail className="text-gray-400" />
              {record.formData.email}
            </div>
          )}
          {record.formData?.phone && (
            <div className="flex items-center gap-1 text-sm">
              <FiPhone className="text-gray-400" />
              {record.formData.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Form',
      dataIndex: 'LeadForm',
      key: 'form',
      render: (form) => form?.formTitle || 'Unknown',
    },
    {
      title: 'Project Type',
      key: 'projectType',
      render: (_, record) => record.formData?.projectType || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>
          {status?.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'New', value: 'new' },
        { text: 'Contacted', value: 'contacted' },
        { text: 'Qualified', value: 'qualified' },
        { text: 'Quoted', value: 'quoted' },
        { text: 'Won', value: 'won' },
        { text: 'Lost', value: 'lost' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewLead(record.id)}>
          View Details
        </Button>
      ),
    },
  ]

  return (
    <MainLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Leads Dashboard</h1>
          <p className="text-gray-600">
            Manage and track your incoming leads
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="text-gray-600 text-sm mb-1">Total Leads</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            </Card>
            <Card>
              <div className="text-gray-600 text-sm mb-1">Recent (7 days)</div>
              <div className="text-3xl font-bold text-blue-600">{stats.recent}</div>
            </Card>
            <Card>
              <div className="text-gray-600 text-sm mb-1">Qualified</div>
              <div className="text-3xl font-bold text-green-600">
                {stats.byStatus?.find(s => s.status === 'qualified')?.count || 0}
              </div>
            </Card>
            <Card>
              <div className="text-gray-600 text-sm mb-1">Won</div>
              <div className="text-3xl font-bold text-success">
                {stats.byStatus?.find(s => s.status === 'won')?.count || 0}
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Filter by Status</label>
              <Select
                style={{ width: '100%' }}
                placeholder="All Statuses"
                allowClear
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
              >
                <Option value="new">New</Option>
                <Option value="contacted">Contacted</Option>
                <Option value="qualified">Qualified</Option>
                <Option value="quoted">Quoted</Option>
                <Option value="won">Won</Option>
                <Option value="lost">Lost</Option>
              </Select>
            </div>
          </div>
        </Card>

        {/* Leads Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={leads}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} leads`,
            }}
          />
        </Card>

        {/* Lead Detail Modal */}
        <Modal
          title="Lead Details"
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          width={700}
        >
          {selectedLead && (
            <div>
              {/* Lead Info */}
              <Card className="mb-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <div className="text-lg font-semibold">{selectedLead.formData?.fullName}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Source</label>
                    <div className="text-lg">{selectedLead.LeadForm?.formTitle}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <div className="flex items-center gap-2">
                      <FiMail className="text-gray-400" />
                      {selectedLead.formData?.email}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone</label>
                    <div className="flex items-center gap-2">
                      <FiPhone className="text-gray-400" />
                      {selectedLead.formData?.phone || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Submitted</label>
                    <div className="flex items-center gap-2">
                      <FiCalendar className="text-gray-400" />
                      {new Date(selectedLead.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* All Form Data */}
                <div className="mt-4 pt-4 border-t">
                  <label className="text-sm font-medium text-gray-600 block mb-2">
                    Additional Information
                  </label>
                  <div className="space-y-2">
                    {Object.entries(selectedLead.formData || {}).map(([key, value]) => {
                      if (['fullName', 'email', 'phone'].includes(key)) return null
                      return (
                        <div key={key} className="flex gap-2">
                          <span className="text-sm text-gray-600 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="text-sm font-medium">{value}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>

              {/* Update Form */}
              <Form
                form={form}
                layout="vertical"
                onFinish={handleUpdateLead}
              >
                <Form.Item
                  label="Status"
                  name="status"
                  rules={[{ required: true }]}
                >
                  <Select size="large">
                    <Option value="new">New</Option>
                    <Option value="contacted">Contacted</Option>
                    <Option value="qualified">Qualified</Option>
                    <Option value="quoted">Quoted</Option>
                    <Option value="won">Won</Option>
                    <Option value="lost">Lost</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Notes"
                  name="notes"
                >
                  <TextArea
                    rows={4}
                    placeholder="Add notes about this lead..."
                  />
                </Form.Item>

                <div className="flex justify-end gap-3">
                  <Button onClick={() => setIsModalVisible(false)}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit">
                    Update Lead
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  )
}

export default LeadsPage
