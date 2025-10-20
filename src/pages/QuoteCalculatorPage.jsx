import { useState, useEffect } from 'react'
import { Card, Form, Input, InputNumber, Button, Select, message, Divider, Table, Tag } from 'antd'
import {  FiDollarSign } from 'react-icons/fi'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'
import { Calculator } from 'lucide-react'

const { Option } = Select

function QuoteCalculatorPage() {
  const [loading, setLoading] = useState(false)
  const [pricingSchemes, setPricingSchemes] = useState([])
  const [selectedScheme, setSelectedScheme] = useState(null)
  const [calculationResult, setCalculationResult] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchPricingSchemes()
  }, [])

  const fetchPricingSchemes = async () => {
    try {
      const response = await apiService.get('/pricing-schemes')
      if (response.success) {
        setPricingSchemes(response.data)
      }
    } catch (error) {
      message.error('Failed to load pricing schemes')
    }
  }

  const handleSchemeChange = async (schemeId) => {
    if (!schemeId) {
      setSelectedScheme(null)
      return
    }

    try {
      const response = await apiService.get(`/pricing-schemes/${schemeId}/rules`)
      if (response.success) {
        setSelectedScheme(response.data)
      }
    } catch (error) {
      message.error('Failed to load pricing scheme details')
    }
  }

  const handleCalculate = async (values) => {
    if (!selectedScheme) {
      message.error('Please select a pricing scheme')
      return
    }

    setLoading(true)
    try {
      const response = await apiService.post(`/pricing-schemes/${selectedScheme.id}/calculate`, values)
      if (response.success) {
        setCalculationResult(response.data)
        message.success('Quote calculated successfully!')
      } else {
        message.error(response.message)
      }
    } catch (error) {
      message.error('Failed to calculate quote: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getSchemeTypeDisplay = (type) => {
    const types = {
      'sqft_turnkey': 'Square-Foot (Turnkey)',
      'sqft_labor_only': 'Square-Foot (Labor Only)',
      'hourly_time_materials': 'Hourly (Time & Materials)',
      'unit_based': 'Unit Based'
    }
    return types[type] || type
  }

  const breakdownColumns = [
    {
      title: 'Item',
      dataIndex: 'item',
      key: 'item',
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
    },
    {
      title: 'Cost',
      dataIndex: 'cost',
      key: 'cost',
      align: 'right',
      render: (cost) => `$${cost.toFixed(2)}`
    }
  ]

  const getBreakdownData = () => {
    if (!calculationResult) return []

    const data = []
    const { breakdown } = calculationResult

    // Add surface costs
    Object.entries(breakdown.surfaces).forEach(([surface, details]) => {
      data.push({
        key: surface,
        item: surface.charAt(0).toUpperCase() + surface.slice(1),
        details: details.squareFeet ? `${details.squareFeet} sqft @ $${details.rate}/sqft` :
                details.linearFeet ? `${details.linearFeet} linear ft @ $${details.rate}/ft` :
                details.count ? `${details.count} units @ $${details.rate}/unit` : '',
        cost: details.cost
      })
    })

    // Add product costs
    Object.entries(breakdown.products).forEach(([product, details]) => {
      data.push({
        key: `product-${product}`,
        item: product,
        details: `${details.quantity} units @ $${details.unitPrice}`,
        cost: details.total
      })
    })

    // Add labor if any
    if (breakdown.labor > 0) {
      data.push({
        key: 'labor',
        item: 'Labor',
        details: 'Hourly rate',
        cost: breakdown.labor
      })
    }

    return data
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Calculator className="text-3xl text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Quote Calculator</h1>
            </div>
            <p className="text-gray-600">
              Calculate quotes using your pricing schemes and room measurements
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calculator Form */}
            <Card title="Quote Calculator" className="shadow-sm">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleCalculate}
                className="space-y-4"
              >
                <Form.Item
                  label="Pricing Scheme"
                  name="pricingSchemeId"
                  rules={[{ required: true, message: 'Please select a pricing scheme' }]}
                >
                  <Select
                    placeholder="Select pricing scheme"
                    onChange={handleSchemeChange}
                  >
                    {pricingSchemes.map(scheme => (
                      <Option key={scheme.id} value={scheme.id}>
                        {scheme.name} - {getSchemeTypeDisplay(scheme.type)}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {selectedScheme && (
                  <div className="p-3 bg-blue-50 rounded-lg mb-4">
                    <p className="text-sm font-medium text-blue-800 mb-1">Pricing Rules:</p>
                    <p className="text-sm text-blue-700">{selectedScheme.rulesSummary}</p>
                  </div>
                )}

                <Divider>Room Measurements</Divider>

                {/* Walls */}
                <div className="grid grid-cols-3 gap-3">
                  <Form.Item label="Wall Height (ft)" name={['measurements', 'walls', 'height']}>
                    <InputNumber min={0} step={0.5} placeholder="8" />
                  </Form.Item>
                  <Form.Item label="Wall Width (ft)" name={['measurements', 'walls', 'width']}>
                    <InputNumber min={0} step={0.5} placeholder="12" />
                  </Form.Item>
                  <Form.Item label="Wall Count" name={['measurements', 'walls', 'count']}>
                    <InputNumber min={0} placeholder="4" />
                  </Form.Item>
                </div>

                {/* Ceilings */}
                <div className="grid grid-cols-2 gap-3">
                  <Form.Item label="Ceiling Length (ft)" name={['measurements', 'ceilings', 'length']}>
                    <InputNumber min={0} step={0.5} placeholder="12" />
                  </Form.Item>
                  <Form.Item label="Ceiling Width (ft)" name={['measurements', 'ceilings', 'width']}>
                    <InputNumber min={0} step={0.5} placeholder="10" />
                  </Form.Item>
                </div>

                {/* Trim */}
                <Form.Item label="Trim Length (linear ft)" name={['measurements', 'trim', 'length']}>
                  <InputNumber min={0} placeholder="40" />
                </Form.Item>

                {/* Estimated Hours (for hourly schemes) */}
                {selectedScheme?.type === 'hourly_time_materials' && (
                  <Form.Item
                    label="Estimated Hours"
                    name={['measurements', 'estimatedHours']}
                    rules={[{ required: true, message: 'Hours required for hourly pricing' }]}
                  >
                    <InputNumber min={0} step={0.5} placeholder="8" />
                  </Form.Item>
                )}

                <Divider>Products (Optional)</Divider>
                <p className="text-sm text-gray-600 mb-3">
                  Add products to include in the quote calculation
                </p>

                <Form.List name="selectedProducts">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <div key={key} className="flex items-center gap-3 mb-3">
                          <Form.Item
                            {...restField}
                            name={[name, 'productId']}
                            className="flex-1"
                          >
                            <Input placeholder="Product ID" />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'quantity']}
                          >
                            <InputNumber min={1} placeholder="Qty" />
                          </Form.Item>
                          <Button type="link" danger onClick={() => remove(name)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button type="dashed" onClick={() => add()} block>
                        Add Product
                      </Button>
                    </>
                  )}
                </Form.List>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  className="w-full"
                  icon={<Calculator />}
                >
                  Calculate Quote
                </Button>
              </Form>
            </Card>

            {/* Results */}
            <Card title="Quote Results" className="shadow-sm">
              {calculationResult ? (
                <div className="space-y-4">
                  <div className="text-center p-6 bg-green-50 rounded-lg">
                    <FiDollarSign className="text-4xl text-green-600 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-800">
                      ${calculationResult.totalAmount.toFixed(2)}
                    </div>
                    <p className="text-green-600">Total Quote Amount</p>
                  </div>

                  <Divider />

                  <div>
                    <h4 className="font-semibold mb-3">Cost Breakdown</h4>
                    <Table
                      columns={breakdownColumns}
                      dataSource={getBreakdownData()}
                      pagination={false}
                      size="small"
                      summary={(pageData) => {
                        const total = pageData.reduce((sum, item) => sum + item.cost, 0)
                        return (
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={2}>
                              <strong>Total</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2} align="right">
                              <strong>${total.toFixed(2)}</strong>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        )
                      }}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="primary" className="flex-1">
                      Save Quote
                    </Button>
                    <Button className="flex-1">
                      Export PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Calculator className="text-5xl mx-auto mb-4 text-gray-300" />
                  <p>Enter measurements and click "Calculate Quote" to see results</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

export default QuoteCalculatorPage