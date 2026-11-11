#!/bin/sh
set -eu
SDK_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
# Use the same local Node selection as the React Native Xcode build.
if [ -f "$SDK_ROOT/ios/.xcode.env" ]; then . "$SDK_ROOT/ios/.xcode.env"; fi
if [ -f "$SDK_ROOT/ios/.xcode.env.local" ]; then . "$SDK_ROOT/ios/.xcode.env.local"; fi
"${NODE_BINARY:-node}" "$SDK_ROOT/scripts/verify-native-sdk.mjs" apple
