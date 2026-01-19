// components/JobProgressTracker.jsx
import { useState } from 'react';
import { List, Select, Tag, Space, message, Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { jobsService } from '../services/jobsService';

const { Text } = Typography;
const { Option } = Select;

function JobProgressTracker({ jobId, job, onProgressUpdate }) {
  const [updating, setUpdating] = useState({});

  const handleStatusChange = async (areaId, newStatus) => {
    try {
      setUpdating(prev => ({ ...prev, [areaId]: true }));
      
      const response = await jobsService.updateAreaProgress(jobId, areaId, newStatus);
      
      if (response.success) {
        message.success('Area progress updated');
        // Wait a bit for DB to commit, then refresh
        await new Promise(resolve => setTimeout(resolve, 100));
        if (onProgressUpdate) {
          await onProgressUpdate();
        }
      }
    } catch (error) {
      message.error('Failed to update progress: ' + error.message);
    } finally {
      setUpdating(prev => ({ ...prev, [areaId]: false }));
    }
  };

  const getAreaStatus = (areaId) => {
    if (!job.areaProgress || !job.areaProgress[areaId]) {
      return 'not_started';
    }
    return job.areaProgress[areaId].status;
  };

  const areas = job.quote?.areas || [];

  if (areas.length === 0) {
    return <Text type="secondary">No areas defined for this job</Text>;
  }

  return (
    <List
      dataSource={areas}
      renderItem={(area) => {
        const currentStatus = getAreaStatus(area.id);
        const isCompleted = currentStatus === 'completed';
        
        return (
          <List.Item
            style={{
              backgroundColor: isCompleted ? '#f6ffed' : 'transparent',
              border: isCompleted ? '1px solid #b7eb8f' : 'none',
              borderRadius: 4,
              marginBottom: 8,
              padding: 12
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
                
                <Space>
                  <Tag color={jobsService.getAreaStatusColor(currentStatus)}>
                    {jobsService.getAreaStatusLabel(currentStatus)}
                  </Tag>
                  
                  <Select
                    value={currentStatus}
                    onChange={(value) => handleStatusChange(area.id, value)}
                    loading={updating[area.id]}
                    disabled={updating[area.id]}
                    style={{ width: 150 }}
                    size="small"
                  >
                    <Option value="not_started">Not Started</Option>
                    <Option value="prepped">Prepped</Option>
                    <Option value="in_progress">In Progress</Option>
                    <Option value="touch_ups">Touch-Ups</Option>
                    <Option value="completed">Completed</Option>
                  </Select>
                </Space>
              </Space>
            </div>
          </List.Item>
        );
      }}
    />
  );
}

export default JobProgressTracker;
