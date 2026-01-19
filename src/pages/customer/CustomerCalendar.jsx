import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Space, Button, Select, Tag, message, Spin } from 'antd';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ArrowLeftOutlined, CalendarOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import { magicLinkApiService } from '../../services/magicLinkApiService';

const { Title, Text } = Typography;
const { Option } = Select;
const localizer = momentLocalizer(moment);

/**
 * Customer-facing Job Calendar (view-only)
 * Displays scheduled, in-progress, and completed jobs for the customer
 */
function CustomerCalendar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchCalendarEvents();
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      // Use magicLinkApiService directly for customer portal endpoints
      const response = await magicLinkApiService.get('/api/customer-portal/jobs/calendar');

      if (response.success) {
        const formattedEvents = response.data
          .filter(job => job.start)
          .map(job => ({
            id: job.id,
            title: `${job.jobNumber} - ${job.customerName}`,
            start: new Date(job.start),
            end: job.end ? new Date(job.end) : new Date(job.start),
            status: job.status,
            jobNumber: job.jobNumber,
            customerName: job.customerName,
            duration: job.duration
          }));

        setEvents(formattedEvents);
      } else {
        message.error(response.message || 'Failed to load calendar');
      }
    } catch (error) {
      console.error('Customer calendar error:', error);
      message.error('Failed to load calendar: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event) => {
    navigate(`/portal/job/${event.id}`);
  };

  const eventStyleGetter = (event) => {
    const colors = {
      scheduled: '#722ed1',
      in_progress: '#1890ff',
      completed: '#52c41a'
    };
    const backgroundColor = colors[event.status] || '#1890ff';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.85,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '13px',
        fontWeight: 500
      }
    };
  };

  const getStatusLabel = (status) => {
    const labels = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return labels[status] || status;
  };

  const filteredEvents = statusFilter === 'all'
    ? events
    : events.filter(e => e.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading calendar..." />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/portal/dashboard')}
          className="mb-4"
        >
          Back to Dashboard
        </Button>
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <Title level={2}>
              <CalendarOutlined /> Job Calendar
            </Title>
            <Text type="secondary">
              View your scheduled jobs and timelines
            </Text>
          </div>

          <Space wrap>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 180 }}
            >
              <Option value="all">All Statuses</Option>
              <Option value="scheduled">Scheduled</Option>
              <Option value="in_progress">In Progress</Option>
              <Option value="completed">Completed</Option>
            </Select>

            <Select
              value={view}
              onChange={setView}
              style={{ width: 120 }}
            >
              <Option value="month">Month</Option>
              <Option value="week">Week</Option>
              <Option value="day">Day</Option>
              <Option value="agenda">Agenda</Option>
            </Select>
          </Space>
        </div>
      </div>

      {/* Legend */}
      <Card className="mb-4">
        <Space wrap>
          <Text strong>Status Legend:</Text>
          <Tag color="#722ed1">Scheduled</Tag>
          <Tag color="#1890ff">In Progress</Tag>
          <Tag color="#52c41a">Completed</Tag>
        </Space>
      </Card>

      {/* Calendar */}
      <Card>
        <div style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            popup
            tooltipAccessor={event =>
              `${event.jobNumber}\n${event.customerName}\nStatus: ${getStatusLabel(event.status)}`
            }
          />
        </div>
      </Card>

      {filteredEvents.length === 0 && (
        <Card className="mt-4">
          <div className="text-center py-8">
            <Text type="secondary">No scheduled jobs found</Text>
          </div>
        </Card>
      )}
    </div>
  );
}

export default CustomerCalendar;

