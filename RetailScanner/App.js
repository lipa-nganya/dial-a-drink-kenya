import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import HomeScreen from './src/screens/HomeScreen';
import AddBarcodeScreen from './src/screens/AddBarcodeScreen';
import POSScanScreen from './src/screens/POSScanScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
            options={{ title: 'Retail Scanner' }}
          />
          <Stack.Screen 
            name="AddBarcode" 
            component={AddBarcodeScreen}
            options={{ title: 'Add Barcode & Stock' }}
          />
          <Stack.Screen 
            name="POSScan" 
            component={POSScanScreen}
            options={{ title: 'POS Scanner' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
