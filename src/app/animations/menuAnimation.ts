import {animate, query, stagger, state, style, transition, trigger, group} from '@angular/animations';

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
]);

export const listAnimation = trigger('listAnimation', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(-8px)' }),
      stagger(40, [
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ], { optional: true }),
    query(':leave', [
      stagger(20, [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' })),
      ]),
    ], { optional: true }),
  ]),
]);
