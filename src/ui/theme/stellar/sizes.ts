/**
 * Stellar presentation metrics.
 *
 * Source: luneShaoGM/Stellar@stellar-migration/src/theme/sizes.ts
 *
 * Donor GetLayoutInsets() is backed by an Xaman native module. Fresnica uses
 * React Native SafeAreaView at the screen/shell boundary, so native inset
 * acquisition is deliberately not copied here. All remaining donor metrics and
 * scaling formulas are preserved.
 */
import {Dimensions, Platform, PixelRatio} from 'react-native';

const {height: physicalScreenHeight} = Dimensions.get('screen');
const {width, height} = Dimensions.get('window');

const bottomInset = 0;
const topInset = 0;

const guidelineBaseWidth = 350;
const guidelineBaseHeight = 680;
const isSmallDevice = width <= 375;
const xyFactor = width / height;
const isSquareScreen = xyFactor > 0.85;
const alternateScreenCorrectionFactor = isSquareScreen ? 2 : 1;

const tabbarHeight = Platform.select({ios: 50, android: 60, default: 0}) ?? 0;
const statusBarHeight = topInset;

const stellarSizes = {
  screen: {
    height,
    width: width / alternateScreenCorrectionFactor,
    uncorrectedWidth: width,
    screenHeight: physicalScreenHeight,
    heightHalf: height * 0.5,
    heightThird: height * 0.333,
    heightTwoThirds: height * 0.666,
    heightQuarter: height * 0.25,
    heightThreeQuarters: height * 0.75,
    widthHalf: width * 0.5,
    widthThird: width * 0.333,
    widthTwoThirds: width * 0.666,
    widthQuarter: width * 0.25,
    widthThreeQuarters: width * 0.75,
    isSmallDevice,
  },
  statusBarHeight,
  tabbarHeight,
  bottomInset,
  topInset,
  safeAreaBottomInset: 0,
  safeAreaTopInset: 0,
  padding: 30,
  paddingSml: 20,
  paddingMid: 15,
  paddingExtraSml: 10,
  paddingList: 20,
  borderRadius: 8,
  extraKeyBoardPadding: 20,
  scale: (size: number) => ((width / guidelineBaseWidth) * size) / alternateScreenCorrectionFactor,
  verticalScale: (size: number) => (height / guidelineBaseHeight) * size,
  moderateScale: (size: number, factor = 0.5) =>
    size + ((((width / guidelineBaseWidth) * size) / alternateScreenCorrectionFactor) - size) * factor,
  widthPercentageToDP: (widthPercent: number) =>
    PixelRatio.roundToNearestPixel((width * widthPercent) / 100),
  heightPercentageToDP: (heightPercent: number) =>
    PixelRatio.roundToNearestPixel((height * heightPercent) / 100),
} as const;

export default stellarSizes;
