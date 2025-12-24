import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { 
  TextInput, 
  Button, 
  Card, 
  Title, 
  Paragraph, 
  ActivityIndicator,
  List,
  Chip
} from 'react-native-paper';
import { getDrinkByBarcode, searchDrinks, attachBarcode, addStock } from '../services/api';

export default function AddBarcodeScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [currentStock, setCurrentStock] = useState(null); // Current stock of selected drink
  const [stockToAdd, setStockToAdd] = useState(''); // Amount to add to stock
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [fetchingStock, setFetchingStock] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  
  useEffect(() => {
    if (permission) {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    
    setScanned(true);
    setBarcode(data);
    setSelectedDrink(null);
    setSearchResults([]);
    setCurrentStock(null);
    setStockToAdd('');
    
    // Check if barcode already exists
    try {
      const existingDrink = await getDrinkByBarcode(data);
      if (existingDrink) {
        // Barcode exists - show the drink and its current stock
        setSelectedDrink(existingDrink);
        const stock = existingDrink.stock !== undefined && existingDrink.stock !== null 
          ? parseInt(existingDrink.stock) 
          : 0;
        setCurrentStock(stock);
        Alert.alert(
          'Barcode Already Exists',
          `This barcode is attached to: ${existingDrink.name}\nCurrent stock: ${stock}`,
          [{ text: 'OK' }]
        );
        setTimeout(() => setScanned(false), 2000);
        return;
      }
    } catch (error) {
      // Barcode doesn't exist, which is fine - user can attach it
    }
    
    setTimeout(() => setScanned(false), 2000);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchDrinks(searchTerm);
      setSearchResults(results || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to search drinks');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectDrink = async (drink) => {
    setSelectedDrink(drink);
    setSearchResults([]);
    setSearchTerm('');
    setStockToAdd('');
    
    // Set current stock from the drink object immediately
    const stock = drink.stock !== undefined && drink.stock !== null 
      ? parseInt(drink.stock) 
      : 0;
    setCurrentStock(stock);
    
    // Optionally fetch latest stock to ensure it's up to date
    setFetchingStock(true);
    try {
      const updatedDrink = await searchDrinks(drink.name);
      const foundDrink = Array.isArray(updatedDrink) 
        ? updatedDrink.find(d => d.id === drink.id)
        : updatedDrink;
      
      if (foundDrink && foundDrink.stock !== undefined && foundDrink.stock !== null) {
        setCurrentStock(parseInt(foundDrink.stock) || 0);
      }
    } catch (error) {
      // Keep the stock from the drink object if fetch fails
      console.error('Error fetching latest stock:', error);
    } finally {
      setFetchingStock(false);
    }
  };

  const handleAttachBarcode = async () => {
    if (!selectedDrink) {
      Alert.alert('Error', 'Please select a drink');
      return;
    }

    if (!barcode) {
      Alert.alert('Error', 'Please scan a barcode');
      return;
    }

    const stockToAddValue = parseInt(stockToAdd) || 0;
    if (stockToAddValue < 0) {
      Alert.alert('Error', 'Stock to add must be a non-negative whole number');
      return;
    }

    if (stockToAddValue === 0) {
      Alert.alert('Error', 'Please enter a quantity to add to stock');
      return;
    }

    setLoading(true);
    try {
      // Attach barcode if not already attached
      const hasBarcode = selectedDrink.barcode === barcode;
      if (!hasBarcode) {
        await attachBarcode(selectedDrink.id, barcode);
      }
      
      // Add stock to existing stock
      const result = await addStock(selectedDrink.id, stockToAddValue);
      const newStock = result.newStock || (currentStock + stockToAddValue);
      
      Alert.alert(
        'Success',
        `Stock added successfully!\n\n${selectedDrink.name}\nPrevious stock: ${currentStock || 0}\nAdded: ${stockToAddValue}\nNew stock: ${newStock}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setBarcode('');
              setSelectedDrink(null);
              setCurrentStock(null);
              setStockToAdd('');
              setScanned(false);
              setSearchResults([]);
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to attach barcode and add stock');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Scan Barcode</Title>
          <Paragraph>Point camera at barcode to scan</Paragraph>
          {barcode && (
            <Chip style={styles.chip} icon="barcode">
              Scanned: {barcode}
            </Chip>
          )}
        </Card.Content>
      </Card>

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
        {scanned && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Search & Select Item</Title>
          <TextInput
            label="Search items..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            right={
              <TextInput.Icon
                icon="magnify"
                onPress={handleSearch}
              />
            }
          />
          {searching && <ActivityIndicator style={styles.loader} />}
          
          {searchResults.length > 0 && (
            <View style={styles.results}>
              {searchResults.map((drink) => (
                <List.Item
                  key={drink.id}
                  title={drink.name}
                  description={`KES ${drink.price}`}
                  left={(props) => <List.Icon {...props} icon="bottle-wine" />}
                  onPress={() => handleSelectDrink(drink)}
                />
              ))}
            </View>
          )}

          {selectedDrink && (
            <Card style={styles.selectedCard}>
              <Card.Content>
                <Title>Selected Item</Title>
                <Paragraph>{selectedDrink.name}</Paragraph>
                <Paragraph>Price: KES {selectedDrink.price}</Paragraph>
                {currentStock !== null && (
                  <Paragraph style={styles.stockInfo}>
                    Current Stock: <Title style={styles.stockValue}>{currentStock}</Title>
                  </Paragraph>
                )}
                {fetchingStock && <ActivityIndicator style={styles.loader} />}
              </Card.Content>
            </Card>
          )}
        </Card.Content>
      </Card>

      {selectedDrink && barcode && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Add Stock</Title>
            {currentStock !== null && (
              <Paragraph style={styles.stockInfo}>
                Current Stock: <Title style={styles.stockValue}>{currentStock}</Title>
              </Paragraph>
            )}
            <TextInput
              label="Quantity to Add (whole numbers only)"
              value={stockToAdd}
              onChangeText={setStockToAdd}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Enter quantity to add"
            />
            {currentStock !== null && stockToAdd && parseInt(stockToAdd) > 0 && (
              <Paragraph style={styles.preview}>
                New stock will be: {currentStock + parseInt(stockToAdd)}
              </Paragraph>
            )}
            <Button
              mode="contained"
              onPress={handleAttachBarcode}
              loading={loading}
              disabled={loading || !stockToAdd || parseInt(stockToAdd) <= 0}
              style={styles.button}
            >
              {selectedDrink.barcode === barcode ? 'Add Stock' : 'Attach Barcode & Add Stock'}
            </Button>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
  },
  scannerContainer: {
    height: 300,
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    marginTop: 8,
  },
  loader: {
    marginTop: 8,
  },
  results: {
    marginTop: 8,
  },
  selectedCard: {
    marginTop: 16,
    backgroundColor: '#e3f2fd',
  },
  input: {
    marginTop: 8,
  },
  button: {
    marginTop: 16,
  },
  stockInfo: {
    marginTop: 8,
    fontSize: 14,
  },
  stockValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  preview: {
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
  },
});

