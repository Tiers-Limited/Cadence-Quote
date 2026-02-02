// src/pages/customer/ProductSelectionWizard.jsx
// Multi-step wizard for customer product/color/sheen selections

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Steps,
  Button,
  Select,
  Input,
  Spin,
  Result,
  Progress,
  Alert,
  Modal,
  Tag,
  Divider,
  Space,
} from 'antd';
import {
  CheckOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { customerPortalAPI } from '../../services/customerPortalAPI';

const { TextArea } = Input;
const { Option } = Select;
import { Row, Col, Empty, Input as AntdInput } from 'antd';
const { Search } = AntdInput;
import BrandedPortalHeader from '../../components/CustomerPortal/BrandedPortalHeader';
import PortalFooter from '../../components/CustomerPortal/PortalFooter';

const ProductSelectionWizard = () => {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState([]);
  const [quoteInfo, setQuoteInfo] = useState(null);
  const [error, setError] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [brands, setBrands] = useState([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [isTurnkey, setIsTurnkey] = useState(false); // Track if this is turnkey pricing
  const [savingSelection, setSavingSelection] = useState(false); // Track when saving individual selections
  // per-area brand and color pagination state
  const [areaBrandMap, setAreaBrandMap] = useState({}); // { idx: brandId }
  const [colorsByArea, setColorsByArea] = useState({}); // { idx: { items: [], page: 1, limit: 36, hasMore: true, loading: false, search: '' } }
  const colorGridRef = React.useRef(null);

  // Current selection (must be defined before any derived hooks)
  const currentSelection = selections[currentStep];

  // Derived colors for current area (from remote fetch)
  const currentAreaColors = colorsByArea[currentStep]?.items || [];
  const currentAreaHasMore = colorsByArea[currentStep]?.hasMore;
  const currentAreaLoading = colorsByArea[currentStep]?.loading;
  const currentAreaSearch = colorsByArea[currentStep]?.search || '';

  const handleColorGridScroll = (e) => {
    const el = e.target;
    // only trigger fetch if near bottom and more pages available
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && currentAreaHasMore && !currentAreaLoading) {
      fetchColorsForArea(currentStep, (colorsByArea[currentStep]?.page || 1) + 1);
    }
  };

  // Fetch brands for the dropdown
  const fetchBrands = async () => {
    try {
      setBrandLoading(true);
      const res = await customerPortalAPI.getBrands({ limit: 200 });
      if (res.success) setBrands(res.data || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
    } finally {
      setBrandLoading(false);
    }
  };

  // Fetch colors for a specific area (by index) using brandId
  const fetchColorsForArea = async (areaIdx, page = 1, search = '') => {
    const brandId = areaBrandMap[areaIdx];
    if (!brandId) return;

    setColorsByArea(prev => ({
      ...prev,
      [areaIdx]: { ...(prev[areaIdx] || {}), loading: true }
    }));

    try {
      const res = await customerPortalAPI.getColors({ brandId, page, limit: 36, search });
      if (res.success) {
        setColorsByArea(prev => {
          const prevItems = page === 1 ? [] : (prev[areaIdx]?.items || []);
          return {
            ...prev,
            [areaIdx]: {
              items: [...prevItems, ...(res.data || [])],
              page,
              limit: 36,
              hasMore: res.pagination?.hasMore || false,
              loading: false,
              search: search || ''
            }
          };
        });
      }
    } catch (err) {
      console.error('Failed to fetch colors for area:', err);
      setColorsByArea(prev => ({ ...(prev || {}), [areaIdx]: { ...(prev[areaIdx] || {}), loading: false } }));
    }
  };

  // Call when brand changed for area
  const handleBrandChangeForArea = (areaIdx, brandId) => {
    setAreaBrandMap(prev => ({ ...prev, [areaIdx]: brandId }));
    // reset colors for area and fetch first page
    setColorsByArea(prev => ({ ...prev, [areaIdx]: { items: [], page: 0, limit: 36, hasMore: true, loading: false, search: '' } }));
    fetchColorsForArea(areaIdx, 1);
  };

  // Search colors for area
  const handleSearchColorsForArea = (areaIdx, q) => {
    setColorsByArea(prev => ({ ...prev, [areaIdx]: { ...(prev[areaIdx] || {}), items: [], page: 0, hasMore: true, search: q } }));
    fetchColorsForArea(areaIdx, 1, q);
  };

  // Select a color (object from API) for an area and save immediately (only if sheen already selected)
  const handleColorSelect = async (areaIdx, colorObj) => {
    // Update local selection state optimistically
    const updated = [...selections];
    
    if (isTurnkey) {
      // For turnkey pricing, apply the color to all areas
      updated.forEach((sel, idx) => {
        updated[idx] = { 
          ...updated[idx], 
          selectedColor: colorObj.name, 
          selectedColorId: colorObj.id, 
          selectedColorHex: colorObj.hexValue, 
          _needsSave: !updated[idx]?.selectedSheen 
        };
      });
    } else {
      // For regular pricing, only update the specific area
      updated[areaIdx] = { 
        ...updated[areaIdx], 
        selectedColor: colorObj.name, 
        selectedColorId: colorObj.id, 
        selectedColorHex: colorObj.hexValue, 
        _needsSave: !updated[areaIdx]?.selectedSheen 
      };
    }
    
    setSelections(updated);

    // If sheen is not selected yet, defer save until sheen selection (or autosave)
    if (!updated[areaIdx].selectedSheen) {
      return;
    }

    // Prepare payload for saveSelections
    let payload;
    if (isTurnkey) {
      // For turnkey pricing, send a single selection that applies to all areas
      payload = [{
        surfaceType: updated[areaIdx].surfaceType,
        color: { id: colorObj.id, name: colorObj.name, code: colorObj.code, hexValue: colorObj.hexValue },
        sheen: updated[areaIdx].selectedSheen || null,
        notes: updated[areaIdx].customerNotes || null,
      }];
    } else {
      // For regular pricing, send the specific area selection
      payload = [{
        areaId: updated[areaIdx].areaId,
        areaName: updated[areaIdx].areaName,
        surfaceType: updated[areaIdx].surfaceType,
        color: { id: colorObj.id, name: colorObj.name, code: colorObj.code, hexValue: colorObj.hexValue },
        sheen: updated[areaIdx].selectedSheen || null,
        notes: updated[areaIdx].customerNotes || null,
      }];
    }

    try {
      setSavingSelection(true);
      const saveResp = await customerPortalAPI.saveSelections(proposalId, { selections: payload });
      // Use the server's persisted selections (avoid extra GET/refresh)
      if (saveResp && Array.isArray(saveResp.selections)) {
        setSelections(saveResp.selections);
        const newSel = saveResp.selections[areaIdx];
        if (newSel && newSel.product && newSel.product.brandId) {
          setAreaBrandMap(prev => ({ ...prev, [areaIdx]: newSel.product.brandId }));
        }
      }
    } catch (err) {
      console.error('Failed to save single selection:', err);
      // Revert the optimistic update on error
      const reverted = [...selections];
      if (isTurnkey) {
        reverted.forEach((sel, idx) => {
          reverted[idx] = { ...reverted[idx], selectedColor: null, selectedColorId: null, selectedColorHex: null };
        });
      } else {
        reverted[areaIdx] = { ...reverted[areaIdx], selectedColor: null, selectedColorId: null, selectedColorHex: null };
      }
      setSelections(reverted);
      Modal.error({
        title: 'Save Failed',
        content: 'Failed to save your color selection. Please try again.',
      });
    } finally {
      setSavingSelection(false);
    }
  };

  useEffect(() => {
    fetchSelectionOptions();

    // Auto-save every 30 seconds
    const autoSaveInterval = setInterval(() => {
      if (selections.length > 0) {
        autoSaveSelections();
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [proposalId]);

  // When the user moves to a different area, ensure we have colors for that area's brand
  useEffect(() => {
    const brandId = areaBrandMap[currentStep];
    const areaColors = colorsByArea[currentStep];
    if (brandId && (!areaColors || (areaColors.items && areaColors.items.length === 0))) {
      fetchColorsForArea(currentStep, 1);
    }
  }, [currentStep, areaBrandMap]);

  const fetchSelectionOptions = async () => {
    try {
      setLoading(true);
      const response = await customerPortalAPI.getSelectionOptions(proposalId);
      
      setQuoteInfo(response.quote);
      setSelections(response.selections || []);
      setIsTurnkey(response.quote?.isTurnkey || false);
      
      // Initialize area brand map from product.brandId or null
      const initBrandMap = {};
      (response.selections || []).forEach((s, idx) => {
        initBrandMap[idx] = s.product?.brandId || s.selectedBrandId || null;
      });
      setAreaBrandMap(initBrandMap);

      // Fetch brands for dropdown
      fetchBrands();

      setLoading(false);
    } catch (err) {
      console.error('Error fetching selection options:', err);
      
      if (err.response?.data?.code === 'PORTAL_CLOSED') {
        setError('Selection portal is not yet open. Please complete deposit payment first.');
      } else if (err.response?.data?.code === 'PORTAL_EXPIRED') {
        setError('Selection portal has expired. Please contact your contractor.');
      } else if (err.response?.data?.code === 'SELECTIONS_LOCKED') {
        setError('Selections are already submitted and locked.');
      } else {
        setError(err.response?.data?.message || 'Failed to load selection options');
      }
      
      setLoading(false);
    }
  };

  const autoSaveSelections = async () => {
    try {
      setAutoSaving(true);
      let selectionsData;
      
      if (isTurnkey && selections.length > 0) {
        // For turnkey pricing, send a single selection that applies to all areas
        const firstSelection = selections[0];
        selectionsData = [{
          surfaceType: firstSelection.surfaceType,
          // send color as object when available
          color: firstSelection.selectedColorId ? { 
            id: firstSelection.selectedColorId, 
            name: firstSelection.selectedColor, 
            hexValue: firstSelection.selectedColorHex, 
            code: firstSelection.selectedColorNumber 
          } : (firstSelection.selectedColor || null),
          sheen: firstSelection.selectedSheen,
          notes: firstSelection.customerNotes,
        }];
      } else {
        // For regular pricing, send all selections
        selectionsData = selections.map(s => ({
          areaId: s.areaId,
          areaName: s.areaName,
          surfaceType: s.surfaceType,
          // send color as object when available
          color: s.selectedColorId ? { 
            id: s.selectedColorId, 
            name: s.selectedColor, 
            hexValue: s.selectedColorHex, 
            code: s.selectedColorNumber 
          } : (s.selectedColor || null),
          sheen: s.selectedSheen,
          notes: s.customerNotes,
        }));
      }
      
      const saveResp = await customerPortalAPI.saveSelections(proposalId, { selections: selectionsData });
      if (saveResp && Array.isArray(saveResp.selections)) {
        setSelections(saveResp.selections);
      }
      console.log('✅ Auto-saved selections');
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleColorChange = (index, color) => {
    const updated = [...selections];
    updated[index].selectedColor = color;
    setSelections(updated);
  };

  const handleSheenChange = async (index, sheen) => {
    const updated = [...selections];
    
    if (isTurnkey) {
      // For turnkey pricing, apply the sheen to all areas
      updated.forEach((sel, idx) => {
        updated[idx] = { ...updated[idx], selectedSheen: sheen };
        // clear deferred save flag
        if (updated[idx]._needsSave) updated[idx]._needsSave = false;
      });
    } else {
      // For regular pricing, only update the specific area
      updated[index].selectedSheen = sheen;
      // clear deferred save flag
      if (updated[index]._needsSave) updated[index]._needsSave = false;
    }
    
    // Update UI immediately for seamless experience
    setSelections(updated);

    // Persist this area if a color is selected (or if it was previously marked for save)
    if (updated[index].selectedColorId || updated[index].selectedColor) {
      let payload;
      if (isTurnkey) {
        // For turnkey pricing, send a single selection that applies to all areas
        payload = [{
          surfaceType: updated[index].surfaceType,
          color: updated[index].selectedColorId ? { 
            id: updated[index].selectedColorId, 
            name: updated[index].selectedColor, 
            code: updated[index].selectedColorNumber, 
            hexValue: updated[index].selectedColorHex 
          } : (updated[index].selectedColor || null),
          sheen,
          notes: updated[index].customerNotes || null,
        }];
      } else {
        // For regular pricing, send the specific area selection
        payload = [{
          areaId: updated[index].areaId,
          areaName: updated[index].areaName,
          surfaceType: updated[index].surfaceType,
          color: updated[index].selectedColorId ? { 
            id: updated[index].selectedColorId, 
            name: updated[index].selectedColor, 
            code: updated[index].selectedColorNumber, 
            hexValue: updated[index].selectedColorHex 
          } : (updated[index].selectedColor || null),
          sheen,
          notes: updated[index].customerNotes || null,
        }];
      }

      try {
        setSavingSelection(true);
        const saveResp = await customerPortalAPI.saveSelections(proposalId, { selections: payload });
        
        // Update with server response
        if (saveResp && Array.isArray(saveResp.selections)) {
          setSelections(saveResp.selections);
          const newSel = saveResp.selections[index];
          if (newSel && newSel.product && newSel.product.brandId) {
            setAreaBrandMap(prev => ({ ...prev, [index]: newSel.product.brandId }));
          }
        }
      } catch (err) {
        console.error('Failed to save sheen selection:', err);
        // Revert the optimistic update on error
        const reverted = [...selections];
        if (isTurnkey) {
          reverted.forEach((sel, idx) => {
            reverted[idx] = { ...reverted[idx], selectedSheen: null };
          });
        } else {
          reverted[index] = { ...reverted[index], selectedSheen: null };
        }
        setSelections(reverted);
        Modal.error({
          title: 'Save Failed',
          content: 'Failed to save your selection. Please try again.',
        });
      } finally {
        setSavingSelection(false);
      }
    }
  };

  const handleNotesChange = (index, notes) => {
    const updated = [...selections];
    updated[index].customerNotes = notes;
    setSelections(updated);
  };

  const isCurrentSelectionComplete = () => {
    if (currentStep >= selections.length) return true;
    const current = selections[currentStep];
    
    if (isTurnkey) {
      // For turnkey pricing, check if any area has both color and sheen (since they all share the same selection)
      return selections.some(s => s.selectedColor && s.selectedSheen);
    } else {
      // For regular pricing, check only the current area
      return current.selectedColor && current.selectedSheen;
    }
  };

  const getCompletionPercentage = () => {
    if (isTurnkey) {
      // For turnkey pricing, if ANY area has both color and sheen, all areas are complete
      const hasCompleteSelection = selections.some(s => s.selectedColor && s.selectedSheen);
      return hasCompleteSelection ? 100 : 0;
    } else {
      // For regular pricing, count individual area completions
      const completed = selections.filter(s => s.selectedColor && s.selectedSheen).length;
      return Math.round((completed / selections.length) * 100);
    }
  };

  const handleNext = async () => {
    if (!isCurrentSelectionComplete()) {
      Modal.warning({
        title: 'Selection Incomplete',
        content: 'Please select both a color and sheen before proceeding.',
      });
      return;
    }
    
    // Save current selection
    await autoSaveSelections();
    
    if (currentStep < selections.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Check if all selections are complete
    let incompleteSelections;
    
    if (isTurnkey) {
      // For turnkey pricing, check if we have at least one complete selection (applies to all)
      const hasCompleteSelection = selections.some(s => s.selectedColor && s.selectedSheen);
      incompleteSelections = hasCompleteSelection ? [] : [{ areaName: 'All Areas', reason: 'Missing color or sheen selection' }];
    } else {
      // For regular pricing, check each area individually
      incompleteSelections = selections.filter(s => !s.selectedColor || !s.selectedSheen);
    }
    
    if (incompleteSelections.length > 0) {
      Modal.warning({
        title: 'Incomplete Selections',
        content: isTurnkey 
          ? 'Please select both a color and sheen for your home before submitting.'
          : `Please complete all ${incompleteSelections.length} remaining area(s) before submitting.`,
      });
      return;
    }
    
    Modal.confirm({
      title: 'Submit Selections?',
      content: 'Once submitted, you will not be able to change your selections. Your project will be converted to a job and scheduled for work.',
      okText: 'Submit & Lock Selections',
      cancelText: 'Review Again',
      onOk: async () => {
        try {
          setSubmitting(true);
          const response = await customerPortalAPI.submitSelections(proposalId);
          
          Modal.success({
            title: 'Selections Submitted!',
            content: `Your selections have been submitted. Job #${response.job.jobNumber} has been created and will be scheduled soon.`,
            onOk: () => {
              navigate('/portal/dashboard');
            },
          });
        } catch (err) {
          console.error('Error submitting selections:', err);
          Modal.error({
            title: 'Submission Failed',
            content: err.response?.data?.message || 'Failed to submit selections',
          });
          setSubmitting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div>
        
        <div className="flex items-center justify-center min-h-screen">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        
        <div className="max-w-2xl mx-auto p-6">
          <Result
            status="error"
            title="Selection Portal Access Error"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => navigate('/portal/dashboard')}>
                Back to Dashboard
              </Button>
            }
          />
        </div>
      </div>
    );
  }


  const completionPercentage = getCompletionPercentage();

  return (
   
      <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Product Selection</h1>
            <p className="text-gray-600">Proposal #{quoteInfo?.quoteNumber}</p>
            {isTurnkey && (
              <div className="mt-2">
                <Tag color="blue">Turnkey Pricing - Selections apply to entire home</Tag>
              </div>
            )}
          </div>
          <div className="text-right">
            {typeof quoteInfo?.daysRemaining === 'number' && (
              <Tag color={quoteInfo.daysRemaining <= 1 ? 'red' : quoteInfo.daysRemaining <= 3 ? 'orange' : 'green'} icon={<ClockCircleOutlined />}>
                {quoteInfo.daysRemaining} day{quoteInfo.daysRemaining !== 1 ? 's' : ''} remaining
              </Tag>
            )}
            {savingSelection && <Tag color="blue" icon={<Spin size="small" />}>Saving selection...</Tag>}
            {autoSaving && <Tag color="blue">Auto-saving...</Tag>}
          </div>
        </div>
        
        <Divider />
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-medium">{completionPercentage}% Complete</span>
          </div>
          <Progress 
            percent={completionPercentage} 
            status={completionPercentage === 100 ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <p className="text-xs text-gray-500 mt-2">
            {isTurnkey 
              ? (getCompletionPercentage() === 100 ? 'All areas completed' : 'Selection needed for all areas')
              : `${selections.filter(s => s.selectedColor && s.selectedSheen).length} of ${selections.length} areas completed`
            }
          </p>
        </div>
      </Card>

      {/* Steps Progress */}
      <Card className="mb-6">
        <Steps
          current={currentStep}
          size="small"
          items={selections.map((sel, idx) => {
            let status;
            if (isTurnkey) {
              // For turnkey pricing, all areas share the same status
              const hasSelection = selections.some(s => s.selectedColor && s.selectedSheen);
              status = hasSelection ? 'finish' : idx === currentStep ? 'process' : 'wait';
            } else {
              // For regular pricing, each area has its own status
              status = sel.selectedColor && sel.selectedSheen ? 'finish' : idx === currentStep ? 'process' : 'wait';
            }
            
            return {
              title: sel.areaName || `Area ${idx + 1}`,
              description: sel.surfaceType,
              status: status,
            };
          })}
        />
      </Card>

      {/* Selection Form */}
      <Card title={`${currentSelection?.areaName || `Area ${currentStep + 1}`} - ${currentSelection?.surfaceType}`}>
        {isTurnkey && (
          <Alert
            message="Turnkey Pricing Selection"
            description="Your color and sheen selections will be applied to all areas of your home automatically. Once you make your selections, you can submit immediately."
            type="info"
            showIcon
            className="mb-4"
          />
        )}
        {currentSelection && (
          <div className="space-y-6">
            {/* Product Information */}
            <Alert
              message="Selected Product"
              description={
                <div className="mt-2">
                  <p className="font-semibold text-lg">{currentSelection.product?.fullName || 'Product information not available'}</p>
                  <p className="text-gray-600">Brand: {currentSelection.product?.brand || '—'}</p>
                </div>
              }
              type="info"
              showIcon
            />

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Color <span className="text-red-500">*</span>
              </label>

              {/* Brand dropdown + Search Input */}
              <div className="mb-4 flex gap-3">
                <Select
                  placeholder="Select Brand"
                  style={{ minWidth: 220 }}
                  loading={brandLoading}
                  value={areaBrandMap[currentStep] || undefined}
                  onChange={(val) => handleBrandChangeForArea(currentStep, val)}
                >
                  {brands.map(b => (
                    <Option key={b.id} value={b.id}>{b.name}</Option>
                  ))}
                </Select>

                <Search
                  placeholder="Search colors by name or code..."
                  allowClear
                  enterButton="Search"
                  onSearch={(val) => handleSearchColorsForArea(currentStep, val)}
                  onChange={(e) => handleSearchColorsForArea(currentStep, e.target.value)}
                  value={currentAreaSearch}
                  style={{ flex: 1 }}
                  size="middle"
                />
              </div>

              {/* Scrollable Grid of Color Cards with server-side pagination */}
              <div style={{ height: 240, overflowY: 'auto', paddingRight: 8 }} onScroll={handleColorGridScroll} ref={colorGridRef}>
                {currentAreaColors.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {currentAreaColors.map((color) => {
                      const colorObj = typeof color === 'string' ? { id: color, name: color, hexValue: null } : color;
                      const isSelected = currentSelection?.selectedColorId && String(currentSelection.selectedColorId) === String(colorObj.id);

                      return (
                        <div key={colorObj.id || colorObj.name} onClick={() => handleColorSelect(currentStep, colorObj)} style={{ cursor: 'pointer' }}>
                          <div className={`p-2 border rounded ${isSelected ? 'border-green-500' : 'border-gray-200'} hover:shadow`}>
                            <div style={{ width: '100%', height: 72, borderRadius: 6, border: '1px solid #d9d9d9', backgroundColor: colorObj.hexValue || '#f0f0f0' }} />
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontWeight: 600 }}>{colorObj.name}</div>
                              {colorObj.code && <div style={{ color: '#6b7280', fontSize: 12 }}>{colorObj.code}</div>}
                            </div>
                            {isSelected && <div style={{ marginTop: 6 }}><Tag color="success">Selected</Tag></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty description={currentAreaSearch ? `No colors found matching "${currentAreaSearch}"` : 'No colors available for this brand'} />
                )}

                {/* Load more indicator (server-side) */}
                {currentAreaHasMore && (
                  <div style={{ textAlign: 'center', padding: 12 }}>
                    <Button loading={currentAreaLoading} onClick={() => fetchColorsForArea(currentStep, (colorsByArea[currentStep]?.page || 1) + 1)}>Load more</Button>
                  </div>
                )}
              </div>

              {/* Fallback: custom color */}
              <div className="mt-3">
                <Button type="link" onClick={() => handleNotesChange(currentStep, 'Custom color requested')}>Custom Color (specify in notes)</Button>
              </div>
            </div>

            {/* Sheen Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Sheen <span className="text-red-500">*</span>
              </label>
              <Spin spinning={savingSelection} tip="Saving selection...">
                <Select
                  size="large"
                  placeholder="Choose a sheen..."
                  value={currentSelection.selectedSheen}
                  onChange={(value) => handleSheenChange(currentStep, value)}
                  className="w-full"
                  disabled={savingSelection}
                >
                  {currentSelection.availableSheens && currentSelection.availableSheens.length > 0 ? (
                    currentSelection.availableSheens.map((sheen) => (
                      <Option key={sheen} value={sheen}>
                        {sheen}
                      </Option>
                    ))
                  ) : (
                    <>
                      <Option value="flat">Flat</Option>
                      <Option value="eggshell">Eggshell</Option>
                      <Option value="satin">Satin</Option>
                      <Option value="semi-gloss">Semi-Gloss</Option>
                      <Option value="gloss">Gloss</Option>
                    </>
                  )}
                </Select>
              </Spin>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Special Notes (Optional)
              </label>
              <TextArea
                rows={3}
                placeholder="Any special instructions or preferences for this area..."
                value={currentSelection.customerNotes}
                onChange={(e) => handleNotesChange(currentStep, e.target.value)}
              />
            </div>

            {/* Navigation Buttons */}
            <Divider />
            <div className="flex justify-between items-center">
              <Button
                size="large"
                icon={<LeftOutlined />}
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              
              <Space>
                {currentStep < selections.length - 1 ? (
                  <Button
                    type="primary"
                    size="large"
                    icon={<RightOutlined />}
                    onClick={handleNext}
                    disabled={!isCurrentSelectionComplete()}
                  >
                    Next Area
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={completionPercentage !== 100}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Submit All Selections
                  </Button>
                )}
                
                {/* For turnkey pricing, show submit button on any step once selection is complete */}
                {isTurnkey && completionPercentage === 100 && currentStep < selections.length - 1 && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleSubmit}
                    loading={submitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Submit All Selections
                  </Button>
                )}
              </Space>
            </div>
          </div>
        )}
      </Card>

      {/* Summary Card */}
      <Card title="Selection Summary" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selections.map((sel, idx) => {
            let isComplete;
            if (isTurnkey) {
              // For turnkey pricing, all areas share the same completion status
              isComplete = selections.some(s => s.selectedColor && s.selectedSheen);
            } else {
              // For regular pricing, each area has its own completion status
              isComplete = sel.selectedColor && sel.selectedSheen;
            }
            
            return (
              <div
                key={idx}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  idx === currentStep ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                } ${isComplete ? 'bg-green-50' : ''}`}
                onClick={() => setCurrentStep(idx)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{sel.areaName}</h4>
                    <p className="text-sm text-gray-600">{sel.surfaceType}</p>
                  </div>
                  {isComplete && (
                    <CheckOutlined className="text-green-600 text-xl" />
                  )}
                </div>
                {(isTurnkey ? selections.some(s => s.selectedColor) : sel.selectedColor) && (
                  <div className="mt-2 text-sm">
                    <p><strong>Color:</strong> {isTurnkey ? (selections.find(s => s.selectedColor)?.selectedColor || 'Not selected') : (sel.selectedColor || 'Not selected')}</p>
                    <p><strong>Sheen:</strong> {isTurnkey ? (selections.find(s => s.selectedSheen)?.selectedSheen || 'Not selected') : (sel.selectedSheen || 'Not selected')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
    
  );
};

export default ProductSelectionWizard;
