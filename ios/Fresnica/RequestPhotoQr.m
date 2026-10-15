#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RequestPhotoQr, NSObject)

RCT_EXTERN_METHOD(pickQr:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
