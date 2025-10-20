import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Button, Select, Switch, Space, message, Divider } from 'antd'
import { FiPlus, FiTrash2, FiSave, FiArrowLeft } from 'react-icons/fi'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'

const { TextArea } = Input
const { Option } = Select

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
]

function LeadFormBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formFields, setFormFields] = useState([
    {
      fieldName: 'fullName',
      fieldLabel: 'Full Name',
      fieldType: 'text',
      isRequired: true,
      order: 1,
    },
    {
      fieldName: 'email',
      fieldLabel: 'Email Address',
      fieldType: 'email',
      isRequired: true,
      order: 2,
    },
    {
      fieldName: 'phone',
      fieldLabel: 'Phone Number',
      fieldType: 'tel',
      isRequired: false,
      order: 3,
    },
  ])

  useEffect(() => {
    if (id) {
      fetchLeadForm()
    }
  }, [id])

  const fetchLeadForm = async () => {
    setLoading(true)
    try {
      const response = await apiService.get(`/lead-forms/${id}`)
      if (response.success) {
        const data = response.data
        form.setFieldsValue({
          formName: data.formName,
          formTitle: data.formTitle,
          formDescription: data.formDescription,
          isActive: data.isActive,
        })
        setFormFields(data.formFields || [])
      }
    } catch (error) {
      message.error('Failed to load lead form: ' + error.message)
      navigate('/lead-forms')
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = () => {
    const newField = {
      fieldName: '',
      fieldLabel: '',
      fieldType: 'text',
      isRequired: false,
      order: formFields.length + 1,
    }
    setFormFields([...formFields, newField])
  }

  const handleRemoveField = (index) => {
    const updated = formFields.filter((_, i) => i !== index)
    // Reorder
    updated.forEach((field, i) => {
      field.order = i + 1
    })
    setFormFields(updated)
  }

  const handleFieldChange = (index, field, value) => {
    const updated = [...formFields]
    updated[index][field] = value
    
    // Auto-generate fieldName from fieldLabel
    if (field === 'fieldLabel' && !updated[index].fieldName) {
      updated[index].fieldName = value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
    }
    
    setFormFields(updated)
  }

  const handleSubmit = async (values) => {
    // Validate fields
    const invalidFields = formFields.filter(f => !f.fieldName || !f.fieldLabel || !f.fieldType)
    if (invalidFields.length > 0) {
      message.error('Please fill in all field details')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...values,
        formFields,
      }

      if (id) {
        // Update existing form
        const response = await apiService.put(`/lead-forms/${id}`, payload)
        if (response.success) {
          message.success('Lead form updated successfully')
          navigate('/lead-forms')
        }
      } else {
        // Create new form
        const response = await apiService.post('/lead-forms', payload)
        if (response.success) {
          message.success('Lead form created successfully')
          message.info(`Public URL: ${window.location.origin}/lead/${response.data.publicUrl}`, 5)
          navigate('/lead-forms')
        }
      }
    } catch (error) {
      message.error(`Failed to ${id ? 'update' : 'create'} lead form: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div>Loading...</div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            icon={<FiArrowLeft />}
            onClick={() => navigate('/lead-forms')}
            className="mb-4"
          >
            Back to Lead Forms
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            {id ? 'Edit Lead Form' : 'Create Lead Form'}
          </h1>
          <p className="text-gray-600 mt-1">
            Build a custom form to capture leads from your website
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            isActive: true,
          }}
        >
          {/* Basic Info */}
          <Card title="Basic Information" className="mb-6">
            <Form.Item
              label="Form Name"
              name="formName"
              rules={[{ required: true, message: 'Please enter form name' }]}
              tooltip="Internal identifier (lowercase, no spaces)"
            >
              <Input
                size="large"
                placeholder="e.g., kitchen-remodel"
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/\s+/g, '-')
                  form.setFieldsValue({ formName: value })
                }}
              />
            </Form.Item>

            <Form.Item
              label="Form Title"
              name="formTitle"
              rules={[{ required: true, message: 'Please enter form title' }]}
              tooltip="Displayed to users at the top of the form"
            >
              <Input size="large" placeholder="e.g., Kitchen Remodel Quote Request" />
            </Form.Item>

            <Form.Item
              label="Description (Optional)"
              name="formDescription"
              tooltip="Brief description shown below the title"
            >
              <TextArea rows={2} placeholder="Tell us about your kitchen remodeling project..." />
            </Form.Item>

            <Form.Item
              label="Status"
              name="isActive"
              valuePropName="checked"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Card>

          {/* Form Fields */}
          <Card
            title="Form Fields"
            className="mb-6"
            extra={
              <Button
                type="primary"
                icon={<FiPlus />}
                onClick={handleAddField}
              >
                Add Field
              </Button>
            }
          >
            <div className="space-y-4">
              {formFields.map((field, index) => (
                <Card
                  key={index}
                  size="small"
                  className="bg-gray-50"
                  extra={
                    formFields.length > 1 && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<FiTrash2 />}
                        onClick={() => handleRemoveField(index)}
                      >
                        Remove
                      </Button>
                    )
                  }
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4">
                      <label className="block text-sm font-medium mb-1">Field Label *</label>
                      <Input
                        placeholder="e.g., Full Name"
                        value={field.fieldLabel}
                        onChange={(e) => handleFieldChange(index, 'fieldLabel', e.target.value)}
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-sm font-medium mb-1">Field Name *</label>
                      <Input
                        placeholder="e.g., fullName"
                        value={field.fieldName}
                        onChange={(e) => handleFieldChange(index, 'fieldName', e.target.value)}
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-sm font-medium mb-1">Field Type *</label>
                      <Select
                        style={{ width: '100%' }}
                        value={field.fieldType}
                        onChange={(value) => handleFieldChange(index, 'fieldType', value)}
                      >
                        {FIELD_TYPES.map(type => (
                          <Option key={type.value} value={type.value}>
                            {type.label}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    <div className="col-span-2 flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.isRequired}
                          onChange={(e) => handleFieldChange(index, 'isRequired', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Required</span>
                      </label>
                    </div>

                    {(field.fieldType === 'select' || field.fieldType === 'radio') && (
                      <div className="col-span-12">
                        <label className="block text-sm font-medium mb-1">
                          Options (comma-separated)
                        </label>
                        <Input
                          placeholder="e.g., Full Kitchen, Cabinets Only, Walls Only"
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => {
                            const options = e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                            handleFieldChange(index, 'options', options)
                          }}
                        />
                      </div>
                    )}

                    {field.fieldType === 'textarea' && (
                      <div className="col-span-12">
                        <label className="block text-sm font-medium mb-1">Placeholder (Optional)</label>
                        <Input
                          placeholder="Tell us more about your project..."
                          value={field.placeholder || ''}
                          onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {formFields.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No fields added yet. Click "Add Field" to create your first form field.
                </div>
              )}
            </div>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <Button size="large" onClick={() => navigate('/lead-forms')}>
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<FiSave />}
              htmlType="submit"
              loading={saving}
            >
              {id ? 'Update Form' : 'Create Form'}
            </Button>
          </div>
        </Form>
      </div>
    </MainLayout>
  )
}

export default LeadFormBuilderPage
