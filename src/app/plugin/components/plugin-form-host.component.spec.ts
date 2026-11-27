import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {PluginFormHostComponent} from './plugin-form-host.component';
import {ProfileFormBase, profileFormProviders} from '../../components/forms/profile-form.base';
import {FormModelBridge} from '../../utils/model-form.bridge';

interface RequiredModel {
  host: string;
}

@Component({
  selector: 'app-required-plugin-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: profileFormProviders(() => RequiredPluginFormComponent),
  template: '',
})
class RequiredPluginFormComponent extends ProfileFormBase<RequiredModel> {
  protected override readonly bridge = new FormModelBridge<RequiredModel>([
    {form: 'host', validators: [Validators.required], defaultValue: () => ''},
  ]);

  protected override createEmptyModel(): RequiredModel {
    return {host: ''};
  }
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PluginFormHostComponent],
  template: `<app-plugin-form-host [componentType]="type" [formControl]="control"></app-plugin-form-host>`,
})
class HostComponent {
  type = RequiredPluginFormComponent;
  control = new FormControl<RequiredModel | null>({host: ''});
}

describe('PluginFormHostComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [HostComponent]});
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('propagates the inner form validity after creating the component', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.invalid).toBeTrue();
  });

  it('marks the parent control pristine when the inner value reverts', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const inner = fixture.debugElement.query(By.directive(RequiredPluginFormComponent)).componentInstance as RequiredPluginFormComponent;
    const control = fixture.componentInstance.control;
    control.markAsDirty();

    inner.form.get('host')?.setValue('changed');
    expect(control.dirty).toBeTrue();

    inner.form.get('host')?.setValue('');
    expect(control.dirty).toBeFalse();
  });
});
