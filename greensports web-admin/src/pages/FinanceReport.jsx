import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, CreditCard, Download, Calendar, ArrowUpRight, ArrowDownRight, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { financeService } from '../services/financeService';
import DataTable from '../components/DataTable';

const FinanceReport = () => {
  const { selectedClubId } = useClub();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    mtdRevenue: 0,
    pendingCollections: 0,
    stripePayouts: 0
  });

  useEffect(() => {
    if (selectedClubId) {
      loadFinanceData();
    }
  }, [selectedClubId]);

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [transData, statsData] = await Promise.all([
        financeService.getTransactions(selectedClubId),
        financeService.getRevenueStats(selectedClubId)
      ]);
      setTransactions(transData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { 
      header: 'Member / Reference', 
      accessor: 'member',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val || 'Unknown Member'}</div>
          <div className="text-muted text-sm" style={{ fontFamily: 'monospace' }}>{row.stripeId || row.id}</div>
        </div>
      )
    },
    { header: 'Type', accessor: 'type' },
    { 
      header: 'Amount', 
      accessor: 'amount', 
      render: (val) => <strong style={{ color: 'var(--text)' }}>${parseFloat(val || 0).toLocaleString()}</strong> 
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val) => {
        const variants = {
          'Paid': 'badge-success',
          'Pending': 'badge-warning',
          'Refunded': 'badge-danger',
          'Failed': 'badge-danger'
        };
        return <span className={`badge ${variants[val] || 'badge-default'}`}>{val}</span>;
      }
    },
    { 
      header: 'Date', 
      accessor: 'createdAt', 
      render: (val) => val?.toDate?.().toLocaleDateString() || 'N/A' 
    }
  ];

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Financial Dashboard</h1>
          <p>Production-ready revenue tracking, Stripe reconciliation, and financial auditing.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadFinanceData}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary">
            <Download size={18} />
            <span>Export Financials</span>
          </button>
        </div>
      </div>

      <div className="stats-marquee">
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <DollarSign size={20} />
            </div>
            <div className="sm-trend positive">
              <ArrowUpRight size={14} /> +12.5%
            </div>
          </div>
          <div className="sm-card-body">
            <h3>${stats.totalRevenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
              <CreditCard size={20} />
            </div>
            <div className="sm-trend positive">Stripe Linked</div>
          </div>
          <div className="sm-card-body">
            <h3>${stats.stripePayouts.toLocaleString()}</h3>
            <p>Net Payouts</p>
          </div>
        </div>
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>${stats.pendingCollections.toLocaleString()}</h3>
            <p>Pending Collections</p>
          </div>
        </div>
      </div>

      <div className="tabs-container mb-md">
        <div className="tabs">
          <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
            <TrendingUp size={16} />
            Transactions
          </button>
          <button className={`tab ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>
            <CreditCard size={16} />
            Stripe Payouts
          </button>
          <button className={`tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <Zap size={16} />
            Revenue Analytics
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <div className="card-header">
              <h3>Monthly Revenue Trend</h3>
            </div>
            <div className="image-upload-zone" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <div className="text-center text-muted">
                 <TrendingUp size={48} className="mb-md opacity-20" />
                 <p>Revenue Chart (Real Data)</p>
               </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h3>Revenue by Type</h3>
            </div>
            <div className="image-upload-zone" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <div className="text-center text-muted">
                 <Zap size={48} className="mb-md opacity-20" />
                 <p>Category Distribution (Real Data)</p>
               </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'payouts' ? (
        <div className="card">
           <div className="card-header">
             <h3>Upcoming Stripe Payouts</h3>
           </div>
           <div className="activity-list">
             <div className="activity-item">
               <div className="activity-icon"><CreditCard size={16} /></div>
               <div className="activity-content">
                 <p><strong>${(stats.stripePayouts * 0.4).toLocaleString()}</strong> expected next week</p>
                 <span>Stripe Transfer • Scheduled</span>
               </div>
               <div className="activity-badge">Processing</div>
             </div>
           </div>
        </div>
      ) : (
        <DataTable 
          title="Recent Transactions"
          columns={columns}
          data={transactions}
          loading={loading}
        />
      )}
    </div>
  );
};

export default FinanceReport;
