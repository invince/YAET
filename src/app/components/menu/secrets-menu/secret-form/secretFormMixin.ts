import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';
import {Secret, SecretType} from '../../../../domain/Secret';
import {FormGroup, Validators} from '@angular/forms';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {MatSelectChange} from '@angular/material/select';

export class SecretFormMixin {


  static generateModelForm() {
    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();
    mappings.set('name' , {name: 'name', formControlOption:  ['', [Validators.required, Validators.minLength(3)]]});
    mappings.set('secretType' , {name: 'secretType', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'login', precondition: form => [SecretType.SSH_KEY, SecretType.LOGIN_PASSWORD].includes(form.get('secretType')?.value)}  , 'login');
    mappings.set({name: 'password', precondition: form => [SecretType.PASSWORD_ONLY, SecretType.LOGIN_PASSWORD].includes(form.get('secretType')?.value) }  , 'password');
    mappings.set({name: 'password', precondition: form => false } , 'confirmPassword'); // we don't set model.password via confirmPassword control
    mappings.set({name: 'key', precondition: form => form.get('secretType')?.value  == SecretType.SSH_KEY } , 'key');
    mappings.set({name: 'passphrase', precondition: form => form.get('secretType')?.value  == SecretType.SSH_KEY } , 'passphrase');

    return  new ModelFormController<Secret>(mappings);

  }


  static passwordMatchValidator(group: FormGroup) {
    const type = group.get('secretType')?.value;
    if ([SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY].includes(type)) {
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password === confirmPassword ? null : { passwordMismatch: true };
    }
    return null;
  }

  static secretNameShouldBeUnique(secretStorageService: SecretStorageService, secret: Secret | undefined = undefined) { // NOTE: inside validatorFn, we cannot use inject thing
    return (group: FormGroup) => {
      let name = group.get("name")?.value;
      if (name && secretStorageService.data.secrets?.find(one => one.name === name && one.id !== secret?.id)) {
        return {duplicateSecret: true};
      }
      return null;
    }
  }

  static checkCurrentSecret(group: FormGroup) {
    if (!group.dirty) {
      return null;
    }

    let secretType = group.get('secretType')?.value;
    switch (secretType) {
      case SecretType.LOGIN_PASSWORD: {
        if (!group.get('login')?.value) {
          return {emptyLogin: true};
        }
        if (!group.get('password')?.value) {
          return {emptyPassword: true};
        }
        break;
      }

      case SecretType.PASSWORD_ONLY: {
        if (!group.get('password')?.value) {
          return {emptyPassword: true};
        }
        break;
      }
      case SecretType.SSH_KEY: {
        if (!group.get('login')?.value) {
          return {emptyLogin: true};
        }
        if (!group.get('key')?.value) {
          return {emptyKey: true};
        }
        break;
      }
    }
    return null;

  }

  static onSelectType(form: FormGroup, $event: MatSelectChange) {
    const selectedType = $event.value;
    // Reset the form, preserving the selected type
    form.reset({
      name: form.get('name')?.value, // Preserve name if needed
      secretType: selectedType, // Set the selected type
    });

    // Optionally clear custom errors
    form.setErrors(null);
  }

  static shouldShowField(form: FormGroup, fieldName: string) {
    let secretType = form.get('secretType')?.value;
    switch (secretType) {
      case SecretType.LOGIN_PASSWORD:
        return ['login', 'password'].includes(fieldName);
      case SecretType.PASSWORD_ONLY:
        return ['password'].includes(fieldName);
      case SecretType.SSH_KEY:
        return ['login', 'key', 'passphrase'].includes(fieldName);

    }
    return false;
  }
}
