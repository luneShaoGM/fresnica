#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(RequestPhotoQr, NSObject)

RCT_EXTERN_METHOD(pickQr:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

// The cover is owned by the native app lifecycle; JavaScript can only reveal while active.
@interface RCT_EXTERN_MODULE(PrivacyShield, NSObject)
RCT_EXTERN_METHOD(reveal:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
