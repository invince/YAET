import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'filterKeyword',
  standalone: true,
  pure: true
})
export class FilterKeywordPipe implements PipeTransform {

  private lastItems: any = undefined;
  private lastProviders: ((item: any) => string | string[])[] | null = null;
  private lastKeyword: string = '';
  private lastResult: any[] = [];

  transform<T>(
    items: T[],
    keywordProviders: ((item: T) => string | string[])[],
    filterKeyword: string
  ): T[] {
    if (!items || !filterKeyword || !keywordProviders) {
      return items;
    }

    if (items === this.lastItems && keywordProviders === this.lastProviders && filterKeyword === this.lastKeyword) {
      return this.lastResult as T[];
    }

    this.lastItems = items;
    this.lastProviders = keywordProviders;
    this.lastKeyword = filterKeyword;

    const lowercasedKeyword = filterKeyword.toLowerCase();

    this.lastResult = items.filter(item => {
      const allKeywords = keywordProviders.flatMap(provider => {
        const result = provider(item);
        return Array.isArray(result) ? result : [result];
      });

      return allKeywords.some(keyword =>
        keyword && keyword.toLowerCase().includes(lowercasedKeyword)
      );
    });

    return this.lastResult as T[];
  }
}
