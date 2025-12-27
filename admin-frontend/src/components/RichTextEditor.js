import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  TextField,
  Paper,
  Typography,
  Tooltip
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  Link,
  FormatClear
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

const RichTextEditor = ({ value, onChange, placeholder, rows = 15, ...props }) => {
  const { isDarkMode, colors } = useTheme();
  const textFieldRef = useRef(null);
  const textareaRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Find the textarea element after render
  useEffect(() => {
    if (textFieldRef.current) {
      const textarea = textFieldRef.current.querySelector('textarea');
      if (textarea) {
        textareaRef.current = textarea;
      }
    }
  }, [value]);

  const handleSelectionChange = () => {
    const textarea = textareaRef.current || (textFieldRef.current?.querySelector('textarea'));
    if (textarea) {
      setSelection({
        start: textarea.selectionStart || 0,
        end: textarea.selectionEnd || 0
      });
    }
  };

  const insertText = (before, after = '', placeholderText = '') => {
    const textarea = textareaRef.current || (textFieldRef.current?.querySelector('textarea'));
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentValue = value || '';
    const selectedText = currentValue.substring(start, end);
    const textBefore = currentValue.substring(0, start);
    const textAfter = currentValue.substring(end);

    let newText;
    if (selectedText) {
      // If text is selected, wrap it
      newText = textBefore + before + selectedText + after + textAfter;
    } else {
      // If no text selected, insert placeholder
      newText = textBefore + before + placeholderText + after + textAfter;
    }

    // Update the value
    onChange({ target: { value: newText } });

    // Restore cursor position after state update
    setTimeout(() => {
      const updatedTextarea = textFieldRef.current?.querySelector('textarea');
      if (updatedTextarea) {
        const newCursorPos = start + before.length + (selectedText || placeholderText).length + after.length;
        updatedTextarea.setSelectionRange(newCursorPos, newCursorPos);
        updatedTextarea.focus();
        // Update selection state
        setSelection({ start: newCursorPos, end: newCursorPos });
        textareaRef.current = updatedTextarea;
      }
    }, 50);
  };

  const handleBold = () => {
    insertText('*', '*', 'bold text');
  };

  const handleItalic = () => {
    insertText('_', '_', 'italic text');
  };

  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url && url.trim()) {
      const linkText = prompt('Enter link text (or leave empty to use URL):');
      const finalLinkText = linkText && linkText.trim() ? linkText.trim() : url.trim();
      insertText(`[${finalLinkText}](`, ')', url.trim());
    }
  };

  const handleClearFormat = () => {
    const textarea = textareaRef.current || (textFieldRef.current?.querySelector('textarea'));
    if (!textarea) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentValue = value || '';
    const selectedText = currentValue.substring(start, end);
    
    if (selectedText) {
      // Remove formatting from selected text
      let cleanedText = selectedText
        .replace(/\*([^*]+)\*/g, '$1') // Remove bold
        .replace(/_([^_]+)_/g, '$1') // Remove italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links
      
      const textBefore = currentValue.substring(0, start);
      const textAfter = currentValue.substring(end);
      const newText = textBefore + cleanedText + textAfter;
      
      onChange({ target: { value: newText } });
      
      setTimeout(() => {
        const updatedTextarea = textFieldRef.current?.querySelector('textarea');
        if (updatedTextarea) {
          const newCursorPos = start + cleanedText.length;
          updatedTextarea.setSelectionRange(newCursorPos, newCursorPos);
          updatedTextarea.focus();
          setSelection({ start: newCursorPos, end: newCursorPos });
          textareaRef.current = updatedTextarea;
        }
      }, 50);
    }
  };

  const selectedText = value.substring(selection.start, selection.end);
  const hasSelection = selectedText.length > 0;

  return (
    <Box>
      <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <ButtonGroup 
          size="small" 
          variant="outlined"
          sx={{
            '& .MuiButton-root': {
              borderColor: colors.border,
              color: colors.textSecondary,
              '&:hover': {
                borderColor: colors.accentText,
                backgroundColor: 'rgba(0, 224, 184, 0.1)',
                color: colors.accentText
              }
            }
          }}
        >
          <Tooltip title="Bold (*text*)">
            <Button onClick={handleBold} startIcon={<FormatBold />}>
              Bold
            </Button>
          </Tooltip>
          <Tooltip title="Italic (_text_)">
            <Button onClick={handleItalic} startIcon={<FormatItalic />}>
              Italic
            </Button>
          </Tooltip>
          <Tooltip title="Insert Link">
            <Button onClick={handleLink} startIcon={<Link />}>
              Link
            </Button>
          </Tooltip>
          <Tooltip title="Clear Formatting">
            <Button 
              onClick={handleClearFormat} 
              startIcon={<FormatClear />}
              disabled={!hasSelection}
            >
              Clear
            </Button>
          </Tooltip>
        </ButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Format: *bold* _italic_ [text](url)
        </Typography>
      </Box>
      <TextField
        {...props}
        ref={textFieldRef}
        fullWidth
        multiline
        rows={rows}
        value={value || ''}
        onChange={(e) => {
          onChange(e);
          // Update selection after a brief delay to ensure textarea is updated
          setTimeout(handleSelectionChange, 0);
        }}
        onSelect={handleSelectionChange}
        onClick={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        placeholder={placeholder}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            ...props.sx?.['& .MuiOutlinedInput-root']
          },
          '& textarea': {
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          },
          ...props.sx
        }}
      />
      {hasSelection && (
        <Paper sx={{ mt: 1, p: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            Selected: "{selectedText}"
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default RichTextEditor;

