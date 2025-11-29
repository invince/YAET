import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';
import {Proxy} from '../../../../domain/Proxy';
import {FormGroup, Validators} from '@angular/forms';
import {ProxyStorageService} from '../../../../services/proxy-storage.service';
import {MatSelectChange} from '@angular/material/select';

export class ProxyFormMixin {


  static generateModelForm() {
    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();
    mappings.set('name' , {name: 'name', formControlOption:  ['', [Validators.required, Validators.minLength(3)]]});
    mappings.set('type' , {name: 'type', formControlOption:  ['', [Validators.required]]});
    mappings.set('host' , {name: 'host', formControlOption:  ['', [Validators.required]]});
    mappings.set('port' , {name: 'port', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'secretId', precondition: form => form.get('authType')?.value  == 'secret' } , 'secretId');

    return  new ModelFormController<Proxy>(mappings);

  }

  static proxyNameShouldBeUnique(proxyStorageService: ProxyStorageService, proxy: Proxy | undefined = undefined) { // NOTE: inside validatorFn, we cannot use inject thing
    return (group: FormGroup) => {
      let name = group.get("name")?.value;
      if (name && proxyStorageService.dataCopy.proxies?.find(one => one.name === name && one.id !== proxy?.id)) {
        return {duplicateProxy: true};
      }
      return null;
    }
  }
}
