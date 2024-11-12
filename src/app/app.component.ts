import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {SidebarComponent} from "./sidebar/sidebar.component";
import {AppModule} from './app.module';

@Component({
  selector: 'app-root',
  standalone: true,
    imports: [RouterOutlet, SidebarComponent, AppModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'myTermX';
}
