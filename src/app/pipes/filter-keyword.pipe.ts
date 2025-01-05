import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterKeyword',
  standalone: true
})
export class FilterKeywordPipe implements PipeTransform {

  /**
   * Transforms the array by filtering based on the keyword.
   * @param items - The list to filter.
   * @param keywordProviders - An array of functions that provide keyword (or lists of keywords) from each item.
   * @param filter - The keyword to filter by.
   * @returns Filtered list.
   */
  transform<T>(
    items: T[],
    keywordProviders: ((item: T) => string | string[])[],
    filterKeyword: string
  ): T[] {
    if (!items || !filterKeyword || !keywordProviders) {
      return items;
    }

    const lowercasedKeyword = filterKeyword.toLowerCase();

    return items.filter(item => {
      // Collect all keywords from providers
      const allKeywords = keywordProviders.flatMap(provider => {
        const result = provider(item);
        return Array.isArray(result) ? result : [result]; // Normalize to an array
      });

      // Check if any keyword matches the filter
      return allKeywords.some(keyword =>
        keyword && keyword.toLowerCase().includes(lowercasedKeyword)
      );
    });
  }
}
