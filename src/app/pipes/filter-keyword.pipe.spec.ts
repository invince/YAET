import {FilterKeywordPipe} from './filter-keyword.pipe';

describe('FilterKeywordPipe', () => {
  let pipe: FilterKeywordPipe;

  beforeEach(() => {
    pipe = new FilterKeywordPipe();
  });

  const items = [
    { name: 'Alpha', type: 'server' },
    { name: 'Beta', type: 'workstation' },
    { name: 'Gamma', type: 'server' },
  ];

  it('should return all items when filter is empty', () => {
    const result = pipe.transform(items, [item => item.name], '');
    expect(result).toEqual(items);
  });

  it('should return all items when filter is nullish', () => {
    const result = pipe.transform(items, [item => item.name], null as any);
    expect(result).toEqual(items);
  });

  it('should filter by single keyword provider', () => {
    const result = pipe.transform(items, [item => item.name], 'alpha');
    expect(result).toEqual([items[0]]);
  });

  it('should be case insensitive', () => {
    const result = pipe.transform(items, [item => item.name], 'ALPHA');
    expect(result).toEqual([items[0]]);
  });

  it('should match partial keywords', () => {
    const result = pipe.transform(items, [item => item.name], 'et');
    expect(result).toEqual([items[1]]);
  });

  it('should use multiple keyword providers', () => {
    const result = pipe.transform(items, [
      item => item.name,
      item => item.type
    ], 'workstation');
    expect(result).toEqual([items[1]]);
  });

  it('should match any of multiple keywords', () => {
    const result = pipe.transform(items, [
      item => item.name,
      item => item.type
    ], 'server');
    expect(result).toEqual([items[0], items[2]]);
  });

  it('should handle keyword providers returning arrays', () => {
    const multiItems = [
      { name: 'US-East', tags: ['aws', 'production'] },
      { name: 'US-West', tags: ['aws', 'staging'] },
    ];
    const result = pipe.transform(multiItems, [
      item => item.name,
      item => item.tags
    ], 'staging');
    expect(result).toEqual([multiItems[1]]);
  });

  it('should return empty array when no items match', () => {
    const result = pipe.transform(items, [item => item.name], 'zzzz');
    expect(result).toEqual([]);
  });

  it('should handle null items gracefully', () => {
    const result = pipe.transform(null as any, [(item: any) => item.name || ''], 'test');
    expect(result).toBeNull();
  });
});
