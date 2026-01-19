// components/AdminActions/UpdateJobStatusModal.jsx
// Modal for contractor admin to update job status (manual actions)

import React, { useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, message } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { adminStatusService } from '../../services/adminStatusService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function UpdateJobStatusModal({ visible, onCancel, onSuccess, job }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);

  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled', icon: <CalendarOutlined />, requiresDate: true },
    { value: 'in_progress', label: 'In Progress', icon: <PlayCircleOutlined /> },
    { value: 'completed', label: 'Completed', icon: <CheckCircleOutlined /> },
    { value: 'closed', label: 'Closed', icon: <CloseCircleOutlined /> }
  ];

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const response = await adminStatusService.updateJobStatus(job.id, {
        status: values.status,
        scheduledStartDate: values.scheduledStartDate ? values.scheduledStartDate.toISOString() : null,
        scheduledEndDate: values.scheduledEndDate ? values.scheduledEndDate.toISOString() : null,
        reason: values.reason || null
      });

      if (response.success) {
        message.success(`Job status updated to "${values.status}" successfully`);
        form.resetFields();
        onSuccess?.();
        onCancel();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to update job status');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    // Clear date fields if status doesn't require them
    const option = statusOptions.find(opt => opt.value === status);
    if (!option?.requiresDate) {
      form.setFieldsValue({ scheduledStartDate: null, scheduledEndDate: null });
    }
  };

  return (
    <Modal
      title="Update Job Status"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item label="Job Number">
          <Input value={job?.jobNumber} disabled />
        </Form.Item>

        <Form.Item label="Current Status">
          <Input value={job?.status?.replace('_', ' ').toUpperCase()} disabled />
        </Form.Item>

        <Form.Item
          name="status"
          label="New Status"
          rules={[{ required: true, message: 'Please select a status' }]}
        >
          <Select 
            placeholder="Select new status"
            onChange={handleStatusChange}
          >
            {statusOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.icon} {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedStatus === 'scheduled' && (
          <>
            <Form.Item
              name="scheduledStartDate"
              label="Scheduled Start Date"
              rules={[{ required: true, message: 'Please select a start date' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm"
                placeholder="Select start date and time"
              />
            </Form.Item>

            <Form.Item
              name="scheduledEndDate"
              label="Scheduled End Date (Optional)"
            >
              <DatePicker
                style={{ width: '100%' }}
                showTime
                format="YYYY-MM-DD HH:mm"
                placeholder="Select end date and time"
              />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="reason"
          label="Notes (Optional)"
        >
          <TextArea
            rows={3}
            placeholder="Add any notes about this status change..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default UpdateJobStatusModal;

