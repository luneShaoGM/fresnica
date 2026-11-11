Pod::Spec.new do |spec|
  spec.name = 'FresnicaNative'
  spec.version = '0.3.1'
  spec.summary = 'Pinned Fresnica Native SDK and React Native adapter binaries.'
  spec.homepage = 'https://github.com/manran/fresnica'
  spec.license = { :type => 'MIT' }
  spec.author = { 'Fresnica' => 'fresnica-mobile' }
  spec.source = { :git => 'https://github.com/manran/fresnica.git', :tag => 'native-sdk-v0.3.1' }
  spec.platform = :ios, '13.4'

  spec.vendored_frameworks = [
    'native/FresnicaSDK.xcframework',
    'native/FresnicaSDKFFI.xcframework',
    'adapter/react-native/FresnicaRNAdapter.xcframework',
  ]

  # Verify before adapter compilation as well as at the final app build entrypoint.
  spec.script_phase = {
    :name => 'Verify pinned Fresnica SDK',
    :script => '/bin/sh "${PODS_TARGET_SRCROOT}/../../scripts/verify-native-sdk-apple.sh"',
    :execution_position => :before_compile,
  }

  spec.pod_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -ObjC',
  }
  spec.user_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -ObjC',
  }
end
