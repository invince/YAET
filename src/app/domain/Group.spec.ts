import {Group} from './Group';

describe('Group', () => {
  it('should create with given name', () => {
    const group = new Group('Servers');
    expect(group.name).toBe('Servers');
  });

  it('should generate an id', () => {
    const group = new Group('Test');
    expect(group.id).toBeTruthy();
    expect(typeof group.id).toBe('string');
  });

  it('should have unique ids for different instances', () => {
    const a = new Group('A');
    const b = new Group('B');
    expect(a.id).not.toBe(b.id);
  });

  it('should start with empty color', () => {
    const group = new Group('Test');
    expect(group.color).toBe('');
  });

  it('should allow setting color', () => {
    const group = new Group('Test');
    group.color = '#ff0000';
    expect(group.color).toBe('#ff0000');
  });

  it('should allow updating name', () => {
    const group = new Group('Old');
    group.name = 'Updated';
    expect(group.name).toBe('Updated');
  });
});
