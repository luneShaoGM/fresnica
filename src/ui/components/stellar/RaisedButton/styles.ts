import {StyleSheet} from 'react-native';

import {stellarColors, stellarFonts, stellarSizes} from '../../../theme/stellar';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: stellarColors.white,
    borderRadius: stellarSizes.scale(75) / 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: stellarColors.grey,
    shadowOffset: {width: 0, height: 3},
    shadowRadius: 3,
  },
  buttonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledContent: {
    opacity: 0.3,
  },
  iconLeft: {
    marginRight: 3,
  },
  iconRight: {
    marginLeft: 3,
  },
  textButton: {
    fontFamily: stellarFonts.base.familyBold,
    fontSize: stellarFonts.base.size * 1.1,
    lineHeight: stellarFonts.createLineHeight(stellarFonts.base.size * 1.1),
    includeFontPadding: true,
    paddingBottom: 1,
    textAlign: 'center',
    color: stellarColors.black,
    paddingHorizontal: 5,
  },
});
