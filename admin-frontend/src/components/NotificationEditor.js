import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  Send,
  Visibility,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

// Common emojis for quick insertion
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '👍', '👎', '👏', '🙌', '👋', '🤝', '✊', '👊', '💪', '🤞',
  '💰', '💵', '💸', '📈', '📊', '✅', '❌', '⚠️', '🎉', '🎊',
  '🚀', '⭐', '🔥', '💯', '🎯', '🏆', '🎁', '🎈', '🎂', '🍕'
];

const NotificationEditor = ({ onNotificationSent }) => {
  const { isDarkMode, colors } = useTheme();
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const insertText = (text, field) => {
    if (field === 'title') {
      setTitle(title + text);
    } else if (field === 'preview') {
      setPreview(preview + text);
    } else if (field === 'message') {
      setMessage(message + text);
    }
  };

  const applyFormat = (format, field) => {
    const textarea = document.getElementById(`notification-${field}`);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let text = '';
    let newText = '';

    if (field === 'title') text = title;
    else if (field === 'preview') text = preview;
    else if (field === 'message') text = message;

    const selectedText = text.substring(start, end);
    
    if (format === 'bold') {
      newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);
    } else if (format === 'italic') {
      newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end);
    }

    if (field === 'title') setTitle(newText);
    else if (field === 'preview') setPreview(newText);
    else if (field === 'message') setMessage(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        format === 'bold' ? start + 2 : start + 1,
        format === 'bold' ? end + 2 : end + 1
      );
    }, 0);
  };

  const parseMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  };

  const handleSend = async () => {
    if (!title.trim() || !preview.trim() || !message.trim()) {
      setError('Title, preview, and message are required');
      return;
    }

    try {
      setSending(true);
      setError(null);
      setSuccess(null);

      const response = await api.post('/admin/notifications', {
        title: title.trim(),
        preview: preview.trim(),
        message: message.trim()
      });

      if (response.data.success) {
        setSuccess(`Notification sent to ${response.data.sentTo} riders (${response.data.successful} successful, ${response.data.failed} failed)`);
        setTitle('');
        setPreview('');
        setMessage('');
        if (onNotificationSent) {
          onNotificationSent();
        }
        fetchNotifications();
      } else {
        setError('Failed to send notification');
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      setError(err.response?.data?.error || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const response = await api.get('/admin/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleViewStats = async (notification) => {
    try {
      const response = await api.get(`/admin/notifications/${notification.id}`);
      setSelectedNotification(response.data);
      setStatsDialogOpen(true);
    } catch (err) {
      console.error('Error fetching notification stats:', err);
      setError('Failed to load notification stats');
    }
  };

  React.useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <Box>
      <Paper sx={{ p: 3, backgroundColor: colors.paper, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
          Create Custom Notification
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Title Field */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: colors.textSecondary }}>
            Title *
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Tooltip title="Bold">
              <IconButton
                size="small"
                onClick={() => applyFormat('bold', 'title')}
                sx={{ color: colors.accentText }}
              >
                <FormatBold />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton
                size="small"
                onClick={() => applyFormat('italic', 'title')}
                sx={{ color: colors.accentText }}
              >
                <FormatItalic />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="notification-title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter notification title"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              }
            }}
          />
        </Box>

        {/* Preview Field */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: colors.textSecondary }}>
            Preview * (Shown in push notification)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Tooltip title="Bold">
              <IconButton
                size="small"
                onClick={() => applyFormat('bold', 'preview')}
                sx={{ color: colors.accentText }}
              >
                <FormatBold />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton
                size="small"
                onClick={() => applyFormat('italic', 'preview')}
                sx={{ color: colors.accentText }}
              >
                <FormatItalic />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="notification-preview"
            fullWidth
            multiline
            rows={2}
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            placeholder="Enter preview text (shown in push notification)"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              }
            }}
          />
        </Box>

        {/* Message Field */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: colors.textSecondary }}>
            Message * (Full message content)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tooltip title="Bold">
              <IconButton
                size="small"
                onClick={() => applyFormat('bold', 'message')}
                sx={{ color: colors.accentText }}
              >
                <FormatBold />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton
                size="small"
                onClick={() => applyFormat('italic', 'message')}
                sx={{ color: colors.accentText }}
              >
                <FormatItalic />
              </IconButton>
            </Tooltip>
            <Box sx={{ ml: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {EMOJIS.map((emoji, idx) => (
                <Tooltip key={idx} title={emoji}>
                  <IconButton
                    size="small"
                    onClick={() => insertText(emoji, 'message')}
                    sx={{ fontSize: '1.2rem' }}
                  >
                    {emoji}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Box>
          <TextField
            id="notification-message"
            fullWidth
            multiline
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter full message content"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              }
            }}
          />
        </Box>

        <Button
          variant="contained"
          startIcon={sending ? <CircularProgress size={20} /> : <Send />}
          onClick={handleSend}
          disabled={sending || !title.trim() || !preview.trim() || !message.trim()}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': {
              backgroundColor: '#00C4A3'
            },
            '&:disabled': {
              backgroundColor: colors.border,
              color: colors.textSecondary
            }
          }}
        >
          {sending ? 'Sending...' : 'Send Notification'}
        </Button>
      </Paper>

      {/* Notifications List */}
      <Paper sx={{ backgroundColor: colors.paper }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}` }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
            Sent Notifications
          </Typography>
        </Box>
        {loadingNotifications ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              No notifications sent yet
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Preview</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Sent At</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Stats</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <Typography
                        variant="body2"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(notification.title) }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: colors.textSecondary }}
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(notification.preview) }}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(notification.sentAt || notification.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${notification.stats?.readCount || 0}/${notification.stats?.totalDrivers || 0} read`}
                        size="small"
                        color={notification.stats?.readCount === notification.stats?.totalDrivers ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewStats(notification)}
                        sx={{ color: colors.accentText }}
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Stats Dialog */}
      <Dialog
        open={statsDialogOpen}
        onClose={() => setStatsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.textPrimary }}>
          Notification Statistics
        </DialogTitle>
        <DialogContent>
          {selectedNotification && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary }}>
                {selectedNotification.title}
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Chip
                  label={`${selectedNotification.stats?.readCount || 0} Read`}
                  color="success"
                  sx={{ mr: 1 }}
                />
                <Chip
                  label={`${selectedNotification.stats?.unreadCount || 0} Unread`}
                  color="default"
                />
                <Typography variant="body2" sx={{ mt: 1, color: colors.textSecondary }}>
                  {selectedNotification.stats?.readPercentage || 0}% read rate
                </Typography>
              </Box>

              <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textPrimary, fontWeight: 600 }}>
                Read by:
              </Typography>
              {selectedNotification.stats?.readDrivers?.length > 0 ? (
                <Box sx={{ mb: 2 }}>
                  {selectedNotification.stats.readDrivers.map((driver) => (
                    <Chip
                      key={driver.id}
                      label={driver.name}
                      icon={<CheckCircle />}
                      color="success"
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                  No riders have read this notification yet
                </Typography>
              )}

              <Typography variant="subtitle2" sx={{ mb: 1, color: colors.textPrimary, fontWeight: 600 }}>
                Unread by:
              </Typography>
              {selectedNotification.stats?.unreadDrivers?.length > 0 ? (
                <Box>
                  {selectedNotification.stats.unreadDrivers.map((driver) => (
                    <Chip
                      key={driver.id}
                      label={driver.name}
                      icon={<Cancel />}
                      color="default"
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  All riders have read this notification
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationEditor;
