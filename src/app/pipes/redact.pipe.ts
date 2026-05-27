import {Pipe, PipeTransform} from '@angular/core';

const SENSITIVE_KEYS = new Set(['id', 'profileId', 'profile_id', 'secretId', 'secret_id', 'sessionId', 'session_id']);

@Pipe({
  name: 'redact',
  standalone: true,
  pure: true
})
export class RedactPipe implements PipeTransform {

  transform<T>(value: T): T {
    if (value === null || value === undefined) return value;
    return this._redact(value);
  }

  private _redact(value: unknown): any {
    if (Array.isArray(value)) {
      return value.map(v => this._redact(v));
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key) && (typeof val === 'string' || typeof val === 'number')) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this._redact(val);
        }
      }
      return result;
    }
    return value;
  }
}
