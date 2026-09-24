export type RequestScannerViewProps = Readonly<{
  active: boolean;
  torchEnabled: boolean;
  onCode: (value: string) => void;
  onError: () => void;
}>;
