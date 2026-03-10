import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  InputAdornment,
  TablePagination,
  Tabs,
  Tab
} from '@mui/material';
import { Receipt, Search } from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Payables = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, colors } = useTheme();
  const [currentTab, setCurrentTab] = useState(0); // 0: Unpaid, 1: Paid
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [purchasePage, setPurchasePage] = useState(0);
  const [purchaseRowsPerPage, setPurchaseRowsPerPage] = useState(10);
  const [purchaseDetailsOpen, setPurchaseDetailsOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [assetAccounts, setAssetAccounts] = useState([]);

  useEffect(() => {
    if (location.state) {
      const { tab } = location.state;
      if (typeof tab === 'number') {
        setCurrentTab(tab === 2 ? 1 : tab === 3 ? 0 : tab === 1 ? 0 : Math.min(1, Math.max(0, tab)));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state]);

  useEffect(() => {
    // Both Unpaid and Paid tabs need purchases and suppliers (for invoice tables and supplier links)
    fetchPurchases();
    fetchSuppliers();
    const loadAccounts = async () => {
      try {
        const res = await api.get('/admin/accounts');
        setAssetAccounts(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching asset accounts:', err);
      }
    };
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  useEffect(() => {
    setPurchasePage(0);
  }, [currentTab]);

  const fetchSuppliers = async () => {
    try {
      setError(null);
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError('Failed to fetch suppliers. Please try again.');
    }
  };

  const fetchPurchases = async () => {
    try {
      setPurchasesLoading(true);
      setError(null);
      const response = await api.get('/driver-wallet/admin/cash-submissions/all', {
        params: { limit: 1000 }
      });
      // Handle standardized API response format: { success: true, data: { submissions, total } }
      const submissions = response.data?.data?.submissions || response.data?.submissions || [];
      // Filter for purchases type and sort by newest first (createdAt DESC)
      const purchaseSubmissions = Array.isArray(submissions) 
        ? submissions
            .filter(submission => submission.submissionType === 'purchases')
            .sort((a, b) => {
              const dateA = new Date(a.createdAt || 0);
              const dateB = new Date(b.createdAt || 0);
              return dateB - dateA; // Newest first
            })
        : [];
      setPurchases(purchaseSubmissions);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setError('Failed to fetch purchases. Please try again.');
    } finally {
      setPurchasesLoading(false);
    }
  };

  const getPurchaseStatus = (p) => {
    const attachedToAccount = !!(p.details?.assetAccountId != null && p.details?.assetAccountId !== '');
    const amount = parseFloat(p.amount) || 0;
    const amountPaid = (p.details?.amountPaid != null) ? parseFloat(p.details.amountPaid) : 0;
    return attachedToAccount || amountPaid >= amount ? 'Paid' : 'Unpaid';
  };

  const applyPurchaseSearch = (list, term) => {
    if (!(term || '').trim()) return list;
    const searchLower = (term || '').toLowerCase();
    return list.filter((purchase) => {
      const supplier = purchase.details?.supplier || '';
      const item = purchase.details?.item || '';
      const items = purchase.details?.items || [];
      const itemsText = Array.isArray(items) ? items.map((i) => i.item || i.name || '').join(' ') : '';
      return supplier.toLowerCase().includes(searchLower) ||
        item.toLowerCase().includes(searchLower) ||
        itemsText.toLowerCase().includes(searchLower);
    });
  };

  const paidPurchases = useMemo(() => purchases.filter((p) => getPurchaseStatus(p) === 'Paid'), [purchases]);
  const unpaidPurchases = useMemo(() => purchases.filter((p) => getPurchaseStatus(p) === 'Unpaid'), [purchases]);
  const paidFilteredPurchases = useMemo(() => applyPurchaseSearch(paidPurchases, purchaseSearchTerm), [paidPurchases, purchaseSearchTerm]);
  const unpaidFilteredPurchases = useMemo(() => applyPurchaseSearch(unpaidPurchases, purchaseSearchTerm), [unpaidPurchases, purchaseSearchTerm]);

  const getAssetAccountName = (accountId) => {
    if (accountId == null || accountId === '') return '—';
    const id = Number(accountId);
    const account = assetAccounts.find((a) => Number(a.id) === id);
    return account ? (account.name || `#${id}`) : `#${id}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const handlePurchaseChangePage = (event, newPage) => {
    setPurchasePage(newPage);
  };

  const handlePurchaseChangeRowsPerPage = (event) => {
    setPurchaseRowsPerPage(parseInt(event.target.value, 10));
    setPurchasePage(0);
  };

  const handleOpenPurchaseDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setPurchaseDetailsOpen(true);
  };

  const handleClosePurchaseDetails = () => {
    setPurchaseDetailsOpen(false);
    setSelectedPurchase(null);
  };


  const renderInvoicesTable = (filteredList, emptyMessage) => {
    const paginated = filteredList.slice(
      purchasePage * purchaseRowsPerPage,
      purchasePage * purchaseRowsPerPage + purchaseRowsPerPage
    );
    return (
      <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>Show</Typography>
              <TextField
                select
                size="small"
                value={purchaseRowsPerPage}
                onChange={(e) => { setPurchaseRowsPerPage(parseInt(e.target.value, 10)); setPurchasePage(0); }}
                SelectProps={{ native: true }}
                sx={{ minWidth: 80 }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </TextField>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>entries</Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Search by supplier, item..."
              value={purchaseSearchTerm}
              onChange={(e) => setPurchaseSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: colors.textSecondary }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: 250,
                '& .MuiOutlinedInput-root': { backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper, '& fieldset': { borderColor: colors.border } },
                '& .MuiInputBase-input': { color: colors.textPrimary }
              }}
            />
          </Box>
          {purchasesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: colors.paper }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Received By</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Supplier</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Account</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                      {paginated.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ color: colors.textSecondary, py: 4 }}>{emptyMessage}</TableCell>
                        </TableRow>
                      ) : (
                        paginated.map((purchase) => {
                          const accountDisplay = getAssetAccountName(purchase.details?.assetAccountId);
                          const adminName = purchase.admin?.name || purchase.admin?.username || 'N/A';
                          const purchaseStatus = getPurchaseStatus(purchase);
                          return (
                            <TableRow key={purchase.id} hover onClick={() => handleOpenPurchaseDetails(purchase)} sx={{ cursor: 'pointer' }}>
                              <TableCell sx={{ color: colors.textPrimary }}>{formatDate(purchase.createdAt)}</TableCell>
                              <TableCell sx={{ color: colors.textPrimary }}>{adminName}</TableCell>
                              <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                                {(() => {
                                  const supplierName = purchase.details?.supplier || '';
                                  const supplierMatch = suppliers.find((s) => (s.name || '').trim().toLowerCase() === (supplierName || '').trim().toLowerCase());
                                  if (supplierMatch) {
                                    return (
                                      <Typography component="span" onClick={(e) => { e.stopPropagation(); navigate(`/payables/suppliers/${supplierMatch.id}/invoices`); }} sx={{ color: colors.accentText, cursor: 'pointer', textDecoration: 'underline', '&:hover': { textDecoration: 'underline' } }}>
                                        {supplierName || '-'}
                                      </Typography>
                                    );
                                  }
                                  return supplierName || '-';
                                })()}
                              </TableCell>
                              <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 500 }}>{formatCurrency(purchase.amount)}</TableCell>
                              <TableCell sx={{ color: colors.textPrimary }}>{accountDisplay}</TableCell>
                              <TableCell>
                                <Chip label={purchaseStatus} color={purchaseStatus === 'Paid' ? 'success' : 'default'} size="small" sx={purchaseStatus === 'Unpaid' ? { backgroundColor: '#FF3366', color: '#FFFFFF', '& .MuiChip-label': { color: '#FFFFFF' } } : undefined} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              <TablePagination component="div" count={filteredList.length} page={purchasePage} onPageChange={handlePurchaseChangePage} rowsPerPage={purchaseRowsPerPage} onRowsPerPageChange={handlePurchaseChangeRowsPerPage} rowsPerPageOptions={[10, 25, 50, 100]} sx={{ color: colors.textPrimary, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { color: colors.textPrimary } }} />
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPaidInvoicesTab = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Receipt sx={{ color: colors.accentText, fontSize: 40 }} />
        <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>Paid Invoices</Typography>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {renderInvoicesTable(paidFilteredPurchases, purchaseSearchTerm ? 'No paid invoices match your search.' : 'No paid invoices.')}
    </Box>
  );

  const renderUnpaidInvoicesTab = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Receipt sx={{ color: colors.accentText, fontSize: 40 }} />
        <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>Unpaid Invoices</Typography>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {renderInvoicesTable(unpaidFilteredPurchases, purchaseSearchTerm ? 'No unpaid invoices match your search.' : 'No unpaid invoices.')}
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={(e, v) => setCurrentTab(v)}
          sx={{
            minHeight: 40,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 },
            '& .Mui-selected': { color: colors.accentText },
            '& .MuiTabs-indicator': { backgroundColor: colors.accentText }
          }}
        >
          <Tab label="Unpaid" id="payables-tab-0" aria-controls="payables-tabpanel-0" />
          <Tab label="Paid" id="payables-tab-1" aria-controls="payables-tabpanel-1" />
        </Tabs>
      </Box>
      <Box role="tabpanel" id="payables-tabpanel-0" aria-labelledby="payables-tab-0" hidden={currentTab !== 0}>
        {currentTab === 0 && renderUnpaidInvoicesTab()}
      </Box>
      <Box role="tabpanel" id="payables-tabpanel-1" aria-labelledby="payables-tab-1" hidden={currentTab !== 1}>
        {currentTab === 1 && renderPaidInvoicesTab()}
      </Box>

      {/* Purchase Details Dialog */}
      <Dialog
        open={purchaseDetailsOpen && !!selectedPurchase}
        onClose={handleClosePurchaseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Purchase Details</DialogTitle>
        <DialogContent dividers>
          {selectedPurchase && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(selectedPurchase.createdAt)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Supplier
                  </Typography>
                  <Typography variant="body1">
                    {selectedPurchase.details?.supplier || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Received By
                  </Typography>
                  <Typography variant="body1">
                    {selectedPurchase.admin?.name ||
                      selectedPurchase.admin?.username ||
                      '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(selectedPurchase.amount)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Payment Method
                  </Typography>
                  <Typography variant="body1">
                    {selectedPurchase.details?.paymentMethod === 'mpesa'
                      ? `M-Pesa: ${
                          selectedPurchase.details?.mpesaName || 'N/A'
                        }`
                      : `Cash: ${
                          selectedPurchase.details?.recipientName || 'N/A'
                        }`}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Items
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(selectedPurchase.details?.items) &&
                    selectedPurchase.details.items.length > 0 ? (
                      selectedPurchase.details.items.map((item, idx) => {
                        const qty = Number(item.quantity || 1);
                        const unit = Number(item.price || 0);
                        const lineTotal =
                          !Number.isNaN(qty) && !Number.isNaN(unit)
                            ? qty * unit
                            : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell>{item.item || '—'}</TableCell>
                            <TableCell align="right">{qty}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(unit)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(lineTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell>
                          {selectedPurchase.details?.item || 'Purchase'}
                        </TableCell>
                        <TableCell align="right">1</TableCell>
                        <TableCell align="right">
                          {formatCurrency(
                            selectedPurchase.details?.price ||
                              selectedPurchase.amount
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(selectedPurchase.amount)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePurchaseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Payables;
