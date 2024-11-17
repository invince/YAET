import {animate, state, style, transition, trigger} from '@angular/animations';

export const menuAnimation = trigger('slideInOut', [
  state(
    'in',
    style({
      transform: 'translateX(0)',
    })
  ),
  state(
    'out',
    style({
      transform: 'translateX(-100%)',
    })
  ),
  transition('out => in', animate('300ms ease-in')),
  transition('in => out', animate('300ms ease-out')),
])
