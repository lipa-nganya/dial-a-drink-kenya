const fs = require('fs');
const path = require('path');

// Read the snapshot file
const snapshotPath = '/Users/maria/.cursor/browser-logs/snapshot-2025-12-24T14-50-49-557Z.log';
const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');

// Extract supplier rows - look for rows with supplier data
const rows = [];
const lines = snapshotContent.split('\n');

let currentRow = null;
let rowCells = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect start of a new row
  if (line.includes('role: row') && line.includes('name:')) {
    // Save previous row if exists
    if (currentRow && rowCells.length >= 3) {
      rows.push({
        name: rowCells[0] || '',
        phone: rowCells[1] || null,
        email: rowCells[2] || null,
        balance: rowCells[3] || '0.00'
      });
    }
    
    // Extract row name which contains all data
    const nameMatch = line.match(/name:\s*(.+?)(?:\s+ref:|$)/);
    if (nameMatch) {
      const rowData = nameMatch[1];
      // Parse the row data - format appears to be: "Supplier Phone Email Balance Status Actions"
      const parts = rowData.split(/\s+(?=\d|Active|Inactive|Edit)/);
      
      currentRow = {
        raw: rowData,
        parts: parts
      };
      rowCells = [];
    }
  }
  
  // Extract cell data
  if (line.includes('role: cell') && line.includes('name:')) {
    const nameMatch = line.match(/name:\s*(.+?)(?:\s+ref:|$)/);
    if (nameMatch && !nameMatch[1].includes('Edit') && !nameMatch[1].includes('View') && !nameMatch[1].includes('Make Payment')) {
      const cellValue = nameMatch[1].trim();
      if (cellValue && cellValue !== 'Active' && cellValue !== 'Inactive') {
        rowCells.push(cellValue);
      }
    }
  }
}

// Save last row
if (currentRow && rowCells.length >= 3) {
  rows.push({
    name: rowCells[0] || '',
    phone: rowCells[1] || null,
    email: rowCells[2] || null,
    balance: rowCells[3] || '0.00'
  });
}

// Output results
console.log(`Found ${rows.length} suppliers`);
console.log('\nFirst 10 suppliers:');
rows.slice(0, 10).forEach((s, i) => {
  console.log(`${i + 1}. ${s.name} - Phone: ${s.phone || 'N/A'}, Email: ${s.email || 'N/A'}, Balance: ${s.balance}`);
});

// Write to JSON file for review
fs.writeFileSync(
  path.join(__dirname, 'extracted-suppliers.json'),
  JSON.stringify(rows, null, 2)
);

console.log(`\n✅ Extracted data written to extracted-suppliers.json`);

