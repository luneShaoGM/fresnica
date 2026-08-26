Pod::Spec.new do |spec|
  spec.name = 'FresnicaNative'
  spec.version = '0.2.1'
  spec.summary = 'Pinned Fresnica Native SDK and React Native adapter binaries.'
  spec.homepage = 'https://github.com/manran/fresnica'
  spec.license = { :type => 'MIT' }
  spec.author = { 'Fresnica' => 'fresnica-mobile' }
  spec.source = { :git => 'https://github.com/manran/fresnica.git', :tag => 'native-sdk-v0.2.1' }
  spec.platform = :ios, '13.4'

  spec.vendored_frameworks = [
    'native/FresnicaSDK.xcframework',
    'native/FresnicaSDKFFI.xcframework',
    'adapter/react-native/FresnicaRNAdapter.xcframework',
  ]

  spec.pod_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -ObjC',
  }
  spec.user_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -ObjC',
  }
end
