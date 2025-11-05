const express = require('express');
const { Drink, Category, SubCategory } = require('../models');
const router = express.Router();

// Wine products from the Dial a Drink Kenya website
const dialadrinkWineProducts = [
  // Red Wines
  {
    name: "Robertson Rose",
    description: "Robertson Rose (ABV 8.5%), South Africa",
    price: 1600,
    capacity: ["750ML", "1.5 Litres"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1600, currentPrice: 1600 },
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 8.5,
    wineType: "Rose"
  },
  {
    name: "Rosso Nobile Cioccolata",
    description: "Rosso Nobile Cioccolata (ABV 10%), Germany",
    price: 1899,
    capacity: ["750ML", "Twinpack"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1899, currentPrice: 1899 },
      { capacity: "Twinpack", originalPrice: 3599, currentPrice: 3599 }
    ],
    abv: 10.0,
    wineType: "Red"
  },
  {
    name: "1659 Sauvignon Blanc",
    description: "1659 Sauvignon Blanc (ABV 13%), South Africa",
    price: 1995,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1995, currentPrice: 1995 }
    ],
    abv: 13.0,
    wineType: "White"
  },
  {
    name: "Mucho Mas Gold",
    description: "Mucho Mas Gold (ABV 14%), Spain",
    price: 3500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
    ],
    abv: 14.0,
    wineType: "Red"
  },
  {
    name: "Mikado Red",
    description: "Mikado Red (ABV 11%), Ukraine",
    price: 1799,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1799, currentPrice: 1799 }
    ],
    abv: 11.0,
    wineType: "Red"
  },
  {
    name: "Mikado White Wine",
    description: "Mikado White Wine (ABV 11%), Ukraine",
    price: 1799,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1799, currentPrice: 1799 }
    ],
    abv: 11.0,
    wineType: "White"
  },
  {
    name: "1659 Sweet Rose",
    description: "1659 Sweet Rose (ABV 10.51%), South Africa",
    price: 1895,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1895, currentPrice: 1895 }
    ],
    abv: 10.51,
    wineType: "Rose"
  },
  {
    name: "Tons de Duorum White",
    description: "Tons de Duorum White (ABV 12.5%), Portugal",
    price: 2700,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2700, currentPrice: 2700 }
    ],
    abv: 12.5,
    wineType: "White"
  },
  {
    name: "Tons de Duorum Red",
    description: "Tons de Duorum Red (ABV 13.5%), Portugal",
    price: 2700,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2700, currentPrice: 2700 }
    ],
    abv: 13.5,
    wineType: "Red"
  },
  {
    name: "Cellar Cask Red",
    description: "Cellar Cask Red (ABV 11.5%), South Africa",
    price: 4599,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4599, currentPrice: 4599 }
    ],
    abv: 11.5,
    wineType: "Red"
  },
  {
    name: "Cellar Cask White",
    description: "Cellar Cask White (ABV 14%), South Africa",
    price: 4800,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 14.0,
    wineType: "White"
  },
  {
    name: "Pierre Marcel Sweet Red",
    description: "Pierre Marcel Sweet Red (ABV 8%), France",
    price: 1699,
    capacity: ["750ML", "1.5 Litres"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1699, currentPrice: 1699 },
      { capacity: "1.5 Litres", originalPrice: 2800, currentPrice: 2800 }
    ],
    abv: 8.0,
    wineType: "Red"
  },
  {
    name: "Asconi Red Semi Sweet",
    description: "Asconi Red Semi Sweet (ABV 12%), Moldova",
    price: 2095,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2095, currentPrice: 2095 }
    ],
    abv: 12.0,
    wineType: "Red"
  },
  {
    name: "Gato Negro Merlot",
    description: "Gato Negro Merlot (ABV 12.5%), Chile",
    price: 2300,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 12.5,
    wineType: "Red"
  },
  {
    name: "Choco Secco White wine",
    description: "Choco Secco White wine (ABV 10%), Germany",
    price: 1650,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1650, currentPrice: 1650 }
    ],
    abv: 10.0,
    wineType: "White",
    isAvailable: false // Sold out on website
  },
  {
    name: "Don Santiago Sweet Red Wine",
    description: "Don Santiago Sweet Red Wine (ABV 14%), Spain",
    price: 2400,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2400, currentPrice: 2400 }
    ],
    abv: 14.0,
    wineType: "Red"
  },
  {
    name: "Brancott Estate Sauvignon Blanc",
    description: "Brancott Estate Sauvignon Blanc (ABV 13%), New Zealand",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 13.0,
    wineType: "White",
    isAvailable: false // Sold out on website
  },
  {
    name: "4th Street White 5L",
    description: "4th Street White 5L (ABV 8%), South Africa",
    price: 4400,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4400, currentPrice: 4400 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Cono Sur 20 Barrels Cabernet Sauvignon",
    description: "Cono Sur 20 Barrels Cabernet Sauvignon (ABV 14%), Chile",
    price: 5100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 5100, currentPrice: 5100 }
    ],
    abv: 14.0,
    wineType: "Red"
  },
  {
    name: "Alma Mora Pinot Grigio",
    description: "Alma Mora Pinot Grigio (ABV 12.5%), Argentina",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 12.5,
    wineType: "White",
    isAvailable: false // Sold out on website
  },
  {
    name: "El Esteco Atimus",
    description: "El Esteco Atimus (ABV 14%), Argentina",
    price: 7500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 7500, currentPrice: 7500 }
    ],
    abv: 14.0,
    wineType: "Red"
  },
  {
    name: "KWV Cape Tawny wine",
    description: "KWV Cape Tawny wine (ABV 17.5%), South Africa",
    price: 2900,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2900, currentPrice: 2900 }
    ],
    abv: 17.5,
    wineType: "Red"
  },
  {
    name: "Finca Las Morras Cabernet Sauvignon",
    description: "Finca Las Morras Cabernet Sauvignon (ABV 12.5%), Argentina",
    price: 2000,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 }
    ],
    abv: 12.5,
    wineType: "Red"
  },
  {
    name: "Namaqua Red Dry",
    description: "Namaqua Red Dry (ABV 8%), South Africa",
    price: 4400,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4400, currentPrice: 4400 }
    ],
    abv: 8.0,
    wineType: "Red"
  },
  {
    name: "Fragolino DuchesaLia",
    description: "Fragolino DuchesaLia (ABV 7%), Italy",
    price: 1900,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
    ],
    abv: 7.0,
    wineType: "Red"
  },
  {
    name: "Drostdhof Claret Select 5Litres",
    description: "Drostdhof Claret Select 5Litres (ABV 12.5%), South Africa",
    price: 4895,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4895, currentPrice: 4895 }
    ],
    abv: 12.5,
    wineType: "Red"
  },
  {
    name: "Nederburg Pinotage",
    description: "Nederburg Pinotage (ABV 14%), South Africa",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 14.0,
    wineType: "Red"
  },
  {
    name: "Nederburg Merlot",
    description: "Nederburg Merlot (ABV 14.5%), South Africa",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 14.5,
    wineType: "Red"
  },
  {
    name: "Nederburg Chardonnay",
    description: "Nederburg Chardonnay (ABV 13.5%), South Africa",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 13.5,
    wineType: "White"
  },
  {
    name: "4th Street Red",
    description: "4th Street Red (ABV 8%), South Africa",
    price: 4400,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4400, currentPrice: 4400 }
    ],
    abv: 8.0,
    wineType: "Red"
  },
  {
    name: "Nederburg Cabernet Sauvignon",
    description: "Nederburg Cabernet Sauvignon (ABV 13.5%), South Africa",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 13.5,
    wineType: "Red"
  },
  {
    name: "Gato Negro Sauvignon Blanc",
    description: "Gato Negro Sauvignon Blanc (ABV 12%), Chile",
    price: 1500,
    capacity: ["750ML", "1.5 Litres"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 },
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Gato Negro Chardonnay",
    description: "Gato Negro Chardonnay (ABV 12.5%), Chile",
    price: 2600,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 12.5,
    wineType: "White"
  },
  {
    name: "Carlo Rossi California Red",
    description: "Carlo Rossi California Red (ABV 11.5%), USA",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 11.5,
    wineType: "Red"
  },
  {
    name: "Carlo Rossi California White",
    description: "Carlo Rossi California White (ABV 11.5%), USA",
    price: 2300,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 11.5,
    wineType: "White"
  },
  {
    name: "Cassilero Del Diablo Sauvignon Blanc",
    description: "Cassilero Del Diablo Sauvignon Blanc (ABV 13%), Chile",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 13.0,
    wineType: "White"
  },
  {
    name: "Chamdor White Wine",
    description: "Chamdor White Wine (ABV 8%), South Africa",
    price: 950,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 950, currentPrice: 950 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Douglas Green Chardonnay",
    description: "Douglas Green Chardonnay (ABV 13%), South Africa",
    price: 2300,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 13.0,
    wineType: "White"
  },
  {
    name: "Drostdhof Grand Cru",
    description: "Drostdhof Grand Cru (ABV 12%), South Africa",
    price: 1400,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Drostdhof White 5litres",
    description: "Drostdhof White 5litres (ABV 12%), South Africa",
    price: 4800,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4800, currentPrice: 4800 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Four Cousins White",
    description: "Four Cousins White (ABV 8%), South Africa",
    price: 1400,
    capacity: ["750ML", "1.5 Litres"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 },
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Fragolino Bianco",
    description: "Fragolino Bianco (ABV 7%), Italy",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 7.0,
    wineType: "White"
  },
  {
    name: "Frontera Sauvignon Blanc",
    description: "Frontera Sauvignon Blanc (ABV 12%), Chile",
    price: 2600,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Frontera Chardonnay",
    description: "Frontera Chardonnay (ABV 12.5%), Chile",
    price: 2600,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 12.5,
    wineType: "White"
  },
  {
    name: "Frontera Late Harvest",
    description: "Frontera Late Harvest (ABV 12%), Chile",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Gamla Riesling",
    description: "Gamla Riesling (ABV 11%), Israel",
    price: 2700,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2700, currentPrice: 2700 }
    ],
    abv: 11.0,
    wineType: "White"
  },
  {
    name: "Graham Beck",
    description: "Graham Beck (ABV 13%), South Africa",
    price: 3200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 13.0,
    wineType: "White"
  },
  {
    name: "Gran Verano Sauvignon Blanc",
    description: "Gran Verano Sauvignon Blanc (ABV 12%), Chile",
    price: 1700,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1700, currentPrice: 1700 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Gran Verano Chardonnay",
    description: "Gran Verano Chardonnay (ABV 12.5%), Chile",
    price: 2600,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 12.5,
    wineType: "White"
  },
  {
    name: "Kleine Rust Chenin Blanc",
    description: "Kleine Rust Chenin Blanc (ABV 12%), South Africa",
    price: 2800,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2800, currentPrice: 2800 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "KWV Chardonnay",
    description: "KWV Chardonnay (ABV 13%), South Africa",
    price: 2600,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 13.0,
    wineType: "White"
  },
  {
    name: "Mt. Hermon Moscato",
    description: "Mt. Hermon Moscato (ABV 7%), Israel",
    price: 3200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
    ],
    abv: 7.0,
    wineType: "White"
  },
  {
    name: "Namaqua Sweet White",
    description: "Namaqua Sweet White (ABV 8%), South Africa",
    price: 1400,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Namaqua Cask 5litres",
    description: "Namaqua Cask 5litres (ABV 8%), South Africa",
    price: 4000,
    capacity: ["5 Litres"],
    capacityPricing: [
      { capacity: "5 Litres", originalPrice: 4000, currentPrice: 4000 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Nederburg Sauvignon Blanc",
    description: "Nederburg Sauvignon Blanc (ABV 13%), South Africa",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 13.0,
    wineType: "White"
  },
  {
    name: "Pierre Marcel White",
    description: "Pierre Marcel White (ABV 8%), France",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Robertson's White Wine",
    description: "Robertson's White Wine (ABV 8.5%), South Africa",
    price: 1600,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1600, currentPrice: 1600 }
    ],
    abv: 8.5,
    wineType: "White"
  },
  {
    name: "Robertson White",
    description: "Robertson White (ABV 8.5%), South Africa",
    price: 2600,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 8.5,
    wineType: "White"
  },
  {
    name: "Simonsig Sauvignon Blanc Semilion",
    description: "Simonsig Sauvignon Blanc Semilion (ABV 12%), South Africa",
    price: 1900,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Simonsig Chenin Blanc",
    description: "Simonsig Chenin Blanc (ABV 12%), South Africa",
    price: 1900,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Simonsig Sauvignon Blanc",
    description: "Simonsig Sauvignon Blanc (ABV 12%), South Africa",
    price: 2200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Tilia Chardonnay",
    description: "Tilia Chardonnay (ABV 12.5%), Argentina",
    price: 2200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 }
    ],
    abv: 12.5,
    wineType: "White"
  },
  {
    name: "Tommasi Pinot Grigio",
    description: "Tommasi Pinot Grigio (ABV 12%), Italy",
    price: 2500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  {
    name: "Upper Valley Sweet White",
    description: "Upper Valley Sweet White (ABV 8%), South Africa",
    price: 2800,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2800, currentPrice: 2800 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Upper Valley Dry White",
    description: "Upper Valley Dry White (ABV 8%), South Africa",
    price: 2800,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2800, currentPrice: 2800 }
    ],
    abv: 8.0,
    wineType: "White"
  },
  {
    name: "Zapallar Sauvignon Blanc",
    description: "Zapallar Sauvignon Blanc (ABV 12%), Chile",
    price: 2500,
    capacity: ["1.5 Litres"],
    capacityPricing: [
      { capacity: "1.5 Litres", originalPrice: 2500, currentPrice: 2500 }
    ],
    abv: 12.0,
    wineType: "White"
  },
  // Rose Wines
  {
    name: "4th Street Rose",
    description: "4th Street Rose (ABV 8%), South Africa",
    price: 1400,
    capacity: ["750ML", "5 Litres"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 },
      { capacity: "5 Litres", originalPrice: 4200, currentPrice: 4200 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Belaire Gold",
    description: "Belaire Gold (ABV 12%), France",
    price: 5200,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
    ],
    abv: 12.0,
    wineType: "Rose"
  },
  {
    name: "Berry Bush Rose",
    description: "Berry Bush Rose (ABV 8%), South Africa",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Boland Cellar Rose",
    description: "Boland Cellar Rose (ABV 8%), South Africa",
    price: 1400,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Casal Mendes Rose",
    description: "Casal Mendes Rose (ABV 8%), Portugal",
    price: 1500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Douglas Green Sunkissed Wine",
    description: "Douglas Green Sunkissed Wine (ABV 8%), South Africa",
    price: 2300,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Dulzino Rose",
    description: "Dulzino Rose (ABV 8%), Spain",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Four Cousins Rose",
    description: "Four Cousins Rose (ABV 8%), South Africa",
    price: 1400,
    capacity: ["750ML", "1.5 Litres"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1400, currentPrice: 1400 },
      { capacity: "1.5 Litres", originalPrice: 2400, currentPrice: 2400 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Fragolino Duschessalia Rose",
    description: "Fragolino Duschessalia Rose (ABV 7%), Italy",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 7.0,
    wineType: "Rose"
  },
  {
    name: "Frontera Cabernet Blush",
    description: "Frontera Cabernet Blush (ABV 12%), Chile",
    price: 1800,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1800, currentPrice: 1800 }
    ],
    abv: 12.0,
    wineType: "Rose"
  },
  {
    name: "Frontera Sweet Rose",
    description: "Frontera Sweet Rose (ABV 12%), Chile",
    price: 2300,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
    ],
    abv: 12.0,
    wineType: "Rose"
  },
  {
    name: "Frontera Rose",
    description: "Frontera Rose (ABV 12%), Chile",
    price: 1500,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 1500, currentPrice: 1500 }
    ],
    abv: 12.0,
    wineType: "Rose"
  },
  {
    name: "Mateus Rose",
    description: "Mateus Rose (ABV 8%), Portugal",
    price: 2600,
    capacity: ["1 Litre"],
    capacityPricing: [
      { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Moscatel De Setubal",
    description: "Moscatel De Setubal (ABV 8%), Portugal",
    price: 2600,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
    ],
    abv: 8.0,
    wineType: "Rose"
  },
  {
    name: "Nederburg Rose",
    description: "Nederburg Rose (ABV 12%), South Africa",
    price: 2100,
    capacity: ["750ML"],
    capacityPricing: [
      { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
    ],
    abv: 12.0,
    wineType: "Rose"
  }
];

router.post('/import-dialadrink-wine', async (req, res) => {
  try {
    console.log('Starting Dial a Drink wine import...');
    
    // Get the Wine category
    const wineCategory = await Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      return res.status(404).json({ error: 'Wine category not found' });
    }

    // Get or create the "All Wines" subcategory
    let subCategory = await SubCategory.findOne({ 
      where: { name: 'All Wines', categoryId: wineCategory.id } 
    });
    
    if (!subCategory) {
      subCategory = await SubCategory.create({
        name: 'All Wines',
        categoryId: wineCategory.id,
        isActive: true
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const product of dialadrinkWineProducts) {
      try {
        // Check if product already exists
        const existingDrink = await Drink.findOne({
          where: {
            name: product.name,
            categoryId: wineCategory.id
          }
        });

        if (existingDrink) {
          console.log(`Skipping existing product: ${product.name}`);
          skippedCount++;
          results.push({ name: product.name, status: 'skipped', reason: 'already exists' });
          continue;
        }

        // Create the drink
        const drink = await Drink.create({
          name: product.name,
          description: product.description,
          price: product.price.toString(),
          originalPrice: product.price.toString(),
          categoryId: wineCategory.id,
          subCategoryId: subCategory.id,
          capacity: product.capacity,
          capacityPricing: product.capacityPricing,
          abv: product.abv,
          isAvailable: product.isAvailable !== undefined ? product.isAvailable : true,
          isPopular: product.isPopular || false,
          isOnOffer: false,
          image: null
        });

        console.log(`Imported: ${product.name} - KES ${product.price}`);
        importedCount++;
        results.push({ name: product.name, status: 'imported', id: drink.id });
      } catch (error) {
        console.error(`Error importing ${product.name}:`, error.message);
        results.push({ name: product.name, status: 'error', error: error.message });
      }
    }

    console.log(`Dial a Drink wine import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`);
    
    res.json({
      success: true,
      message: `Dial a Drink wine import completed. Imported: ${importedCount}, Skipped: ${skippedCount}`,
      importedCount,
      skippedCount,
      totalProducts: dialadrinkWineProducts.length,
      results
    });

  } catch (error) {
    console.error('Error in Dial a Drink wine import:', error);
    res.status(500).json({ error: 'Failed to import Dial a Drink wine products', details: error.message });
  }
});

module.exports = router;
