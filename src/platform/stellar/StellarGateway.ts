import type { BalanceGatewayPort } from '../../capabilities/balance/BalanceGateway';
import type { HistoryGatewayPort } from '../../capabilities/history/HistoryGateway';
import type { PaymentGatewayPort } from '../../capabilities/payment/PaymentGateway';
import type { TrustlineGatewayPort } from '../../capabilities/trustline/TrustlineGateway';
import type { BuiltTransaction } from '../../capabilities/stellar/types';
import type {
  BuildPathPaymentStrictReceiveInput,
  BuildPathPaymentStrictSendInput,
  LoadStrictReceivePathsInput,
  LoadStrictSendPathsInput,
  StellarPathPaymentRoute,
} from './types';

export interface StellarGateway
  extends BalanceGatewayPort, HistoryGatewayPort, PaymentGatewayPort, TrustlineGatewayPort {}

export interface StellarPathPaymentGateway {
  loadStrictSendPaths(input: LoadStrictSendPathsInput): Promise<readonly StellarPathPaymentRoute[]>;
  loadStrictReceivePaths(input: LoadStrictReceivePathsInput): Promise<readonly StellarPathPaymentRoute[]>;
  buildPathPaymentStrictSend(input: BuildPathPaymentStrictSendInput): Promise<BuiltTransaction>;
  buildPathPaymentStrictReceive(input: BuildPathPaymentStrictReceiveInput): Promise<BuiltTransaction>;
}
