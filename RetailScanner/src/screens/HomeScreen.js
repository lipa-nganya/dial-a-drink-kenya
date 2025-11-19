import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Title, Paragraph } from 'react-native-paper';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Retail Scanner</Title>
          <Paragraph style={styles.description}>
            Choose a scanning mode to get started
          </Paragraph>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Add Barcode & Stock</Title>
          <Paragraph>
            Scan barcodes and attach them to inventory items. Set stock quantities.
          </Paragraph>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('AddBarcode')}
            style={styles.button}
          >
            Start Scanning
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>POS Scanner</Title>
          <Paragraph>
            Scan items at point of sale. Items will be added to cart and inventory will be decreased.
          </Paragraph>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('POSScan')}
            style={styles.button}
          >
            Start POS Scan
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
  },
  description: {
    marginTop: 8,
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
  },
});

