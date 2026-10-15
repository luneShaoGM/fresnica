import React, {useMemo, type PropsWithChildren} from 'react';
import {FresnicaUiProvider, themes} from '@fresnica/ui-native';
import {enUS, zhCN, type UiLocale} from '@fresnica/ui-native/locales';

import {useAppTheme} from '@ui/theme';
import {toNativeUiTheme} from '@ui/theme/toNativeUiTheme';

import type {SupportedLocale} from '../locale';

const zhTW: UiLocale = Object.freeze({close: '關閉', loading: '載入中'});

type Props = PropsWithChildren<Readonly<{locale: SupportedLocale}>>;

// The App owns product language/theme preferences; this only supplies the
// external component library with the resolved presentation contracts.
export function UiNativeProvider({locale, children}: Props) {
  const appTheme = useAppTheme();
  const nativeTheme = useMemo(
    () => toNativeUiTheme(appTheme, appTheme.statusBarContent === 'light' ? themes.dark : themes.light),
    [appTheme],
  );
  const nativeLocale = locale === 'zh' ? zhCN : locale === 'zh-TW' ? zhTW : enUS;

  return (
    <FresnicaUiProvider theme={nativeTheme} locale={nativeLocale}>
      {children}
    </FresnicaUiProvider>
  );
}
