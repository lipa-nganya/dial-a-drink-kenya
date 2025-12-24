const fs = require('fs');

// Read the snapshot file
const snapshotPath = '/Users/maria/.cursor/browser-logs/snapshot-2025-12-24T14-50-49-557Z.log';
const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');

const suppliers = [];
const lines = snapshotContent.split('\n');

// Pattern: name: SupplierName Phone Email Balance Active Edit...
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('role: row') && line.includes('name:') && line.includes('Active') && 
      !line.includes('Supplier Phone Email') && !line.includes('activate to sort')) {
    
    const nameMatch = line.match(/name:\s*(.+?)(?:\s+ref:|$)/);
    if (nameMatch) {
      const rowData = nameMatch[1];
      
      // Split by spaces but preserve email addresses and negative numbers
      // Format: "Supplier Phone Email Balance Active Edit..."
      const tokens = rowData.split(/\s+/);
      
      let name = '';
      let phone = null;
      let email = null;
      let balance = '0.00';
      
      let nameParts = [];
      let i = 0;
      
      // Collect name parts until we hit a phone number, email, or balance
      while (i < tokens.length) {
        const token = tokens[i];
        
        // Check if it's a phone number (7-12 digits)
        if (token.match(/^\d{7,12}$/)) {
          phone = token;
          i++;
          continue;
        }
        
        // Check if it's an email
        if (token.includes('@')) {
          email = token;
          i++;
          continue;
        }
        
        // Check if it's a balance (number with optional decimal)
        if (token.match(/^-?\d+\.?\d*$/)) {
          balance = parseFloat(token).toFixed(2);
          i++;
          continue;
        }
        
        // Check if it's "Active" or "Inactive" - stop here
        if (token === 'Active' || token === 'Inactive' || token.startsWith('Edit')) {
          break;
        }
        
        // Otherwise, it's part of the name
        nameParts.push(token);
        i++;
      }
      
      name = nameParts.join(' ').trim();
      
      // Clean up email (remove spaces)
      if (email) {
        email = email.replace(/\s/g, '');
      }
      
      if (name && name.length > 1) {
        suppliers.push({
          name: name,
          phone: phone || null,
          email: email || null,
          openingBalance: parseFloat(balance) || 0
        });
      }
    }
  }
}

// Remove duplicates
const uniqueSuppliers = [];
const seen = new Set();
suppliers.forEach(s => {
  const key = s.name.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    uniqueSuppliers.push(s);
  }
});

console.log(`Found ${uniqueSuppliers.length} unique suppliers\n`);

// Write to file
fs.writeFileSync(
  '/Users/maria/dial-a-drink/backend/scripts/extracted-suppliers.json',
  JSON.stringify(uniqueSuppliers, null, 2)
);

console.log('Sample suppliers (first 30):');
uniqueSuppliers.slice(0, 30).forEach((s, i) => {
  const name = s.name.padEnd(35);
  const phone = (s.phone || 'N/A').padEnd(15);
  const email = (s.email || 'N/A').substring(0, 25).padEnd(25);
  const balance = s.openingBalance.toFixed(2).padStart(12);
  console.log(`${(i + 1).toString().padStart(3)}. ${name} | ${phone} | ${email} | ${balance}`);
});

console.log(`\n✅ Extracted ${uniqueSuppliers.length} suppliers to extracted-suppliers.json`);

