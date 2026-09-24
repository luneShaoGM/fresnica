import React from 'react';

import { parseRequestIngress } from '../requestIngressFlow';
import { RequestIngressScreen, type RequestScannerViewComponent } from '../RequestIngressScreen';

jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: function QRCodeMock() {
    return null;
  },
}));

jest.mock('../../../ui/components', () => ({
  Screen: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (value, [name, replacement]) => value.replace(`{{${name}}}`, String(replacement)),
        key === 'request.ingress.accepted.body' ? 'accepted {{carrier}}' : key,
      );
    },
  }),
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
}>;

function walk(
  node: React.ReactNode,
  callback: (element: React.ReactElement<NodeProps>) => void,
  stopType?: React.ElementType,
): void {
  if (Array.isArray(node)) {
    React.Children.forEach(node, child => walk(child, callback, stopType));
    return;
  }
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  if (node.type === stopType) return;
  if (typeof node.type === 'function' && !(node.type.prototype && node.type.prototype instanceof React.Component)) {
    const rendered = (node.type as (props: NodeProps) => React.ReactNode)(node.props);
    walk(rendered, callback, stopType);
    return;
  }
  React.Children.forEach(node.props.children, child => walk(child, callback, stopType));
}

const ScannerView: RequestScannerViewComponent = () => null;
const baseProps = {
  carrier: 'scan' as const,
  scannerActive: false,
  torchEnabled: false,
  ScannerView,
  onCode: jest.fn(),
  onScannerError: jest.fn(),
  onToggleTorch: jest.fn(),
  onRetry: jest.fn(),
  onOpenSettings: jest.fn(),
  onClose: jest.fn(),
};

describe('RequestIngressScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps blocked camera permission on a stable screen with retry, settings, and close actions', () => {
    const root = RequestIngressScreen({ ...baseProps, permissionState: 'blocked' });
    const labels: string[] = [];
    walk(root, element => {
      if (element.props.accessibilityLabel) labels.push(element.props.accessibilityLabel);
    });

    expect(labels).toContain('request.ingress.close');
    expect(labels).toContain('request.ingress.retry');
    expect(labels).toContain('request.ingress.permission.settings');
  });

  it('injects the scanner only after permission is granted and preserves local torch state', () => {
    const onCode = jest.fn();
    const onScannerError = jest.fn();
    const root = RequestIngressScreen({
      ...baseProps,
      permissionState: 'granted',
      scannerActive: true,
      torchEnabled: true,
      onCode,
      onScannerError,
    });
    let scanner: React.ReactElement<React.ComponentProps<RequestScannerViewComponent>> | undefined;
    walk(
      root,
      element => {
        if (element.type === ScannerView) {
          scanner = element as React.ReactElement<React.ComponentProps<RequestScannerViewComponent>>;
        }
      },
      ScannerView,
    );

    expect(scanner?.props.active).toBe(true);
    expect(scanner?.props.torchEnabled).toBe(true);
    scanner?.props.onCode('GDESTINATION');
    expect(onCode).toHaveBeenCalledWith('GDESTINATION');
  });

  it('renders accepted typed fields without echoing the original request URI', () => {
    const raw = 'web+stellar:pay?destination=GDESTINATION&amount=1';
    const result = parseRequestIngress(
      {
        currentNetwork: { id: 'stellar-mainnet', networkPassphrase: 'Public Global Stellar Network ; September 2015' },
        isClassicAccountAddress: value => value.startsWith('G'),
      },
      'paste',
      raw,
    );
    const root = RequestIngressScreen({ ...baseProps, carrier: 'paste', result });
    const texts: string[] = [];
    walk(root, element => {
      const child = element.props.children;
      if (typeof child === 'string') texts.push(child);
    });

    const rendered = texts.join(' ');
    expect(rendered).toContain('GDESTINATION');
    expect(rendered).toContain('1');
    expect(rendered).not.toContain(raw);
    expect(rendered).not.toContain('web+stellar:pay');
  });

  it('does not echo sensitive rejected input into UI copy', () => {
    const secret = `S${'A'.repeat(55)}`;
    const result = parseRequestIngress(
      {
        currentNetwork: { id: 'stellar-mainnet', networkPassphrase: 'Public Global Stellar Network ; September 2015' },
        isClassicAccountAddress: value => value.startsWith('G'),
      },
      'paste',
      secret,
    );
    const root = RequestIngressScreen({ ...baseProps, carrier: 'paste', result });
    const serialized: string[] = [];
    walk(root, element => serialized.push(JSON.stringify(element.props)));
    expect(serialized.join(' ')).not.toContain(secret);
  });
});
