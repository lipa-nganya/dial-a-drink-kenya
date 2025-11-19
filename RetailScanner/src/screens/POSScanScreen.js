import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { 
  Button, 
  Card, 
  Title, 
  Paragraph, 
  ActivityIndicator,
  List,
  Chip,
  Divider
} from 'react-native-paper';
import { scanForPOS, decreaseStock, addToPOSCart, getPOSCart, clearPOSCart, removeFromPOSCart } from '../services/api';

export default function POSScanScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  
  useEffect(() => {
    if (permission) {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  // Poll backend cart to sync with Admin POS
  useEffect(() => {
    let isMounted = true;
    
    const fetchCart = async () => {
      try {
        const response = await getPOSCart();
        if (!isMounted) return;
        
        if (response.cart) {
          // If backend cart is empty, clear local cart
          if (response.cart.length === 0) {
            setScannedItems(prevItems => {
              if (prevItems.length > 0) {
                console.log('🛒 Backend cart cleared, clearing local cart');
                return [];
              }
              return prevItems;
            });
          } else {
            // Sync local cart with backend cart
            const backendCart = response.cart.map(item => ({
              id: item.drinkId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.image
            }));
            
            // Update local cart if it differs from backend
            setScannedItems(prevItems => {
              const prevCartStr = JSON.stringify(prevItems.map(item => ({ id: item.id, quantity: item.quantity })).sort((a, b) => a.id - b.id));
              const backendCartStr = JSON.stringify(backendCart.map(item => ({ id: item.id, quantity: item.quantity })).sort((a, b) => a.id - b.id));
              
              if (prevCartStr !== backendCartStr) {
                console.log('🛒 Syncing local cart with backend cart');
                return backendCart;
              }
              return prevItems;
            });
          }
        }
      } catch (error) {
        console.error('Error fetching POS cart:', error);
      }
    };

    // Fetch initial cart
    fetchCart();

    // Poll every 2 seconds (same as Admin POS)
    const cartPollInterval = setInterval(fetchCart, 2000);

    return () => {
      isMounted = false;
      clearInterval(cartPollInterval);
    };
  }, []); // Empty dependency array - only run on mount/unmount

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return;
    
    setScanned(true);
    setLoading(true);

    try {
      // Normalize barcode: trim whitespace
      const normalizedBarcode = data.trim();
      console.log(`📱 Retail Scanner: Scanned barcode: "${data}" (normalized: "${normalizedBarcode}")`);
      
      const product = await scanForPOS(normalizedBarcode);
      
      // Add to backend cart (this will sync with Admin POS)
      await addToPOSCart(product.id, 1);
      
      // Update local cart immediately for better UX
      // The polling will sync with backend, but this gives instant feedback
      setScannedItems(prevItems => {
        const existingIndex = prevItems.findIndex(item => item.id === product.id);
        
        if (existingIndex >= 0) {
          // Increase quantity
          const updatedItems = [...prevItems];
          updatedItems[existingIndex].quantity += 1;
          return updatedItems;
        } else {
          // Add new item
          return [...prevItems, {
            ...product,
            quantity: 1
          }];
        }
      });

      // Show success feedback
      Alert.alert('Item Added', `${product.name} added to cart`);
      
    } catch (error) {
      Alert.alert(
        'Product Not Found',
        `No product found with barcode: ${data}`,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const handleCompleteOrder = async () => {
    if (scannedItems.length === 0) {
      Alert.alert('Error', 'No items to process');
      return;
    }

    setLoading(true);
    try {
      // Decrease stock for each item
      for (const item of scannedItems) {
        await decreaseStock(item.id, item.quantity);
      }

      // Clear backend cart (this will also clear Admin POS cart)
      await clearPOSCart();

      Alert.alert(
        'Success',
        `Order completed! ${scannedItems.length} item(s) processed.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setScannedItems([]);
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete order');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      // Remove from backend cart
      await removeFromPOSCart(itemId);
      // Update local cart
      setScannedItems(scannedItems.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Error removing item:', error);
      // Still update local cart even if backend fails
      setScannedItems(scannedItems.filter(item => item.id !== itemId));
    }
  };

  const getTotal = () => {
    return scannedItems.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * item.quantity;
    }, 0);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.scannerContainer}>
        {hasPermission ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'],
            }}
          />
        ) : (
          <View style={styles.overlay}>
            <Paragraph>Camera permission required</Paragraph>
            <Button onPress={requestPermission}>Grant Permission</Button>
          </View>
        )}
        {(scanned || loading) && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Scanned Items</Title>
            {scannedItems.length === 0 ? (
              <Paragraph>No items scanned yet</Paragraph>
            ) : (
              <>
                {scannedItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Paragraph style={styles.itemName}>{item.name}</Paragraph>
                      <Paragraph>KES {item.price} × {item.quantity}</Paragraph>
                    </View>
                    <Chip 
                      icon="close" 
                      onPress={() => handleRemoveItem(item.id)}
                      style={styles.removeChip}
                    >
                      Remove
                    </Chip>
                  </View>
                ))}
                <Divider style={styles.divider} />
                <View style={styles.totalRow}>
                  <Title>Total: KES {getTotal().toFixed(2)}</Title>
                </View>
                <Button
                  mode="contained"
                  onPress={handleCompleteOrder}
                  loading={loading}
                  disabled={loading}
                  style={styles.button}
                >
                  Complete Order
                </Button>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scannerContainer: {
    height: 300,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontWeight: 'bold',
  },
  removeChip: {
    marginLeft: 8,
  },
  divider: {
    marginVertical: 16,
  },
  totalRow: {
    marginVertical: 8,
  },
  button: {
    marginTop: 16,
  },
});

