#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(SessionAuthentication, NSObject)
RCT_EXTERN_METHOD(canAuthenticate:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(authenticate:(NSString *)requestId reason:(NSString *)reason cancelLabel:(NSString *)cancelLabel resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancel:(NSString *)requestId)
@end
