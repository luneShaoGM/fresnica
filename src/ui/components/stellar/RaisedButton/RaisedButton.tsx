import React, {Component} from 'react';
import {
  Animated,
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  Platform,
  Text,
  type TextStyle,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';

import {stellarSizes} from '../../../theme/stellar';
import {StellarLoadingIndicator} from '../LoadingIndicator';
import {styles} from './styles';

type IconPosition = 'right' | 'left';

type Props = Readonly<{
  small?: boolean;
  iconPosition?: IconPosition;
  iconSize?: number;
  isDisabled?: boolean;
  containerStyle?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  disabledStyle?: TextStyle | TextStyle[];
  iconStyle?: ImageStyle | ImageStyle[];
  accessibilityLabel?: string;
  testID?: string;
  isLoading?: boolean;
  loadingIndicatorStyle?: 'light' | 'dark';
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
  /**
   * Donor RaisedButton accepts an Images registry key. The Fresnica source port
   * temporarily receives an explicit image source until the donor Icon/Images
   * registry is migrated as its own dependency.
   */
  iconSource?: ImageSourcePropType;
}>;

type State = Readonly<{
  isDisabled: boolean;
  animatedShadow: Animated.Value;
  animatedScale: Animated.Value;
}>;

/**
 * Source port: Stellar/src/components/General/RaisedButton/RaisedButton.tsx
 *
 * Preserves donor sizing, press/release animation, leading 500ms press throttle,
 * loading state and disabled presentation. Xaman's global Images/Icon registry
 * is the only presentation dependency adapted at this stage.
 */
export class StellarRaisedButton extends Component<Props, State> {
  static defaultProps = {
    small: false,
    iconPosition: 'left' as IconPosition,
    iconSize: 20,
    isDisabled: false,
  };

  private lastPressAt = 0;

  constructor(props: Props) {
    super(props);
    this.state = {
      isDisabled: props.isDisabled ?? false,
      animatedShadow: new Animated.Value(
        props.isDisabled
          ? 0
          : (Platform.select({ios: 0.1, android: 5, default: 0}) ?? 0),
      ),
      animatedScale: new Animated.Value(0),
    };
  }

  static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): Partial<State> | null {
    const isDisabled = nextProps.isDisabled ?? false;
    if (isDisabled === prevState.isDisabled) {
      return null;
    }

    return {
      isDisabled,
      animatedShadow: new Animated.Value(
        isDisabled
          ? 0
          : (Platform.select({ios: 0.1, android: 5, default: 0}) ?? 0),
      ),
    };
  }

  private getContentHeight = (): number =>
    stellarSizes.scale(this.props.small ? 35 : 50);

  private animateTiming = (
    variable: Animated.Value,
    toValue: number,
    duration = 200,
    callback?: () => void,
  ) => {
    Animated.timing(variable, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start(callback);
  };

  private animateSpring = (
    variable: Animated.Value,
    toValue: number,
    callback?: () => void,
  ) => {
    Animated.spring(variable, {
      toValue,
      tension: 100,
      friction: 6.75,
      useNativeDriver: false,
    }).start(callback);
  };

  private press = () => {
    this.props.onPress?.();
  };

  private release = () => {
    const {animatedShadow, animatedScale} = this.state;
    this.animateSpring(
      animatedShadow,
      Platform.select({ios: 0.1, android: 3, default: 0}) ?? 0,
    );
    this.animateSpring(animatedScale, 0);
  };

  private handlePress = () => {
    const now = Date.now();
    if (now - this.lastPressAt < 500) {
      return;
    }
    this.lastPressAt = now;

    const {isDisabled, isLoading} = this.props;
    if (isDisabled || isLoading) {
      return;
    }

    const {animatedShadow, animatedScale} = this.state;
    this.animateTiming(animatedScale, 1, 50);
    this.animateTiming(animatedShadow, 0, 50, () => {
      this.press();
      this.release();
    });
  };

  private renderChildren() {
    const {
      label,
      iconSource,
      iconPosition = 'left',
      textStyle,
      disabledStyle,
      iconStyle,
      iconSize = 20,
      isDisabled,
      isLoading,
      loadingIndicatorStyle,
    } = this.props;

    if (isLoading) {
      return (
        <StellarLoadingIndicator
          color={loadingIndicatorStyle ?? 'default'}
          size="small"
        />
      );
    }

    const icon = iconSource ? (
      <Image
        resizeMode="contain"
        source={iconSource}
        style={[
          {width: iconSize, height: iconSize},
          iconPosition === 'left' ? styles.iconLeft : styles.iconRight,
          iconStyle,
        ]}
      />
    ) : null;

    return (
      <View
        style={[
          styles.buttonWrapper,
          isDisabled ? styles.disabledContent : undefined,
        ]}>
        {iconPosition === 'left' ? icon : null}
        {label ? (
          <Text
            numberOfLines={1}
            style={[
              styles.textButton,
              textStyle,
              isDisabled ? disabledStyle : undefined,
            ]}>
            {label}
          </Text>
        ) : null}
        {iconPosition === 'right' ? icon : null}
      </View>
    );
  }

  render() {
    const {containerStyle, accessibilityLabel, testID, onLongPress} =
      this.props;
    const {animatedShadow, animatedScale} = this.state;

    return (
      <TouchableWithoutFeedback
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{
          disabled: this.props.isDisabled || this.props.isLoading,
        }}
        testID={testID}
        onLongPress={onLongPress}
        onPress={this.handlePress}>
        <Animated.View
          style={[
            styles.container,
            {height: this.getContentHeight()},
            containerStyle,
            {
              shadowOpacity: animatedShadow,
              elevation: animatedShadow,
              transform: [
                {
                  translateY: animatedScale.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1.5],
                  }),
                },
              ],
            },
          ]}>
          {this.renderChildren()}
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }
}
