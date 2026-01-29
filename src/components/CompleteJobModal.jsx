import { useState } from 'react';
import { Modal, Form, InputNumber, Input, message, Alert, Space, Typography } from 'antd';
import { CheckCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { apiService } from '../services/apiService';

const { Text } = Typography;
const { TextArea } = Input;

const CompleteJobModal = ({ visible, onCancel, job, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      // Call the job completion endpoint
      const data = await apiService.post(`/jobs/${job.id}/complete`, {
        finalInvoiceAmount: values.finalInvoiceAmount,
        actualMaterialCost: values.actualMaterialCost || null,
        actualLaborCost: values.actualLaborCost || null,
        completionNotes: values.completionNotes || null,
      });

      if (data.success) {
        message.success('Job marked as complete successfully!');
        
        // Show analytics info if calculated
        if (data.job?.quote?.canCalculateAnalytics) {
          message.info('Job analytics are now available on the dashboard', 5);
        }
        
        form.resetFields();
        onSuccess?.();
        onCancel();
      } else {
        message.error(data.message || 'Failed to complete job');
      }
    } catch (error) {
      console.error('Error completing job:', error);
      message.error(error.message || 'Failed to complete job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span>Mark Job as Complete</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Complete Job"
      okButtonProps={{ 
        loading,
        icon: <CheckCircleOutlined />,
        type: 'primary',
        style: { background: '#52c41a', borderColor: '#52c41a' }
      }}
      cancelButtonProps={{ disabled: loading }}
      width={600}
      destroyOnClose
    >
      <Alert
        message="Job Completion & Analytics"
        description="Completing this job will enable Job Analytics on your dashboard. Provide actual costs for accurate profit margin tracking."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          finalInvoiceAmount: job?.total || job?.quote?.total || 0
        }}
      >
        <Form.Item
          name="finalInvoiceAmount"
          label={
            <Space>
              <DollarOutlined />
              <span>Final Invoice Amount</span>
            </Space>
          }
          rules={[
            { required: true, message: 'Please enter the final invoice amount' },
            { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }
          ]}
          tooltip="The total amount invoiced to the customer for this completed job"
        >
          <InputNumber
            style={{ width: '100%' }}
            prefix="$"
            min={0}
            step={0.01}
            precision={2}
            placeholder="Enter final invoice amount"
          />
        </Form.Item>

        <Alert
          message="Optional: Actual Costs for Analytics"
          description="Providing actual material and labor costs enables accurate profit margin analysis. Leave blank if not tracked."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          name="actualMaterialCost"
          label="Actual Material Cost (Optional)"
          tooltip="Total cost of materials purchased for this job. Used for analytics only."
        >
          <InputNumber
            style={{ width: '100%' }}
            prefix="$"
            min={0}
            step={0.01}
            precision={2}
            placeholder="Enter actual material cost"
          />
        </Form.Item>

        <Form.Item
          name="actualLaborCost"
          label="Actual Labor Cost (Optional)"
          tooltip="Total labor cost for this job. Used for analytics only."
        >
          <InputNumber
            style={{ width: '100%' }}
            prefix="$"
            min={0}
            step={0.01}
            precision={2}
            placeholder="Enter actual labor cost"
          />
        </Form.Item>

        <Form.Item
          name="completionNotes"
          label="Completion Notes (Optional)"
          tooltip="Any notes about the job completion"
        >
          <TextArea
            rows={3}
            placeholder="Enter any notes about the job completion..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Alert
          message="What happens next?"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>Job status will be updated to "Completed"</li>
              <li>Job Analytics will be calculated automatically (if overhead is configured)</li>
              <li>Analytics will appear on your Dashboard</li>
              <li>Customer will be notified if balance is due</li>
            </ul>
          }
          type="success"
          showIcon
        />
      </Form>
    </Modal>
  );
};

export default CompleteJobModal;
