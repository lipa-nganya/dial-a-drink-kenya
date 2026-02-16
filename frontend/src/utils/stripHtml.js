/**
 * Strip HTML tags from text
 * @param {string} html - Text that may contain HTML
 * @returns {string} - Plain text with HTML removed
 */
export const stripHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Create a temporary DOM element to parse HTML
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  
  // Get text content (automatically strips HTML)
  let text = tmp.textContent || tmp.innerText || '';
  
  // Clean up any remaining HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text;
};
