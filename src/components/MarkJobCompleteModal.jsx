import React, { useState } from 'react';
import { Modal, Form, InputNumber, Button, message, Divider } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { apiService } from '../services/apiService';

const MarkJobCompleteModal = ({ visible, onCancel, quote, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      const data = await apiService.post(`/quotes/${quote.id}/complete-job`, {
        finalInvoiceAmount: values.finalInvoiceAmount,
        actualMaterialCost: values.actualMaterialCost || null,
        actualLaborCost: values.actualLaborCost || null
      });

      if (!data.success) {
        throw new Error(data.message || 'Failed to mark job as complete');
      }

      message.success('Job marked as complete successfully!');
      form.resetFields();
      onSuccess(data.data);
      onCancel();

    } catch (error) {
      console.error('Error marking job complete:', error);
      message.error(error.message || 'Failed to mark job as complete');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CheckCircleOutlined className="text-green-600" />
          <span>Mark Job Complete</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={600}
    >
      <div className="mb-4">
        <p className="text-gray-600">
          Mark this job as complete to enable profit margin analytics.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
          <p className="text-sm text-blue-800">
            <strong>Quote #{quote?.quoteNumber}</strong> - {quote?.customerName}
          </p>
          <p className="text-sm text-blue-600">
            Original Total: ${quote?.total?.toLocaleString() || '0'}
          </p>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          finalInvoiceAmount: quote?.total || 0
        }}
      >
        <Form.Item
          name="finalInvoiceAmount"
          label="Final Invoice Amount"
          rules={[
            { required: true, message: 'Final invoice amount is required' },
            { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }
          ]}
          extra="The actual amount invoiced to the customer (may differ from original quote)"
        >
          <InputNumber
            style={{ width: '100%' }}
            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            precision={2}
            placeholder="Enter final invoice amount"
          />
        </Form.Item>

        <Divider>Actual Costs (Optional)</Divider>
        
        <p className="text-sm text-gray-600 mb-4">
          Enter actual costs if tracked during job execution. These will be used for more accurate profit analysis.
        </p>

        <Form.Item
          name="actualMaterialCost"
          label="Actual Material Cost"
          extra="Real material expenses tracked during job execution"
        >
          <InputNumber
            style={{ width: '100%' }}
            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            precision={2}
            placeholder="Enter actual material cost (optional)"
            min={0}
          />
        </Form.Item>

        <Form.Item
          name="actualLaborCost"
          label="Actual Labor Cost"
          extra="Real labor expenses tracked during job execution"
        >
          <InputNumber
            style={{ width: '100%' }}
            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value.replace(/\$\s?|(,*)/g, '')}
            precision={2}
            placeholder="Enter actual labor cost (optional)"
            min={0}
          />
        </Form.Item>

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            className="bg-green-600 hover:bg-green-700 border-green-600"
          >
            Mark Complete
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default MarkJobCompleteModal;