// components/AdminActions/MarkDepositPaidModal.jsx
// Modal for contractor admin to mark deposit as paid (non-Stripe)

import React, { useState } from 'react';
import { Modal, Form, Select, Input, message } from 'antd';
import { DollarCircleOutlined } from '@ant-design/icons';
import { adminStatusService } from '../../services/adminStatusService';

const { Option } = Select;
const { TextArea } = Input;

function MarkDepositPaidModal({ visible, onCancel, onSuccess, quote }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const response = await adminStatusService.markDepositPaid(quote.id, {
        paymentMethod: values.paymentMethod,
        notes: values.notes || null
      });

      if (response.success) {
        message.success('Deposit marked as paid successfully');
        form.resetFields();
        onSuccess?.();
        onCancel();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to mark deposit as paid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <DollarCircleOutlined style={{ marginRight: 8 }} />
          Mark Deposit as Paid
        </span>
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          paymentMethod: 'cash'
        }}
      >
        <Form.Item label="Quote Number">
          <Input value={quote?.quoteNumber} disabled />
        </Form.Item>

        <Form.Item label="Customer Name">
          <Input value={quote?.customerName} disabled />
        </Form.Item>

        <Form.Item label="Deposit Amount">
          <Input 
            value={`$${parseFloat(quote?.depositAmount || 0).toFixed(2)}`} 
            disabled 
          />
        </Form.Item>

        <Form.Item
          name="paymentMethod"
          label="Payment Method"
          rules={[{ required: true, message: 'Please select a payment method' }]}
        >
          <Select placeholder="Select payment method">
            <Option value="cash">Cash</Option>
            <Option value="check">Check</Option>
            <Option value="bank_transfer">Bank Transfer</Option>
            <Option value="money_order">Money Order</Option>
            <Option value="other">Other</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="notes"
          label="Notes (Optional)"
        >
          <TextArea
            rows={4}
            placeholder="Add any additional notes about this payment..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default MarkDepositPaidModal;

