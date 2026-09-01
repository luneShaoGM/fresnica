import React from 'react';
import {Text, View} from 'react-native';

import {useThemedStyles} from '../../../../ui/theme';
import {createStyles} from './styles';

export function XAppsScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>XApps</Text>
        <Text style={styles.title}>Apps and connections</Text>
        <Text style={styles.description}>
          The XApps product entry is now part of the application shell. Browser, permission,
          connection and signing behavior will be enabled only through explicit Fresnica
          authorization boundaries in the XApps stage.
        </Text>
      </View>
    </View>
  );
}
