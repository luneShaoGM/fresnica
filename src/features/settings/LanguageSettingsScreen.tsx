import React from 'react';
import {Pressable, SafeAreaView, ScrollView, Text, View} from 'react-native';

import {useLocalization} from '../../locale';
import {useThemedStyles} from '../../ui/theme';
import {createStyles} from './LanguageSettingsScreen.styles';

type Props = Readonly<{
  onBack: () => void;
}>;

export function LanguageSettingsScreen({onBack}: Props) {
  const {locale, locales, setLocale, t} = useLocalization();
  const styles = useThemedStyles(createStyles);
  const sortedLocales = [...locales].sort((left, right) =>
    left.englishName.localeCompare(right.englishName),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({pressed}) => [styles.backButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('language.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.note}>{t('language.fallbackNote')}</Text>
        {sortedLocales.map(option => {
          const selected = option.code === locale;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{selected}}
              key={option.code}
              onPress={() => setLocale(option.code)}
              style={({pressed}) => [styles.row, pressed ? styles.pressed : undefined]}>
              <View style={styles.labelColumn}>
                <Text style={styles.localName}>{option.localName}</Text>
                <Text style={styles.englishName}>
                  {option.englishName} · {option.code}
                </Text>
              </View>
              <View style={styles.statusColumn}>
                {selected ? <Text style={styles.current}>{t('language.current')}</Text> : null}
                <Text style={option.translated ? styles.translated : styles.fallback}>
                  {t(option.translated ? 'language.translated' : 'language.fallback')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
