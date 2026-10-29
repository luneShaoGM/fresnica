import React from 'react';

import { ListRow, Screen } from '@ui/components';
import { NativeScreen } from '@ui/components/NativeScreen';

import { createLocalization } from '../../../locale/localization';
import { defaultTheme } from '../../../ui/theme';
import { SettingsHomeScreen } from '../SettingsHomeScreen';
import { createStyles } from '../SettingsHomeScreen.styles';

jest.mock('@fresnica/ui-native', () => ({
  Screen: () => null,
}));

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => {
  const actual = jest.requireActual('../../../locale/localization') as typeof import('../../../locale/localization');
  return { useLocalization: () => actual.createLocalization('en') };
});

type NodeProps = Readonly<{
  children?: React.ReactNode;
  contentInset?: string;
  scrollable?: boolean;
  scroll?: boolean;
  padded?: boolean;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
}>;

function collect(root: React.ReactNode, predicate: (element: React.ReactElement<NodeProps>) => boolean) {
  const matches: React.ReactElement<NodeProps>[] = [];

  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<NodeProps>(node)) return;
    if (predicate(node)) matches.push(node);
    React.Children.forEach(node.props.children, visit);
  };

  visit(root);
  return matches;
}

function renderSettings(accountCount = 3) {
  const onOpenAccounts = jest.fn();
  const onOpenNetwork = jest.fn();
  const onOpenLanguage = jest.fn();
  const onOpenSecurity = jest.fn();
  const onOpenConnectedDapps = jest.fn();
  const onOpenAbout = jest.fn();
  const root = SettingsHomeScreen({
    accountCount,
    onOpenAccounts,
    onOpenNetwork,
    onOpenLanguage,
    onOpenSecurity,
    onOpenConnectedDapps,
    onOpenAbout,
  });
  return {
    root,
    callbacks: { onOpenAccounts, onOpenNetwork, onOpenLanguage, onOpenSecurity, onOpenConnectedDapps, onOpenAbout },
  };
}

describe('Settings Home native scroll integration', () => {
  it('keeps App safe area while the library supplies only scroll and content presentation', () => {
    const { root } = renderSettings();
    const [appScreen] = collect(root, element => element.type === Screen);
    const [nativeScreen] = collect(root, element => element.type === NativeScreen);

    expect(appScreen?.props).toMatchObject({ scrollable: false, contentInset: 'none' });
    expect(nativeScreen?.props).toMatchObject({ scroll: true, padded: false });
    expect(collect(root, element => element.type === ListRow)).toHaveLength(10);

    const styles = createStyles(defaultTheme);
    expect(styles.content.paddingHorizontal).toBe(defaultTheme.spacing.lg);
    expect(styles.content.paddingBottom).toBe(defaultTheme.spacing.xl);
  });

  it('preserves the five existing navigation callbacks without activating unavailable settings', () => {
    const { root, callbacks } = renderSettings();
    const rows = collect(root, element => element.type === ListRow);
    const t = createLocalization('en').t;

    const interactive = [
      [t('settings.accounts'), callbacks.onOpenAccounts],
      [t('settings.general'), callbacks.onOpenNetwork],
      [t('settings.language'), callbacks.onOpenLanguage],
      [t('settings.security'), callbacks.onOpenSecurity],
      [t('settings.connectedDapps'), callbacks.onOpenConnectedDapps],
      [t('settings.about'), callbacks.onOpenAbout],
    ] as const;
    for (const [title, action] of interactive) {
      const row = rows.find(element => element.props.title === title);
      expect(row?.props.onPress).toBe(action);
      row?.props.onPress?.();
      expect(action).toHaveBeenCalledTimes(1);
    }

    for (const title of ['settings.addressBook', 'settings.advanced', 'settings.support', 'settings.terms']) {
      const row = rows.find(element => element.props.title === t(title));
      expect(row?.props.onPress).toBeUndefined();
      expect(row?.props.subtitle).toBe(t('settings.soon'));
    }
  });

  it('keeps the localized account count and current language projection', () => {
    const localization = createLocalization('en');
    const expectedLanguageName = localization.locales.find(option => option.code === localization.locale)?.localName;
    const zero = collect(renderSettings(0).root, element => element.type === ListRow);
    const many = collect(renderSettings(7).root, element => element.type === ListRow);

    expect(zero.find(element => element.props.title === localization.t('settings.accounts'))?.props.subtitle).toBe(
      localization.tPlural('settings.accountCount', 0),
    );
    expect(many.find(element => element.props.title === localization.t('settings.accounts'))?.props.subtitle).toBe(
      localization.tPlural('settings.accountCount', 7),
    );
    expect(many.find(element => element.props.title === localization.t('settings.language'))?.props.subtitle).toBe(
      expectedLanguageName,
    );
  });
});
