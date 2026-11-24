import { sensitiveField } from './sensitiveFlowHarness';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn(), useLayoutEffect: jest.fn(), useCallback: jest.fn(), useImperativeHandle: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn(), useIsFocused: jest.fn() }));

it.each([false, true])('keeps visible/secure input outside React state and consumes native text synchronously (secure=%s)', secureTextEntry => {
  const changed = jest.fn();
  const field = sensitiveField({ secureTextEntry, multiline: !secureTextEntry, onTextChange: changed });
  field.type('sensitive-test-material');
  expect(field.handle.current!.read()).toBe('sensitive-test-material');
  expect(JSON.stringify(field.render())).not.toContain('sensitive-test-material');
  expect(field.h.states).toEqual([]);
  expect(field.handle.current!.consume()).toBe('sensitive-test-material');
  expect(field.native.read()).toBe('');
  expect(field.handle.current!.read()).toBe('');
  expect(changed).toHaveBeenLastCalledWith('');
  field.type('replacement-material');
  field.close();
  expect(field.native.read()).toBe('');
  expect(field.handle.current!.read()).toBe('');
});
