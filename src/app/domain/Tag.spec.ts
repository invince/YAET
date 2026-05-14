import {Tag} from './Tag';

describe('Tag', () => {
  it('should create with given name', () => {
    const tag = new Tag('production');
    expect(tag.name).toBe('production');
  });

  it('should generate an id', () => {
    const tag = new Tag('test');
    expect(tag.id).toBeTruthy();
    expect(typeof tag.id).toBe('string');
  });

  it('should have unique ids for different instances', () => {
    const a = new Tag('A');
    const b = new Tag('B');
    expect(a.id).not.toBe(b.id);
  });

  it('should start with empty color', () => {
    const tag = new Tag('test');
    expect(tag.color).toBe('');
  });

  it('should allow setting color', () => {
    const tag = new Tag('test');
    tag.color = '#00ff00';
    expect(tag.color).toBe('#00ff00');
  });

  it('should allow updating name', () => {
    const tag = new Tag('old');
    tag.name = 'renamed';
    expect(tag.name).toBe('renamed');
  });
});
