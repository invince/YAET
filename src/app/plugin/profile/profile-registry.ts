import {Injectable} from '@angular/core';

export type ProfileFactory = () => any;

@Injectable({providedIn: 'root'})
export class ProfileRegistry {
  private factories = new Map<string, ProfileFactory>();

  register(profileType: string, factory: ProfileFactory): void {
    this.factories.set(profileType, factory);
  }

  create(profileType: string): any {
    const factory = this.factories.get(profileType);
    return factory ? factory() : {};
  }

  has(profileType: string): boolean {
    return this.factories.has(profileType);
  }
}
