#!/usr/bin/env node
/**
 * Convert MySQL/MariaDB SQL dump to PostgreSQL format (streaming version)
 * This script handles basic conversions needed for importing into PostgreSQL
 */

const fs = require('fs');
const readline = require('readline');

const inputFile = '/Users/maria/Documents/dial a drink database.sql';
const outputFile = '/Users/maria/Documents/dial-a-drink-postgresql.sql';

console.log('🔄 Converting MySQL dump to PostgreSQL format...');
console.log('⏳ This may take a few minutes for large files...\n');

const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

// Write header
writeStream.write(`-- Converted from MySQL/MariaDB to PostgreSQL
-- Original file: dial a drink database.sql
-- Conversion date: ${new Date().toISOString()}
-- 
-- IMPORTANT: Review and test this file before importing into production!
-- Some MySQL-specific features may need manual adjustment.
--

`);

const rl = readline.createInterface({
  input: fs.createReadStream(inputFile),
  crlfDelay: Infinity
});

let lineCount = 0;
let inComment = false;

rl.on('line', (line) => {
  lineCount++;
  if (lineCount % 10000 === 0) {
    process.stdout.write(`\r📊 Processed ${lineCount.toLocaleString()} lines...`);
  }

  let processedLine = line;

  // Skip MySQL-specific SET statements
  if (processedLine.match(/^SET (SQL_MODE|time_zone|CHARACTER_SET|COLLATION)/i)) {
    return;
  }

  // Skip MySQL-specific comments
  if (processedLine.match(/^\/\*!40101/)) {
    inComment = true;
    return;
  }
  if (inComment && processedLine.match(/\*\//)) {
    inComment = false;
    return;
  }
  if (inComment) return;

  // Remove backticks
  processedLine = processedLine.replace(/`/g, '');

  // Replace MySQL-specific syntax
  processedLine = processedLine.replace(/ENGINE=InnoDB[^;]*/gi, '');
  processedLine = processedLine.replace(/DEFAULT CHARSET=[^;]*/gi, '');
  processedLine = processedLine.replace(/COLLATE=[^;]*/gi, '');
  processedLine = processedLine.replace(/CHARACTER SET [^;]*/gi, '');
  processedLine = processedLine.replace(/AUTO_INCREMENT=\d+/gi, '');
  processedLine = processedLine.replace(/\bAUTO_INCREMENT\b/gi, 'SERIAL');

  // Replace data types
  processedLine = processedLine.replace(/\btinyint\(1\)/gi, 'BOOLEAN');
  processedLine = processedLine.replace(/\btinyint\(/gi, 'SMALLINT(');
  processedLine = processedLine.replace(/\btinyint\b/gi, 'SMALLINT');
  processedLine = processedLine.replace(/\bint\(11\)/gi, 'INTEGER');
  processedLine = processedLine.replace(/\bint\(/gi, 'INTEGER(');
  processedLine = processedLine.replace(/\bint\b/gi, 'INTEGER');
  processedLine = processedLine.replace(/\blongtext\b/gi, 'TEXT');
  processedLine = processedLine.replace(/\bdatetime\b/gi, 'TIMESTAMP');

  // Replace functions
  processedLine = processedLine.replace(/current_timestamp\(\)/gi, 'CURRENT_TIMESTAMP');
  processedLine = processedLine.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');

  // Replace database creation/use
  if (processedLine.match(/^CREATE DATABASE/i)) {
    processedLine = '-- ' + processedLine + ' (create database manually in pgAdmin)';
  }
  if (processedLine.match(/^USE /i)) {
    processedLine = '-- ' + processedLine + ' (removed - connect to database in pgAdmin)';
  }

  // Replace transaction statements
  processedLine = processedLine.replace(/^START TRANSACTION;/i, 'BEGIN;');
  
  // Remove LOCK/UNLOCK TABLES
  if (processedLine.match(/^(LOCK TABLES|UNLOCK TABLES)/i)) {
    return;
  }

  writeStream.write(processedLine + '\n');
});

rl.on('close', () => {
  writeStream.end();
  console.log(`\n✅ Conversion complete!`);
  console.log(`📁 Output file: ${outputFile}`);
  const stats = fs.statSync(outputFile);
  console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📝 Total lines processed: ${lineCount.toLocaleString()}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Open pgAdmin`);
  console.log(`   2. Connect to localhost PostgreSQL (user: maria, database: dialadrink)`);
  console.log(`   3. Right-click on 'dialadrink' database → Query Tool`);
  console.log(`   4. Click File → Open → Select: ${outputFile}`);
  console.log(`   5. Review the SQL (especially data types and constraints)`);
  console.log(`   6. Execute the query (F5 or Execute button)`);
  console.log(`\n⚠️  Note: You may need to manually adjust some syntax after import.`);
});
