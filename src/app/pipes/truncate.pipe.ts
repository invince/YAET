import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | undefined | null, limit: number = 10, suffix: string = '...'): string {
    if (!value) {
      return '';
    }
    if (value.length > limit) {
      return value.slice(0, limit) + suffix;
    }
    return value;
  }
}
