# Tables in "dial a drink database.sql"

**File Location:** `/Users/maria/Documents/dial a drink database.sql`  
**File Size:** ~527 MB  
**Total Tables:** 120

## All Tables (Alphabetically Sorted)

1. `account_update`
2. `accounts`
3. `accounts_reports`
4. `activity_log`
5. `advance_requests`
6. `alert_filter`
7. `appointment_recurring`
8. `asstes`
9. `blog_categories`
10. `blogs`
11. `branch_expense`
12. `branches`
13. `brands`
14. `callback_details`
15. `cash_sub`
16. `categories`
17. `client_callback_details`
18. `company`
19. `completes`
20. `country`
21. `customer_till`
22. `customers`
23. `daily_sales`
24. `daily_sales_filter`
25. `delivery`
26. `fav_items`
27. `hand_cash`
28. `home_banner`
29. `invoice_pay_details`
30. `l2_account`
31. `l3_account`
32. `loyalty_points`
33. `missing_return`
34. `missing_stock`
35. `monthly_payment`
36. `my_cust`
37. `my_customers`
38. `my_office_shift`
39. `my_purchase`
40. `my_shifts`
41. `my_sub`
42. `ngong_territory`
43. `notify_items`
44. `office`
45. `office2`
46. `office_customer_details`
47. `office_payment`
48. `office_sale_items`
49. `office_sales`
50. `office_shift`
51. `online_users`
52. `onshelf_availability`
53. `opening_account`
54. `order_items` ⭐
55. `orders` ⭐
56. `payable_payment`
57. `paying`
58. `payment`
59. `penalty`
60. `pending_transfers`
61. `petty_register`
62. `product_categories`
63. `product_details`
64. `product_dispatch`
65. `product_subcategories`
66. `pur_hold`
67. `purchase_items`
68. `receive_items`
69. `rent`
70. `rider_account`
71. `rider_attendance`
72. `rider_complete`
73. `riders_sub_check`
74. `role`
75. `ruaka_account_hold`
76. `ruaka_shop_sale_items`
77. `ruaka_shop_sales`
78. `ruaka_teritory`
79. `salary_details`
80. `sales_order`
81. `sales_rep`
82. `saving`
83. `savings_withdrawal`
84. `scale`
85. `settings`
86. `share_of_shelf_report`
87. `shift_sales`
88. `shifts`
89. `shop`
90. `shop_account`
91. `shop_sale_items`
92. `shop_sales`
93. `short_expiryreport`
94. `staff_items`
95. `staff_pay_details`
96. `staff_sales_account`
97. `stores`
98. `sub_accounts`
99. `sub_categories`
100. `supplier_account`
101. `tasks`
102. `tb1`
103. `tb2`
104. `tec_categories`
105. `tec_combo_items`
106. `tec_customers`
107. `tec_expenses`
108. `tec_gift_cards`
109. `tec_groups`
110. `tec_login_attempts`
111. `tec_notice`
112. `tec_office_customers`
113. `tec_payments`
114. `tec_printers`
115. `tec_product_store_qty`
116. `tec_products`
117. `tec_products_new`
118. `tec_products_prices`
119. `tec_products_prices_old`
120. `tec_products_prices_original`
121. `tec_products_tags`
122. `tec_products_web`
123. `tec_products_web_old`
124. `tec_products_web_original`
125. `tec_purchase_items`
126. `tec_purchases`
127. `tec_registers`
128. `tec_sale_items` ⭐
129. `tec_sales` ⭐
130. `tec_sales_rep`
131. `tec_sessions`
132. `tec_settings`
133. `tec_stores`
134. `tec_suppliers`
135. `tec_suspended_items`
136. `tec_suspended_sales`
137. `tec_territory`
138. `tec_user_logins`
139. `tec_users`
140. `thy_accounts`
141. `thy_accounts_l2`
142. `thy_accounts_l3`
143. `transfer_hold`
144. `users`

## Key Tables for Order Import

⭐ **Primary Order Tables:**
- `orders` - Main orders table
- `order_items` - Order line items
- `tec_sales` - Alternative sales table (TEC system)
- `tec_sale_items` - TEC sales line items

**Related Tables:**
- `customers` - Customer information
- `tec_customers` - TEC customer information
- `delivery` - Delivery information
- `payment` - Payment records
- `tec_payments` - TEC payment records

**Product Tables:**
- `tec_products` - Products (TEC system)
- `tec_products_web` - Web products
- `product_details` - Product details
- `brands` - Brand information
- `categories` - Categories
- `product_categories` - Product categories
- `sub_categories` - Subcategories
- `product_subcategories` - Product subcategories

## Notes

- The database appears to use a dual system: standard tables (`orders`, `order_items`) and TEC system tables (`tec_sales`, `tec_sale_items`)
- There are 28,020 orders mentioned - these are likely in the `orders` or `tec_sales` tables
- The file is quite large (527MB), suggesting it contains substantial data
