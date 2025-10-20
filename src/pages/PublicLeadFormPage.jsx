import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Form, Input, Button, Select, message, Checkbox, DatePicker, InputNumber, Radio } from 'antd'
import { FiSend, FiCheckCircle } from 'react-icons/fi'
import { apiService } from '../services/apiService'

const { TextArea } = Input
const { Option } = Select

function PublicLeadFormPage() {
  const { publicUrl } = useParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [leadForm, setLeadForm] = useState(null)

  useEffect(() => {
    fetchLeadForm()
  }, [publicUrl])

  const fetchLeadForm = async () => {
    setLoading(true)
    try {
      const response = await apiService.get(`/lead-forms/public/${publicUrl}`)
      if (response.success) {
        setLeadForm(response.data)
      } else {
        message.error('Lead form not found')
      }
    } catch (error) {
      message.error('Failed to load form: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values) => {
    setSubmitting(true)
    try {
      const response = await apiService.post(`/lead-forms/public/${publicUrl}/submit`, {
        formData: values,
      })
      
      if (response.success) {
        setSubmitted(true)
        form.resetFields()
      }
    } catch (error) {
      message.error('Failed to submit form: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field) => {
    const commonProps = {
      size: 'large',
      placeholder: field.placeholder || field.fieldLabel,
    }

    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'tel':
        return <Input {...commonProps} type={field.fieldType} />
      
      case 'number':
        return <InputNumber {...commonProps} style={{ width: '100%' }} />
      
      case 'textarea':
        return <TextArea {...commonProps} rows={4} />
      
      case 'select':
        return (
          <Select {...commonProps} placeholder={`Select ${field.fieldLabel}`}>
            {field.options?.map(option => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
          </Select>
        )
      
      case 'radio':
        return (
          <Radio.Group>
            {field.options?.map(option => (
              <Radio key={option} value={option}>
                {option}
              </Radio>
            ))}
          </Radio.Group>
        )
      
      case 'checkbox':
        return (
          <Checkbox.Group>
            {field.options?.map(option => (
              <Checkbox key={option} value={option}>
                {option}
              </Checkbox>
            ))}
          </Checkbox.Group>
        )
      
      case 'date':
        return <DatePicker {...commonProps} style={{ width: '100%' }} />
      
      default:
        return <Input {...commonProps} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-lg">Loading form...</div>
      </div>
    )
  }

  if (!leadForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h2>
            <p className="text-gray-600">This lead capture form is no longer available.</p>
          </div>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="mb-4">
            <FiCheckCircle className="text-6xl text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600">
              Your inquiry has been submitted successfully. We'll get back to you shortly.
            </p>
          </div>
          <Button
            type="primary"
            size="large"
            onClick={() => setSubmitted(false)}
          >
            Submit Another Response
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            {leadForm.formTitle}
          </h1>
          {leadForm.formDescription && (
            <p className="text-lg text-gray-600">
              {leadForm.formDescription}
            </p>
          )}
        </div>

        {/* Form */}
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="space-y-4"
          >
            {leadForm.formFields?.map((field) => (
              <Form.Item
                key={field.fieldName}
                label={
                  <span className="text-base font-medium">
                    {field.fieldLabel}
                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </span>
                }
                name={field.fieldName}
                rules={[
                  {
                    required: field.isRequired,
                    message: `Please enter ${field.fieldLabel}`,
                  },
                  ...(field.fieldType === 'email' ? [
                    { type: 'email', message: 'Please enter a valid email' }
                  ] : []),
                ]}
              >
                {renderField(field)}
              </Form.Item>
            ))}

            <div className="pt-4">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<FiSend />}
                loading={submitting}
                block
              >
                Submit
              </Button>
            </div>
          </Form>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Cadence Quote</p>
        </div>
      </div>
    </div>
  )
}

export default PublicLeadFormPage
