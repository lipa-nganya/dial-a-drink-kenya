const puppeteer = require('puppeteer');

/**
 * Generate PDF receipt for an order
 */
async function generateReceiptPDF(order) {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Generate HTML for the receipt
    const html = generateReceiptHTML(order);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();
    return pdf;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Generate HTML content for the receipt
 */
function generateReceiptHTML(order) {
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const itemsHTML = order.items?.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.drink?.name || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">KES ${Number(item.price || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">KES ${(Number(item.price || 0) * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('') || '';
  
  const subtotal = Number(order.totalAmount || 0) - Number(order.tipAmount || 0);
  const tip = Number(order.tipAmount || 0);
  const total = Number(order.totalAmount || 0);
  
  const paymentStatus = order.paymentStatus === 'paid' ? 'Paid' : 
                       order.paymentType === 'pay_now' ? 'Unpaid' : 
                       'Pay on Delivery';
  
  const paymentMethod = order.paymentMethod ? 
    (order.paymentMethod === 'mobile_money' ? 'Mobile Money' :
     order.paymentMethod === 'card' ? 'Card' :
     order.paymentMethod === 'cash' ? 'Cash' : order.paymentMethod) : 
    'N/A';
  
  // Get receipt number from transaction if available
  const receiptNumber = order.transactions?.find(t => t.receiptNumber)?.receiptNumber || 
                       `ORD-${order.id}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Arial', sans-serif;
          color: #333;
          line-height: 1.6;
        }
        .receipt-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #00E0B8;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #00E0B8;
          font-size: 26px;
          margin-bottom: 10px;
        }
        .header p {
          color: #666;
          font-size: 12px;
        }
        .receipt-info {
          margin-bottom: 25px;
        }
        .receipt-info h2 {
          color: #000;
          font-size: 18px;
          margin-bottom: 15px;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
        }
        .info-label {
          font-weight: 600;
          color: #666;
        }
        .info-value {
          color: #000;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .items-table th {
          background-color: #00E0B8;
          color: #000;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
        }
        .items-table td {
          padding: 8px;
          border-bottom: 1px solid #eee;
          font-size: 11px;
        }
        .items-table th:last-child,
        .items-table td:last-child {
          text-align: right;
        }
        .items-table th:nth-child(2),
        .items-table td:nth-child(2) {
          text-align: center;
        }
        .totals {
          margin-top: 20px;
          text-align: right;
        }
        .total-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 8px;
          font-size: 12px;
        }
        .total-label {
          font-weight: 600;
          margin-right: 20px;
          min-width: 120px;
          text-align: right;
        }
        .total-value {
          min-width: 100px;
          text-align: right;
        }
        .grand-total {
          font-size: 16px;
          font-weight: 700;
          color: #000;
          border-top: 2px solid #00E0B8;
          padding-top: 10px;
          margin-top: 10px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        .status-paid {
          background-color: #4CAF50;
          color: white;
        }
        .status-unpaid {
          background-color: #FF9800;
          color: white;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <h1>Dial A Drink Kenya</h1>
          <p>Order Receipt</p>
        </div>
        
        <div class="receipt-info">
          <h2>Order Information</h2>
          <div class="info-row">
            <span class="info-label">Receipt Number:</span>
            <span class="info-value">${receiptNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Order Number:</span>
            <span class="info-value">#${order.id}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Order Date:</span>
            <span class="info-value">${orderDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Order Status:</span>
            <span class="info-value">${order.status?.charAt(0).toUpperCase() + order.status?.slice(1).replace('_', ' ') || 'N/A'}</span>
          </div>
        </div>
        
        <div class="receipt-info">
          <h2>Customer Information</h2>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${order.customerName || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-value">${order.customerPhone || 'N/A'}</span>
          </div>
          ${order.customerEmail ? `
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${order.customerEmail}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Delivery Address:</span>
            <span class="info-value">${order.deliveryAddress || 'N/A'}</span>
          </div>
        </div>
        
        <div class="receipt-info">
          <h2>Order Items</h2>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>
        
        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">KES ${subtotal.toFixed(2)}</span>
          </div>
          ${tip > 0 ? `
          <div class="total-row">
            <span class="total-label">Tip:</span>
            <span class="total-value">KES ${tip.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span class="total-label">Total:</span>
            <span class="total-value">KES ${total.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="receipt-info">
          <h2>Payment Information</h2>
          <div class="info-row">
            <span class="info-label">Payment Status:</span>
            <span class="info-value">
              <span class="status-badge ${order.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
                ${paymentStatus}
              </span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Method:</span>
            <span class="info-value">${paymentMethod}</span>
          </div>
          ${order.paymentType ? `
          <div class="info-row">
            <span class="info-label">Payment Type:</span>
            <span class="info-value">${order.paymentType === 'pay_now' ? 'Pay Now' : 'Pay on Delivery'}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>Thank you for your order!</p>
          <p>For inquiries, please contact us at your registered phone number.</p>
          <p style="margin-top: 10px;">This is a computer-generated receipt.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateReceiptPDF,
  generateReceiptHTML
};

