import {FormGroup} from '@angular/forms';
import {AuthType} from '../domain/Secret';

export function passwordMatchValidator(
  group: FormGroup,
  passwordField = 'password',
  confirmField = 'confirmPassword',
): { passwordMismatch: boolean } | null {
  const password = group.get(passwordField)?.value;
  const confirm = group.get(confirmField)?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

export function clearAuthFields(
  form: FormGroup,
  authType: AuthType | string | undefined,
): void {
  if (authType === AuthType.LOGIN) {
    form.get('secretId')?.setValue(null);
  } else if (authType === AuthType.SECRET) {
    form.get('password')?.setValue(null);
    form.get('confirmPassword')?.setValue(null);
  } else {
    form.get('password')?.setValue(null);
    form.get('confirmPassword')?.setValue(null);
    form.get('secretId')?.setValue(null);
  }
}


