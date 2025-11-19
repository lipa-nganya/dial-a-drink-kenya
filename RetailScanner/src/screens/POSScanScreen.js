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
import { scanForPOS, decreaseStock, addToPOSCart, getPOSCart, clearPOSCart } from '../services/api';

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

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || loading) return;
    
    setScanned(true);
    setLoading(true);

    try {
      const product = await scanForPOS(data);
      
      // Add to backend cart (this will sync with Admin POS)
      await addToPOSCart(product.id, 1);
      
      // Update local cart
      const existingIndex = scannedItems.findIndex(item => item.id === product.id);
      
      if (existingIndex >= 0) {
        // Increase quantity
        const updatedItems = [...scannedItems];
        updatedItems[existingIndex].quantity += 1;
        setScannedItems(updatedItems);
      } else {
        // Add new item
        setScannedItems([...scannedItems, {
          ...product,
          quantity: 1
        }]);
      }

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

