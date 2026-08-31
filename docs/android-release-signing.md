# Android release signing

Production signing material is intentionally local and must never be committed to this repository.

## Keystore location

Place the production keystore at:

```text
android/app/release/fresnica-release.keystore
```

The `android/app/release` directory ignores all local files except its `.gitignore`.

## Signing credentials

Configure these values in your local `~/.gradle/gradle.properties`:

```properties
FRESNICA_RELEASE_STORE_PASSWORD=<keystore password>
FRESNICA_RELEASE_KEY_ALIAS=<key alias>
FRESNICA_RELEASE_KEY_PASSWORD=<key password>
```

The same names may be supplied as environment variables instead. Do not add the values to repository `gradle.properties`, CI logs, source files, or committed shell scripts.

## Build

From the repository root:

```text
cd android
./gradlew :app:assembleRelease
```

Release tasks fail before execution when the keystore or any required signing value is missing. Debug builds and Gradle sync do not require production signing material.

The signed APK is produced under:

```text
android/app/build/outputs/apk/release/
```
