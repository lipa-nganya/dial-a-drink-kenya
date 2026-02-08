#!/usr/bin/env python3
"""
Convert MySQL dump to PostgreSQL format
"""

import re
import sys

def convert_mysql_to_postgres(input_file, output_file):
    """Convert MySQL dump to PostgreSQL format"""
    
    print(f"Reading {input_file}...")
    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    print("Converting MySQL syntax to PostgreSQL...")
    
    # Remove MySQL-specific statements
    content = re.sub(r'^CREATE DATABASE.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^USE .*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^SET SQL_MODE.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^SET time_zone.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^SET @OLD_CHARACTER_SET.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^SET NAMES.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^LOCK TABLES.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r'^UNLOCK TABLES.*$', '', content, flags=re.MULTILINE | re.IGNORECASE)
    
    # Remove backticks
    content = re.sub(r'`([^`]+)`', r'\1', content)
    
    # Convert data types - must be done carefully
    content = re.sub(r'\bint\((\d+)\)', r'INTEGER', content, flags=re.IGNORECASE)
    content = re.sub(r'\bbigint\((\d+)\)', r'BIGINT', content, flags=re.IGNORECASE)
    content = re.sub(r'\bsmallint\((\d+)\)', r'SMALLINT', content, flags=re.IGNORECASE)
    content = re.sub(r'\btinyint\((\d+)\)', r'SMALLINT', content, flags=re.IGNORECASE)
    content = re.sub(r'\bmediumint\((\d+)\)', r'INTEGER', content, flags=re.IGNORECASE)
    content = re.sub(r'\bvarchar\((\d+)\)', r'VARCHAR(\1)', content, flags=re.IGNORECASE)
    content = re.sub(r'\bchar\((\d+)\)', r'CHAR(\1)', content, flags=re.IGNORECASE)
    content = re.sub(r'\btext\((\d+)\)', r'TEXT', content, flags=re.IGNORECASE)
    
    # Remove ON UPDATE current_timestamp() - PostgreSQL doesn't support this
    content = re.sub(r'\s+ON UPDATE current_timestamp\(\)', '', content, flags=re.IGNORECASE)
    content = re.sub(r'\s+ON UPDATE CURRENT_TIMESTAMP', '', content, flags=re.IGNORECASE)
    
    # Fix current_timestamp()
    content = re.sub(r'current_timestamp\(\)', 'CURRENT_TIMESTAMP', content, flags=re.IGNORECASE)
    
    # Convert datetime
    content = re.sub(r'\bdatetime\b', 'TIMESTAMP', content, flags=re.IGNORECASE)
    
    # Convert ENUM to VARCHAR (PostgreSQL ENUMs need to be created as types first)
    # For simplicity, convert to VARCHAR - can be changed to proper ENUM types later if needed
    content = re.sub(r"enum\('([^']+)'\)", r"VARCHAR(50)", content, flags=re.IGNORECASE)
    content = re.sub(r"enum\('([^']+)','([^']+)'\)", r"VARCHAR(50)", content, flags=re.IGNORECASE)
    content = re.sub(r"enum\('([^']+)','([^']+)','([^']+)'\)", r"VARCHAR(50)", content, flags=re.IGNORECASE)
    content = re.sub(r"enum\('([^']+)','([^']+)','([^']+)','([^']+)'\)", r"VARCHAR(50)", content, flags=re.IGNORECASE)
    # For longer enums, use a more general pattern
    content = re.sub(r"enum\([^)]+\)", r"VARCHAR(100)", content, flags=re.IGNORECASE)
    
    # Remove MySQL-specific table options
    content = re.sub(r'ENGINE=InnoDB[^;]*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'ENGINE=MyISAM[^;]*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'DEFAULT CHARSET=[^;]*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'COLLATE=[^;]*', '', content, flags=re.IGNORECASE)
    content = re.sub(r'AUTO_INCREMENT', 'SERIAL', content, flags=re.IGNORECASE)
    
    # Convert text types
    content = re.sub(r'\bLONGTEXT\b', 'TEXT', content, flags=re.IGNORECASE)
    content = re.sub(r'\bMEDIUMTEXT\b', 'TEXT', content, flags=re.IGNORECASE)
    content = re.sub(r'\bTINYTEXT\b', 'TEXT', content, flags=re.IGNORECASE)
    
    # Transaction statements
    content = re.sub(r'START TRANSACTION', 'BEGIN', content, flags=re.IGNORECASE)
    
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('-- Converted from MySQL to PostgreSQL\n')
        f.write('-- WARNING: Review this file before importing!\n\n')
        f.write(content)
    
    print("✅ Conversion complete!")
    return True

if __name__ == '__main__':
    input_file = '/Users/maria/Documents/dial a drink database.sql'
    output_file = '/tmp/dial_a_drink_postgresql_converted.sql'
    
    if len(sys.argv) > 1:
        output_file = sys.argv[1]
    
    convert_mysql_to_postgres(input_file, output_file)
