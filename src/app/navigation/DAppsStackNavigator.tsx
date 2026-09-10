import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {DAppsScreen} from '@features/dapps/screens/DAppsScreen';

import type {DAppsStackParamList} from './navigationTypes';

const Stack = createNativeStackNavigator<DAppsStackParamList>();

export function DAppsStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="dapps" screenOptions={{headerShown: false}}>
      <Stack.Screen name="dapps" component={DAppsScreen} />
    </Stack.Navigator>
  );
}
