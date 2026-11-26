#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SecureAssetFetch, NSObject)

RCT_EXTERN_METHOD(fetch:(NSString *)url
                  kind:(NSString *)kind
                  requestId:(NSString *)requestId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(cancel:(NSString *)requestId)

RCT_EXTERN_METHOD(openIconCache:(NSString *)epoch
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(readIconCache:(NSString *)session
                  key:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(writeIconCache:(NSString *)session
                  key:(NSString *)key
                  sourceUrl:(NSString *)sourceUrl
                  base64:(NSString *)base64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removeIconCache:(NSString *)session
                  key:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(closeIconCache:(NSString *)session
                  clearAll:(BOOL)clearAll
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
