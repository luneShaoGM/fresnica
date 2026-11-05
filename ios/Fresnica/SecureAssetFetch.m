#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SecureAssetFetch, NSObject)

RCT_EXTERN_METHOD(fetch:(NSString *)url
                  kind:(NSString *)kind
                  requestId:(NSString *)requestId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancel:(NSString *)requestId)

@end
