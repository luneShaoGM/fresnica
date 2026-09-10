import {
  AppModal,
  BottomAction,
  Button,
  Card,
  Field,
  Header,
  ListRow,
  Screen,
  StateView,
} from '..';
import {defaultTheme} from '../../theme';

describe('shared UI component contracts', () => {
  it('exports the shell primitives used by feature screens', () => {
    for (const component of [AppModal, BottomAction, Button, Card, Field, Header, ListRow, Screen, StateView]) {
      expect(typeof component).toBe('function');
    }
  });

  it('provides semantic elevation metrics through AppTheme', () => {
    expect(defaultTheme.elevation.low.androidElevation).toBeLessThan(defaultTheme.elevation.medium.androidElevation);
    expect(defaultTheme.elevation.medium.androidElevation).toBeLessThan(defaultTheme.elevation.high.androidElevation);
  });
});
