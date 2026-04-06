import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Stack,
  IconButton
} from '@mui/material';
import { useParams, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Search from '@mui/icons-material/Search';
import Clear from '@mui/icons-material/Clear';
import Download from '@mui/icons-material/Download';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';
import { buildCashAtHandStatementRows } from '../utils/cashAtHandStatementRows';
import { buildSavingsStatementRows } from '../utils/savingsStatementRows';
import {
  formatCashAtHandDateTime,
  formatCashAtHandDateOnly,
  cashAtHandDateSortMs
} from '../utils/cashAtHandDateDisplay';
import {
  mergeLogsWithInlineDrafts,
  getDefaultDebitCreditStrings
} from '../utils/cashAtHandInlineEdit';
import { mergeSavingsRowsWithDrafts, getDefaultSavingsDebitCreditStrings } from '../utils/savingsInlineEdit';

const formatCurrency = (amount) => `KES ${Math.round(Number(amount || 0)).toLocaleString()}`;

const formatDate = (dateString) =>
  formatCashAtHandDateTime(dateString, 'en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const getSubmissionTypeLabel = (type) => {
  const labels = {
    purchases: 'Purchase',
    cash: 'Expense',
    general_expense: 'General Expense',
    payment_to_office: 'Payment to Office',
    walk_in_sale: 'Walk-in Sale',
    order_payment: 'Order Payment'
  };
  
  // Handle null, undefined, or empty string
  if (!type || type.trim() === '') {
    return 'Unknown Type';
  }
  
  // Return the label or capitalize the type if not found
  return labels[type] || type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/** First two whitespace-separated words of a delivery address (for compact Paid to Office hints). */
const firstTwoAddressWords = (address) => {
  const s = String(address ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const words = s.split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ');
};

/** One-line summary for table column search (no JSX). */
const getDetailsPlainSummary = (s) => {
  const orders = s.orders || [];
  const paymentMethod = String(s?.details?.paymentMethod || '').toLowerCase();
  const isPaidToOffice =
    paymentMethod === 'paid_to_office' || paymentMethod === 'customer_paid_to_office';
  const paidToOfficeSuffix = isPaidToOffice ? ' (Paid to Office)' : '';
  if (orders.length > 0) {
    const nums = orders
      .map((o) => {
        const label = `#${o.orderNumber ?? o.id}`;
        if (!isPaidToOffice) return label;
        const hint = firstTwoAddressWords(o.deliveryAddress ?? o.delivery_address);
        return hint ? `${label} (Paid to Office · ${hint})` : `${label} (Paid to Office)`;
      })
      .join(', ');
    return `${orders.length} order(s): ${nums}`;
  }
  const d = s.details;
  if (!d || typeof d !== 'object') return '';
  switch (s.submissionType) {
    case 'cash': {
      if (d.recipientName) {
        return `to: ${d.recipientName}`;
      }
      if (d.recipient) {
        return `to: ${d.recipient}`;
      }
      if (d.source) {
        return `source: ${d.source}`;
      }
      if (Array.isArray(d.items) && d.items.length > 0) {
        const firstItem = d.items[0].item || d.items[0].name || 'Unknown';
        return `for: ${firstItem}`;
      }
      return '';
    }
    case 'general_expense': {
      if (d.nature) {
        return `Nature: ${d.nature}`;
      }
      if (d.description) {
        return d.description;
      }
      if (Array.isArray(d.items) && d.items.length > 0) {
        const firstItem = d.items[0].item || d.items[0].description || 'No Description';
        return `for: ${firstItem}`;
      }
      return 'No Description';
    }
    case 'payment_to_office': {
      const parts = [];
      
      // Recipient/sender info
      if (d.recipientName) {
        parts.push(`to: ${d.recipientName}`);
      } else if (d.recipient) {
        parts.push(`to: ${d.recipient}`);
      } else if (d.sender) {
        parts.push(`from: ${d.sender}`);
      }
      
      // Account info
      if (d.assetAccountName) {
        parts.push(`via: ${d.assetAccountName}`);
      } else if (d.accountReference) {
        parts.push(`ref: ${d.accountReference}`);
      } else if (d.accountType) {
        parts.push(d.accountType);
      }
      
      // Transaction code if available
      if (d.transactionCode) {
        parts.push(`code: ${d.transactionCode}`);
      }
      
      // Item if available
      if (Array.isArray(d.items) && d.items.length > 0) {
        const firstItem = d.items[0].item || d.items[0].name;
        if (firstItem && parts.length < 3) {
          parts.push(`for: ${firstItem}`);
        }
      }
      
      return parts.slice(0, 3).join(', ');
    }
    case 'purchases': {
      const sup = d.supplier ? `from: ${d.supplier}` : '';
      const item = d.item || (Array.isArray(d.items) && d.items.length > 0 ? d.items[0].item || d.items[0].name : '');
      return [sup, item].filter(Boolean).join(', ');
    }
    case 'order_payment': {
      const parts = [];
      if (d.paymentMethod) {
        const pm = String(d.paymentMethod).toLowerCase();
        if (pm === 'paid_to_office' || pm === 'customer_paid_to_office') {
          parts.push('Method: Paid to Office');
        } else {
          parts.push(`Method: ${d.paymentMethod}`);
        }
      }
      if (Array.isArray(d.orderIds) && d.orderIds.length) {
        const labels = d.orderIds.map((id) => `#${id}${paidToOfficeSuffix}`).join(', ');
        parts.push(`Order IDs: ${labels}`);
      }
      if (d.orderId) parts.push(`Order #${d.orderId}${paidToOfficeSuffix}`);
      return parts.join(' · ');
    }
    case 'walk_in_sale':
      return [d.customerName && `Customer: ${d.customerName}`, d.notes].filter(Boolean).join(' · ');
    default:
      return '';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'approved': return 'success';
    case 'pending': return 'warning';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const getSubmissionReference = (submission) => {
  const d = submission?.details;
  if (!d || typeof d !== 'object') return '—';
  const fromAccount = d.accountReference || d.reference;
  const fromSupplier = d.supplierPayment?.reference;
  const ref = fromAccount || fromSupplier || null;
  return ref && String(ref).trim() ? String(ref).trim() : '—';
};

const getSubmissionTransactionCode = (submission) => {
  const d = submission?.details;
  if (!d || typeof d !== 'object') return '—';
  const code = d.transactionCode || d.txCode || d.receiptNumber || null;
  return code && String(code).trim() ? String(code).trim() : '—';
};

const RiderCashAtHandDetail = () => {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();
  const { user } = useAdmin();
  const isSuperSuperAdmin = user?.role === 'super_super_admin';
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const mapLegacySubmissionsSubTab = (v) => {
    if (typeof v !== 'number') return 0;
    // Legacy mapping (pre-removal of "All Submissions"):
    // 0 = All submissions, 1 = Pending, 2 = Approved, 3 = Rejected
    // New mapping:
    // 0 = Pending, 1 = Approved, 2 = Rejected
    if (v === 1) return 0;
    if (v === 2) return 1;
    if (v === 3) return 2;
    // Any other value (including legacy 0/"All submissions") defaults to Pending
    return 0;
  };

  const initialSubmissionsSubTab = mapLegacySubmissionsSubTab(location.state?.submissionsSubTab);
  const [submissionsSubTab, setSubmissionsSubTab] = useState(initialSubmissionsSubTab);
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [logs, setLogs] = useState([]);
  const [totalCashAtHand, setTotalCashAtHand] = useState(0);
  const [cashAtHandOpeningBalance, setCashAtHandOpeningBalance] = useState(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [openingBalanceSaving, setOpeningBalanceSaving] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [savingsRows, setSavingsRows] = useState([]);
  const [savingsWithdrawals, setSavingsWithdrawals] = useState([]);
  const [savingsWallet, setSavingsWallet] = useState(null);
  const [savingsBalance, setSavingsBalance] = useState(null);
  const [savingsSearch, setSavingsSearch] = useState('');
  const [savingsOpeningInput, setSavingsOpeningInput] = useState('');
  const [savingsOpeningSaving, setSavingsOpeningSaving] = useState(false);
  const [savingsInlineDrafts, setSavingsInlineDrafts] = useState({});
  const [savingsInlineSavingKey, setSavingsInlineSavingKey] = useState(null);
  const savingsInlineDraftsRef = useRef({});
  const savingsSaveTimersRef = useRef({});
  const [logsSearch, setLogsSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmissionId, setRejectSubmissionId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmedSearch, setConfirmedSearch] = useState('');
  const [detailsSubmission, setDetailsSubmission] = useState(null);
  const [cashLogInlineDrafts, setCashLogInlineDrafts] = useState({});
  const [cashLogInlineSavingKey, setCashLogInlineSavingKey] = useState(null);
  const cashLogInlineDraftsRef = useRef({});
  const cashLogSaveTimersRef = useRef({});

  useEffect(() => {
    cashLogInlineDraftsRef.current = cashLogInlineDrafts;
  }, [cashLogInlineDrafts]);

  useEffect(() => {
    savingsInlineDraftsRef.current = savingsInlineDrafts;
  }, [savingsInlineDrafts]);

  const fetchRider = useCallback(async () => {
    if (!riderId) return;
    try {
      const res = await api.get(`/drivers/${riderId}`);
      const data = res.data?.data ?? res.data;
      setRider(data || null);
    } catch {
      setRider(null);
    }
  }, [riderId]);

  const fetchSubmissions = useCallback(async () => {
    if (!riderId) return;
    try {
      const statusMap = { 0: 'pending', 1: 'approved', 2: 'rejected' };
      const statusParam = statusMap[submissionsSubTab];
      const res = await api.get(`/driver-wallet/${riderId}/cash-submissions`, {
        params: statusParam ? { status: statusParam } : { limit: 500 }
      });
      const data = res.data?.data ?? res.data;
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
      setCounts(data?.counts ?? { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      setSubmissions([]);
      setCounts({ pending: 0, approved: 0, rejected: 0 });
    }
  }, [riderId, submissionsSubTab]);

  const fetchLogs = useCallback(async () => {
    if (!riderId) return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/driver-wallet/${riderId}/cash-at-hand`);
      const data = res.data?.data ?? res.data;
      setLogs(Array.isArray(data?.entries) ? data.entries : []);
      setTotalCashAtHand(parseFloat(data?.totalCashAtHand ?? data?.cashAtHand ?? 0) || 0);
      const ob = data?.cashAtHandOpeningBalance;
      const obParsed = ob != null && ob !== '' ? parseFloat(ob) : NaN;
      if (Number.isFinite(obParsed) && obParsed >= 0) {
        setCashAtHandOpeningBalance(obParsed);
        setOpeningBalanceInput(String(Math.round(obParsed)));
      } else {
        setCashAtHandOpeningBalance(null);
        setOpeningBalanceInput('');
      }
    } catch {
      setLogs([]);
      setTotalCashAtHand(0);
      setCashAtHandOpeningBalance(null);
      setOpeningBalanceInput('');
    } finally {
      setLogsLoading(false);
    }
  }, [riderId]);

  const fetchSavings = useCallback(async () => {
    if (!riderId) return;
    setSavingsLoading(true);
    try {
      const res = await api.get(`/driver-wallet/${riderId}`);
      const data = res.data?.data ?? res.data;
      const wallet = data?.wallet || null;
      setSavingsWallet(wallet);
      const raw = Array.isArray(data?.recentSavingsCredits) ? data.recentSavingsCredits : [];
      setSavingsRows(raw);
      setSavingsWithdrawals(Array.isArray(data?.recentWithdrawals) ? data.recentWithdrawals : []);
      if (wallet?.savings !== undefined && wallet?.savings !== null && wallet?.savings !== '') {
        const s = parseFloat(wallet.savings);
        setSavingsBalance(Number.isFinite(s) ? s : null);
      } else {
        setSavingsBalance(null);
      }
      const ob = wallet?.savingsOpeningBalance;
      const obParsed = ob != null && ob !== '' ? parseFloat(ob) : NaN;
      if (Number.isFinite(obParsed) && obParsed >= 0) {
        setSavingsOpeningInput(String(Math.round(obParsed)));
      } else {
        setSavingsOpeningInput('');
      }
    } catch {
      setSavingsRows([]);
      setSavingsWithdrawals([]);
      setSavingsWallet(null);
      setSavingsBalance(null);
      setSavingsOpeningInput('');
    } finally {
      setSavingsLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRider()
      .then(() => {})
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchRider]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  useEffect(() => {
    if (typeof location.state?.submissionsSubTab === 'number') {
      setSubmissionsSubTab(mapLegacySubmissionsSubTab(location.state.submissionsSubTab));
    }
  }, [location.state?.submissionsSubTab]);

  // Only keep/allow search on the Confirmed tab.
  useEffect(() => {
    if (submissionsSubTab !== 1) setConfirmedSearch('');
  }, [submissionsSubTab]);

  useEffect(() => {
    if (tabIndex === 1) fetchLogs();
    if (tabIndex === 2) fetchSavings();
  }, [tabIndex, fetchLogs, fetchSavings]);

  const riderName = rider?.name ?? 'Rider';
  const pendingCount = counts.pending ?? 0;

  const normalizedLogsSearch = String(logsSearch || '').trim().toLowerCase();

  const mergedCashLogs = useMemo(
    () => mergeLogsWithInlineDrafts(Array.isArray(logs) ? logs : [], cashLogInlineDrafts),
    [logs, cashLogInlineDrafts]
  );

  const filteredCashLogs = useMemo(() => {
    if (!Array.isArray(mergedCashLogs) || mergedCashLogs.length === 0) return [];

    const entryType = (entry) => {
      const t = entry.type ?? entry.transaction_type ?? entry.Type;
      return typeof t === 'string' ? t.toLowerCase() : t;
    };

    const getOrderNumber = (entry) => {
      const id = entry.orderId ?? entry.order_id ?? entry.details?.orderId ?? entry.details?.order_id;
      if (id != null) return id;
      const desc = entry.description || '';
      const match = typeof desc === 'string' && desc.match(/Order payment #(\d+)/);
      return match ? match[1] : null;
    };

    const getLogTypeLabel = (entry, isCredit) => {
      const type = entryType(entry);
      if (isCredit || type === 'cash_received') return 'Order';
      return 'Submission';
    };

    const getDescriptionPlain = (entry) => {
      let desc = entry.description || entry.customerName || 'N/A';
      if (typeof desc === 'string') {
        desc = desc.replace(/\s+submission\s*$/i, '').trim();
      }
      return desc || 'N/A';
    };

    const sorted = [...mergedCashLogs].sort((a, b) => cashAtHandDateSortMs(b.date) - cashAtHandDateSortMs(a.date));

    const filtered = normalizedLogsSearch
      ? sorted.filter((entry) => {
          const type = entryType(entry);
          const isCredit = type === 'cash_received';
          const amount = parseFloat(entry.amount || 0);
          const orderNum = getOrderNumber(entry);
          const haystack = [
            entry.date,
            orderNum != null ? `#${orderNum}` : '',
            getLogTypeLabel(entry, isCredit),
            getDescriptionPlain(entry),
            amount
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedLogsSearch);
        })
      : sorted;

    return filtered;
  }, [mergedCashLogs, normalizedLogsSearch]);

  const cashAtHandStatementRows = useMemo(() => {
    const entryType = (entry) => {
      const t = entry.type ?? entry.transaction_type ?? entry.Type;
      return typeof t === 'string' ? t.toLowerCase() : t;
    };
    const getOrderNumber = (entry) => {
      const id = entry.orderId ?? entry.order_id ?? entry.details?.orderId ?? entry.details?.order_id;
      if (id != null) return id;
      const desc = entry.description || '';
      const match = typeof desc === 'string' && desc.match(/Order payment #(\d+)/);
      return match ? match[1] : null;
    };
    const getLogTypeLabel = (entry, isCredit) => {
      const type = entryType(entry);
      if (isCredit || type === 'cash_received') return 'Order';
      return 'Submission';
    };
    const getDescriptionPlain = (entry) => {
      const type = entryType(entry);
      const baseDesc = (entry.description || entry.customerName || '').toString().trim();
      if (type === 'cash_submission') {
        // Use getDetailsPlainSummary for better formatting
        return getDetailsPlainSummary(entry) || baseDesc || 'N/A';
      }
      return baseDesc || 'N/A';
    };

    const base = buildCashAtHandStatementRows(filteredCashLogs, totalCashAtHand, '', {
      openingBalance: cashAtHandOpeningBalance
    });
    return base.map((row) => ({
      ...row,
      orderNum: getOrderNumber(row.entry),
      typeLabel: getLogTypeLabel(row.entry, row.isCredit),
      desc: getDescriptionPlain(row.entry)
    }));
  }, [filteredCashLogs, totalCashAtHand, cashAtHandOpeningBalance]);

  const normalizedSavingsSearch = String(savingsSearch || '').trim().toLowerCase();

  const savingsEntriesModel = useMemo(() => {
    const credits = mergeSavingsRowsWithDrafts(savingsRows, savingsInlineDrafts);
    const withdrawals = Array.isArray(savingsWithdrawals) ? savingsWithdrawals : [];
    const entries = [
      ...credits.map((c) => ({
        ...c,
        amount: parseFloat(c.amount || 0) || 0
      })),
      ...withdrawals.map((w) => ({
        ...w,
        amount: -(parseFloat(w.amount || 0) || 0)
      }))
    ];
    return { entries, total: entries.length };
  }, [savingsRows, savingsWithdrawals, savingsInlineDrafts]);

  const savingsStatementRows = useMemo(() => {
    const { entries } = savingsEntriesModel;
    const current = parseFloat(savingsBalance || 0) || 0;
    const opening = savingsWallet?.savingsOpeningBalance;
    return buildSavingsStatementRows(entries, current, normalizedSavingsSearch, { openingBalance: opening });
  }, [savingsEntriesModel, savingsBalance, normalizedSavingsSearch, savingsWallet]);

  const saveSavingsRow = useCallback(
    async (entryKey) => {
      const row = savingsRows.find((r) => r.entryKey === entryKey);
      if (!row?.entryKey) return;
      const draft = savingsInlineDraftsRef.current[entryKey] || {};
      const defaults = getDefaultSavingsDebitCreditStrings(row);
      const debitStr = draft.debit !== undefined ? draft.debit : defaults.debit;
      const creditStr = draft.credit !== undefined ? draft.credit : defaults.credit;
      const parseField = (s) => {
        const t = String(s ?? '').trim();
        if (t === '') return null;
        const n = parseFloat(t);
        if (!Number.isFinite(n) || n < 0) throw new Error('Amounts must be non-negative numbers or blank');
        return n;
      };
      try {
        setSavingsInlineSavingKey(entryKey);
        await api.put(`/admin/drivers/${riderId}/savings-log-display`, {
          entryKey,
          debitAmount: parseField(debitStr),
          creditAmount: parseField(creditStr)
        });
        setSavingsInlineDrafts((prev) => {
          const next = { ...prev };
          delete next[entryKey];
          return next;
        });
        await fetchSavings();
      } catch (e) {
        alert(e.response?.data?.error || e.message || 'Failed to save');
      } finally {
        setSavingsInlineSavingKey(null);
      }
    },
    [savingsRows, riderId, fetchSavings]
  );

  const scheduleSavingsSave = useCallback(
    (entryKey) => {
      if (savingsSaveTimersRef.current[entryKey]) {
        clearTimeout(savingsSaveTimersRef.current[entryKey]);
      }
      savingsSaveTimersRef.current[entryKey] = setTimeout(() => {
        saveSavingsRow(entryKey);
      }, 850);
    },
    [saveSavingsRow]
  );

  const flushSavingsSave = useCallback(
    (entryKey) => {
      if (savingsSaveTimersRef.current[entryKey]) {
        clearTimeout(savingsSaveTimersRef.current[entryKey]);
        delete savingsSaveTimersRef.current[entryKey];
      }
      saveSavingsRow(entryKey);
    },
    [saveSavingsRow]
  );

  const clearSavingsRowOverrides = useCallback(
    async (entryKey) => {
      if (!entryKey) return;
      try {
        setSavingsInlineSavingKey(entryKey);
        await api.put(`/admin/drivers/${riderId}/savings-log-display`, {
          entryKey,
          debitAmount: null,
          creditAmount: null,
          balanceAfter: null
        });
        setSavingsInlineDrafts((prev) => {
          const next = { ...prev };
          delete next[entryKey];
          return next;
        });
        await fetchSavings();
      } catch (e) {
        alert(e.response?.data?.error || e.message || 'Failed to clear');
      } finally {
        setSavingsInlineSavingKey(null);
      }
    },
    [riderId, fetchSavings]
  );

  const saveSavingsOpeningBalance = async () => {
    const t = String(savingsOpeningInput ?? '').trim();
    try {
      setSavingsOpeningSaving(true);
      if (t === '') {
        await api.put(`/admin/drivers/${riderId}/savings-opening-balance`, {
          savingsOpeningBalance: null
        });
      } else {
        const n = parseFloat(t);
        if (!Number.isFinite(n) || n < 0) {
          alert('Opening balance must be a non-negative number or blank to clear.');
          return;
        }
        await api.put(`/admin/drivers/${riderId}/savings-opening-balance`, {
          savingsOpeningBalance: n
        });
      }
      await fetchSavings();
    } catch (e) {
      alert(e.response?.data?.error || e.message || 'Failed to save opening balance');
    } finally {
      setSavingsOpeningSaving(false);
    }
  };

  const parseCashLogField = (s) => {
    const t = String(s ?? '').trim();
    if (t === '') return null;
    const n = parseFloat(t);
    if (!Number.isFinite(n) || n < 0) throw new Error('Amounts must be non-negative numbers or blank');
    return n;
  };

  const saveCashLogRow = useCallback(
    async (entryKey) => {
      const entry = logs.find((e) => e.entryKey === entryKey);
      if (!entry?.entryKey) return;
      const draft = cashLogInlineDraftsRef.current[entryKey] || {};
      const defaults = getDefaultDebitCreditStrings(entry);
      const debitStr = draft.debit !== undefined ? draft.debit : defaults.debit;
      const creditStr = draft.credit !== undefined ? draft.credit : defaults.credit;
      try {
        setCashLogInlineSavingKey(entryKey);
        await api.put(`/admin/drivers/${riderId}/cash-at-hand-log-display`, {
          entryKey,
          debitAmount: parseCashLogField(debitStr),
          creditAmount: parseCashLogField(creditStr)
        });
        setCashLogInlineDrafts((prev) => {
          const next = { ...prev };
          delete next[entryKey];
          return next;
        });
        await fetchLogs();
      } catch (e) {
        alert(e.response?.data?.error || e.message || 'Failed to save');
      } finally {
        setCashLogInlineSavingKey(null);
      }
    },
    [logs, riderId, fetchLogs]
  );

  const scheduleCashLogSave = useCallback(
    (entryKey) => {
      if (cashLogSaveTimersRef.current[entryKey]) {
        clearTimeout(cashLogSaveTimersRef.current[entryKey]);
      }
      cashLogSaveTimersRef.current[entryKey] = setTimeout(() => {
        saveCashLogRow(entryKey);
      }, 850);
    },
    [saveCashLogRow]
  );

  const flushCashLogSave = useCallback(
    (entryKey) => {
      if (cashLogSaveTimersRef.current[entryKey]) {
        clearTimeout(cashLogSaveTimersRef.current[entryKey]);
        delete cashLogSaveTimersRef.current[entryKey];
      }
      saveCashLogRow(entryKey);
    },
    [saveCashLogRow]
  );

  const clearCashLogRowOverrides = useCallback(
    async (entryKey) => {
      if (!entryKey) return;
      try {
        setCashLogInlineSavingKey(entryKey);
        await api.put(`/admin/drivers/${riderId}/cash-at-hand-log-display`, {
          entryKey,
          debitAmount: null,
          creditAmount: null,
          balanceAfter: null
        });
        setCashLogInlineDrafts((prev) => {
          const next = { ...prev };
          delete next[entryKey];
          return next;
        });
        await fetchLogs();
      } catch (e) {
        alert(e.response?.data?.error || e.message || 'Failed to clear');
      } finally {
        setCashLogInlineSavingKey(null);
      }
    },
    [riderId, fetchLogs]
  );

  const saveOpeningBalance = async () => {
    const t = String(openingBalanceInput ?? '').trim();
    try {
      setOpeningBalanceSaving(true);
      if (t === '') {
        await api.put(`/admin/drivers/${riderId}/cash-at-hand-opening-balance`, {
          cashAtHandOpeningBalance: null
        });
      } else {
        const n = parseFloat(t);
        if (!Number.isFinite(n) || n < 0) {
          alert('Opening balance must be a non-negative number or blank to clear.');
          return;
        }
        await api.put(`/admin/drivers/${riderId}/cash-at-hand-opening-balance`, {
          cashAtHandOpeningBalance: n
        });
      }
      await fetchLogs();
    } catch (e) {
      alert(e.response?.data?.error || e.message || 'Failed to save opening balance');
    } finally {
      setOpeningBalanceSaving(false);
    }
  };

  const handleExportCashAtHandStatementCSV = () => {
    if (!cashAtHandStatementRows.length) {
      alert('No cash at hand transactions to export');
      return;
    }

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = ['Date', 'Order #', 'Type', 'Description', 'Debit (KES)', 'Credit (KES)', 'Balance (KES)'];
    const rows = cashAtHandStatementRows.map(({ entry, orderNum, typeLabel, desc, debitDisplay, creditDisplay, balance }) => {
      const date = entry?.date ? new Date(entry.date).toISOString() : '';
      const d = debitDisplay === '—' ? '' : debitDisplay;
      const c = creditDisplay === '—' ? '' : creditDisplay;
      return [
        escapeCSV(date),
        escapeCSV(orderNum != null ? `#${orderNum}` : ''),
        escapeCSV(typeLabel),
        escapeCSV(desc),
        escapeCSV(d),
        escapeCSV(c),
        escapeCSV(Math.round(balance))
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = (riderName || `rider-${riderId}`).toString().replace(/[^a-z0-9-_]+/gi, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `cash-at-hand-statement-${safeName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApprove = (submissionId) => {
    // Route to the detailed approval page so admin can assign an account
    navigate(`/cash-at-hand/submissions/${submissionId}/approve`);
  };

  const handleRejectClick = (submissionId) => {
    setRejectSubmissionId(submissionId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!riderId || rejectSubmissionId == null) return;
    setActionLoadingId(rejectSubmissionId);
    setError(null);
    try {
      await api.post(`/driver-wallet/${riderId}/cash-submissions/${rejectSubmissionId}/reject`, {
        rejectionReason: rejectReason || undefined
      });
      setRejectDialogOpen(false);
      setRejectSubmissionId(null);
      setRejectReason('');
      setDetailsSubmission(null);
      await fetchSubmissions();
      await fetchLogs();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to reject submission');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDetails = (s) => setDetailsSubmission(s);
  const closeDetails = () => setDetailsSubmission(null);

  const handleApproveFromDetails = (submissionId) => {
    closeDetails();
    handleApprove(submissionId);
  };

  const handleRejectFromDetails = (submissionId) => {
    closeDetails();
    handleRejectClick(submissionId);
  };

  const renderSubmissionDetailsDialogContent = (s) => {
    const d = s.details && typeof s.details === 'object' ? s.details : {};
    const orders = s.orders || [];
    const metaLine = (label, value) =>
      value != null && value !== '' ? (
        <Box key={label}>
          <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textPrimary }}>
            {value}
          </Typography>
        </Box>
      ) : null;

    return (
      <Stack spacing={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Chip size="small" label={getSubmissionTypeLabel(s.submissionType)} color="primary" variant="outlined" />
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            ID #{s.id}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={3} flexWrap="wrap" alignItems="center">
          <Box>
            <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
              Amount
            </Typography>
            <Typography variant="h6" sx={{ color: colors.textPrimary }}>
              {formatCurrency(s.amount)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
              Status
            </Typography>
            <Chip size="small" label={s.status} color={getStatusColor(s.status)} sx={{ mt: 0.25 }} />
          </Box>
        </Stack>

        {orders.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textPrimary }}>
              Linked orders
            </Typography>
            <Stack spacing={1}>
              {orders.map((order) => {
                const address = order.deliveryAddress ?? order.delivery_address ?? '';
                return (
                  <Paper
                    key={order.id}
                    variant="outlined"
                    sx={{ p: 1.5, backgroundColor: colors.paper, borderColor: colors.border }}
                  >
                    <Typography variant="body2" fontWeight={600} sx={{ color: colors.textPrimary }}>
                      Order #{order.orderNumber ?? order.id}
                      {order.customerName ? ` · ${order.customerName}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mt: 0.5 }}>
                      {address || 'No address'}
                    </Typography>
                    {order.totalAmount != null && (
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        Total: {formatCurrency(order.totalAmount)} · Status: {order.status ?? '—'}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}

        {s.submissionType === 'purchases' && (
          <Box>
            {metaLine('Supplier', d.supplier)}
            {metaLine('Delivery location', d.deliveryLocation)}
            {Array.isArray(d.items) && d.items.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Items</Typography>
                {d.items.map((it, idx) => (
                  <Typography key={idx} variant="body2" sx={{ color: colors.textPrimary }}>
                    {it.item || it.name || 'Item'} × {it.quantity ?? 1}
                    {it.price != null ? ` · ${formatCurrency(it.price)}` : ''}
                    {it.capacity ? ` · ${it.capacity}` : ''}
                  </Typography>
                ))}
              </Box>
            )}
            {d.item && d.price != null && !(Array.isArray(d.items) && d.items.length) && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {d.item} × {formatCurrency(d.price)}
              </Typography>
            )}
          </Box>
        )}

        {s.submissionType === 'cash' && (
          <Box>
            {metaLine('Recipient', d.recipientName)}
            {Array.isArray(d.items) && d.items.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Items</Typography>
                {d.items.map((it, idx) => (
                  <Typography key={idx} variant="body2">
                    {it.item || it.name || 'Item'} × {it.quantity ?? 1}
                    {it.price != null ? ` · ${formatCurrency(it.price)}` : ''}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {s.submissionType === 'general_expense' && (
          <Box>
            {metaLine('Nature', d.nature)}
            {Array.isArray(d.items) && d.items.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Line items</Typography>
                {d.items.map((it, idx) => (
                  <Typography key={idx} variant="body2">
                    {it.item || it.description || 'Item'} — {formatCurrency(it.amount ?? it.price ?? 0)}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {s.submissionType === 'payment_to_office' && (
          <Box>
            {metaLine('Account type', d.accountType)}
            {metaLine('Reference', d.reference)}
            {Array.isArray(d.items) && d.items.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Items</Typography>
                {d.items.map((it, idx) => (
                  <Typography key={idx} variant="body2">
                    {it.item || it.description || 'Item'} — {formatCurrency(it.amount ?? it.price ?? 0)}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        {s.submissionType === 'order_payment' && (
          <Box>
            {metaLine(
              'Payment method',
              (() => {
                const pm = String(d.paymentMethod || '').toLowerCase();
                if (pm === 'paid_to_office' || pm === 'customer_paid_to_office') return 'Paid to Office';
                return d.paymentMethod;
              })()
            )}
            {/* Avoid duplicate Order ID fields when linked orders are already rendered above */}
            {orders.length === 0 && Array.isArray(d.orderIds) && d.orderIds.length > 0 && metaLine('Order IDs', d.orderIds.join(', '))}
            {orders.length === 0 && d.orderId != null && metaLine('Order ID', String(d.orderId))}
          </Box>
        )}

        {s.submissionType === 'walk_in_sale' && (
          <Box>
            {metaLine('Customer', d.customerName)}
            {metaLine('Notes', d.notes)}
          </Box>
        )}

        {orders.length === 0 &&
          (!d || Object.keys(d).length === 0) &&
          ['purchases', 'cash', 'general_expense', 'payment_to_office', 'order_payment', 'walk_in_sale'].includes(
            s.submissionType
          ) && (
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              No additional structured details for this submission.
            </Typography>
          )}

        <Divider sx={{ borderColor: colors.border }} />

        <Stack spacing={1}>
          {metaLine('Submitted', formatDate(s.createdAt))}
          {s.status === 'approved' && (
            <>
              {metaLine('Approved by', s.approver?.name || s.approver?.username || '—')}
              {metaLine('Approved at', s.approvedAt ? formatDate(s.approvedAt) : '—')}
            </>
          )}
          {s.status === 'rejected' && (
            <>
              {metaLine('Rejected by', s.rejector?.name || s.rejector?.username || '—')}
              {metaLine('Rejected at', s.rejectedAt ? formatDate(s.rejectedAt) : '—')}
              {metaLine('Reason', s.rejectionReason || '—')}
            </>
          )}
        </Stack>
      </Stack>
    );
  };

  const confirmedQuery = String(confirmedSearch || '').trim().toLowerCase();
  const submissionsForTable =
    submissionsSubTab === 1 && confirmedQuery
      ? submissions.filter((s) => {
          const detailsText = `${getSubmissionTypeLabel(s.submissionType)} ${getDetailsPlainSummary(s)}`;
          const haystack = `${s.id} ${s.submissionType} ${s.amount} ${detailsText}`;
          return haystack.toLowerCase().includes(confirmedQuery);
        })
      : submissions;

  if (loading && !rider) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: colors.accent }} />
      </Box>
    );
  }

  if (!rider && !loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Rider not found.</Alert>
        <Button component={RouterLink} to="/riders" startIcon={<ArrowBack />} sx={{ mt: 2 }}>
          Back to Riders
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button
        component={RouterLink}
        to="/riders"
        startIcon={<ArrowBack />}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Riders
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Typography variant="h5" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
        {riderName} Cash at Hand Details
      </Typography>
      <Paper sx={{ backgroundColor: colors.paper }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <Tab
            label={
              <Badge badgeContent={pendingCount} color="error" max={99}>
                <span>Submissions</span>
              </Badge>
            }
          />
          <Tab label="Logs" />
          <Tab label="Savings" />
        </Tabs>
        {tabIndex === 0 && (
          <Box sx={{ p: 2 }}>
            <Tabs
              value={submissionsSubTab}
              onChange={(_, v) => setSubmissionsSubTab(v)}
              sx={{ borderBottom: `1px solid ${colors.border}`, mb: 2 }}
            >
              {/* Removed "All Submissions" tab; tabs now start at Pending */}
              <Tab
                label={
                  <Badge badgeContent={pendingCount} color="error" max={99}>
                    <span>Pending</span>
                  </Badge>
                }
              />
              <Tab label="Confirmed" />
              <Tab label="Rejected" />
            </Tabs>
            {submissionsSubTab === 1 && (
              <TextField
                size="small"
                fullWidth
                placeholder="Search confirmed submissions..."
                value={confirmedSearch}
                onChange={(e) => setConfirmedSearch(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date posted</TableCell>
                    <TableCell>Date approved</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>Details</TableCell>
                    {submissionsSubTab !== 0 && <TableCell>Reference</TableCell>}
                    {submissionsSubTab !== 0 && <TableCell>Transaction Code</TableCell>}
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissionsForTable.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={submissionsSubTab !== 0 ? 9 : 7} align="center" sx={{ color: colors.textSecondary, py: 3 }}>
                        No submissions in this category.
                      </TableCell>
                    </TableRow>
                  ) : (
                    submissionsForTable.map((s) => (
                      <TableRow
                        key={s.id}
                        hover
                        onClick={() => openDetails(s)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                          {formatDate(s.createdAt)}
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                          {s.approvedAt ? formatDate(s.approvedAt) : '—'}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <Chip
                            size="small"
                            label={getSubmissionTypeLabel(s.submissionType)}
                            variant="outlined"
                            sx={{ borderColor: colors.border, color: colors.textPrimary }}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 400, verticalAlign: 'top' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: colors.textSecondary,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.35
                            }}
                            title={getDetailsPlainSummary(s) || undefined}
                          >
                            {getDetailsPlainSummary(s) || '—'}
                          </Typography>
                        </TableCell>
                        {submissionsSubTab !== 0 && (
                          <TableCell sx={{ color: colors.textSecondary, maxWidth: 180 }}>
                            <Typography variant="body2" noWrap title={getSubmissionReference(s)}>
                              {getSubmissionReference(s)}
                            </Typography>
                          </TableCell>
                        )}
                        {submissionsSubTab !== 0 && (
                          <TableCell sx={{ color: colors.textSecondary, maxWidth: 180 }}>
                            <Typography variant="body2" noWrap title={getSubmissionTransactionCode(s)}>
                              {getSubmissionTransactionCode(s)}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ color: colors.textPrimary, whiteSpace: 'nowrap' }}>
                          {formatCurrency(s.amount)}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={s.status} color={getStatusColor(s.status)} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="flex-end"
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {s.status === 'pending' && (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  disabled={actionLoadingId === s.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(s.id);
                                  }}
                                >
                                  {actionLoadingId === s.id ? '…' : 'Approve'}
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  disabled={actionLoadingId === s.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectClick(s.id);
                                  }}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle sx={{ color: colors.textPrimary }}>Reject cash submission</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Rejection reason (optional)"
                  fullWidth
                  multiline
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  sx={{ mt: 1 }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRejectDialogOpen(false)} sx={{ color: colors.textSecondary }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRejectConfirm}
                  color="error"
                  variant="contained"
                  disabled={rejectSubmissionId != null && actionLoadingId === rejectSubmissionId}
                >
                  {rejectSubmissionId != null && actionLoadingId === rejectSubmissionId ? 'Rejecting…' : 'Reject'}
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={Boolean(detailsSubmission)}
              onClose={closeDetails}
              maxWidth="sm"
              fullWidth
              scroll="paper"
            >
              <DialogTitle sx={{ color: colors.textPrimary }}>Cash submission details</DialogTitle>
              <DialogContent dividers>
                {detailsSubmission && renderSubmissionDetailsDialogContent(detailsSubmission)}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Button onClick={closeDetails} sx={{ color: colors.textSecondary }}>
                  Close
                </Button>
                {detailsSubmission?.status === 'pending' && (
                  <>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleRejectFromDetails(detailsSubmission.id)}
                    >
                      Reject
                    </Button>
                    <Button variant="contained" onClick={() => handleApproveFromDetails(detailsSubmission.id)}>
                      Approve
                    </Button>
                  </>
                )}
              </DialogActions>
            </Dialog>
          </Box>
        )}
        {tabIndex === 1 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Cash at Hand Transactions
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportCashAtHandStatementCSV}
                disabled={logsLoading || cashAtHandStatementRows.length === 0}
                sx={{ borderColor: colors.border, color: colors.textPrimary }}
              >
                Export statement
              </Button>
            </Box>
            {isSuperSuperAdmin && (
              <Box
                sx={{
                  mb: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  flexWrap: 'wrap',
                  maxWidth: 720
                }}
              >
                <TextField
                  size="small"
                  label="Statement opening balance (KES)"
                  helperText="Cash before the oldest transaction. Leave blank to compute from current balance automatically."
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  sx={{ minWidth: 260, flex: '1 1 220px' }}
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={saveOpeningBalance}
                  disabled={openingBalanceSaving}
                  sx={{ mt: 0.5 }}
                >
                  {openingBalanceSaving ? 'Saving…' : 'Save opening'}
                </Button>
              </Box>
            )}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search cash at hand (order #, description, amount, date...)"
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
                sx={{ maxWidth: 520 }}
                InputProps={{
                  startAdornment: <Search sx={{ color: colors.textSecondary, mr: 1 }} />
                }}
              />
              {normalizedLogsSearch && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Clear />}
                  onClick={() => setLogsSearch('')}
                  sx={{ borderColor: colors.border, color: colors.textPrimary }}
                >
                  Clear
                </Button>
              )}
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Showing {cashAtHandStatementRows.length} / {Array.isArray(logs) ? logs.length : 0}
              </Typography>
            </Box>
            {logsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: colors.accent }} />
              </Box>
            ) : !logs || logs.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
                <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                  No cash at hand transactions found
                </Typography>
              </Paper>
            ) : cashAtHandStatementRows.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
                <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                  No cash at hand transactions match your search.
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Credit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Debit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Balance</TableCell>
                      {isSuperSuperAdmin && (
                        <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="center" width={48}>
                          Reset
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cashAtHandStatementRows.map(({ entry, debitDisplay, creditDisplay, balance, orderNum, typeLabel, desc, type }, index) => {
                      const ek = entry.entryKey;
                      const defaults = ek ? getDefaultDebitCreditStrings(entry) : { debit: '', credit: '' };
                      const draft = ek ? cashLogInlineDrafts[ek] || {} : {};
                      const debitInput =
                        draft.debit !== undefined ? draft.debit : defaults.debit;
                      const creditInput =
                        draft.credit !== undefined ? draft.credit : defaults.credit;
                      const isCr = type === 'cash_received';
                      const saving = ek && cashLogInlineSavingKey === ek;
                      const inlineCellSx = {
                        '& .MuiInputBase-input': { textAlign: 'right', py: 0.5, fontSize: '0.875rem' },
                        maxWidth: 120
                      };
                      return (
                        <TableRow key={entry.transactionId ?? entry.id ?? index} hover>
                          <TableCell sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                            {cashAtHandStatementRows.length - index}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {formatCashAtHandDateOnly(entry.date, 'en-KE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {orderNum != null ? `#${orderNum}` : '—'}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>{typeLabel}</TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>{desc}</TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, verticalAlign: 'middle' }}>
                            {isSuperSuperAdmin && ek ? (
                              isCr ? (
                                <TextField
                                  size="small"
                                  variant="standard"
                                  disabled={saving}
                                  placeholder="—"
                                  value={creditInput}
                                  onChange={(e) => {
                                    setCashLogInlineDrafts((prev) => ({
                                      ...prev,
                                      [ek]: { ...prev[ek], credit: e.target.value }
                                    }));
                                    scheduleCashLogSave(ek);
                                  }}
                                  onBlur={() => flushCashLogSave(ek)}
                                  sx={inlineCellSx}
                                />
                              ) : (
                                '—'
                              )
                            ) : creditDisplay === '—' ? (
                              '—'
                            ) : (
                              formatCurrency(creditDisplay)
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, verticalAlign: 'middle' }}>
                            {isSuperSuperAdmin && ek ? (
                              <TextField
                                size="small"
                                variant="standard"
                                disabled={saving}
                                placeholder="—"
                                value={debitInput}
                                onChange={(e) => {
                                  setCashLogInlineDrafts((prev) => ({
                                    ...prev,
                                    [ek]: { ...prev[ek], debit: e.target.value }
                                  }));
                                  scheduleCashLogSave(ek);
                                }}
                                onBlur={() => flushCashLogSave(ek)}
                                sx={inlineCellSx}
                              />
                            ) : debitDisplay === '—' ? (
                              '—'
                            ) : (
                              formatCurrency(debitDisplay)
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            {formatCurrency(balance)}
                          </TableCell>
                          {isSuperSuperAdmin && (
                            <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
                              {ek ? (
                                <IconButton
                                  size="small"
                                  aria-label="Clear overrides for this row"
                                  disabled={saving}
                                  onClick={() => clearCashLogRowOverrides(ek)}
                                  sx={{ color: colors.textSecondary }}
                                >
                                  <Clear fontSize="small" />
                                </IconButton>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {isSuperSuperAdmin && logs.length > 0 && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: colors.textSecondary }}>
                Edit Credit and Debit inline; the balance column updates as you type. Values save automatically after a short
                pause or when you leave a field. Use Reset to clear all overrides for a row.
              </Typography>
            )}
          </Box>
        )}
        {tabIndex === 2 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Savings Credits
              </Typography>
              {savingsBalance != null && (
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Current savings: {formatCurrency(savingsBalance)}
                </Typography>
              )}
            </Box>
            {isSuperSuperAdmin && (
              <Box
                sx={{
                  mb: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  flexWrap: 'wrap',
                  maxWidth: 720
                }}
              >
                <TextField
                  size="small"
                  label="Statement opening balance (KES)"
                  helperText="Savings before the oldest transaction. Leave blank for auto."
                  value={savingsOpeningInput}
                  onChange={(e) => setSavingsOpeningInput(e.target.value)}
                  sx={{ minWidth: 260, flex: '1 1 220px' }}
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={saveSavingsOpeningBalance}
                  disabled={savingsOpeningSaving}
                  sx={{ mt: 0.5 }}
                >
                  {savingsOpeningSaving ? 'Saving…' : 'Save opening'}
                </Button>
              </Box>
            )}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search savings (order #, description, amount, date...)"
                value={savingsSearch}
                onChange={(e) => setSavingsSearch(e.target.value)}
                sx={{ maxWidth: 520 }}
                InputProps={{
                  startAdornment: <Search sx={{ color: colors.textSecondary, mr: 1 }} />
                }}
              />
              {normalizedSavingsSearch && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Clear />}
                  onClick={() => setSavingsSearch('')}
                  sx={{ borderColor: colors.border, color: colors.textPrimary }}
                >
                  Clear
                </Button>
              )}
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Showing {savingsStatementRows.length} / {savingsEntriesModel.total}
              </Typography>
            </Box>
            {savingsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: colors.accent }} />
              </Box>
            ) : savingsEntriesModel.total === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
                <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                  No savings transactions found
                </Typography>
              </Paper>
            ) : savingsStatementRows.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
                <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                  No savings transactions match your search.
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Debit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Credit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Balance</TableCell>
                      {isSuperSuperAdmin && (
                        <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="center" width={48}>
                          Reset
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {savingsStatementRows.map(({ row, debitDisplay, creditDisplay, balance }, idx) => {
                      const orderNum = row.orderId ?? row.orderNumber ?? null;
                      const ek = row.entryKey;
                      const saving = ek && savingsInlineSavingKey === ek;
                      const defaults = ek ? getDefaultSavingsDebitCreditStrings(row) : { debit: '', credit: '' };
                      const draft = ek ? savingsInlineDrafts[ek] || {} : {};
                      const debitInput = draft.debit !== undefined ? draft.debit : defaults.debit;
                      const creditInput = draft.credit !== undefined ? draft.credit : defaults.credit;
                      const inlineCellSx = {
                        '& .MuiInputBase-input': { textAlign: 'right', py: 0.5, fontSize: '0.875rem' },
                        maxWidth: 120
                      };
                      return (
                        <TableRow key={ek ?? row.id ?? `${row.orderId ?? 'row'}-${idx}`} hover>
                          <TableCell sx={{ color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                            {formatDate(row.date)}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {orderNum != null ? `#${orderNum}` : '—'}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {row.notes || '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {isSuperSuperAdmin && ek ? (
                              <TextField
                                size="small"
                                variant="standard"
                                disabled={saving}
                                placeholder="—"
                                value={debitInput}
                                onChange={(e) => {
                                  setSavingsInlineDrafts((prev) => ({
                                    ...prev,
                                    [ek]: { ...prev[ek], debit: e.target.value }
                                  }));
                                  scheduleSavingsSave(ek);
                                }}
                                onBlur={() => flushSavingsSave(ek)}
                                sx={inlineCellSx}
                              />
                            ) : debitDisplay === '—' ? '—' : formatCurrency(debitDisplay)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {isSuperSuperAdmin && ek ? (
                              <TextField
                                size="small"
                                variant="standard"
                                disabled={saving}
                                placeholder="—"
                                value={creditInput}
                                onChange={(e) => {
                                  setSavingsInlineDrafts((prev) => ({
                                    ...prev,
                                    [ek]: { ...prev[ek], credit: e.target.value }
                                  }));
                                  scheduleSavingsSave(ek);
                                }}
                                onBlur={() => flushSavingsSave(ek)}
                                sx={inlineCellSx}
                              />
                            ) : creditDisplay === '—' ? '—' : formatCurrency(creditDisplay)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            {formatCurrency(balance)}
                          </TableCell>
                          {isSuperSuperAdmin && (
                            <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
                              {ek ? (
                                <IconButton
                                  size="small"
                                  aria-label="Clear savings overrides for this row"
                                  disabled={saving}
                                  onClick={() => clearSavingsRowOverrides(ek)}
                                  sx={{ color: colors.textSecondary }}
                                >
                                  <Clear fontSize="small" />
                                </IconButton>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {isSuperSuperAdmin && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: colors.textSecondary }}>
                Savings rows can be edited inline; values save automatically after a short pause or when you leave a field. Reset clears overrides.
              </Typography>
            )}
          </Box>
        )}
      </Paper>

    </Box>
  );
};

export default RiderCashAtHandDetail;
