const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const results = [];
const csvFilePath = path.join(__dirname, '../dial_a_drink_smokes_inventory.csv');

console.log('CSV file path:', csvFilePath);
console.log('File exists:', fs.existsSync(csvFilePath));

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (data) => {
    console.log('Parsed row:', data['Drink Name']);
    results.push(data);
  })
  .on('end', () => {
    console.log(`Total rows parsed: ${results.length}`);
    console.log('First few products:');
    results.slice(0, 5).forEach(row => {
      console.log(`- ${row['Drink Name']} (${row.Category} - ${row.SubCategory})`);
    });
  });
































