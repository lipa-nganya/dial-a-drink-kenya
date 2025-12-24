-- Create wallet for driver ID 4 if it doesn't exist
INSERT INTO driver_wallets ("driverId", balance, "totalTipsReceived", "totalTipsCount", "totalDeliveryPay", "totalDeliveryPayCount", "createdAt", "updatedAt")
SELECT 4, 0, 0, 0, 0, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM driver_wallets WHERE "driverId" = 4);

-- Show the result
SELECT id, "driverId", balance, "totalTipsReceived", "totalDeliveryPay" 
FROM driver_wallets 
WHERE "driverId" = 4;












