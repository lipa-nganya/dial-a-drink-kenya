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
import { getDrinkByBarcode, searchDrinks, attachBarcode, updateStock } from '../services/api';

export default function AddBarcodeScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedDrink, setSelectedDrink] = useState(null);
  const [stock, setStock] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

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
    
    // Check if barcode already exists
    try {
      const existingDrink = await getDrinkByBarcode(data);
      if (existingDrink) {
        Alert.alert(
          'Barcode Already Exists',
          `This barcode is already attached to: ${existingDrink.name}`,
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

  const handleSelectDrink = (drink) => {
    setSelectedDrink(drink);
    setSearchResults([]);
    setSearchTerm('');
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

    const stockValue = parseInt(stock) || 0;
    if (stockValue < 0) {
      Alert.alert('Error', 'Stock must be a non-negative whole number');
      return;
    }

    setLoading(true);
    try {
      await attachBarcode(selectedDrink.id, barcode);
      if (stockValue > 0) {
        await updateStock(selectedDrink.id, stockValue);
      }
      
      Alert.alert(
        'Success',
        `Barcode ${barcode} attached to ${selectedDrink.name}${stockValue > 0 ? ` with stock ${stockValue}` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setBarcode('');
              setSelectedDrink(null);
              setStock('');
              setScanned(false);
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to attach barcode');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Card>
          <Card.Content>
            <Title>Camera Permission Required</Title>
            <Paragraph>Please grant camera permission to scan barcodes</Paragraph>
          </Card.Content>
        </Card>
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
              </Card.Content>
            </Card>
          )}
        </Card.Content>
      </Card>

      {selectedDrink && barcode && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Enter Stock Quantity</Title>
            <TextInput
              label="Stock (whole numbers only)"
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleAttachBarcode}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Attach Barcode & Save Stock
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
});

