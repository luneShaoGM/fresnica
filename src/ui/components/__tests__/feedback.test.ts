import { NativeButton } from '../NativeButton';
let mockFeedback: (() => void) | undefined;
jest.mock('react', () => ({ ...jest.requireActual('react'), useContext: () => mockFeedback }));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
it('provides one feedback event and preserves the action result', () => {
  mockFeedback = jest.fn();
  const result = { operation: 'original' };
  const onPress = jest.fn(() => result);
  const button = NativeButton({ label: 'Continue', onPress });
  expect(button.props.onPress()).toBe(result);
  expect(mockFeedback).toHaveBeenCalledTimes(1);
  expect(onPress).toHaveBeenCalledTimes(1);
});
it('keeps the original callback when feedback is disabled', () => {
  mockFeedback = undefined;
  const onPress = jest.fn();
  expect(NativeButton({ label: 'Continue', onPress }).props.onPress).toBe(onPress);
});
