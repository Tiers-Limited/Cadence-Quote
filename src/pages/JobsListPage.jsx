// pages/JobsListPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Row,
  Col,
  message,
  Typography,
  Spin,
  Tabs,
  Checkbox,
  Grid,
  Drawer
} from 'antd';
import {
  CalendarOutlined,
  SearchOutlined,
  FolderOutlined,
  FileTextOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { jobsService } from '../services/jobsService';
import UpdateJobStatusModal from '../components/AdminActions/UpdateJobStatusModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

function JobsListPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 6,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    scheduledDate: 'all',
    assignedTo: 'all',
    search: ''
  });
  const [updateStatusModalVisible, setUpdateStatusModalVisible] = useState(false);
  const [selectedJobForAction, setSelectedJobForAction] = useState(null);

  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, [pagination.current, filters, activeTab]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const statusFilter = activeTab === 'all' ? undefined : getStatusFromTab(activeTab);
      
      const response = await jobsService.getAllJobs({
        page: pagination.current,
        limit: pagination.pageSize,
        status: statusFilter || (filters.status !== 'all' ? filters.status : undefined),
        search: filters.search
      });

      if (response.success) {
        setJobs(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total
        }));
      }
    } catch (error) {
      message.error('Failed to load jobs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await jobsService.getJobStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const getStatusFromTab = (tab) => {
    const tabMap = {
      'not-scheduled': 'deposit_paid',
      'scheduled': 'scheduled',
      'in-progress': 'in_progress',
      'completed': 'completed',
      'closed': 'canceled'
    };
    return tabMap[tab];
  };

  const getStatusBadgeColor = (status) => {
    const colorMap = {
      'deposit_paid': 'orange',
      'scheduled': 'blue',
      'in_progress': 'purple',
      'completed': 'green',
      'canceled': 'default'
    };
    return colorMap[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labelMap = {
      'deposit_paid': 'Not Scheduled',
      'selections_complete': 'Not Scheduled',
      'scheduled': 'Scheduled',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'canceled': 'Closed'
    };
    return labelMap[status] || status;
  };

  const getActionButton = (record) => {
    const buttonSize = isMobile ? 'small' : 'middle';
    
    return (
      <Space direction={isMobile ? 'vertical' : 'horizontal'} size="small" style={{ width: '100%' }}>
        {record.status === 'deposit_paid' || record.status === 'selections_complete' ? (
          <Button 
            type="default" 
            size={buttonSize}
            style={{ backgroundColor: '#FFF4E6', borderColor: '#FFD591', color: '#FA8C16', width: isMobile ? '100%' : 'auto' }}
            onClick={() => navigate(`/jobs/${record.id}`)}
          >
            Schedule Job
          </Button>
        ) : record.status === 'scheduled' ? (
          <Button 
            type="primary" 
            size={buttonSize}
            icon={!isMobile && <CalendarOutlined />}
            onClick={() => navigate(`/jobs/${record.id}`)}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            Reschedule
          </Button>
        ) : record.status === 'in_progress' ? (
          <Button 
            type="default"
            size={buttonSize}
            icon={!isMobile && <CheckCircleOutlined />}
            onClick={() => navigate(`/jobs/${record.id}`)}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            Mark Complete
          </Button>
        ) : (
          <Button 
            type="default"
            size={buttonSize}
            icon={!isMobile && <FolderOutlined />}
            onClick={() => navigate(`/jobs/${record.id}`)}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            View Job
          </Button>
        )}
        
        {/* Admin Status Update Button */}
        <Button
          type="link"
          size={buttonSize}
          icon={<EditOutlined />}
          onClick={() => {
            setSelectedJobForAction(record);
            setUpdateStatusModalVisible(true);
          }}
          title="Update Status"
        />
      </Space>
    );
  };

  const columns = [
    {
      title: 'Job ID',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
      width: isMobile ? 120 : 250,
      render: (text) => <span style={{ color: '#262626' }}>{text}</span>
     
    },
    {
      title: 'Job Name',
      dataIndex: 'jobName',
      key: 'jobName',
      width: isMobile ? 200 : 250,
      render: (text, record) => {
        return (
          <div>
            <div style={{ fontWeight: 500, color: '#262626' }}>{record.jobName}</div>
            {!isMobile && (
              <>
                <div style={{ fontSize: '12px', color: '#8C8C8C' }}>
                  {record.client ? record.client.email : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: '#8C8C8C' }}>
                  {record.client ? record.client.name : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: '#8C8C8C' }}>
                  {record.client ? record.client.phone : 'N/A'}
                </div>
              </>
            )}
          </div>
        );
      }
    },
    ...(!isMobile ? [{
      title: 'Address',
      dataIndex: 'jobAddress',
      width: 300,
      key: 'jobAddress',
      render: (text, record) => {
        const fullAddress = text || (
          record.client 
            ? [record.client.street, record.client.city, record.client.state, record.client.zip]
                .filter(Boolean)
                .join(', ')
            : null
        );
        
        return (
          <div>
            <div style={{ color: '#262626' }}>{fullAddress || 'N/A'}</div>
            <div style={{ fontSize: '12px', color: '#8C8C8C' }}>
              {record.client.city}, {record.client.state}
            </div>
          </div>
        );
      }
    }] : []),
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 100 : 'auto',
      render: (status) => (
        <Tag color={getStatusBadgeColor(status)} style={{ borderRadius: '4px' }}>
          {getStatusLabel(status)}
        </Tag>
      )
    },
    ...(!isMobile ? [{
      title: 'Start Date',
      dataIndex: 'scheduledStartDate',
      width: 180,
      key: 'scheduledStartDate',
      render: (date, record) => {
        if (!date) {
          return <span style={{ color: '#8C8C8C' }}>—</span>;
        }
        const startDate = new Date(date);
        const endDate = record.scheduledEndDate ? new Date(record.scheduledEndDate) : null;
        
        if (endDate && record.status === 'completed') {
          return (
            <div>
              <div>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div style={{ fontSize: '12px', color: '#8C8C8C' }}>
                {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          );
        }
        return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }] : []),
    {
      title: 'Action',
      key: 'action',
      align: 'center',
      width: isMobile ? 150 : 'auto',
      render: (_, record) => getActionButton(record)
    }
  ];

  const tabItems = [
    {
      key: 'all',
      label: isMobile ? `All (${stats?.total || 0})` : `All (${stats?.total || 0})`,
    },
    {
      key: 'not-scheduled',
      label: isMobile ? `Not Sched. (${stats?.selectionsNeeded || 0})` : `Not Scheduled (${stats?.selectionsNeeded || 0})`,
    },
    {
      key: 'scheduled',
      label: `Scheduled (${stats?.scheduled || 0})`,
    },
    {
      key: 'in-progress',
      label: isMobile ? `In Prog. (${stats?.inProgress || 0})` : `In Progress (${stats?.inProgress || 0})`,
    },
    {
      key: 'completed',
      label: `Completed (${stats?.completed || 0})`,
    },
    {
      key: 'closed',
      label: `Closed (0)`,
    }
  ];

  const FilterContent = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Select
        value={filters.status}
        onChange={(value) => setFilters({ ...filters, status: value })}
        style={{ width: '100%' }}
      >
        <Option value="all">Status: All</Option>
        <Option value="deposit_paid">Not Scheduled</Option>
        <Option value="scheduled">Scheduled</Option>
        <Option value="in_progress">In Progress</Option>
        <Option value="completed">Completed</Option>
      </Select>

      <Select
        value={filters.scheduledDate}
        onChange={(value) => setFilters({ ...filters, scheduledDate: value })}
        style={{ width: '100%' }}
      >
        <Option value="all">Scheduled Date: All</Option>
        <Option value="today">Today</Option>
        <Option value="week">This Week</Option>
        <Option value="month">This Month</Option>
      </Select>

      <Select
        value={filters.assignedTo}
        onChange={(value) => setFilters({ ...filters, assignedTo: value })}
        style={{ width: '100%' }}
      >
        <Option value="all">Assigned To: All</Option>
        <Option value="unassigned">Unassigned</Option>
      </Select>
    </Space>
  );

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', backgroundColor: '#F5F5F5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
        <Title level={3} style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 600 }}>Jobs</Title>
        <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
          Manage and schedule all your booked jobs from start to finish.
        </Text>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={[8, 8]} style={{ marginBottom: isMobile ? '16px' : '24px' }}>
          <Col xs={12} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', borderRadius: '8px' }}>
              <FolderOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#1890FF', marginBottom: '8px' }} />
              <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 600, color: '#262626' }}>{stats.total}</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#8C8C8C' }}>Total Jobs</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', borderRadius: '8px' }}>
              <FileTextOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#FA8C16', marginBottom: '8px' }} />
              <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 600, color: '#262626' }}>{stats.selectionsNeeded}</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#8C8C8C' }}>Not Scheduled</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', borderRadius: '8px' }}>
              <CalendarOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#1890FF', marginBottom: '8px' }} />
              <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 600, color: '#262626' }}>{stats.scheduled}</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#8C8C8C' }}>Scheduled</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', borderRadius: '8px' }}>
              <CalendarOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#52C41A', marginBottom: '8px' }} />
              <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 600, color: '#262626' }}>{stats.inProgress}</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#8C8C8C' }}>In Progress</div>
            </Card>
          </Col>
          <Col xs={12} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', borderRadius: '8px' }}>
              <TeamOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#8C8C8C', marginBottom: '8px' }} />
              <div style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 600, color: '#262626' }}>{stats.completed}</div>
              <div style={{ fontSize: isMobile ? '12px' : '14px', color: '#8C8C8C' }}>Closed</div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Content Card */}
      <Card style={{ borderRadius: '8px' }}>
        {/* Tabs */}
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={tabItems}
          style={{ marginBottom: '16px' }}
          size={isMobile ? 'small' : 'middle'}
        />

        {/* Filters */}
        {isMobile ? (
          <Row gutter={16} style={{ marginBottom: '16px' }} align="middle">
            <Col flex="auto">
              <Button 
                icon={<FilterOutlined />} 
                onClick={() => setFilterDrawerVisible(true)}
                block
              >
                Filters
              </Button>
            </Col>
            <Col>
              <Button icon={<SearchOutlined />} />
            </Col>
          </Row>
        ) : (
          <Row gutter={16} style={{ marginBottom: '16px' }} align="middle">
            <Col flex="auto">
              <Space size="middle" wrap>
                <Select
                  value={filters.status}
                  onChange={(value) => setFilters({ ...filters, status: value })}
                  style={{ width: 150 }}
                >
                  <Option value="all">Status: All</Option>
                  <Option value="deposit_paid">Not Scheduled</Option>
                  <Option value="scheduled">Scheduled</Option>
                  <Option value="in_progress">In Progress</Option>
                  <Option value="completed">Completed</Option>
                </Select>

                <Select
                  value={filters.scheduledDate}
                  onChange={(value) => setFilters({ ...filters, scheduledDate: value })}
                  style={{ width: 180 }}
                >
                  <Option value="all">Scheduled Date: All</Option>
                  <Option value="today">Today</Option>
                  <Option value="week">This Week</Option>
                  <Option value="month">This Month</Option>
                </Select>

                <Select
                  value={filters.assignedTo}
                  onChange={(value) => setFilters({ ...filters, assignedTo: value })}
                  style={{ width: 170 }}
                >
                  <Option value="all">Assigned To: All</Option>
                  <Option value="unassigned">Unassigned</Option>
                </Select>
              </Space>
            </Col>
            <Col>
              <Button icon={<SearchOutlined />} />
            </Col>
          </Row>
        )}

        {/* Table */}
        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          scroll={{ x: isMobile ? 800 : 'auto' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page) => setPagination({ ...pagination, current: page }),
            showSizeChanger: false,
            showTotal: (total, range) => `Showing ${range[0]}-${range[1]} of ${total}`,
            size: isMobile ? 'small' : 'default'
          }}
        />
      </Card>

      {/* Mobile Filter Drawer */}
      <Drawer
        title="Filters"
        placement="right"
        onClose={() => setFilterDrawerVisible(false)}
        open={filterDrawerVisible}
        width={isMobile ? '80%' : 400}
      >
        <FilterContent />
      </Drawer>

      {/* Admin Status Update Modal */}
      <UpdateJobStatusModal
        visible={updateStatusModalVisible}
        onCancel={() => {
          setUpdateStatusModalVisible(false);
          setSelectedJobForAction(null);
        }}
        onSuccess={() => {
          fetchJobs();
          fetchStats();
        }}
        job={selectedJobForAction}
      />
    </div>
  );
}

export default JobsListPage;
