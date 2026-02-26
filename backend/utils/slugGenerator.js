/**
 * Generate SEO-friendly slug from product name, brand, and capacity
 * @param {string} name - Product name
 * @param {string} brand - Brand name (optional)
 * @param {string|Array} capacity - Capacity or array of capacities (optional)
 * @returns {string} - SEO-friendly slug
 */
function generateSlug(name, brand = null, capacity = null) {
  if (!name) {
    throw new Error('Product name is required for slug generation');
  }

  // Build slug parts
  const parts = [];

  // Add brand if available
  if (brand && typeof brand === 'string' && brand.trim()) {
    parts.push(brand.trim());
  }

  // Add product name
  parts.push(name.trim());

  // Add capacity if available
  if (capacity) {
    if (Array.isArray(capacity) && capacity.length > 0) {
      // Use first capacity if multiple
      const firstCapacity = capacity[0];
      if (firstCapacity && typeof firstCapacity === 'string') {
        parts.push(firstCapacity.trim());
      }
    } else if (typeof capacity === 'string' && capacity.trim()) {
      parts.push(capacity.trim());
    }
  }

  // Join all parts
  let slug = parts.join(' ');

  // Convert to lowercase
  slug = slug.toLowerCase();

  // Remove special characters, keep only alphanumeric, spaces, and hyphens
  slug = slug.replace(/[^a-z0-9\s-]/g, '');

  // Replace spaces and multiple hyphens with single hyphen
  slug = slug.replace(/[\s-]+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Ensure slug is not empty
  if (!slug) {
    slug = 'product';
  }

  return slug;
}

/**
 * Generate unique slug by appending number if slug already exists
 * @param {Object} sequelize - Sequelize instance
 * @param {string} baseSlug - Base slug to make unique
 * @param {number} excludeId - Product ID to exclude from uniqueness check (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateUniqueSlug(sequelize, baseSlug, excludeId = null) {
  const { Drink } = require('../models');
  const { Op } = require('sequelize');
  
  let slug = baseSlug;
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const whereClause = { slug };
    
    // Exclude current product when updating
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    const existing = await Drink.findOne({ where: whereClause });

    if (!existing) {
      isUnique = true;
    } else {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  return slug;
}

/**
 * Generate slug for a drink product
 * @param {Object} drink - Drink object with name, brand, capacity
 * @param {Object} sequelize - Sequelize instance
 * @param {number} excludeId - Product ID to exclude (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateDrinkSlug(drink, sequelize, excludeId = null) {
  const brandName = drink.brand?.name || drink.brandName || null;
  const capacity = drink.capacity || null;
  
  // Get first capacity from capacityPricing if available
  let capacityValue = capacity;
  if (!capacityValue && drink.capacityPricing && Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
    capacityValue = drink.capacityPricing[0].capacity || drink.capacityPricing[0].size;
  }
  
  // If capacity is an array, use first element
  if (Array.isArray(capacityValue) && capacityValue.length > 0) {
    capacityValue = capacityValue[0];
  }

  const baseSlug = generateSlug(drink.name, brandName, capacityValue);
  return await generateUniqueSlug(sequelize, baseSlug, excludeId);
}

/**
 * Generate slug for a category
 * @param {string} categoryName - Category name
 * @returns {string} - SEO-friendly slug
 */
function generateCategorySlugFromName(categoryName) {
  if (!categoryName) {
    throw new Error('Category name is required for slug generation');
  }

  let slug = categoryName.trim().toLowerCase();

  // Remove special characters, keep only alphanumeric, spaces, and hyphens
  slug = slug.replace(/[^a-z0-9\s-]/g, '');

  // Replace spaces and multiple hyphens with single hyphen
  slug = slug.replace(/[\s-]+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Ensure slug is not empty
  if (!slug) {
    slug = 'category';
  }

  return slug;
}

/**
 * Generate unique slug for a category
 * @param {Object} sequelize - Sequelize instance
 * @param {string} baseSlug - Base slug to make unique
 * @param {number} excludeId - Category ID to exclude from uniqueness check (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateUniqueCategorySlug(sequelize, baseSlug, excludeId = null) {
  const { Category } = require('../models');
  const { Op } = require('sequelize');
  
  let slug = baseSlug;
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const whereClause = { slug };
    
    // Exclude current category when updating
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    const existing = await Category.findOne({ where: whereClause });

    if (!existing) {
      isUnique = true;
    } else {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  return slug;
}

/**
 * Generate slug for a category
 * @param {Object} category - Category object with name
 * @param {Object} sequelize - Sequelize instance
 * @param {number} excludeId - Category ID to exclude (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateCategorySlug(category, sequelize, excludeId = null) {
  const baseSlug = generateCategorySlugFromName(category.name);
  return await generateUniqueCategorySlug(sequelize, baseSlug, excludeId);
}

module.exports = {
  generateSlug,
  generateUniqueSlug,
  generateDrinkSlug,
  generateCategorySlugFromName,
  generateUniqueCategorySlug,
  generateCategorySlug
};
