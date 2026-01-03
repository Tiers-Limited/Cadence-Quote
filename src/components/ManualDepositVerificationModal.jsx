import { Modal, Form, InputNumber, Select, Input, DatePicker, message } from 'antd';
import { useState } from 'react';
import { apiService } from '../services/apiService';

const { Option } = Select;
const { TextArea } = Input;

function ManualDepositVerificationModal({ visible, onClose, quote, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      
      const payload = {
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        transactionId: values.transactionId || null,
        notes: values.notes || null,
        receivedDate: values.receivedDate ? values.receivedDate.format('YYYY-MM-DD') : null
      };

      const response = await apiService.post(
        `/contractor-portal/proposals/${quote.id}/verify-deposit`,
        payload
      );

      if (response.success) {
        message.success('Deposit verified successfully! Portal is now open for customer.');
        form.resetFields();
        onSuccess && onSuccess();
        onClose();
      }
    } catch (error) {
      message.error('Failed to verify deposit: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Verify Deposit Received"
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Verify Deposit"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          amount: quote?.depositAmount || 0,
          paymentMethod: 'cash',
          receivedDate: null
        }}
      >
        <Form.Item
          name="amount"
          label="Amount Received"
          rules={[
            { required: true, message: 'Please enter the amount received' },
            { type: 'number', min: 0.01, message: 'Amount must be greater than 0' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            precision={2}
            addonBefore="$"
            placeholder="0.00"
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
            <Option value="zelle">Zelle</Option>
            <Option value="venmo">Venmo</Option>
            <Option value="cashapp">Cash App</Option>
            <Option value="wire_transfer">Wire Transfer</Option>
            <Option value="other">Other</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="transactionId"
          label="Check Number / Transaction ID"
          help="Optional - Enter check number or transaction reference"
        >
          <Input placeholder="e.g., Check #1234 or Transaction ID" />
        </Form.Item>

        <Form.Item
          name="receivedDate"
          label="Date Received"
          help="Optional - When was the payment received?"
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="notes"
          label="Notes"
          help="Optional - Any additional information"
        >
          <TextArea
            rows={3}
            placeholder="e.g., Received at office, customer hand-delivered..."
          />
        </Form.Item>
      </Form>

      <div style={{ 
        marginTop: 16, 
        padding: 12, 
        background: '#f0f9ff', 
        border: '1px solid #3b82f6',
        borderRadius: 4 
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
          <strong>Note:</strong> Verifying the deposit will automatically open the customer portal 
          for product selections. The customer will receive an email notification.
        </p>
      </div>
    </Modal>
  );
}

export default ManualDepositVerificationModal;
