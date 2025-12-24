const fs = require('fs');

// Read the snapshot file
const snapshotPath = '/Users/maria/.cursor/browser-logs/snapshot-2025-12-24T14-50-49-557Z.log';
const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');

const suppliers = [];
const lines = snapshotContent.split('\n');

let inTableRow = false;
let currentSupplier = null;
let cellIndex = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect start of a supplier row (has name with supplier data)
  if (line.includes('role: row') && line.includes('name:') && 
      !line.includes('Supplier Phone Email') && 
      !line.includes('activate to sort')) {
    const nameMatch = line.match(/name:\s*(.+?)(?:\s+ref:|$)/);
    if (nameMatch) {
      const rowName = nameMatch[1].trim();
      // Skip header rows and action rows
      if (!rowName.includes('Supplier Phone Email') && 
          !rowName.includes('activate to sort') &&
          rowName.length > 5) {
        inTableRow = true;
        cellIndex = 0;
        currentSupplier = {
          name: '',
          phone: null,
          email: null,
          openingBalance: '0.00'
        };
      }
    }
  }
  
  // Extract cell data
  if (inTableRow && line.includes('role: cell') && line.includes('name:')) {
    const nameMatch = line.match(/name:\s*(.+?)(?:\s+ref:|$)/);
    if (nameMatch) {
      const cellValue = nameMatch[1].trim();
      
      // Skip action cells
      if (!cellValue.includes('Edit') && 
          !cellValue.includes('View') && 
          !cellValue.includes('Make Payment') &&
          !cellValue.includes('Active') &&
          !cellValue.includes('Inactive') &&
          cellValue.length > 0) {
        
        // Determine which cell this is based on pattern
        // Cell order: Supplier, Phone, Email, Balance
        if (cellIndex === 0) {
          // First non-empty cell is usually the supplier name
          if (!currentSupplier.name) {
            currentSupplier.name = cellValue;
          }
        } else if (cellValue.match(/^[\d\s\-+()]+$/) && cellValue.length >= 7) {
          // Looks like a phone number
          if (!currentSupplier.phone) {
            currentSupplier.phone = cellValue.replace(/\s/g, '');
          }
        } else if (cellValue.includes('@')) {
          // Email
          currentSupplier.email = cellValue.replace(/\s/g, '');
        } else if (cellValue.match(/^-?\d+\.?\d*$/)) {
          // Balance (number)
          currentSupplier.openingBalance = parseFloat(cellValue).toFixed(2);
        } else if (!currentSupplier.name || currentSupplier.name.length < cellValue.length) {
          // Might be a longer supplier name
          if (!currentSupplier.phone && !currentSupplier.email) {
            currentSupplier.name = cellValue;
          }
        }
        
        cellIndex++;
      }
    }
  }
  
  // End of row - save supplier
  if (inTableRow && line.includes('role: row') && currentSupplier && currentSupplier.name) {
    // Check if we have a valid supplier
    if (currentSupplier.name && currentSupplier.name.length > 1) {
      suppliers.push({
        name: currentSupplier.name.trim(),
        phone: currentSupplier.phone || null,
        email: currentSupplier.email || null,
        openingBalance: parseFloat(currentSupplier.openingBalance) || 0
      });
    }
    inTableRow = false;
    currentSupplier = null;
    cellIndex = 0;
  }
}

// Also try parsing from row names directly
const rowNamePattern = /name:\s*([^E][^d][^i][^t].+?)\s+(?:(\d{7,12}|-)\s+)?(?:([^\s@]+@[^\s@]+\.[^\s@]+)\s+)?(-?\d+\.?\d*)?\s+Active/;
lines.forEach(line => {
  if (line.includes('role: row') && line.includes('name:') && line.includes('Active')) {
    const match = line.match(/name:\s*(.+?)(?:\s+ref:|$)/);
    if (match) {
      const rowData = match[1];
      const parts = rowData.split(/\s+(?=\d|Active|Inactive|Edit)/);
      
      if (parts.length >= 2 && !rowData.includes('Supplier Phone Email')) {
        let name = parts[0];
        let phone = null;
        let email = null;
        let balance = '0.00';
        
        // Find phone, email, and balance in the parts
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part === 'Active' || part === 'Inactive' || part.startsWith('Edit')) break;
          
          if (part.includes('@')) {
            email = part.replace(/\s/g, '');
          } else if (part.match(/^-?\d+\.?\d*$/) && parseFloat(part) !== 0) {
            balance = parseFloat(part).toFixed(2);
          } else if (part.match(/^\d{7,12}$/)) {
            phone = part;
          }
        }
        
        // Check if this supplier already exists
        const exists = suppliers.find(s => s.name === name);
        if (!exists && name.length > 1) {
          suppliers.push({
            name: name.trim(),
            phone: phone || null,
            email: email || null,
            openingBalance: parseFloat(balance) || 0
          });
        }
      }
    }
  }
});

// Remove duplicates
const uniqueSuppliers = [];
const seenNames = new Set();
suppliers.forEach(s => {
  if (!seenNames.has(s.name.toLowerCase())) {
    seenNames.add(s.name.toLowerCase());
    uniqueSuppliers.push(s);
  }
});

console.log(`Found ${uniqueSuppliers.length} unique suppliers\n`);

// Write to file
fs.writeFileSync(
  '/Users/maria/dial-a-drink/backend/scripts/extracted-suppliers.json',
  JSON.stringify(uniqueSuppliers, null, 2)
);

console.log('First 20 suppliers:');
uniqueSuppliers.slice(0, 20).forEach((s, i) => {
  console.log(`${i + 1}. ${s.name.padEnd(40)} | Phone: ${(s.phone || 'N/A').padEnd(15)} | Email: ${(s.email || 'N/A').padEnd(30)} | Balance: ${s.openingBalance}`);
});

console.log(`\n✅ Extracted ${uniqueSuppliers.length} suppliers to extracted-suppliers.json`);

