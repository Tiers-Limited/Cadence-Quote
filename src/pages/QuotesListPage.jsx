// pages/QuotesListPage.jsx
// Professional Quotes Management Page - View, filter, and manage all quotes

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Tag, Descriptions, Table, Button, Space } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import quoteApiService from '../services/quoteApiService';
import toast from 'react-hot-toast';

const QuotesListPage = () => {
  const navigate = useNavigate();

  // State
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalQuotes: 0,
    limit: 10
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    jobType: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC'
  });

  // UI State
  const [viewQuoteModal, setViewQuoteModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [loadingQuoteDetails, setLoadingQuoteDetails] = useState(false);

  // Fetch quotes
  const fetchQuotes = async (page = 1) => {
    try {
      setLoading(true);
      const response = await quoteApiService.getQuotes({
        page,
        limit: pagination.limit,
        ...filters
      });

      if (response.success) {
        setQuotes(response.data || []);
        setPagination(response.pagination || {
          currentPage: page,
          totalPages: 1,
          totalQuotes: 0,
          limit: pagination.limit
        });
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error(error.response?.data?.message || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  // Load quotes on mount and filter change
  useEffect(() => {
    fetchQuotes(1);
  }, [filters]);

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    fetchQuotes(newPage);
  };

  // Handle status update
  const handleStatusUpdate = async (quoteId, newStatus) => {
    try {
      const response = await quoteApiService.updateQuoteStatus(quoteId, newStatus);
      if (response.success) {
        toast.success(`Quote ${newStatus} successfully`);
        fetchQuotes(pagination.currentPage);
      }
    } catch (error) {
      console.error('Error updating quote status:', error);
      toast.error(error.response?.data?.message || 'Failed to update quote status');
    }
  };

  // Handle duplicate
  const handleDuplicate = async (quoteId) => {
    try {
      const response = await quoteApiService.duplicateQuote(quoteId);
      if (response.success) {
        toast.success('Quote duplicated successfully');
        fetchQuotes(pagination.currentPage);
      }
    } catch (error) {
      console.error('Error duplicating quote:', error);
      toast.error(error.response?.data?.message || 'Failed to duplicate quote');
    }
  };

  // Handle delete
  const handleDelete = (quoteId) => {
    Modal.confirm({
      title: 'Delete Quote',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this quote? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await quoteApiService.deleteQuote(quoteId);
          if (response.success) {
            toast.success('Quote deleted successfully');
            fetchQuotes(pagination.currentPage);
          }
        } catch (error) {
          console.error('Error deleting quote:', error);
          toast.error(error.response?.data?.message || 'Failed to delete quote');
        }
      }
    });
  };

  // View quote details
  const handleViewQuote = async (quoteId) => {
    try {
      setLoadingQuoteDetails(true);
      setViewQuoteModal(true);
      const response = await quoteApiService.getQuoteById(quoteId);
      if (response.success) {
        setSelectedQuote(response.data);
      }
    } catch (error) {
      console.error('Error fetching quote details:', error);
      toast.error('Failed to load quote details');
      setViewQuoteModal(false);
    } finally {
      setLoadingQuoteDetails(false);
    }
  };

  // Edit quote
  const handleEditQuote = async (quoteId) => {
    try {
      const response = await quoteApiService.getQuoteById(quoteId);
      if (response.success) {
        const quote = response.data;
        
        // Navigate to quote builder with complete quote data
        navigate('/quote-builder', { 
          state: { 
            editQuote: quote,
            isEditMode: true
          },
          replace: false
        });
      }
    } catch (error) {
      console.error('Error loading quote for edit:', error);
      toast.error('Failed to load quote for editing');
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      scheduled: 'bg-purple-100 text-purple-800',
      declined: 'bg-red-100 text-red-800',
      archived: 'bg-slate-100 text-slate-800',
      // Legacy support
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800'
    };

    const statusIcons = {
      draft: '📝',
      sent: '📤',
      accepted: '✅',
      scheduled: '📅',
      declined: '❌',
      archived: '🗄️'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        <span>{statusIcons[status]}</span>
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </span>
    );
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="text-gray-600 mt-1">Manage all your project quotes</p>
          </div>
          <button
            onClick={() => navigate('/quotes/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + New Quote
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-900">
                {quotes.filter(q => q.status === 'draft').length}
              </p>
            </div>
            <span className="text-3xl">📝</span>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sent</p>
              <p className="text-2xl font-bold text-blue-900">
                {quotes.filter(q => q.status === 'sent').length}
              </p>
            </div>
            <span className="text-3xl">📤</span>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accepted</p>
              <p className="text-2xl font-bold text-green-900">
                {quotes.filter(q => q.status === 'accepted').length}
              </p>
            </div>
            <span className="text-3xl">✅</span>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Scheduled</p>
              <p className="text-2xl font-bold text-purple-900">
                {quotes.filter(q => q.status === 'scheduled').length}
              </p>
            </div>
            <span className="text-3xl">📅</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search by customer, quote #..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="draft">📝 Draft</option>
            <option value="sent">📤 Sent</option>
            <option value="accepted">✅ Accepted</option>
            <option value="scheduled">📅 Scheduled</option>
            <option value="declined">❌ Declined</option>
            <option value="archived">🗄️ Archived</option>
          </select>

          {/* Job Type Filter */}
          <select
            value={filters.jobType}
            onChange={(e) => handleFilterChange('jobType', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Job Types</option>
            <option value="interior">Interior</option>
            <option value="exterior">Exterior</option>
          </select>

          {/* Sort By */}
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="createdAt">Created Date</option>
            <option value="total">Total Amount</option>
            <option value="customerName">Customer Name</option>
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No quotes found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new quote.</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/quote-builder')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                + Create Quote
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden">
              {quotes.map((quote) => (
                <div key={quote.id} className="border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <button 
                        className="text-sm font-medium text-blue-600 hover:underline focus:outline-none"
                        onClick={() => handleViewQuote(quote.id)}
                        type="button"
                      >
                        {quote.quoteNumber}
                      </button>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(quote.createdAt)}</p>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-900">{quote.customerName}</p>
                    <p className="text-xs text-gray-500">{quote.customerEmail}</p>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Job Type</p>
                      <p className="text-sm text-gray-900 capitalize">{quote.jobType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-lg font-semibold text-gray-900">{formatCurrency(quote.total)}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewQuote(quote.id)}
                      className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      View
                    </button>
                    {quote.status === 'draft' && (
                      <button
                        onClick={() => handleEditQuote(quote.id)}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(quote.id)}
                      className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(quote.id)}
                      className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quote #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          className="text-sm font-medium text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          onClick={() => handleViewQuote(quote.id)}
                          type="button"
                        >
                          {quote.quoteNumber}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{quote.customerName}</div>
                        <div className="text-sm text-gray-500">{quote.customerEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{quote.jobType}</div>
                        {quote.jobCategory && (
                          <div className="text-xs text-gray-500">{quote.jobCategory}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(quote.total)}</div>
                        {quote.totalSqft && (
                          <div className="text-xs text-gray-500">{quote.totalSqft.toLocaleString()} sq ft</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={quote.status} />
                        {quote.status === 'sent' && quote.sentAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            Sent {formatDate(quote.sentAt)}
                          </div>
                        )}
                        {quote.status === 'accepted' && quote.acceptedAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            Accepted {formatDate(quote.acceptedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatDate(quote.createdAt)}</div>
                        {quote.validUntil && new Date(quote.validUntil) > new Date() && (
                          <div className="text-xs text-orange-600 mt-1">
                            Valid until {formatDate(quote.validUntil)}
                          </div>
                        )}
                        {quote.validUntil && new Date(quote.validUntil) <= new Date() && (
                          <div className="text-xs text-red-600 mt-1">
                            Expired
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {/* View Button */}
                          <button
                            onClick={() => handleViewQuote(quote.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Edit Button (only for draft status) */}
                          {quote.status === 'draft' && (
                            <button
                              onClick={() => handleEditQuote(quote.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Edit Quote"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}

                          {/* Duplicate Button */}
                          <button
                            onClick={() => handleDuplicate(quote.id)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Duplicate Quote"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(quote.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Quote"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          {/* Status Update Dropdown */}
                          {quote.status !== 'archived' && (
                            <select
                              value={quote.status}
                              onChange={(e) => handleStatusUpdate(quote.id, e.target.value)}
                              className="ml-2 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              title="Update quote status"
                            >
                              <option value="draft">📝 Draft</option>
                              <option value="sent">📤 Sent</option>
                              <option value="accepted">✅ Accepted</option>
                              <option value="scheduled">📅 Scheduled</option>
                              <option value="declined">❌ Declined</option>
                              <option value="archived">🗄️ Archive</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={pagination.currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{((pagination.currentPage - 1) * pagination.limit) + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(pagination.currentPage * pagination.limit, pagination.totalQuotes)}</span> of{' '}
                      <span className="font-medium">{pagination.totalQuotes}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={pagination.currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {[...new Array(pagination.totalPages)].map((_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => handlePageChange(i + 1)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.currentPage === i + 1
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quote Detail Modal - Ant Design */}
      <Modal
        title={
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white -mx-6 -mt-5 px-6 py-4 rounded-t-lg">
            <h2 className="text-xl font-bold">Quote #{selectedQuote?.quoteNumber}</h2>
            <p className="text-blue-100 text-sm mt-1">Created {selectedQuote && formatDate(selectedQuote.createdAt)}</p>
          </div>
        }
        open={viewQuoteModal}
        onCancel={() => {
          setViewQuoteModal(false);
          setSelectedQuote(null);
        }}
        width={900}
        footer={[
          selectedQuote?.status === 'draft' && (
            <Button
              key="edit"
              type="primary"
              onClick={() => {
                setViewQuoteModal(false);
                handleEditQuote(selectedQuote.id);
              }}
            >
              Edit Quote
            </Button>
          ),
          <Button
            key="duplicate"
            onClick={() => {
              setViewQuoteModal(false);
              handleDuplicate(selectedQuote?.id);
            }}
          >
            Duplicate
          </Button>,
          <Button key="close" onClick={() => setViewQuoteModal(false)}>
            Close
          </Button>,
        ]}
        styles={{
          body: { maxHeight: '70vh', overflowY: 'auto' }
        }}
      >
        {loadingQuoteDetails ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedQuote ? (
          <div className="space-y-6 mt-6">
            {/* Customer Info */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Customer Information
              </h3>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Name">{selectedQuote.customerName}</Descriptions.Item>
                <Descriptions.Item label="Email">{selectedQuote.customerEmail}</Descriptions.Item>
                <Descriptions.Item label="Phone">{selectedQuote.customerPhone || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Address">
                  {selectedQuote.street}, {selectedQuote.city}, {selectedQuote.state} {selectedQuote.zipCode}
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Job Details */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Job Details
              </h3>
              <Descriptions bordered column={3} size="small">
                <Descriptions.Item label="Job Type">
                  <span className="capitalize">{selectedQuote.jobType}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusBadge status={selectedQuote.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Total">
                  <span className="font-bold text-green-600 text-lg">{formatCurrency(selectedQuote.total)}</span>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Areas Breakdown */}
            {selectedQuote.areas && selectedQuote.areas.length > 0 && (
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Areas & Surfaces
                </h3>
                <div className="space-y-4">
                  {selectedQuote.areas.map((area, index) => (
                    <div key={area.id || index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
                        <h4 className="font-medium text-gray-900">{area.name}</h4>
                      </div>
                      <div className="p-3">
                        {area.laborItems && area.laborItems.length > 0 ? (
                          <Table
                            size="small"
                            dataSource={area.laborItems.filter(item => item.selected)}
                            columns={[
                              {
                                title: 'Surface',
                                dataIndex: 'categoryName',
                                key: 'categoryName',
                              },
                              {
                                title: 'Qty',
                                key: 'quantity',
                                align: 'center',
                                render: (_, item) => `${item.quantity} ${item.measurementUnit}`,
                              },
                              {
                                title: 'Coats',
                                dataIndex: 'numberOfCoats',
                                key: 'numberOfCoats',
                                align: 'center',
                                render: (coats) => coats || '-',
                              },
                              {
                                title: 'Gallons',
                                dataIndex: 'gallons',
                                key: 'gallons',
                                align: 'center',
                                render: (gallons) => gallons ? `${gallons} gal` : '-',
                              },
                            ]}
                            pagination={false}
                            rowKey={(item, idx) => `${area.id || index}-${idx}`}
                          />
                        ) : (
                          <p className="text-sm text-gray-500">No surfaces selected</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedQuote.notes && (
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Notes</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuote.notes}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="text-center text-gray-500">Quote not found</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QuotesListPage;
